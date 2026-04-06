import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Globe } from './components/Globe';
import { CountryPanel } from './components/CountryPanel';
import { ZoomIndicator } from './components/ZoomIndicator';
import { useGlobeConfig } from './hooks/useGlobeConfig';
import type { GeoJsonFeature } from './types';

// Map camera distance to a 1–100 zoom scale (closer = higher number)
const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;
// Zoom level at which US states become visible (replaces the USA country polygon)
const STATE_ZOOM_THRESHOLD = 85;

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

  const showStates = zoomLevel >= STATE_ZOOM_THRESHOLD;

  // When zoomed in enough, swap the USA country polygon for individual state polygons
  const polygons = useMemo(() => {
    if (!showStates || usStates.length === 0) return countries;
    // Remove the USA feature from the countries list and add states instead
    const withoutUSA = countries.filter(
      (f) => f.properties.ISO_A2 !== 'US' && f.properties.NAME !== 'United States of America',
    );
    return [...withoutUSA, ...usStates];
  }, [countries, usStates, showStates]);

  // If the user had the USA selected and we switch to state view, deselect
  // (they can now click individual states instead)
  const prevShowStatesRef = useRef(showStates);
  useEffect(() => {
    if (showStates !== prevShowStatesRef.current) {
      prevShowStatesRef.current = showStates;
      if (selectedCountry) {
        const isUSA =
          selectedCountry.properties.ISO_A2 === 'US' ||
          selectedCountry.properties.NAME === 'United States of America';
        const isState = selectedCountry._isState;
        // Deselect if we crossed the threshold with a USA/state selection
        if ((showStates && isUSA) || (!showStates && isState)) {
          setSelectedCountry(null);
          setNoteText('');
        }
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
