import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { GeoJsonFeature, CityPoint } from '../../types';
import { getPolygonId } from '../Globe/Globe';

/** A single search result that could be a city, country, or state */
interface SearchResult {
  id: string;
  label: string;
  subtitle: string;
  type: 'city' | 'country' | 'state';
  lat: number;
  lng: number;
  // Original data for selection callbacks
  city?: CityPoint;
  polygon?: GeoJsonFeature;
}

interface SearchBarProps {
  cities: CityPoint[];
  polygons: GeoJsonFeature[];
  onSelectCity: (city: CityPoint) => void;
  onSelectPolygon: (polygon: GeoJsonFeature) => void;
  /** Fly the globe camera to a location */
  onFlyTo: (lat: number, lng: number) => void;
}

/** Rough centroid of a polygon by averaging all coordinates */
function getPolygonCentroid(feature: GeoJsonFeature): { lat: number; lng: number } {
  const coords = feature.geometry.coordinates;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  // Flatten all rings/polygons to get coordinate pairs
  const flatten = (arr: unknown[]): void => {
    if (typeof arr[0] === 'number') {
      // This is a [lng, lat] pair
      sumLng += arr[0] as number;
      sumLat += arr[1] as number;
      count++;
    } else {
      for (const item of arr) {
        flatten(item as unknown[]);
      }
    }
  };

  flatten(coords as unknown[]);
  return count > 0
    ? { lat: sumLat / count, lng: sumLng / count }
    : { lat: 0, lng: 0 };
}

export default function SearchBar({
  cities,
  polygons,
  onSelectCity,
  onSelectPolygon,
  onFlyTo,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build a flat searchable index from cities + polygons
  const allResults = useMemo((): SearchResult[] => {
    const results: SearchResult[] = [];

    for (const city of cities) {
      results.push({
        id: city.id,
        label: city.name,
        subtitle: city.country,
        type: 'city',
        lat: city.lat,
        lng: city.lng,
        city,
      });
    }

    for (const poly of polygons) {
      const id = getPolygonId(poly);
      const centroid = getPolygonCentroid(poly);
      const isState = Boolean(poly._isState);
      results.push({
        id,
        label: poly.properties.NAME,
        subtitle: isState ? 'State / Province' : 'Country',
        type: isState ? 'state' : 'country',
        lat: centroid.lat,
        lng: centroid.lng,
        polygon: poly,
      });
    }

    return results;
  }, [cities, polygons]);

  // Filter results based on query
  const filtered = useMemo((): SearchResult[] => {
    if (query.length < 2) return [];
    const lower = query.toLowerCase();
    const matches = allResults.filter(
      (r) =>
        r.label.toLowerCase().includes(lower) ||
        r.subtitle.toLowerCase().includes(lower),
    );
    // Sort: exact start matches first, then by label length (shorter = more relevant)
    matches.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(lower) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(lower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.label.length - b.label.length;
    });
    return matches.slice(0, 8);
  }, [query, allResults]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      // Fly camera to the location
      onFlyTo(result.lat, result.lng);

      // Select the item
      if (result.city) {
        onSelectCity(result.city);
      } else if (result.polygon) {
        onSelectPolygon(result.polygon);
      }

      // Close search
      setQuery('');
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onFlyTo, onSelectCity, onSelectPolygon],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[highlightIndex]) {
        e.preventDefault();
        selectResult(filtered[highlightIndex]);
      } else if (e.key === 'Escape') {
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    [filtered, highlightIndex, selectResult],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown = isOpen && filtered.length > 0;

  return (
    <div ref={containerRef} style={styles.container}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search cities, countries, states..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        style={styles.input}
      />

      {showDropdown && (
        <div style={styles.dropdown}>
          {filtered.map((result, i) => (
            <button
              key={result.id}
              style={{
                ...styles.resultItem,
                ...(i === highlightIndex ? styles.resultItemHighlight : {}),
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              onClick={() => selectResult(result)}
            >
              <span style={styles.resultIcon}>
                {result.type === 'city' ? '\u2022' : result.type === 'state' ? '\u25A1' : '\u25CB'}
              </span>
              <div>
                <div style={styles.resultLabel}>{result.label}</div>
                <div style={styles.resultSubtitle}>{result.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '320px',
    maxWidth: 'calc(100vw - 2rem)',
    zIndex: 20,
  },
  input: {
    width: '100%',
    padding: '0.6rem 1rem',
    background: 'rgba(15, 15, 25, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.25)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  dropdown: {
    marginTop: '4px',
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.2)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    width: '100%',
    padding: '0.55rem 0.85rem',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  resultItemHighlight: {
    background: 'rgba(100, 180, 255, 0.12)',
  },
  resultIcon: {
    fontSize: '0.7rem',
    color: 'rgba(100, 180, 255, 0.6)',
    flexShrink: 0,
    width: '1rem',
    textAlign: 'center' as const,
  },
  resultLabel: {
    fontWeight: 500,
    lineHeight: 1.3,
  },
  resultSubtitle: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 1.3,
  },
};
