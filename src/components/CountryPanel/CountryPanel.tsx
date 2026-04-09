import { useState, useEffect, useRef } from 'react';
import type { GeoJsonFeature, CityPoint } from '../../types';
import type { VisitedPlace, VisitDates } from '../../hooks/useTravelData';
import CalendarPicker, { formatDateDisplay } from './CalendarPicker';

interface CountryPanelProps {
  country: GeoJsonFeature | null;
  city: CityPoint | null;
  visitedData: VisitedPlace | undefined;
  isLoggedIn: boolean;
  onMarkVisited: (notes: string, dates?: VisitDates) => Promise<boolean>;
  onRemoveVisited: () => void;
  onNotesChange: (notes: string) => Promise<boolean>;
  onUpdateDates: (dates: VisitDates) => Promise<boolean>;
  onClose: () => void;
  photoCount: number;
  onOpenGallery: () => void;
  friendViewMode?: boolean;
  friendName?: string | null;
}

/** Build a display string from stored visit dates */
function formatVisitDates(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) {
    if (start === end) return formatDateDisplay(start);
    return `${formatDateDisplay(start)} — ${formatDateDisplay(end)}`;
  }
  return formatDateDisplay(start ?? end!);
}

export default function CountryPanel({
  country,
  city,
  visitedData,
  isLoggedIn,
  onMarkVisited,
  onRemoveVisited,
  onNotesChange,
  onUpdateDates,
  onClose,
  photoCount,
  onOpenGallery,
  friendViewMode = false,
  friendName,
}: CountryPanelProps) {
  const displayName = city ? city.name : country?.properties.NAME ?? '';
  const subtitle = city ? city.country : null;

  const isVisited = Boolean(visitedData?.is_visited);
  const hasData = Boolean(visitedData);

  const [notes, setNotes] = useState(visitedData?.notes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Date state for "mark as visited" flow (new places)
  const [showNewDatePicker, setShowNewDatePicker] = useState(false);
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');

  // Date state for editing existing places
  const [showEditDates, setShowEditDates] = useState(false);
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [dateSaveStatus, setDateSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync state when selection or data changes
  useEffect(() => {
    setNotes(visitedData?.notes ?? '');
    setSaveStatus('idle');
    setShowNewDatePicker(false);
    setShowEditDates(false);
    setDateSaveStatus('idle');
    setNewFrom('');
    setNewTo('');
    setEditFrom(visitedData?.visit_start_date ?? '');
    setEditTo(visitedData?.visit_end_date ?? '');
  }, [visitedData, displayName]);

  // --- "Mark as visited" flow ---
  const handleMarkVisitedClick = () => {
    if (hasData) {
      // Row already exists (was unvisited) — just flip the flag
      onMarkVisited(visitedData!.notes);
    } else {
      setShowNewDatePicker(true);
    }
  };

  const handleConfirmNewDate = async () => {
    const dates: VisitDates | undefined =
      (newFrom || newTo) ? { startDate: newFrom || null, endDate: newTo || null } : undefined;
    const ok = await onMarkVisited(notesRef.current, dates);
    if (ok) setShowNewDatePicker(false);
  };

  const handleSkipNewDate = async () => {
    const ok = await onMarkVisited(notesRef.current);
    if (ok) setShowNewDatePicker(false);
  };

  // --- Save dates on existing place ---
  const handleSaveEditDates = async () => {
    setDateSaveStatus('saving');
    const ok = await onUpdateDates({ startDate: editFrom || null, endDate: editTo || null });
    setDateSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setDateSaveStatus('idle'), 1500);
  };

  const handleSaveNotes = async () => {
    const currentNotes = notesRef.current;
    setSaveStatus('saving');
    let ok: boolean;
    if (visitedData) {
      ok = await onNotesChange(currentNotes);
    } else {
      ok = await onMarkVisited(currentNotes);
    }
    if (ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // --- Friend view mode ---
  if (friendViewMode) {
    const friendDateDisplay = visitedData
      ? formatVisitDates(visitedData.visit_start_date, visitedData.visit_end_date)
      : null;

    return (
      <div style={{ ...styles.panel, borderColor: 'rgba(180, 130, 255, 0.25)' }}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.name}>{displayName}</h2>
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        <div style={styles.friendBadge}>
          <span style={styles.friendDot} />
          {friendName}'s map
        </div>

        {isVisited ? (
          <>
            <div style={styles.friendVisitedTag}>✓ {friendName} visited this place</div>
            {friendDateDisplay && <div style={styles.dateDisplay}>{friendDateDisplay}</div>}
            {visitedData?.notes && (
              <div style={styles.friendNotesBox}>
                <div style={styles.friendNotesLabel}>Notes</div>
                <p style={styles.friendNotesText}>{visitedData.notes}</p>
              </div>
            )}
            <button style={styles.friendGalleryBtn} onClick={onOpenGallery}>
              Photo Gallery{photoCount > 0 ? ` (${photoCount})` : ''}
            </button>
          </>
        ) : (
          <p style={styles.friendNotVisited}>{friendName} hasn't visited this place</p>
        )}
      </div>
    );
  }

  // --- Own map mode ---
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.name}>{displayName}</h2>
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {isLoggedIn ? (
        <>
          {/* Visited toggle */}
          {!showNewDatePicker && (
            <button
              style={{
                ...styles.visitedBtn,
                ...(isVisited ? styles.visitedBtnActive : {}),
              }}
              onClick={isVisited ? onRemoveVisited : handleMarkVisitedClick}
            >
              {isVisited ? '✓ Visited' : 'Mark as visited'}
            </button>
          )}

          {/* Date picker for first-time visits (no existing row) */}
          {showNewDatePicker && (
            <div style={styles.dateSection}>
              <div style={styles.dateSectionHeader}>When did you visit?</div>
              <CalendarPicker label="From" value={newFrom} onChange={setNewFrom} />
              <CalendarPicker label="To" value={newTo} onChange={setNewTo} />
              <div style={styles.dateActions}>
                <button style={styles.confirmBtn} onClick={handleConfirmNewDate}>
                  Save with date
                </button>
                <button style={styles.skipBtn} onClick={handleSkipNewDate}>
                  Skip — no date
                </button>
              </div>
            </div>
          )}

          {/* Editable dates for existing places */}
          {hasData && !showNewDatePicker && !showEditDates && (
            <div
              style={{ ...styles.dateDisplay, cursor: 'pointer' }}
              onClick={() => setShowEditDates(true)}
            >
              {formatVisitDates(visitedData!.visit_start_date, visitedData!.visit_end_date) ?? 'Add visit dates'}
              <span style={{ float: 'right', opacity: 0.5, fontSize: '0.7rem' }}>edit</span>
            </div>
          )}

          {hasData && showEditDates && !showNewDatePicker && (
            <div style={styles.dateSection}>
              <CalendarPicker label="From" value={editFrom} onChange={setEditFrom} />
              <CalendarPicker label="To" value={editTo} onChange={setEditTo} />
              <div style={styles.dateActions}>
                <button
                  style={{
                    ...styles.confirmBtn,
                    ...(dateSaveStatus === 'saved' ? styles.saveBtnSaved : {}),
                    ...(dateSaveStatus === 'error' ? styles.saveBtnError : {}),
                  }}
                  onClick={handleSaveEditDates}
                  disabled={dateSaveStatus === 'saving'}
                >
                  {dateSaveStatus === 'saving' ? 'Saving...'
                    : dateSaveStatus === 'saved' ? 'Saved!'
                      : dateSaveStatus === 'error' ? 'Failed'
                        : 'Save Dates'}
                </button>
                <button style={styles.skipBtn} onClick={() => setShowEditDates(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <textarea
            style={styles.textarea}
            placeholder="Add notes about this place..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

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

          <button style={styles.galleryBtn} onClick={onOpenGallery}>
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
  name: { fontSize: '1.1rem', fontWeight: 600, color: '#fff', margin: 0 },
  subtitle: { fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', margin: '0.15rem 0 0 0' },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem 0.5rem',
    borderRadius: '6px', lineHeight: 1,
  },
  visitedBtn: {
    width: '100%', padding: '0.6rem', background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.2)', borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: '0.75rem',
  },
  visitedBtnActive: {
    background: 'rgba(255, 160, 50, 0.15)',
    borderColor: 'rgba(255, 160, 50, 0.4)',
    color: 'rgba(255, 160, 50, 0.9)',
  },
  textarea: {
    width: '100%', minHeight: '100px', background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(100, 180, 255, 0.15)', borderRadius: '8px',
    padding: '0.75rem', color: '#fff', fontSize: '0.9rem', fontFamily: 'inherit',
    resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const,
    marginBottom: '0.5rem',
  },
  saveBtn: {
    width: '100%', padding: '0.5rem', background: 'rgba(100, 180, 255, 0.12)',
    border: '1px solid rgba(100, 180, 255, 0.25)', borderRadius: '8px',
    color: 'rgba(100, 180, 255, 0.8)', fontSize: '0.85rem', cursor: 'pointer',
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
    width: '100%', padding: '0.55rem', marginTop: '0.5rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(100, 180, 255, 0.2)', borderRadius: '8px',
    color: 'rgba(100, 180, 255, 0.7)', fontSize: '0.85rem', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  loginHint: { color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.8rem', textAlign: 'center', margin: 0 },
  // --- Date section ---
  dateSection: {
    marginBottom: '0.75rem', padding: '0.85rem',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(100, 180, 255, 0.15)', borderRadius: '10px',
  },
  dateSectionHeader: {
    fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '0.5rem',
  },
  dateActions: { display: 'flex', gap: '0.35rem', marginTop: '0.5rem' },
  confirmBtn: {
    flex: 1, padding: '0.5rem', background: 'rgba(100, 180, 255, 0.15)',
    border: '1px solid rgba(100, 180, 255, 0.3)', borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.9)', fontSize: '0.8rem', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  skipBtn: {
    flex: 1, padding: '0.5rem', background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.8rem', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dateDisplay: {
    padding: '0.4rem 0.65rem', marginBottom: '0.75rem',
    background: 'rgba(100, 180, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.1)', borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.7)', fontSize: '0.78rem',
  },
  // --- Friend view ---
  friendBadge: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    color: 'rgba(180, 130, 255, 0.9)', fontSize: '0.78rem', fontWeight: 600,
    marginBottom: '0.75rem',
  },
  friendDot: {
    width: '6px', height: '6px', borderRadius: '50%',
    background: 'rgba(180, 130, 255, 0.7)', flexShrink: 0,
  },
  friendVisitedTag: {
    padding: '0.5rem 0.65rem', background: 'rgba(180, 130, 255, 0.1)',
    border: '1px solid rgba(180, 130, 255, 0.25)', borderRadius: '8px',
    color: 'rgba(180, 130, 255, 0.9)', fontSize: '0.82rem', marginBottom: '0.75rem',
  },
  friendNotesBox: { marginBottom: '0.75rem' },
  friendNotesLabel: {
    color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.7rem', marginBottom: '0.25rem',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  },
  friendNotesText: {
    color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', margin: 0,
    lineHeight: 1.5, whiteSpace: 'pre-wrap' as const,
  },
  friendGalleryBtn: {
    width: '100%', padding: '0.55rem', background: 'rgba(180, 130, 255, 0.1)',
    border: '1px solid rgba(180, 130, 255, 0.25)', borderRadius: '8px',
    color: 'rgba(180, 130, 255, 0.8)', fontSize: '0.85rem', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  friendNotVisited: {
    color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.82rem', textAlign: 'center', margin: 0,
  },
};
