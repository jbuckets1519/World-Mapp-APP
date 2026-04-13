import { memo, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import ReactGlobe, { type GlobeMethods } from 'react-globe.gl';
import type { GeoJsonFeature, CityPoint } from '../../types';
import { getPolygonId } from './getPolygonId';

export { getPolygonId };

/** Methods exposed to parent via ref */
export interface GlobeHandle {
  flyTo: (lat: number, lng: number, altitude?: number) => void;
}

interface GlobeProps {
  polygons: GeoJsonFeature[];
  cities: CityPoint[];
  selectedId: string | null;
  /** Set of polygon IDs to highlight as visited */
  visitedIds?: Set<string>;
  /** Increment this to force re-evaluation of visited colors */
  visitedVersion?: number;
  /** Current zoom level 1–100, drives city dot size/visibility */
  zoomLevel?: number;
  /** Optional color override for visited places (e.g. friend's map uses purple) */
  visitedColor?: 'orange' | 'purple';
  width?: number;
  height?: number;
  onPolygonClick?: (polygon: GeoJsonFeature) => void;
  onCityClick?: (city: CityPoint) => void;
  onZoomChange?: (distance: number) => void;
  /** Fires when clicking empty globe space (ocean, etc.) — not a polygon or city */
  onGlobeClick?: () => void;
  /** Set of polygon IDs to highlight as bucketlist (yellow) */
  bucketlistIds?: Set<string>;
  /** Increment to force re-evaluation of bucketlist colors */
  bucketlistVersion?: number;
}

const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;

// --- Country colors — slightly lighter fill so landmasses pop against the ocean ---
const COUNTRY_CAP = 'rgba(100, 180, 255, 0.22)';
const COUNTRY_SIDE = 'rgba(100, 180, 255, 0.07)';
const COUNTRY_STROKE = 'rgb(245, 235, 220)';
const COUNTRY_SELECTED_CAP = 'rgba(100, 180, 255, 0.6)';
const COUNTRY_SELECTED_SIDE = 'rgba(100, 180, 255, 0.35)';

// --- State colors — cap matches countries so USA looks the same ---
const STATE_CAP = 'rgba(100, 180, 255, 0.22)';
const STATE_SIDE = 'rgba(100, 180, 255, 0.07)';
const STATE_STROKE = 'rgba(245, 235, 220, 0.45)';
const STATE_SELECTED_CAP = 'rgba(255, 230, 130, 0.25)';
const STATE_SELECTED_SIDE = 'rgba(255, 230, 130, 0.1)';

// --- Visited colors (warm gold) ---
const VISITED_CAP = 'rgba(255, 195, 50, 0.35)';
const VISITED_SIDE = 'rgba(255, 195, 50, 0.15)';
const VISITED_STROKE = 'rgba(255, 195, 50, 0.5)';

// --- Purple visited colors (used when viewing a friend's map) ---
const PURPLE_VISITED_CAP = 'rgba(180, 130, 255, 0.35)';
const PURPLE_VISITED_SIDE = 'rgba(180, 130, 255, 0.15)';
const PURPLE_VISITED_STROKE = 'rgba(180, 130, 255, 0.5)';

// --- Bucketlist colors (soft coral) ---
const BUCKET_CAP = 'rgba(255, 130, 110, 0.2)';
const BUCKET_SIDE = 'rgba(255, 130, 110, 0.08)';
const BUCKET_STROKE = 'rgba(255, 130, 110, 0.35)';
const BUCKET_ALT = 0.007;
// --- City dot colors ---
// Default: soft white to stay neutral against the blue globe
const CITY_COLOR = 'rgba(220, 220, 230, 1)';
// Visited: green to differentiate from orange visited-countries
const CITY_VISITED_COLOR = 'rgba(80, 200, 120, 1)';
// Selected: bright cyan matching the UI accent
const CITY_SELECTED_COLOR = 'rgba(100, 220, 255, 1)';

// --- Lake colors — fully opaque to match the ocean surface exactly ---
const LAKE_CAP = 'rgba(0, 3, 13, 1)';
const LAKE_SIDE = 'rgba(0, 3, 13, 1)';

// --- Altitudes ---
const COUNTRY_ALT = 0.005;
const STATE_ALT = 0.006;
const VISITED_ALT = 0.008;
// Lakes render well above country/state fills so they fully obscure borders beneath
const LAKE_ALT = 0.01;
const COUNTRY_SELECTED_ALT = 0.035;
const STATE_SELECTED_ALT = 0.037;



const GlobeComponent = forwardRef<GlobeHandle, GlobeProps>(function Globe({
  polygons,
  cities,
  selectedId,
  visitedIds,
  visitedVersion = 0,
  zoomLevel = 1,
  visitedColor = 'orange',
  width = window.innerWidth,
  height = window.innerHeight,
  onPolygonClick,
  onCityClick,
  onZoomChange,
  onGlobeClick,
  bucketlistIds,
  bucketlistVersion = 0,
}, ref) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lng: number, altitude = 1.5) {
      globeRef.current?.pointOfView({ lat, lng, altitude }, 1000);
    },
  }));

  // Store visitedIds in a ref so accessor functions can read it
  // without needing it as a dependency (avoids accessor recreation)
  const visitedRef = useRef(visitedIds);
  visitedRef.current = visitedIds;
  const bucketRef = useRef(bucketlistIds);
  bucketRef.current = bucketlistIds;

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.minDistance = MIN_ZOOM_DISTANCE;
    controls.maxDistance = MAX_ZOOM_DISTANCE;
    controls.zoomSpeed = 0.8;
    controls.rotateSpeed = 0.8;
    controls.enablePan = false;
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !onZoomChange) return;
    const controls = globe.controls();
    const handler = () => onZoomChange(globe.camera().position.length());
    handler();
    controls.addEventListener('change', handler);
    return () => controls.removeEventListener('change', handler);
  }, [onZoomChange]);

  // Accessor functions only depend on selectedId (changes on click, rare).
  // No showStates dependency = no accessor changes when zooming.

  // Pick visited colors based on whose map we're viewing
  const isPurple = visitedColor === 'purple';

  const getCapColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isLake) return LAKE_CAP;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_CAP : COUNTRY_SELECTED_CAP;
      if (visitedRef.current?.has(id)) return isPurple ? PURPLE_VISITED_CAP : VISITED_CAP;
      if (bucketRef.current?.has(id)) return BUCKET_CAP;
      return f._isState ? STATE_CAP : COUNTRY_CAP;
    },
    [selectedId, visitedVersion, isPurple, bucketlistVersion],
  );

  const getSideColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isLake) return LAKE_SIDE;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_SIDE : COUNTRY_SELECTED_SIDE;
      if (visitedRef.current?.has(id)) return isPurple ? PURPLE_VISITED_SIDE : VISITED_SIDE;
      if (bucketRef.current?.has(id)) return BUCKET_SIDE;
      return f._isState ? STATE_SIDE : COUNTRY_SIDE;
    },
    [selectedId, visitedVersion, isPurple, bucketlistVersion],
  );

  const getStrokeColor = useCallback((feat: object) => {
    const f = feat as GeoJsonFeature;
    if (f._isLake) return 'rgba(0, 0, 0, 0)';
    const id = getPolygonId(f);
    if (visitedRef.current?.has(id)) return isPurple ? PURPLE_VISITED_STROKE : VISITED_STROKE;
    if (bucketRef.current?.has(id)) return BUCKET_STROKE;
    return f._isState ? STATE_STROKE : COUNTRY_STROKE;
  }, [visitedVersion, isPurple, bucketlistVersion]);

  const getAltitude = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isLake) return LAKE_ALT;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_ALT : COUNTRY_SELECTED_ALT;
      if (visitedRef.current?.has(id)) return VISITED_ALT;
      if (bucketRef.current?.has(id)) return BUCKET_ALT;
      return f._isState ? STATE_ALT : COUNTRY_ALT;
    },
    [selectedId, visitedVersion, bucketlistVersion],
  );

  // Lakes get no label or click handling
  const getLabel = useCallback((feat: object) => {
    const f = feat as GeoJsonFeature;
    if (f._isLake) return '';
    return f.properties.NAME;
  }, []);

  const handleClick = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isLake) return;
      onPolygonClick?.(f);
    },
    [onPolygonClick],
  );

  // --- City HTML dot accessors ---
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;

  // Track city elements so we can hide back-facing ones each frame
  const cityElMapRef = useRef(new Map<string, { el: HTMLDivElement; lat: number; lng: number }>());

  // Build the HTML element for each city dot
  const getCityElement = useCallback(
    (d: object) => {
      const city = d as CityPoint;
      const z = zoomRef.current;
      // Smooth size scaling up to zoom 70, then capped
      const capped = Math.min(z, 70);
      const t = capped / 100;
      // Convert globe-unit radius to pixel size
      const baseRadius = 0.03 + t * t * 0.19;
      const rankBonus = Math.max(0, (5 - city.scaleRank) * 0.01);
      const isSelected = city.id === selectedId;
      const radius = isSelected ? baseRadius + rankBonus + 0.12 : baseRadius + rankBonus;
      // Map globe radius to px (roughly 40px per globe unit looks right)
      const sizePx = Math.max(3, Math.round(radius * 40));

      // Color logic: selected = cyan, visited = green, default = white
      let color = CITY_COLOR;
      if (isSelected) color = CITY_SELECTED_COLOR;
      else if (visitedRef.current?.has(city.id)) color = CITY_VISITED_COLOR;

      const el = document.createElement('div');
      el.style.width = `${sizePx}px`;
      el.style.height = `${sizePx}px`;
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.style.cursor = 'pointer';
      el.style.pointerEvents = 'auto';
      // Smooth fade for horizon culling — prevents flicker at the edge
      el.style.transition = 'opacity 120ms ease-out';
      // Tooltip on hover
      el.title = `${city.name}, ${city.country}`;
      // Click handler
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onCityClick?.(city);
      });
      // Register for back-face culling
      cityElMapRef.current.set(city.id, { el, lat: city.lat, lng: city.lng });
      return el;
    },
    [selectedId, zoomLevel, visitedVersion, onCityClick],
  );

  // Hide city dots on the far side of the globe each frame
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    let rafId: number;
    let skip = false;
    const DEG2RAD = Math.PI / 180;
    const cull = () => {
      // Only cull on every other frame (~30fps) — city dots don't need
      // 60fps visibility updates and this halves the math every second.
      skip = !skip;
      if (skip) {
        rafId = requestAnimationFrame(cull);
        return;
      }
      const cam = globe.camera().position;
      // Camera direction as unit vector
      const camLen = Math.sqrt(cam.x * cam.x + cam.y * cam.y + cam.z * cam.z);
      const cx = cam.x / camLen;
      const cy = cam.y / camLen;
      const cz = cam.z / camLen;
      // Fade thresholds: dots fully visible above FADE_IN, fully hidden
      // below FADE_OUT, and smoothly interpolated in between. This
      // eliminates the hard-cutoff flicker near the globe's horizon.
      const FADE_OUT = 0.30; // fully transparent (well behind the edge)
      const FADE_IN = 0.55;  // fully opaque (comfortably facing the camera)
      const range = FADE_IN - FADE_OUT;
      cityElMapRef.current.forEach(({ el, lat, lng }) => {
        // Convert lat/lng to unit vector (globe.gl uses y-up, z-forward)
        const latR = lat * DEG2RAD;
        const lngR = lng * DEG2RAD;
        const cosLat = Math.cos(latR);
        const px = cosLat * Math.sin(lngR);
        const py = Math.sin(latR);
        const pz = cosLat * Math.cos(lngR);
        const dot = px * cx + py * cy + pz * cz;
        if (dot <= FADE_OUT) {
          el.style.display = 'none';
          el.style.opacity = '0';
        } else {
          el.style.display = '';
          // Smooth fade from 0→1 across the transition band
          const t = Math.min(1, (dot - FADE_OUT) / range);
          el.style.opacity = t >= 1 ? '1' : t.toFixed(2);
        }
      });
      rafId = requestAnimationFrame(cull);
    };
    rafId = requestAnimationFrame(cull);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <ReactGlobe
      ref={globeRef}
      width={width}
      height={height}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      backgroundColor="rgba(0,0,0,0)"
      showAtmosphere={true}
      atmosphereColor="rgba(140, 140, 255, 0.3)"
      atmosphereAltitude={0.25}
      polygonsData={polygons}
      polygonCapColor={getCapColor}
      polygonSideColor={getSideColor}
      polygonStrokeColor={getStrokeColor}
      polygonLabel={getLabel}
      polygonAltitude={getAltitude}
      polygonsTransitionDuration={300}
      onPolygonClick={handleClick}
      onGlobeClick={onGlobeClick}
      htmlElementsData={cities}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.011}
      htmlElement={getCityElement}
      htmlTransitionDuration={300}
    />
  );
});

// memo avoids re-running the Globe wrapper when unrelated App state updates
// push new renders down from the parent. All props are already stable
// callbacks / memoized data structures, so shallow compare works correctly.
export default memo(GlobeComponent);
