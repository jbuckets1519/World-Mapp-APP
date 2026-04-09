import { useState, useEffect, useRef } from 'react';
import type { GeoJsonFeature, CityPoint } from '../../types';
import type { VisitedPlace, VisitDates } from '../../hooks/useTravelData';

interface CountryPanelProps {
  /** GeoJSON feature for country/state, OR null when a city is selected */
  country: GeoJsonFeature | null;
  /** City data when a city dot is selected */
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
  /** When set, the panel shows this friend's data in read-only mode */
  friendViewMode?: boolean;
  friendName?: string | null;
}

// --- Month / Year constants ---
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CURRENT_YEAR = new Date().getFullYear();
// Allow dates going back 100 years
const YEAR_OPTIONS = Array.from({ length: 101 }, (_, i) => CURRENT_YEAR - i);

/** Format a YYYY-MM-DD date string for display */
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Month-only dates have day = 01
  const month = MONTHS[m - 1] ?? '';
  if (d === 1) return `${month} ${y}`;
  return `${month} ${d}, ${y}`;
}

/** Build a display string from the stored visit dates */
function formatVisitDates(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) {
    // If both are first-of-month, treat as month/year display
    const sameMonth = start === end;
    if (sameMonth) return formatDate(start);
    return `${formatDate(start)} — ${formatDate(end)}`;
  }
  return formatDate(start ?? end!);
}

