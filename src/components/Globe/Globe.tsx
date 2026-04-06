import { useState, useEffect, useRef, useCallback } from 'react';
import ReactGlobe, { type GlobeMethods } from 'react-globe.gl';
import type { GeoJsonFeature } from '../../types';

interface GlobeProps {
  /** Stable array of ALL polygons (countries + states). Never changes after load. */
  polygons: GeoJsonFeature[];
  /** Whether US state polygons should be visible */
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

// --- Fully invisible (for hidden states) ---
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

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

  // Store showStates in a ref so accessor callbacks always read the latest
  // value without needing to be recreated (which triggers globe re-evaluation)
  const showStatesRef = useRef(showStates);
  showStatesRef.current = showStates;

  const selectedRef = useRef(selectedPolygon);
  selectedRef.current = selectedPolygon;

  const hoveredRef = useRef(hovered);
  hoveredRef.current = hovered;

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

  // Force the globe to re-evaluate polygon colors when visibility/selection changes.
  // We do this imperatively rather than swapping callback references, which avoids
  // react-globe.gl's problematic transition/re-render behavior.
  // Force the globe to re-evaluate polygon colors when visibility/selection changes.
  // We do this imperatively rather than swapping callback references, which avoids
  // react-globe.gl's problematic transition/re-render behavior.
  // The imperative API methods exist at runtime but aren't in the type defs.
  const globeInstance = globeRef.current;
  useEffect(() => {
    if (!globeInstance) return;
    const gl = globeInstance as unknown as Record<string, (fn: unknown) => void>;
    gl.polygonCapColor(getCapColor);
    gl.polygonSideColor(getSideColor);
    gl.polygonStrokeColor(getStrokeColor);
    gl.polygonAltitude(getAltitude);
  }, [showStates, selectedPolygon, hovered, globeInstance]);

  // --- Accessor functions ---
  // These use refs so the function identity is STABLE (created once).
  // react-globe.gl won't see a new function reference on every render,
  // which prevents it from triggering full polygon transitions.

  function getCapColor(feat: object): string {
    const f = feat as GeoJsonFeature;
    if (f._isState && !showStatesRef.current) return TRANSPARENT;
    if (f._isState) {
      if (f === selectedRef.current) return STATE_SELECTED_CAP;
      if (f === hoveredRef.current) return STATE_HOVER_CAP;
      return STATE_CAP;
    }
    if (f === selectedRef.current) return COUNTRY_SELECTED_CAP;
    if (f === hoveredRef.current) return COUNTRY_HOVER_CAP;
    return COUNTRY_CAP;
  }

  function getSideColor(feat: object): string {
    const f = feat as GeoJsonFeature;
    if (f._isState && !showStatesRef.current) return TRANSPARENT;
    if (f._isState) {
      if (f === selectedRef.current) return STATE_SELECTED_SIDE;
      if (f === hoveredRef.current) return STATE_HOVER_SIDE;
      return STATE_SIDE;
    }
    if (f === selectedRef.current) return COUNTRY_SELECTED_SIDE;
    if (f === hoveredRef.current) return COUNTRY_HOVER_SIDE;
    return COUNTRY_SIDE;
  }

  function getStrokeColor(feat: object): string {
    const f = feat as GeoJsonFeature;
    if (f._isState && !showStatesRef.current) return TRANSPARENT;
    return f._isState ? STATE_STROKE : COUNTRY_STROKE;
  }

  function getAltitude(feat: object): number {
    const f = feat as GeoJsonFeature;
    // Hidden states sit flat at 0 so they don't interfere with raycasting
    if (f._isState && !showStatesRef.current) return 0;
    if (f._isState) {
      if (f === selectedRef.current) return STATE_SELECTED_ALT;
      if (f === hoveredRef.current) return STATE_HOVER_ALT;
      return STATE_ALT;
    }
    if (f === selectedRef.current) return COUNTRY_SELECTED_ALT;
    if (f === hoveredRef.current) return COUNTRY_HOVER_ALT;
    return COUNTRY_ALT;
  }

  const getLabel = useCallback((feat: object): string => {
    const f = feat as GeoJsonFeature;
    // Don't show tooltip for hidden states
    if (f._isState && !showStatesRef.current) return '';
    return f.properties.NAME;
  }, []);

  const handleHover = useCallback((feat: object | null) => {
    const f = (feat as GeoJsonFeature) || null;
    // Ignore hover on hidden state polygons
    if (f && f._isState && !showStatesRef.current) {
      setHovered(null);
      return;
    }
    setHovered(f);
  }, []);

  const handleClick = useCallback(
    (feat: object) => {
      const f = feat as GeoJsonFeature;
      // Ignore clicks on hidden state polygons
      if (f._isState && !showStatesRef.current) return;
      onPolygonClick?.(f);
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
      // No transition — prevents the "solid blue flash" bug entirely
      polygonsTransitionDuration={0}
      onPolygonHover={handleHover}
      onPolygonClick={handleClick}
    />
  );
}
