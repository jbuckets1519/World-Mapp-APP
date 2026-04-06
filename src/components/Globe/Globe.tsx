import { useState, useEffect, useRef, useCallback } from 'react';
import ReactGlobe, { type GlobeMethods } from 'react-globe.gl';
import type { GeoJsonFeature } from '../../types';

interface GlobeProps {
  /** Stable array containing ALL polygons (countries + states). Never changes. */
  polygons: GeoJsonFeature[];
  /** Whether state polygons should be visible (zoom >= threshold) */
  showStates: boolean;
  /** ID of the currently selected polygon (or null) */
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

/**
 * Stable unique ID for each polygon. Uses NAME + a state/country prefix
 * to avoid collisions (e.g. "Georgia" the country vs "Georgia" the state).
 */
export function getPolygonId(f: GeoJsonFeature): string {
  const prefix = f._isState ? 'state' : 'country';
  return `${prefix}:${f.properties.NAME}`;
}

export default function Globe({
  polygons,
  showStates,
  selectedId,
  width = window.innerWidth,
  height = window.innerHeight,
  onPolygonClick,
  onZoomChange,
}: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // === DEBUG: Log cap color decisions when hoveredId is set (bug trigger) ===
  const debugColorRef = useRef(false);

  const getCapColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);
      let color: string;
      if (f._isState) {
        if (!showStates) { color = TRANSPARENT; }
        else if (id === selectedId) { color = STATE_SELECTED_CAP; }
        else if (id === hoveredId) { color = STATE_HOVER_CAP; }
        else { color = STATE_CAP; }
      } else {
        if (id === selectedId) { color = COUNTRY_SELECTED_CAP; }
        else if (id === hoveredId) { color = COUNTRY_HOVER_CAP; }
        else { color = COUNTRY_CAP; }
      }

      // Log once per hover change when showStates is true
      if (debugColorRef.current && showStates) {
        console.log(`getCapColor: id="${id}" _isState=${f._isState} hoveredId="${hoveredId}" -> ${color}`);
      }
      return color;
    },
    [hoveredId, selectedId, showStates],
  );

  // Flip debug logging on for one render cycle after hover changes
  useEffect(() => {
    if (showStates && hoveredId !== null) {
      debugColorRef.current = true;
      // Turn off after a tick so we only log one batch
      const timer = setTimeout(() => { debugColorRef.current = false; }, 50);
      return () => clearTimeout(timer);
    }
  }, [hoveredId, showStates]);

  const getSideColor = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);
      if (f._isState) {
        if (!showStates) return TRANSPARENT;
        if (id === selectedId) return STATE_SELECTED_SIDE;
        if (id === hoveredId) return STATE_HOVER_SIDE;
        return STATE_SIDE;
      }
      if (id === selectedId) return COUNTRY_SELECTED_SIDE;
      if (id === hoveredId) return COUNTRY_HOVER_SIDE;
      return COUNTRY_SIDE;
    },
    [hoveredId, selectedId, showStates],
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
      const id = getPolygonId(f);
      if (f._isState) {
        if (!showStates) return 0;
        if (id === selectedId) return STATE_SELECTED_ALT;
        if (id === hoveredId) return STATE_HOVER_ALT;
        return STATE_ALT;
      }
      if (id === selectedId) return COUNTRY_SELECTED_ALT;
      if (id === hoveredId) return COUNTRY_HOVER_ALT;
      return COUNTRY_ALT;
    },
    [hoveredId, selectedId, showStates],
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
      if (!feat) {
        if (showStates) console.log('handleHover: null (mouse left polygon)');
        setHoveredId(null);
        return;
      }
      const f = feat as GeoJsonFeature;
      const id = getPolygonId(f);

      // === DEBUG: Log every hover event when states are visible ===
      if (showStates) {
        console.log(`handleHover: name="${f.properties.NAME}" _isState=${f._isState} id="${id}" showStates=${showStates}`, f.properties);
      }

      // Ignore hover on invisible state polygons
      if (f._isState && !showStates) {
        setHoveredId(null);
        return;
      }
      setHoveredId(id);
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
      polygonsTransitionDuration={0}
      onPolygonHover={handleHover}
      onPolygonClick={handleClick}
    />
  );
}
