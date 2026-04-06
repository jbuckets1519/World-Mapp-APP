import { useState, useEffect, useRef, useCallback } from 'react';
import ReactGlobe, { type GlobeMethods } from 'react-globe.gl';
import type { GeoJsonFeature } from '../../types';

interface GlobeProps {
  /** Stable array containing ALL polygons (countries + states). Never changes. */
  polygons: GeoJsonFeature[];
  /** Whether state polygons should be visible (zoom >= threshold) */
  showStates: boolean;
  selectedPolygon: GeoJsonFeature | null;
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
const COUNTRY_HOVER_CAP = 'rgba(100, 180, 255, 0.35)';
const COUNTRY_HOVER_SIDE = 'rgba(100, 180, 255, 0.15)';
const COUNTRY_SELECTED_CAP = 'rgba(100, 180, 255, 0.6)';
const COUNTRY_SELECTED_SIDE = 'rgba(100, 180, 255, 0.35)';

// --- State colors (more muted) ---
const STATE_CAP = 'rgba(80, 150, 220, 0.1)';
const STATE_SIDE = 'rgba(80, 150, 220, 0.03)';
const STATE_STROKE = 'rgba(80, 150, 220, 0.25)';
const STATE_HOVER_CAP = 'rgba(80, 150, 220, 0.3)';
const STATE_HOVER_SIDE = 'rgba(80, 150, 220, 0.1)';
const STATE_SELECTED_CAP = 'rgba(80, 150, 220, 0.5)';
const STATE_SELECTED_SIDE = 'rgba(80, 150, 220, 0.25)';

// --- Hidden (fully invisible for states when below zoom threshold) ---
const TRANSPARENT = 'rgba(0,0,0,0)';

// --- Altitudes ---
const COUNTRY_ALT = 0.005;
const COUNTRY_HOVER_ALT = 0.02;
const COUNTRY_SELECTED_ALT = 0.035;
const STATE_ALT = 0.007;
const STATE_HOVER_ALT = 0.022;
const STATE_SELECTED_ALT = 0.037;

export default function Globe({
  polygons,
  showStates,
  selectedPolygon,
  width = window.innerWidth,
  height = window.innerHeight,
  onPolygonClick,
  onZoomChange,
}: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [hovered, setHovered] = useState<GeoJsonFeature | null>(null);

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

  // All accessor functions include showStates in their dependency array.
  // When showStates changes, new function refs are created, react-globe.gl
  // re-evaluates all polygons. With polygonsTransitionDuration=0 this is
  // instant and safe — no animated transition that could flash blue.

  const getCapColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isState) {
        if (!showStates) return TRANSPARENT;
        if (f === selectedPolygon) return STATE_SELECTED_CAP;
        if (f === hovered) return STATE_HOVER_CAP;
        return STATE_CAP;
      }
      if (f === selectedPolygon) return COUNTRY_SELECTED_CAP;
      if (f === hovered) return COUNTRY_HOVER_CAP;
      return COUNTRY_CAP;
    },
    [hovered, selectedPolygon, showStates],
  );

  const getSideColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isState) {
        if (!showStates) return TRANSPARENT;
        if (f === selectedPolygon) return STATE_SELECTED_SIDE;
        if (f === hovered) return STATE_HOVER_SIDE;
        return STATE_SIDE;
      }
      if (f === selectedPolygon) return COUNTRY_SELECTED_SIDE;
      if (f === hovered) return COUNTRY_HOVER_SIDE;
      return COUNTRY_SIDE;
    },
    [hovered, selectedPolygon, showStates],
  );

  const getStrokeColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isState) return showStates ? STATE_STROKE : TRANSPARENT;
      return COUNTRY_STROKE;
    },
    [showStates],
  );

  const getAltitude = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isState) {
        if (!showStates) return 0;
        if (f === selectedPolygon) return STATE_SELECTED_ALT;
        if (f === hovered) return STATE_HOVER_ALT;
        return STATE_ALT;
      }
      if (f === selectedPolygon) return COUNTRY_SELECTED_ALT;
      if (f === hovered) return COUNTRY_HOVER_ALT;
      return COUNTRY_ALT;
    },
    [hovered, selectedPolygon, showStates],
  );

  const getLabel = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      if (f._isState && !showStates) return '';
      return f.properties.NAME;
    },
    [showStates],
  );

  const handleHover = useCallback(
    (feat: object | null) => {
      const f = (feat as GeoJsonFeature) || null;
      // Ignore hover on invisible state polygons
      if (f?._isState && !showStates) {
        setHovered(null);
        return;
      }
      setHovered(f);
    },
    [showStates],
  );

  const handleClick = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      // Ignore clicks on invisible state polygons
      if (f._isState && !showStates) return;
      onPolygonClick?.(f);
    },
    [onPolygonClick, showStates],
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
      // CRITICAL: transition duration must be 0 to prevent the "solid blue"
      // flash that happens when react-globe.gl animates color changes across
      // all polygons simultaneously during hover state changes.
      polygonsTransitionDuration={0}
      onPolygonHover={handleHover}
      onPolygonClick={handleClick}
    />
  );
}
