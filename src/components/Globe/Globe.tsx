import { useState, useEffect, useRef, useCallback } from 'react';
import ReactGlobe, { type GlobeMethods } from 'react-globe.gl';
import type { GeoJsonFeature } from '../../types';

interface GlobeProps {
  /** Combined array of countries + states (caller merges based on zoom) */
  polygons: GeoJsonFeature[];
  selectedCountry: GeoJsonFeature | null;
  width?: number;
  height?: number;
  polygonAltitude?: number;
  onCountryClick?: (country: GeoJsonFeature) => void;
  onZoomChange?: (distance: number) => void;
}

const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;

// --- Country colors ---
const DEFAULT_CAP = 'rgba(100, 180, 255, 0.15)';
const DEFAULT_SIDE = 'rgba(100, 180, 255, 0.05)';
const DEFAULT_STROKE = 'rgba(100, 180, 255, 0.4)';
const HOVER_CAP = 'rgba(100, 180, 255, 0.35)';
const HOVER_SIDE = 'rgba(100, 180, 255, 0.15)';
const SELECTED_CAP = 'rgba(100, 180, 255, 0.6)';
const SELECTED_SIDE = 'rgba(100, 180, 255, 0.35)';

// --- State colors — thinner, more muted ---
const STATE_DEFAULT_CAP = 'rgba(80, 150, 220, 0.1)';
const STATE_DEFAULT_SIDE = 'rgba(80, 150, 220, 0.03)';
const STATE_DEFAULT_STROKE = 'rgba(80, 150, 220, 0.25)';
const STATE_HOVER_CAP = 'rgba(80, 150, 220, 0.3)';
const STATE_HOVER_SIDE = 'rgba(80, 150, 220, 0.1)';
const STATE_SELECTED_CAP = 'rgba(80, 150, 220, 0.5)';
const STATE_SELECTED_SIDE = 'rgba(80, 150, 220, 0.25)';

// Altitude values
const DEFAULT_ALT = 0.005;
const HOVER_ALT = 0.02;
const SELECTED_ALT = 0.035;
// States sit just above country polygons to avoid z-fighting
const STATE_DEFAULT_ALT = 0.007;
const STATE_HOVER_ALT = 0.022;
const STATE_SELECTED_ALT = 0.037;

export default function Globe({
  polygons,
  selectedCountry,
  width = window.innerWidth,
  height = window.innerHeight,
  onCountryClick,
  onZoomChange,
}: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [hoveredCountry, setHoveredCountry] = useState<GeoJsonFeature | null>(null);

  // Clear stale hover reference whenever the polygon set changes
  // (e.g. when states appear/disappear at the zoom threshold)
  useEffect(() => {
    setHoveredCountry(null);
  }, [polygons]);

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
    const handler = () => {
      const distance = globe.camera().position.length();
      onZoomChange(distance);
    };
    handler();
    controls.addEventListener('change', handler);
    return () => controls.removeEventListener('change', handler);
  }, [onZoomChange]);

  const getCapColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const isState = f._isState;
      if (f === selectedCountry) return isState ? STATE_SELECTED_CAP : SELECTED_CAP;
      if (f === hoveredCountry) return isState ? STATE_HOVER_CAP : HOVER_CAP;
      return isState ? STATE_DEFAULT_CAP : DEFAULT_CAP;
    },
    [hoveredCountry, selectedCountry],
  );

  const getSideColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const isState = f._isState;
      if (f === selectedCountry) return isState ? STATE_SELECTED_SIDE : SELECTED_SIDE;
      if (f === hoveredCountry) return isState ? STATE_HOVER_SIDE : HOVER_SIDE;
      return isState ? STATE_DEFAULT_SIDE : DEFAULT_SIDE;
    },
    [hoveredCountry, selectedCountry],
  );

  const getStrokeColor = useCallback(
    (feat: object) => {
      return (feat as GeoJsonFeature)._isState ? STATE_DEFAULT_STROKE : DEFAULT_STROKE;
    },
    [],
  );

  const getAltitude = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const isState = f._isState;
      if (f === selectedCountry) return isState ? STATE_SELECTED_ALT : SELECTED_ALT;
      if (f === hoveredCountry) return isState ? STATE_HOVER_ALT : HOVER_ALT;
      return isState ? STATE_DEFAULT_ALT : DEFAULT_ALT;
    },
    [hoveredCountry, selectedCountry],
  );

  const getLabel = useCallback(
    (feat: object) => (feat as GeoJsonFeature).properties.NAME,
    [],
  );

  const handleHover = useCallback(
    (feat: object | null) => setHoveredCountry((feat as GeoJsonFeature) || null),
    [],
  );

  const handleClick = useCallback(
    (feat: object) => {
      onCountryClick?.(feat as GeoJsonFeature);
    },
    [onCountryClick],
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
      polygonsTransitionDuration={200}
      onPolygonHover={handleHover}
      onPolygonClick={handleClick}
    />
  );
}
