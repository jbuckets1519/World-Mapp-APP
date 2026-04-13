import { useState, useEffect } from 'react';
import type { GeoJsonFeature, CityPoint } from '../../types';
import type { VisitedPlace, VisitDates } from '../../hooks/useTravelData';
import CalendarPicker, { formatDateDisplay } from './CalendarPicker';
import { PailIcon } from '../Bucketlist';

interface CountryPanelProps {
  country: GeoJsonFeature | null;
  city: CityPoint | null;
  visitedData: VisitedPlace | undefined;
  isLoggedIn: boolean;
  onMarkVisited: (dates?: VisitDates) => Promise<boolean>;
  onRemoveVisited: () => void;
  onUpdateDates: (dates: VisitDates) => Promise<boolean>;
  onClose: () => void;
  /** Opens the full-screen country activity page. Only shown for countries
   *  (not cities/states). Parent decides what to render when triggered. */
  onOpenActivity?: () => void;
  friendViewMode?: boolean;
  friendName?: string | null;
  /** Bucketlist controls */
  isInBucketlist?: boolean;
  onAddToBucketlist?: () => void;
  onRemoveFromBucketlist?: () => void;
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
  onUpdateDates,
  onClose,
  onOpenActivity,
  friendViewMode = false,
  friendName,
  isInBucketlist = false,
  onAddToBucketlist,
  onRemoveFromBucketlist,
}: CountryPanelProps) {
  const displayName = city ? city.name : country?.properties.NAME ?? '';
  const subtitle = city ? city.country : null;

  // "View Activity" only makes sense for country-level places. Cities and
  // state/province polygons have no activity page (photos were migrated up
  // to the country they belong to).
  const isCountryLevel = Boolean(country && !city && !country?._isState);

  const isVisited = Boolean(visitedData?.is_visited);
  const hasData = Boolean(visitedData);

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
      onMarkVisited();
    } else {
      setShowNewDatePicker(true);
    }
  };

  const handleConfirmNewDate = async () => {
    const dates: VisitDates | undefined =
      (newFrom || newTo) ? { startDate: newFrom || null, endDate: newTo || null } : undefined;
    const ok = await onMarkVisited(dates);
    if (ok) setShowNewDatePicker(false);
  };

  const handleSkipNewDate = async () => {
    const ok = await onMarkVisited();
    if (ok) setShowNewDatePicker(false);
  };

  // --- Save dates on existing place ---
  const handleSaveEditDates = async () => {
    setDateSaveStatus('saving');
    const ok = await onUpdateDates({ startDate: editFrom || null, endDate: editTo || null });
    setDateSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setDateSaveStatus('idle'), 1500);
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
          <button className="btn-press" style={styles.closeBtn} onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        <div style={styles.friendBadge}>
          <span style={styles.friendDot} />
          {friendName}'s map
        </div>

        {isVisited ? (
          <>
            <div style={styles.friendVisitedTag}>✓ {friendName} visited this place</div>
            {friendDateDisplay && <div style={styles.dateDisplay}>{friendDateDisplay}</div>}
            {isCountryLevel && onOpenActivity && (
              <button className="btn-press" style={styles.friendGalleryBtn} onClick={onOpenActivity}>
                View Activity
              </button>
            )}
          </>
        ) : (
          <>
            <p style={styles.friendNotVisited}>{friendName} hasn't visited this place</p>
            {isCountryLevel && onOpenActivity && (
              <button className="btn-press" style={styles.friendGalleryBtn} onClick={onOpenActivity}>
                View Activity
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // --- Own map mode ---
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={styles.name}>{displayName}</h2>
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>
          {isLoggedIn && onAddToBucketlist && !city && (
            <button
              className="btn-press"
              style={{
                ...styles.pailBtn,
                ...(isInBucketlist ? styles.pailBtnActive : {}),
              }}
              onClick={isInBucketlist ? onRemoveFromBucketlist : onAddToBucketlist}
              title={isInBucketlist ? 'Remove from bucketlist' : 'Add to bucketlist'}
            >
              <PailIcon size={21} filled={isInBucketlist}
                color={isInBucketlist ? 'rgba(255, 130, 110, 0.9)' : 'rgba(255, 130, 110, 0.55)'} />
            </button>
          )}
        </div>
        <button className="btn-press" style={styles.closeBtn} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {isLoggedIn ? (
        <>
          {/* Visited toggle */}
          {!showNewDatePicker && (
            <button
              className="btn-press"
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
                <button className="btn-press" style={styles.confirmBtn} onClick={handleConfirmNewDate}>
                  Save with date
                </button>
                <button className="btn-press" style={styles.skipBtn} onClick={handleSkipNewDate}>
                  Skip — no date
                </button>
              </div>
            </div>
          )}

          {/* Editable dates for existing places */}
          {hasData && !showNewDatePicker && !showEditDates && (
            <div
              style={{ ...styles.dateDisplay, ...styles.dateDisplayRow, cursor: 'pointer' }}
              onClick={() => setShowEditDates(true)}
            >
              <span style={styles.dateDisplayText}>
                {formatVisitDates(visitedData!.visit_start_date, visitedData!.visit_end_date) ?? 'Add visit dates'}
              </span>
              {(visitedData!.visit_start_date || visitedData!.visit_end_date) && (
                <button
                  type="button"
                  className="btn-press"
                  style={styles.dateClearBtn}
                  aria-label="Clear visit dates"
                  title="Clear dates"
                  onClick={(e) => {
                    // Prevent the parent div's onClick from opening the edit panel
                    e.stopPropagation();
                    onUpdateDates({ startDate: null, endDate: null });
                    setEditFrom('');
                    setEditTo('');
                  }}
                >
                  ✕
                </button>
              )}
              <span style={styles.dateDisplayEditHint}>edit</span>
            </div>
          )}

          {hasData && showEditDates && !showNewDatePicker && (
            <div style={styles.dateSection}>
              <CalendarPicker label="From" value={editFrom} onChange={setEditFrom} />
              <CalendarPicker label="To" value={editTo} onChange={setEditTo} />
              <div style={styles.dateActions}>
                <button
                  className="btn-press"
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
                <button className="btn-press" style={styles.skipBtn} onClick={() => setShowEditDates(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Single "View Activity" entry point — only for country polygons.
              Cities and states have no activity page. */}
          {isCountryLevel && onOpenActivity && (
            <button
              className="btn-press"
              style={styles.viewActivityBtn}
              onClick={onOpenActivity}
            >
              View Activity
            </button>
          )}
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
    bottom: 'calc(56px + 1rem + env(safe-area-inset-bottom, 0px))',
    right: '1.5rem',
    width: '320px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 56px - 2rem - env(safe-area-inset-bottom, 0px))',
    overflowY: 'auto' as const,
    // Frosted glass: more transparent base so the blur reads through
    background: 'rgba(16, 18, 28, 0.62)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.09)',
    borderRadius: '22px',
    padding: '1.25rem',
    zIndex: 1000,
    // Soft shadow for layered depth
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
    animation: 'panelSlideIn 0.25s ease-out',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  name: { fontSize: '1.1rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.92)', margin: 0 },
  subtitle: { fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', margin: '0.15rem 0 0 0' },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem 0.5rem',
    borderRadius: '999px', lineHeight: 1,
  },
  visitedBtn: {
    width: '100%', padding: '0.7rem', background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.82)', fontSize: '0.85rem', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: '0.75rem',
  },
  visitedBtnActive: {
    background: 'rgba(255, 195, 50, 0.15)',
    borderColor: 'rgba(255, 195, 50, 0.4)',
    color: 'rgba(255, 195, 50, 0.9)',
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
  viewActivityBtn: {
    width: '100%', padding: '0.7rem', marginTop: '0.25rem',
    background: 'rgba(100, 180, 255, 0.14)',
    border: '1px solid rgba(100, 180, 255, 0.3)', borderRadius: '999px',
    color: 'rgba(100, 180, 255, 0.95)', fontSize: '0.85rem', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  pailBtn: {
    width: '36px', height: '36px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(15, 15, 25, 0.5)',
    border: '1px solid rgba(255, 130, 110, 0.28)',
    borderRadius: '999px',
    cursor: 'pointer', flexShrink: 0, padding: 0,
  },
  pailBtnActive: {
    background: 'rgba(255, 130, 110, 0.1)',
    borderColor: 'rgba(255, 130, 110, 0.4)',
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
    flex: 1, padding: '0.55rem', background: 'rgba(100, 180, 255, 0.15)',
    border: '1px solid rgba(100, 180, 255, 0.3)', borderRadius: '999px',
    color: 'rgba(100, 180, 255, 0.95)', fontSize: '0.8rem', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  skipBtn: {
    flex: 1, padding: '0.55rem', background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dateDisplay: {
    padding: '0.4rem 0.65rem', marginBottom: '0.75rem',
    background: 'rgba(100, 180, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.1)', borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.7)', fontSize: '0.78rem',
  },
  dateDisplayRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  dateDisplayText: {
    flex: 1, minWidth: 0,
  },
  dateDisplayEditHint: {
    opacity: 0.5, fontSize: '0.7rem', flexShrink: 0,
  },
  dateClearBtn: {
    width: '20px', height: '20px', padding: 0, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.7rem', lineHeight: 1,
    cursor: 'pointer', fontFamily: 'inherit',
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
