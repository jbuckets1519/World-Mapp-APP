import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import ReactGlobe, { type GlobeMethods } from 'react-globe.gl';
import type { GeoJsonFeature, CityPoint } from '../../types';

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
}

const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;

// --- Country colors ---
const COUNTRY_CAP = 'rgba(100, 180, 255, 0.15)';
const COUNTRY_SIDE = 'rgba(100, 180, 255, 0.05)';
const COUNTRY_STROKE = 'rgba(100, 180, 255, 0.4)';
const COUNTRY_SELECTED_CAP = 'rgba(100, 180, 255, 0.6)';
const COUNTRY_SELECTED_SIDE = 'rgba(100, 180, 255, 0.35)';

// --- State colors — cap matches countries so USA looks the same ---
const STATE_CAP = 'rgba(100, 180, 255, 0.15)';
const STATE_SIDE = 'rgba(100, 180, 255, 0.05)';
const STATE_STROKE = 'rgba(255, 230, 130, 0.15)';
const STATE_SELECTED_CAP = 'rgba(255, 230, 130, 0.25)';
const STATE_SELECTED_SIDE = 'rgba(255, 230, 130, 0.1)';

// --- Visited colors (warm orange) ---
const VISITED_CAP = 'rgba(255, 160, 50, 0.35)';
const VISITED_SIDE = 'rgba(255, 160, 50, 0.15)';
const VISITED_STROKE = 'rgba(255, 160, 50, 0.5)';

// --- Purple visited colors (used when viewing a friend's map) ---
const PURPLE_VISITED_CAP = 'rgba(180, 130, 255, 0.35)';
const PURPLE_VISITED_SIDE = 'rgba(180, 130, 255, 0.15)';
const PURPLE_VISITED_STROKE = 'rgba(180, 130, 255, 0.5)';
// --- City dot colors ---
// Default: soft white to stay neutral against the blue globe
const CITY_COLOR = 'rgba(220, 220, 230, 0.6)';
// Visited: green to differentiate from orange visited-countries
const CITY_VISITED_COLOR = 'rgba(80, 200, 120, 0.9)';
// Selected: bright cyan matching the UI accent
const CITY_SELECTED_COLOR = 'rgba(100, 220, 255, 1)';

// --- Altitudes ---
const COUNTRY_ALT = 0.005;
const COUNTRY_SELECTED_ALT = 0.035;
const VISITED_ALT = 0.008;
const STATE_ALT = 0.006;
const STATE_SELECTED_ALT = 0.037;

export function getPolygonId(f: GeoJsonFeature): string {
  const prefix = f._isState ? 'state' : 'country';
  return `${prefix}:${f.properties.NAME}`;
}


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
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_CAP : COUNTRY_SELECTED_CAP;
      if (visitedRef.current?.has(id)) return isPurple ? PURPLE_VISITED_CAP : VISITED_CAP;
      return f._isState ? STATE_CAP : COUNTRY_CAP;
    },
    [selectedId, visitedVersion, isPurple],
  );

  const getSideColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_SIDE : COUNTRY_SELECTED_SIDE;
      if (visitedRef.current?.has(id)) return isPurple ? PURPLE_VISITED_SIDE : VISITED_SIDE;
      return f._isState ? STATE_SIDE : COUNTRY_SIDE;
    },
    [selectedId, visitedVersion, isPurple],
  );

  const getStrokeColor = useCallback((feat: object) => {
    const f = feat as GeoJsonFeature;
    const id = getPolygonId(f);
    if (visitedRef.current?.has(id)) return isPurple ? PURPLE_VISITED_STROKE : VISITED_STROKE;
    return f._isState ? STATE_STROKE : COUNTRY_STROKE;
  }, [visitedVersion, isPurple]);

  const getAltitude = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_ALT : COUNTRY_SELECTED_ALT;
      if (visitedRef.current?.has(id)) return VISITED_ALT;
      return f._isState ? STATE_ALT : COUNTRY_ALT;
    },
    [selectedId, visitedVersion],
  );

  const getLabel = useCallback((feat: object) => {
    return (feat as GeoJsonFeature).properties.NAME;
  }, []);

  const handleClick = useCallback(
    (feat: object) => {
      onPolygonClick?.(feat as GeoJsonFeature);
    },
    [onPolygonClick],
  );

  // --- City point accessors ---
  // Scale dot size with zoom: tiny at low zoom, more visible zoomed in
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;

  const getCityRadius = useCallback(
    (pt: object) => {
      const city = pt as CityPoint;
      const z = zoomRef.current;
      // Base size scales from 0.08 at zoom 1 to 0.35 at zoom 100
      const base = 0.08 + (z / 100) * 0.27;
      // Capitals and megacities get a slight bump
      const bonus = city.isCapital || city.population > 10_000_000 ? 0.04 : 0;
      // Selected city is extra prominent
      if (city.id === selectedId) return base + bonus + 0.15;
      return base + bonus;
    },
    [selectedId, zoomLevel],
  );

  const getCityColor = useCallback(
    (pt: object) => {
      const city = pt as CityPoint;
      if (city.id === selectedId) return CITY_SELECTED_COLOR;
      // Visited cities are always green regardless of whose map
      if (visitedRef.current?.has(city.id)) return CITY_VISITED_COLOR;
      return CITY_COLOR;
    },
    [selectedId, visitedVersion],
  );

  const getCityLabel = useCallback((pt: object) => {
    const city = pt as CityPoint;
    return `<b>${city.name}</b><br/><span style="color:rgba(255,255,255,0.6)">${city.country}</span>`;
  }, []);

  const getCityAltitude = useCallback(
    (pt: object) => {
      const city = pt as CityPoint;
      // Lift selected city slightly above polygons
      return city.id === selectedId ? 0.04 : 0.01;
    },
    [selectedId],
  );

  const handleCityClick = useCallback(
    (pt: object) => {
      onCityClick?.(pt as CityPoint);
    },
    [onCityClick],
  );

  return (
    <ReactGlobe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      showAtmosphere={true}
      atmosphereColor="rgba(100, 180, 255, 0.3)"
      atmosphereAltitude={0.25}
      polygonsData={polygons}
      polygonCapColor={getCapColor}
      polygonSideColor={getSideColor}
      polygonStrokeColor={getStrokeColor}
      polygonLabel={getLabel}
      polygonAltitude={getAltitude}
      polygonsTransitionDuration={300}
      onPolygonClick={handleClick}
      pointsData={cities}
      pointLat="lat"
      pointLng="lng"
      pointColor={getCityColor}
      pointRadius={getCityRadius}
      pointAltitude={getCityAltitude}
      pointLabel={getCityLabel}
      pointResolution={12}
      pointsMerge={false}
      pointsTransitionDuration={300}
      onPointClick={handleCityClick}
    />
  );
});

export default GlobeComponent;
