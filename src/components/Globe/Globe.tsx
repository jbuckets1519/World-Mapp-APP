import { useEffect, useRef, useCallback } from 'react';
import ReactGlobe, { type GlobeMethods } from 'react-globe.gl';
import type { GeoJsonFeature } from '../../types';

interface GlobeProps {
  polygons: GeoJsonFeature[];
  selectedId: string | null;
  width?: number;
  height?: number;
  onPolygonClick?: (polygon: GeoJsonFeature) => void;
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

// --- Altitudes ---
const COUNTRY_ALT = 0.005;
const COUNTRY_SELECTED_ALT = 0.035;
const STATE_ALT = 0.006;
const STATE_SELECTED_ALT = 0.037;

export function getPolygonId(f: GeoJsonFeature): string {
  const prefix = f._isState ? 'state' : 'country';
  return `${prefix}:${f.properties.NAME}`;
}


export default function Globe({
  polygons,
  selectedId,
  width = window.innerWidth,
  height = window.innerHeight,
  onPolygonClick,
  onZoomChange,
}: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

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

  const getCapColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_CAP : COUNTRY_SELECTED_CAP;
      return f._isState ? STATE_CAP : COUNTRY_CAP;
    },
    [selectedId],
  );

  const getSideColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_SIDE : COUNTRY_SELECTED_SIDE;
      return f._isState ? STATE_SIDE : COUNTRY_SIDE;
    },
    [selectedId],
  );

  const getStrokeColor = useCallback((feat: object) => {
    return (feat as GeoJsonFeature)._isState ? STATE_STROKE : COUNTRY_STROKE;
  }, []);

  const getAltitude = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);
      if (id === selectedId) return f._isState ? STATE_SELECTED_ALT : COUNTRY_SELECTED_ALT;
      return f._isState ? STATE_ALT : COUNTRY_ALT;
    },
    [selectedId],
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
    />
  );
}
