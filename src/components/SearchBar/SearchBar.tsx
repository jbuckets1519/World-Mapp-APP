import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { GeoJsonFeature, CityPoint } from '../../types';
import { getPolygonId } from '../Globe/getPolygonId';
import { isUNMember } from '../../data/un-members';
import { PailIcon } from '../Bucketlist';

/** A single search result that could be a city, country, or state */
interface SearchResult {
  id: string;
  label: string;
  subtitle: string;
  type: 'city' | 'country' | 'territory' | 'state';
  lat: number;
  lng: number;
  city?: CityPoint;
  polygon?: GeoJsonFeature;
}

interface SearchBarProps {
  cities: CityPoint[];
  polygons: GeoJsonFeature[];
  onSelectCity: (city: CityPoint) => void;
  onSelectPolygon: (polygon: GeoJsonFeature) => void;
  onFlyTo: (lat: number, lng: number) => void;
  /** Bucketlist integration */
  isInBucketlist?: (placeId: string) => boolean;
  onAddToBucketlist?: (placeType: string, placeId: string, placeName: string) => void;
  onRemoveFromBucketlist?: (placeId: string) => void;
}

/** Rough centroid of a polygon by averaging all coordinates */
function getPolygonCentroid(feature: GeoJsonFeature): { lat: number; lng: number } {
  const coords = feature.geometry.coordinates;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  const flatten = (arr: unknown[]): void => {
    if (typeof arr[0] === 'number') {
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
  isInBucketlist,
  onAddToBucketlist,
  onRemoveFromBucketlist,
  onFlyTo,
}: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build searchable index from cities + polygons
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
      const name = poly.properties.NAME as string;
      const isTerritory = !isState && !isUNMember(name);
      results.push({
        id,
        label: name,
        subtitle: isState ? 'State / Province' : isTerritory ? 'Territory' : 'Country',
        type: isState ? 'state' : isTerritory ? 'territory' : 'country',
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
    matches.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(lower) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(lower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.label.length - b.label.length;
    });
    return matches.slice(0, 8);
  }, [query, allResults]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  // Focus the input when expanding
  useEffect(() => {
    if (expanded) {
      // Small delay so the input is rendered before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [expanded]);

  const collapse = useCallback(() => {
    setExpanded(false);
    setQuery('');
    setDropdownOpen(false);
  }, []);

  const selectResult = useCallback(
    (result: SearchResult) => {
      onFlyTo(result.lat, result.lng);
      if (result.city) {
        onSelectCity(result.city);
      } else if (result.polygon) {
        onSelectPolygon(result.polygon);
      }
      collapse();
    },
    [onFlyTo, onSelectCity, onSelectPolygon, collapse],
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
        collapse();
      }
    },
    [filtered, highlightIndex, selectResult, collapse],
  );

  // Close when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        collapse();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, collapse]);

  const showDropdown = dropdownOpen && filtered.length > 0;

  // --- Collapsed: just the magnifying glass icon ---
  if (!expanded) {
    return (
      <button
        className="btn-press"
        style={styles.iconBtn}
        onClick={() => setExpanded(true)}
        aria-label="Search"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(100, 180, 255, 0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </button>
    );
  }

  // --- Expanded: input + dropdown ---
  return (
    <div ref={containerRef} style={styles.container}>
      <div style={styles.inputRow}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(100, 180, 255, 0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search cities, countries, states..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDropdownOpen(true);
          }}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />
        <button className="btn-press" style={styles.closeBtn} onClick={collapse} aria-label="Close search">
          ✕
        </button>
      </div>

      {showDropdown && (
        <div style={styles.dropdown}>
          {filtered.map((result, i) => {
            const inBucket = isInBucketlist?.(result.id) ?? false;
            return (
              <div
                key={result.id}
                style={{
                  ...styles.resultItem,
                  ...(i === highlightIndex ? styles.resultItemHighlight : {}),
                }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <button style={styles.resultClickArea} onClick={() => selectResult(result)}>
                  <span style={styles.resultIcon}>
                    {result.type === 'city' ? '\u2022' : result.type === 'state' ? '\u25A1' : '\u25CB'}
                  </span>
                  <div>
                    <div style={styles.resultLabel}>{result.label}</div>
                    <div style={styles.resultSubtitle}>{result.subtitle}</div>
                  </div>
                </button>
                {onAddToBucketlist && result.type !== 'city' && (
                  <button
                    style={{
                      ...styles.bucketBtn,
                      ...(inBucket ? styles.bucketBtnActive : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (inBucket) onRemoveFromBucketlist?.(result.id);
                      else onAddToBucketlist(result.type, result.id, result.label);
                    }}
                    title={inBucket ? 'Remove from bucketlist' : 'Add to bucketlist'}
                  >
                    <PailIcon size={14} filled={inBucket}
                      color={inBucket ? 'rgba(255, 130, 110, 0.9)' : 'rgba(255, 130, 110, 0.35)'} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Collapsed icon button — positioned at the top-left corner (where the
  // zoom indicator previously lived).
  iconBtn: {
    position: 'fixed',
    top: 'calc(1rem + env(safe-area-inset-top, 0px))',
    left: '1rem',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(16, 18, 28, 0.55)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '999px',
    cursor: 'pointer',
    zIndex: 20,
  },
  // Expanded container — same top-left position, z-index above city dot HTML elements
  container: {
    position: 'fixed',
    top: 'calc(1rem + env(safe-area-inset-top, 0px))',
    left: '1rem',
    width: '300px',
    maxWidth: 'calc(100vw - 2rem)',
    zIndex: 1000,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.55rem 0.9rem',
    background: 'rgba(16, 18, 28, 0.62)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '999px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    outline: 'none',
    padding: 0,
    minWidth: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: '0 0.15rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  dropdown: {
    marginTop: '6px',
    background: 'rgba(16, 18, 28, 0.62)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '18px',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
    transformOrigin: 'top center',
    animation: 'fadeScaleIn 0.18s ease-out',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '0 0.85rem 0 0',
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.85rem',
  },
  resultClickArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flex: 1,
    padding: '0.65rem 0.5rem 0.65rem 0.95rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left' as const,
    minWidth: 0,
  },
  resultItemHighlight: {
    background: 'rgba(100, 180, 255, 0.12)',
  },
  bucketBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.2rem',
    flexShrink: 0,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  bucketBtnActive: {},
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
