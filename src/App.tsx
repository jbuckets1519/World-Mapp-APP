import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Globe } from './components/Globe';
import { getPolygonId } from './components/Globe/Globe';
import { CountryPanel } from './components/CountryPanel';
import { ZoomIndicator } from './components/ZoomIndicator';
import { useGlobeConfig } from './hooks/useGlobeConfig';
import type { GeoJsonFeature } from './types';

const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;
// States fade in at 85, fade out at 80 (hysteresis prevents flicker)
const STATE_ZOOM_ON = 85;
const STATE_ZOOM_OFF = 80;

function distanceToZoomLevel(distance: number): number {
  const clamped = Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, distance));
  const ratio = (MAX_ZOOM_DISTANCE - clamped) / (MAX_ZOOM_DISTANCE - MIN_ZOOM_DISTANCE);
  return Math.round(1 + ratio * 99);
}

export default function App() {
  const { countries, usStates, loading, error } = useGlobeConfig();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);
  const [noteText, setNoteText] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);

  const rafRef = useRef(0);
  const handleZoomChange = useCallback((distance: number) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setZoomLevel(distanceToZoomLevel(distance));
    });
  }, []);

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hysteresis toggle — states appear at 85, disappear at 80
  const [showStates, setShowStates] = useState(false);
  useEffect(() => {
    if (!showStates && zoomLevel >= STATE_ZOOM_ON) {
      setShowStates(true);
    } else if (showStates && zoomLevel < STATE_ZOOM_OFF) {
      setShowStates(false);
    }
  }, [zoomLevel, showStates]);

  // Two pre-computed stable arrays. Only the reference switches —
  // no items are ever removed from either array, no filtering.
  const countriesOnly = useMemo(() => {
    return countries.length > 0 ? countries : [];
  }, [countries]);

  const withStates = useMemo(() => {
    if (countries.length === 0) return [];
    if (usStates.length === 0) return countries;
    return [...countries, ...usStates];
  }, [countries, usStates]);

  // Switch data based on zoom. Globe's accessor functions don't change —
  // they handle both countries and states with static logic.
  const polygons = showStates ? withStates : countriesOnly;

  // Deselect state when zooming out
  useEffect(() => {
    if (!showStates && selectedFeature?._isState) {
      setSelectedId(null);
      setSelectedFeature(null);
      setNoteText('');
    }
  }, [showStates, selectedFeature]);

  const handlePolygonClick = useCallback(
    (polygon: GeoJsonFeature) => {
      const id = getPolygonId(polygon);
      if (id === selectedId) {
        setSelectedId(null);
        setSelectedFeature(null);
        setNoteText('');
      } else {
        setSelectedId(id);
        setSelectedFeature(polygon);
        setNoteText('');
      }
    },
    [selectedId],
  );

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setSelectedFeature(null);
    setNoteText('');
  }, []);

  if (error) {
    return (
      <div style={{ color: '#ff6b6b', padding: '2rem', textAlign: 'center' }}>
        Failed to load globe data: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'rgba(100, 180, 255, 0.6)',
          fontSize: '1.2rem',
        }}
      >
        Loading globe...
      </div>
    );
  }

  return (
    <>
      <Globe
        polygons={polygons}
        selectedId={selectedId}
        width={dimensions.width}
        height={dimensions.height}
        onPolygonClick={handlePolygonClick}
        onZoomChange={handleZoomChange}
      />
      <ZoomIndicator level={zoomLevel} />
      {selectedFeature && (
        <CountryPanel
          country={selectedFeature}
          text={noteText}
          onTextChange={setNoteText}
          onClose={handleClose}
        />
      )}
    </>
  );
}
