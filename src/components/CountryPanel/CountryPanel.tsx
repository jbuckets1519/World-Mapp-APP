import { useState, useEffect, useRef } from 'react';
import type { GeoJsonFeature, CityPoint } from '../../types';
import type { VisitedPlace } from '../../hooks/useTravelData';

interface CountryPanelProps {
  /** GeoJSON feature for country/state, OR null when a city is selected */
  country: GeoJsonFeature | null;
  /** City data when a city dot is selected */
  city: CityPoint | null;
  visitedData: VisitedPlace | undefined;
  isLoggedIn: boolean;
  onMarkVisited: (notes: string) => Promise<boolean>;
  onRemoveVisited: () => void;
  onNotesChange: (notes: string) => Promise<boolean>;
  onClose: () => void;
  photoCount: number;
  onOpenGallery: () => void;
}

export default function CountryPanel({
  country,
  city,
  visitedData,
  isLoggedIn,
  onMarkVisited,
  onRemoveVisited,
  onNotesChange,
  onClose,
  photoCount,
  onOpenGallery,
}: CountryPanelProps) {
  // Derive display name from whichever selection is active
  const displayName = city ? city.name : country?.properties.NAME ?? '';
  const subtitle = city ? city.country : null;

  const isVisited = Boolean(visitedData);
  const [notes, setNotes] = useState(visitedData?.notes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Log what data the panel receives when it opens or data changes
  useEffect(() => {
    console.log('[CountryPanel] opened/updated —', displayName, {
      isVisited,
      visitedData,
      notesFromDB: visitedData?.notes ?? '(none)',
    });
    setNotes(visitedData?.notes ?? '');
    setSaveStatus('idle');
  }, [visitedData, displayName, isVisited]);

  const handleMarkVisited = async () => {
    console.log('[CountryPanel] Mark as visited clicked —', displayName);
    const ok = await onMarkVisited(notesRef.current);
    console.log('[CountryPanel] markVisited result:', ok ? 'SUCCESS' : 'FAILED');
  };

  const handleRemoveVisited = () => {
    console.log('[CountryPanel] Remove visited clicked —', displayName);
    onRemoveVisited();
  };

  const handleSaveNotes = async () => {
    const currentNotes = notesRef.current;
    console.log('[CountryPanel] Save notes clicked —', displayName, {
      notes: currentNotes,
      isVisited,
    });
    setSaveStatus('saving');

    let ok: boolean;
    if (isVisited) {
      // Place already exists in DB — update the notes column
      ok = await onNotesChange(currentNotes);
    } else {
      // Place not yet visited — mark as visited with these notes
      ok = await onMarkVisited(currentNotes);
    }

    console.log('[CountryPanel] Save result:', ok ? 'SUCCESS' : 'FAILED');
    if (ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.name}>{displayName}</h2>
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      {isLoggedIn ? (
        <>
          {/* Visited toggle */}
          <button
            style={{
              ...styles.visitedBtn,
              ...(isVisited ? styles.visitedBtnActive : {}),
            }}
            onClick={isVisited ? handleRemoveVisited : handleMarkVisited}
          >
            {isVisited ? '✓ Visited' : 'Mark as visited'}
          </button>

          {/* Notes textarea */}
          <textarea
            style={styles.textarea}
            placeholder="Add notes about this place..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Save button — shows real success/failure from Supabase */}
          <button
            style={{
              ...styles.saveBtn,
              ...(saveStatus === 'saved' ? styles.saveBtnSaved : {}),
              ...(saveStatus === 'error' ? styles.saveBtnError : {}),
            }}
            onClick={handleSaveNotes}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'saved'
                ? 'Saved!'
                : saveStatus === 'error'
                  ? 'Save failed — check console'
                  : 'Save Notes'}
          </button>

          {/* Photo gallery trigger */}
          <button
            style={styles.galleryBtn}
            onClick={onOpenGallery}
          >
            Photo Gallery{photoCount > 0 ? ` (${photoCount})` : ''}
          </button>
        </>
      ) : (
        <p style={styles.loginHint}>Log in to save visited places and notes</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    width: '320px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 3rem)',
    overflowY: 'auto' as const,
    background: 'rgba(15, 15, 25, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.2)',
    borderRadius: '12px',
    padding: '1.25rem',
    zIndex: 10,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  name: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'rgba(255, 255, 255, 0.5)',
    margin: '0.15rem 0 0 0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
    lineHeight: 1,
  },
  visitedBtn: {
    width: '100%',
    padding: '0.6rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.2)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: '0.75rem',
  },
  visitedBtnActive: {
    background: 'rgba(255, 160, 50, 0.15)',
    borderColor: 'rgba(255, 160, 50, 0.4)',
    color: 'rgba(255, 160, 50, 0.9)',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    padding: '0.75rem',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: '0.5rem',
  },
  saveBtn: {
    width: '100%',
    padding: '0.5rem',
    background: 'rgba(100, 180, 255, 0.12)',
    border: '1px solid rgba(100, 180, 255, 0.25)',
    borderRadius: '8px',
    color: 'rgba(100, 180, 255, 0.8)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtnSaved: {
    background: 'rgba(80, 200, 120, 0.15)',
    borderColor: 'rgba(80, 200, 120, 0.35)',
    color: 'rgba(80, 200, 120, 0.9)',
  },
  saveBtnError: {
    background: 'rgba(255, 80, 80, 0.15)',
    borderColor: 'rgba(255, 80, 80, 0.35)',
    color: 'rgba(255, 80, 80, 0.9)',
  },
  galleryBtn: {
    width: '100%',
    padding: '0.55rem',
    marginTop: '0.5rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(100, 180, 255, 0.2)',
    borderRadius: '8px',
    color: 'rgba(100, 180, 255, 0.7)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  loginHint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.8rem',
    textAlign: 'center',
    margin: 0,
  },
};