/** Detect whether stored dates are month-only (day=01 for both) or range */
function detectDateMode(start: string | null, end: string | null): 'month' | 'range' {
  if (!start && !end) return 'month';
  if (start && end && start === end && start.endsWith('-01')) return 'month';
  return 'range';
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
  // Derive display name from whichever selection is active
  const displayName = city ? city.name : country?.properties.NAME ?? '';
  const subtitle = city ? city.country : null;

  const isVisited = Boolean(visitedData?.is_visited);
  const [notes, setNotes] = useState(visitedData?.notes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Date selector state — for the "Mark as visited" flow
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateMode, setDateMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Edit date picker state — for already-visited places
  const [showEditDates, setShowEditDates] = useState(false);
  const [editDateMode, setEditDateMode] = useState<'month' | 'range'>('month');
  const [editMonth, setEditMonth] = useState(new Date().getMonth());
  const [editYear, setEditYear] = useState(CURRENT_YEAR);
  const [editRangeStart, setEditRangeStart] = useState('');
  const [editRangeEnd, setEditRangeEnd] = useState('');
  const [dateSaveStatus, setDateSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setNotes(visitedData?.notes ?? '');
    setSaveStatus('idle');
    setShowDatePicker(false);
    setShowEditDates(false);
    setDateSaveStatus('idle');

    // Pre-populate edit date fields from existing data
    const start = visitedData?.visit_start_date ?? null;
    const end = visitedData?.visit_end_date ?? null;
    const mode = detectDateMode(start, end);
    setEditDateMode(mode);
    if (mode === 'month' && start) {
      const [y, m] = start.split('-').map(Number);
      setEditMonth(m - 1);
      setEditYear(y);
    } else {
      setEditMonth(new Date().getMonth());
      setEditYear(CURRENT_YEAR);
    }
    setEditRangeStart(mode === 'range' && start ? start : '');
    setEditRangeEnd(mode === 'range' && end ? end : '');
  }, [visitedData, displayName]);

  /** User clicks "Mark as visited" — show the date picker inline */
  const handleMarkVisitedClick = () => {
    setShowDatePicker(true);
  };

  /** Build VisitDates from the current picker state */
  const buildDates = (): VisitDates | undefined => {
    if (dateMode === 'month') {
      // Month/year → first day of that month
      const mm = String(selectedMonth + 1).padStart(2, '0');
      const date = `${selectedYear}-${mm}-01`;
      return { startDate: date, endDate: date };
    }
    // Range mode
    if (rangeStart || rangeEnd) {
      return {
        startDate: rangeStart || null,
        endDate: rangeEnd || null,
      };
    }
    return undefined;
  };

  /** Confirm the date selection and save */
  const handleConfirmDate = async () => {
    const dates = buildDates();
    const ok = await onMarkVisited(notesRef.current, dates);
    if (ok) {
      setShowDatePicker(false);
    }
  };

  /** Skip date selection — save with no dates */
  const handleSkipDate = async () => {
    const ok = await onMarkVisited(notesRef.current);
    if (ok) {
      setShowDatePicker(false);
    }
  };

  /** Save edited dates on an already-visited place */
  const handleSaveEditDates = async () => {
    setDateSaveStatus('saving');
    let dates: VisitDates;
    if (editDateMode === 'month') {
      const mm = String(editMonth + 1).padStart(2, '0');
      const date = `${editYear}-${mm}-01`;
      dates = { startDate: date, endDate: date };
    } else {
      dates = { startDate: editRangeStart || null, endDate: editRangeEnd || null };
    }
    const ok = await onUpdateDates(dates);
    setDateSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setDateSaveStatus('idle'), 1500);
  };

  const handleRemoveVisited = () => {
    onRemoveVisited();
  };

  const handleSaveNotes = async () => {
    const currentNotes = notesRef.current;
    setSaveStatus('saving');

    let ok: boolean;
    if (visitedData) {
      // Row exists (visited or not) — update notes on existing row
      ok = await onNotesChange(currentNotes);
    } else {
      // No row yet — create one
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

  // Formatted date display for visited places
  const visitDateDisplay = visitedData
    ? formatVisitDates(visitedData.visit_start_date, visitedData.visit_end_date)
    : null;

  // --- Friend view mode: read-only panel showing their data ---
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
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>

        {/* Friend attribution */}
        <div style={styles.friendBadge}>
          <span style={styles.friendDot} />
          {friendName}'s map
        </div>

        {isVisited ? (
          <>
            <div style={styles.friendVisitedTag}>✓ {friendName} visited this place</div>

            {friendDateDisplay && (
              <div style={styles.dateDisplay}>{friendDateDisplay}</div>
            )}

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

  // --- Own map mode: editable panel ---
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
          {/* Mark as visited / Visited button */}
          {!showDatePicker && (
            <button
              style={{
                ...styles.visitedBtn,
                ...(isVisited ? styles.visitedBtnActive : {}),
              }}
              onClick={isVisited ? handleRemoveVisited : handleMarkVisitedClick}
            >
              {isVisited ? '✓ Visited' : 'Mark as visited'}
            </button>
          )}

          {/* Inline date selector — appears after clicking "Mark as visited" */}
          {showDatePicker && (
            <div style={styles.datePicker}>
              <div style={styles.datePickerHeader}>When did you visit?</div>

              {/* Mode toggle */}
              <div style={styles.modeToggle}>
                <button
                  style={{
                    ...styles.modeBtn,
                    ...(dateMode === 'month' ? styles.modeBtnActive : {}),
                  }}
                  onClick={() => setDateMode('month')}
                >
                  Month / Year
                </button>
                <button
                  style={{
                    ...styles.modeBtn,
                    ...(dateMode === 'range' ? styles.modeBtnActive : {}),
                  }}
                  onClick={() => setDateMode('range')}
                >
                  Date Range
                </button>
              </div>

              {dateMode === 'month' ? (
                // Month + Year dropdowns
                <div style={styles.monthYearRow}>
                  <select
                    style={styles.select}
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <select
                    style={styles.select}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              ) : (
                // Start / End date inputs
                <div style={styles.rangeRow}>
                  <label style={styles.rangeLabel}>
                    <span style={styles.rangeLabelText}>From</span>
                    <input
                      type="date"
                      style={styles.dateInput}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                    />
                  </label>
                  <label style={styles.rangeLabel}>
                    <span style={styles.rangeLabelText}>To</span>
                    <input
                      type="date"
                      style={styles.dateInput}
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {/* Confirm / Skip buttons */}
              <div style={styles.dateActions}>
                <button style={styles.confirmBtn} onClick={handleConfirmDate}>
                  Save with date
                </button>
                <button style={styles.skipBtn} onClick={handleSkipDate}>
                  Skip — no date
                </button>
              </div>
            </div>
          )}

          {/* Show visit dates / edit dates for visited places */}
          {isVisited && !showDatePicker && !showEditDates && (
            <div
              style={{ ...styles.dateDisplay, cursor: 'pointer' }}
              onClick={() => setShowEditDates(true)}
            >
              {visitDateDisplay ?? 'Add visit dates'}
              <span style={{ float: 'right', opacity: 0.5, fontSize: '0.7rem' }}>edit</span>
            </div>
          )}

          {/* Inline date editor for already-visited places */}
          {isVisited && showEditDates && !showDatePicker && (
            <div style={styles.datePicker}>
              <div style={styles.datePickerHeader}>Edit visit dates</div>

              <div style={styles.modeToggle}>
                <button
                  style={{
                    ...styles.modeBtn,
                    ...(editDateMode === 'month' ? styles.modeBtnActive : {}),
                  }}
                  onClick={() => setEditDateMode('month')}
                >
                  Month / Year
                </button>
                <button
                  style={{
                    ...styles.modeBtn,
                    ...(editDateMode === 'range' ? styles.modeBtnActive : {}),
                  }}
                  onClick={() => setEditDateMode('range')}
                >
                  Date Range
                </button>
              </div>

              {editDateMode === 'month' ? (
                <div style={styles.monthYearRow}>
                  <select
                    style={styles.select}
                    value={editMonth}
                    onChange={(e) => setEditMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <select
                    style={styles.select}
                    value={editYear}
                    onChange={(e) => setEditYear(Number(e.target.value))}
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={styles.rangeRow}>
                  <label style={styles.rangeLabel}>
                    <span style={styles.rangeLabelText}>From</span>
                    <input
                      type="date"
                      style={styles.dateInput}
                      value={editRangeStart}
                      onChange={(e) => setEditRangeStart(e.target.value)}
                    />
                  </label>
                  <label style={styles.rangeLabel}>
                    <span style={styles.rangeLabelText}>To</span>
                    <input
                      type="date"
                      style={styles.dateInput}
                      value={editRangeEnd}
                      onChange={(e) => setEditRangeEnd(e.target.value)}
                    />
                  </label>
                </div>
              )}

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
  // --- Own map styles ---
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
  // --- Date picker styles ---
  datePicker: {
    marginBottom: '0.75rem',
    padding: '0.85rem',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '10px',
  },
  datePickerHeader: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '0.65rem',
  },
  modeToggle: {
    display: 'flex',
    gap: '0.35rem',
    marginBottom: '0.65rem',
  },
  modeBtn: {
    flex: 1,
    padding: '0.4rem',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    background: 'rgba(100, 180, 255, 0.12)',
    borderColor: 'rgba(100, 180, 255, 0.3)',
    color: 'rgba(100, 180, 255, 0.9)',
  },
  monthYearRow: {
    display: 'flex',
    gap: '0.4rem',
    marginBottom: '0.65rem',
  },
  select: {
    flex: 1,
    padding: '0.45rem 0.5rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  },
  rangeRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
    marginBottom: '0.65rem',
  },
  rangeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  rangeLabelText: {
    width: '2.5rem',
    flexShrink: 0,
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.45)',
  },
  dateInput: {
    flex: 1,
    padding: '0.4rem 0.5rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    outline: 'none',
    colorScheme: 'dark',
  },
  dateActions: {
    display: 'flex',
    gap: '0.35rem',
  },
  confirmBtn: {
    flex: 1,
    padding: '0.5rem',
    background: 'rgba(100, 180, 255, 0.15)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.9)',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  skipBtn: {
    flex: 1,
    padding: '0.5rem',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dateDisplay: {
    padding: '0.4rem 0.65rem',
    marginBottom: '0.75rem',
    background: 'rgba(100, 180, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.1)',
    borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.7)',
    fontSize: '0.78rem',
  },
  // --- Friend view mode styles ---
  friendBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'rgba(180, 130, 255, 0.9)',
    fontSize: '0.78rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  friendDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(180, 130, 255, 0.7)',
    flexShrink: 0,
  },
  friendVisitedTag: {
    padding: '0.5rem 0.65rem',
    background: 'rgba(180, 130, 255, 0.1)',
    border: '1px solid rgba(180, 130, 255, 0.25)',
    borderRadius: '8px',
    color: 'rgba(180, 130, 255, 0.9)',
    fontSize: '0.82rem',
    marginBottom: '0.75rem',
  },
  friendNotesBox: {
    marginBottom: '0.75rem',
  },
  friendNotesLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.7rem',
    marginBottom: '0.25rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  friendNotesText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.85rem',
    margin: 0,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
  },
  friendGalleryBtn: {
    width: '100%',
    padding: '0.55rem',
    background: 'rgba(180, 130, 255, 0.1)',
    border: '1px solid rgba(180, 130, 255, 0.25)',
    borderRadius: '8px',
    color: 'rgba(180, 130, 255, 0.8)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  friendNotVisited: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '0.82rem',
    textAlign: 'center',
    margin: 0,
  },
};
