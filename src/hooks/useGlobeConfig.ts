import { useState, useEffect } from 'react';
import type { GeoJsonFeature, GeoJsonData, CityPoint } from '../types';

// 110m countries — lightweight geometry for major countries
const COUNTRIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// 50m countries — only used to extract small islands missing from 110m
const COUNTRIES_50M_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

// 110m lakes — ~25 most significant lakes (Great Lakes, Caspian Sea, etc.)
const LAKES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_lakes.geojson';

// 10m populated places — ~7,300 cities with SCALERANK for tiering
const CITIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';

// Subdivision boundaries (states, provinces, territories)
const SUBDIVISION_SOURCES = [
  {
    url: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
    nameKey: 'name',
    filter: (name: string) => name !== 'Puerto Rico',
    fixGeometry: (name: string, feat: GeoJsonFeature) => {
      if (name === 'Virginia' && feat.geometry.type === 'MultiPolygon') {
        const coords = feat.geometry.coordinates as number[][][][];
        let largestIdx = 0;
        let largestLen = 0;
        coords.forEach((poly, i) => {
          const len = poly[0]?.length ?? 0;
          if (len > largestLen) { largestLen = len; largestIdx = i; }
        });
        return { type: 'Polygon' as const, coordinates: coords[largestIdx] };
      }
      return null;
    },
  },
  {
    url: 'https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoLow.json',
    nameKey: 'name',
    filter: () => true,
    fixGeometry: () => null,
  },
  {
    url: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
    nameKey: 'name',
    filter: () => true,
    fixGeometry: () => null,
  },
];

/**
 * Normalize a GeoJSON feature into a subdivision with _isState flag and NAME property.
 */
function normalizeSubdivision(
  feat: GeoJsonFeature,
  nameKey: string,
  filterFn: (name: string) => boolean,
  fixFn: (name: string, feat: GeoJsonFeature) => { type: string; coordinates: unknown } | null,
): GeoJsonFeature | null {
  const name = (feat.properties[nameKey] as string) ?? feat.properties.NAME ?? 'Unknown';
  if (!filterFn(name)) return null;

  const result = {
    ...feat,
    _isState: true as const,
    properties: { ...feat.properties, NAME: name },
  };

  const fixedGeom = fixFn(name, feat);
  if (fixedGeom) {
    result.geometry = fixedGeom as GeoJsonFeature['geometry'];
  }

  return result;
}

/**
 * Parse a Natural Earth populated places GeoJSON feature into a CityPoint.
 */
function parseCityFeature(feat: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }): CityPoint | null {
  const props = feat.properties;
  const name = (props.name ?? props.NAME ?? props.nameascii ?? '') as string;
  if (!name) return null;

  const country = (props.adm0name ?? props.ADM0NAME ?? '') as string;
  const scaleRank = (props.scalerank ?? props.SCALERANK ?? 10) as number;
  const population = (props.pop_max ?? props.POP_MAX ?? 0) as number;
  const featureClass = ((props.featurecla ?? props.FEATURECLA ?? '') as string).toLowerCase();
  const isCapital = featureClass.includes('capital');

  // Coordinates from GeoJSON geometry [lng, lat]
  const lng = feat.geometry.coordinates[0];
  const lat = feat.geometry.coordinates[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  return {
    id: `city:${name}`,
    name,
    country,
    lat,
    lng,
    population,
    isCapital,
    scaleRank,
  };
}

/**
 * Fetches country boundaries, subdivision boundaries, and populated places.
 */
export function useGlobeConfig() {
  const [countries, setCountries] = useState<GeoJsonFeature[]>([]);
  const [subdivisions, setSubdivisions] = useState<GeoJsonFeature[]>([]);
  const [lakes, setLakes] = useState<GeoJsonFeature[]>([]);
  const [cities, setCities] = useState<CityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // --- Countries (required): 110m base + 50m islands ---
    // Load both datasets, merge missing islands from 50m into 110m
    Promise.all([
      fetch(COUNTRIES_URL).then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch 110m countries: ${res.status}`);
        return res.json() as Promise<GeoJsonData>;
      }),
      fetch(COUNTRIES_50M_URL).then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<GeoJsonData>;
      }).catch(() => null),
    ])
      .then(([data110m, data50m]) => {
        if (cancelled) return;
        const base = data110m.features;

        if (data50m) {
          // Find country names in 110m so we can identify what's missing
          const names110m = new Set(base.map((f) => f.properties.NAME as string));
          // Add any 50m countries not present in 110m (small islands)
          const islands = data50m.features.filter(
            (f) => !names110m.has(f.properties.NAME as string),
          );
          console.log(`[GlobeConfig] added ${islands.length} island nations from 50m`);
          setCountries([...base, ...islands]);
        } else {
          setCountries(base);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    // --- Subdivisions (optional) ---
    const allSubdivisions: GeoJsonFeature[] = [];
    let pending = SUBDIVISION_SOURCES.length;

    SUBDIVISION_SOURCES.forEach((source) => {
      fetch(source.url)
        .then((res) => {
          if (!res.ok) return null;
          return res.json() as Promise<GeoJsonData>;
        })
        .then((data) => {
          if (data) {
            const normalized = data.features
              .map((f) => normalizeSubdivision(f, source.nameKey, source.filter, source.fixGeometry))
              .filter((f): f is GeoJsonFeature => f !== null);
            allSubdivisions.push(...normalized);
          }
        })
        .catch(() => {})
        .finally(() => {
          pending--;
          if (pending === 0 && !cancelled) {
            setSubdivisions([...allSubdivisions]);
          }
        });
    });

    // --- Lakes (optional — purely visual) ---
    fetch(LAKES_URL)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<GeoJsonData>;
      })
      .then((data) => {
        if (!data || cancelled) return;
        const lakeFeatures = data.features.map((f) => ({
          ...f,
          _isLake: true as const,
          properties: { ...f.properties, NAME: (f.properties.name ?? f.properties.NAME ?? 'Lake') as string },
        }));
        setLakes(lakeFeatures);
        console.log(`[GlobeConfig] loaded ${lakeFeatures.length} lakes`);
      })
      .catch((err) => {
        console.error('[GlobeConfig] lakes load ERROR:', err.message);
      });

    // --- Populated places (optional — globe works without them) ---
    fetch(CITIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch cities: ${res.status}`);
        return res.json();
      })
      .then((data: { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: number[] } }> }) => {
        if (cancelled) return;
        const parsed = data.features
          .map(parseCityFeature)
          .filter((c): c is CityPoint => c !== null);

        // Deduplicate by id — keep the one with better (lower) scaleRank
        const seen = new Map<string, CityPoint>();
        for (const city of parsed) {
          const existing = seen.get(city.id);
          if (!existing || city.scaleRank < existing.scaleRank) {
            seen.set(city.id, city);
          }
        }

        // Keep top 300 cities by population
        const all = [...seen.values()];
        all.sort((a, b) => b.population - a.population);
        const filtered = all.slice(0, 300);
        // Re-sort by scaleRank for tiering
        filtered.sort((a, b) => a.scaleRank - b.scaleRank);

        console.log(`[GlobeConfig] loaded ${filtered.length} cities (top 300 by population) from Natural Earth 10m`);
        setCities(filtered);
      })
      .catch((err) => {
        console.error('[GlobeConfig] cities load ERROR:', err.message);
      });

    return () => { cancelled = true; };
  }, []);

  return { countries, subdivisions, lakes, cities, loading, error };
}
