import { useState, useEffect } from 'react';
import type { GeoJsonFeature, GeoJsonData } from '../types';

// Country boundaries — Natural Earth 110m
const COUNTRIES_URL =
  'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

// Subdivision boundaries (states, provinces, territories)
const SUBDIVISION_SOURCES = [
  {
    url: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
    nameKey: 'name',
    // Filter out non-state territories; fix Virginia's MultiPolygon raycasting bug
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
    url: 'https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json',
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
 * Fetches country boundaries + subdivision boundaries for supported countries.
 * Subdivisions are optional — if any fail, the globe still works.
 */
export function useGlobeConfig() {
  const [countries, setCountries] = useState<GeoJsonFeature[]>([]);
  const [subdivisions, setSubdivisions] = useState<GeoJsonFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Countries are required
    fetch(COUNTRIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch countries: ${res.status}`);
        return res.json() as Promise<GeoJsonData>;
      })
      .then((data) => {
        setCountries(data.features);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    // Subdivisions are optional — each source loads independently
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
        .catch(() => {
          // This source failed — continue without it
        })
        .finally(() => {
          pending--;
          if (pending === 0) {
            setSubdivisions([...allSubdivisions]);
          }
        });
    });
  }, []);

  return { countries, subdivisions, loading, error };
}
