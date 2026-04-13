import type { GeoJsonFeature } from '../../types';

// Lives in its own module (not Globe.tsx) so callers can import it without
// pulling react-globe.gl into the main bundle. Globe.tsx re-imports from here.
export function getPolygonId(f: GeoJsonFeature): string {
  const prefix = f._isState ? 'state' : 'country';
  return `${prefix}:${f.properties.NAME}`;
}
