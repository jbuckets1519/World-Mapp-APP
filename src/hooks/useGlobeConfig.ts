import { useState, useEffect } from 'react';
import type { GeoJsonFeature, GeoJsonData } from '../types';

// Low-res Natural Earth GeoJSON — lightweight country boundaries
const COUNTRIES_URL =
  'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

// US state boundaries — all 50 states + DC
const US_STATES_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

/**
 * Fetches country + US state GeoJSON data and provides globe visual config.
 * Keeps the Globe component free of data-fetching logic.
 */
export function useGlobeConfig() {
  const [countries, setCountries] = useState<GeoJsonFeature[]>([]);
  const [usStates, setUsStates] = useState<GeoJsonFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Countries are required — if this fails, show an error
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

    // States are optional — if this fails, globe still works without them
    fetch(US_STATES_URL)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<GeoJsonData>;
      })
      .then((data) => {
        if (!data) return;
        const normalizedStates = data.features.map((feat) => ({
          ...feat,
          _isState: true as const,
          properties: {
            ...feat.properties,
            NAME: (feat.properties.name as string) ?? feat.properties.NAME,
          },
        }));
        setUsStates(normalizedStates);
      })
      .catch(() => {
        // States failed — globe works fine without them
      });
  }, []);

  // Visual config for country polygons
  const polygonConfig = {
    capColor: () => 'rgba(100, 180, 255, 0.15)',
    sideColor: () => 'rgba(100, 180, 255, 0.05)',
    strokeColor: () => 'rgba(100, 180, 255, 0.4)',
    label: (feat: GeoJsonFeature) => feat.properties.NAME,
    altitude: 0.005,
  };

  return { countries, usStates, loading, error, polygonConfig };
}
