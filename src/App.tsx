import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Globe } from './components/Globe';
import { CountryPanel } from './components/CountryPanel';
import { ZoomIndicator } from './components/ZoomIndicator';
import { useGlobeConfig } from './hooks/useGlobeConfig';
import type { GeoJsonFeature } from './types';

// Map camera distance to a 1–100 zoom scale (closer = higher number)
const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;
// Hysteresis thresholds to prevent oscillation at the boundary.
// States appear at 85, but don't disappear until zoom drops below 80.
const STATE_ZOOM_ON = 85;
const STATE_ZOOM_OFF = 80;

function distanceToZoomLevel(distance: number): number {
  const clamped = Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, distance));
  const ratio = (MAX_ZOOM_DISTANCE - clamped) / (MAX_ZOOM_DISTANCE - MIN_ZOOM_DISTANCE);
  return Math.round(1 + ratio * 99);
}

export default function App() {
  const { countries, usStates, loading, error } = useGlobeConfig();

  const [selectedCountry, setSelectedCountry] = useState<GeoJsonFeature | null>(null);
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

  // Hysteresis: once states are shown, keep them until zoom drops well below the threshold.
  // This prevents the polygon array from thrashing back and forth at the boundary.
  const [showStates, setShowStates] = useState(false);
  useEffect(() => {
    if (!showStates && zoomLevel >= STATE_ZOOM_ON) {
      setShowStates(true);
    } else if (showStates && zoomLevel < STATE_ZOOM_OFF) {
      setShowStates(false);
    }
  }, [zoomLevel, showStates]);

  // All countries are ALWAYS visible. When zoomed in, states are layered on top.
  // No countries are ever filtered out or hidden.
  const polygons = useMemo(() => {
    if (!showStates || usStates.length === 0) return countries;
    return [...countries, ...usStates];
  }, [countries, usStates, showStates]);

  // Deselect states when zooming out past the threshold
  const prevShowStatesRef = useRef(showStates);
  useEffect(() => {
    if (showStates !== prevShowStatesRef.current) {
      prevShowStatesRef.current = showStates;
      if (!showStates && selectedCountry?._isState) {
        setSelectedCountry(null);
        setNoteText('');
      }
    }
  }, [showStates, selectedCountry]);

  const handleCountryClick = useCallback(
    (country: GeoJsonFeature) => {
      if (country === selectedCountry) {
        setSelectedCountry(null);
        setNoteText('');
      } else {
        setSelectedCountry(country);
        setNoteText('');
      }
    },
    [selectedCountry],
  );

  const handleClose = useCallback(() => {
    setSelectedCountry(null);
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
        selectedCountry={selectedCountry}
        width={dimensions.width}
        height={dimensions.height}
        onCountryClick={handleCountryClick}
        onZoomChange={handleZoomChange}
      />
      <ZoomIndicator level={zoomLevel} />
      {selectedCountry && (
        <CountryPanel
          country={selectedCountry}
          text={noteText}
          onTextChange={setNoteText}
          onClose={handleClose}
        />
      )}
    </>
  );
}
