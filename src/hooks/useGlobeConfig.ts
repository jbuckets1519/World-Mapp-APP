import { useState, useEffect } from 'react';
import type { GeoJsonFeature } from '../types';

// Country boundaries — Natural Earth 110m via vasturiano's CDN mirror
const COUNTRIES_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Fallback country URL in case jsdelivr is down
const COUNTRIES_URL_FALLBACK =
  'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

// US state boundaries
const US_STATES_URL =
  'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// Fallback state URL
const US_STATES_URL_FALLBACK =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

/**
 * Fetch with a fallback URL if the primary fails.
 */
async function fetchWithFallback(primaryUrl: string, fallbackUrl: string): Promise<Response> {
  try {
    const res = await fetch(primaryUrl);
    if (res.ok) return res;
  } catch {
    // Primary failed, try fallback
  }
  return fetch(fallbackUrl);
}

/**
 * Convert TopoJSON (from us-atlas/world-atlas) to GeoJSON features.
 * These CDN packages use TopoJSON format, not raw GeoJSON.
 */
async function loadTopoJsonFeatures(
  url: string,
  fallbackUrl: string,
  objectKey?: string,
): Promise<GeoJsonFeature[]> {
  const res = await fetchWithFallback(url, fallbackUrl);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();

  // If it's already GeoJSON (FeatureCollection), return directly
  if (data.type === 'FeatureCollection') {
    return data.features as GeoJsonFeature[];
  }

  // It's TopoJSON — convert manually (avoids adding topojson-client dependency)
  // TopoJSON structure: { type: "Topology", objects: { [key]: { geometries } }, arcs }
  if (data.type === 'Topology') {
    const { topojsonFeature } = await import('./topoJsonHelper');
    const key = objectKey || Object.keys(data.objects)[0];
    return topojsonFeature(data, key);
  }

  throw new Error('Unknown data format');
}

/**
 * Fetches country + US state GeoJSON data.
 * Countries must load for the globe to work. States are optional —
 * if they fail, the globe still renders without state boundaries.
 */
export function useGlobeConfig() {
  const [countries, setCountries] = useState<GeoJsonFeature[]>([]);
  const [usStates, setUsStates] = useState<GeoJsonFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Countries are required — if this fails, show an error
    const loadCountries = loadTopoJsonFeatures(
      COUNTRIES_URL,
      COUNTRIES_URL_FALLBACK,
      'countries',
    );

    // States are optional — if this fails, globe works without them
    const loadStates = loadTopoJsonFeatures(
      US_STATES_URL,
      US_STATES_URL_FALLBACK,
      'states',
    ).catch(() => [] as GeoJsonFeature[]);

    Promise.all([loadCountries, loadStates])
      .then(([countryFeatures, stateFeatures]) => {
        if (cancelled) return;

        // Normalize country features — world-atlas uses `name` or `properties.name`
        const normalizedCountries = countryFeatures.map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            NAME: f.properties.NAME || (f.properties.name as string) || 'Unknown',
          },
        }));
        setCountries(normalizedCountries);

        // Normalize and tag state features
        const normalizedStates = stateFeatures.map((f) => ({
          ...f,
          _isState: true as const,
          properties: {
            ...f.properties,
            NAME: f.properties.NAME || (f.properties.name as string) || 'Unknown',
          },
        }));
        setUsStates(normalizedStates);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { countries, usStates, loading, error };
}
