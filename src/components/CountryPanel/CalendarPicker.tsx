import { useState, useEffect, useRef, useCallback } from 'react';

interface CalendarPickerProps {
  /** YYYY-MM-DD string (may end -01 for month-only, -01-01 for year-only) */
  value: string;
  /** Called with a YYYY-MM-DD string when user selects a date */
  onChange: (dateStr: string) => void;
  /** Label shown above the field, e.g. "From" or "To" */
  label: string;
}

// --- Helpers ---

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseValue(val: string): { year: number; month: number; day: number } {
  if (!val) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  const [y, m, d] = val.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

/** Format a YYYY-MM-DD for display based on precision */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const { year, month, day } = parseValue(dateStr);
  // Year-only: YYYY-01-01
  if (month === 0 && day === 1 && dateStr.endsWith('-01-01')) return `${year}`;
  // Month-only: YYYY-MM-01
  if (day === 1) return `${MONTH_NAMES[month]} ${year}`;
  // Full date
  return `${MONTH_NAMES[month]} ${day}, ${year}`;
}

type View = 'days' | 'months' | 'years';

export default function CalendarPicker({ value, onChange, label }: CalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('days');
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync navigation state when value changes or popup opens
  useEffect(() => {
    if (isOpen) {
      const { year, month } = parseValue(value);
      setViewYear(year);
      setViewMonth(month);
      setView('days');
    }
  }, [isOpen, value]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const select = useCallback((dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  }, [onChange]);

  // --- Navigation ---
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };
  const prevYear = () => setViewYear((y) => y - 1);
  const nextYear = () => setViewYear((y) => y + 1);
  const yearBlockStart = Math.floor(viewYear / 12) * 12;
  const prevYearBlock = () => setViewYear((y) => y - 12);
  const nextYearBlock = () => setViewYear((y) => y + 12);

  // --- Render day grid ---
  const renderDays = () => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const prevMonthDays = getDaysInMonth(
      viewMonth === 0 ? viewYear - 1 : viewYear,
      viewMonth === 0 ? 11 : viewMonth - 1,
    );

    const cells: { day: number; inMonth: boolean; dateStr: string }[] = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const pm = viewMonth === 0 ? 11 : viewMonth - 1;
      const py = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day: d, inMonth: false, dateStr: `${py}-${pad2(pm + 1)}-${pad2(d)}` });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d, inMonth: true,
        dateStr: `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`,
      });
    }

    // Next month leading days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = viewMonth === 11 ? 0 : viewMonth + 1;
      const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ day: d, inMonth: false, dateStr: `${ny}-${pad2(nm + 1)}-${pad2(d)}` });
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

    return (
      <>
        {/* Header */}
        <div style={s.header}>
          <button style={s.arrow} onClick={prevMonth}>‹</button>
          <button style={s.headerLabel} onClick={() => setView('months')}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </button>
          <button style={s.arrow} onClick={nextMonth}>›</button>
        </div>
        {/* Day-of-week labels */}
        <div style={s.grid7}>
          {DAY_LABELS.map((d) => (
            <div key={d} style={s.dayLabel}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={s.grid7}>
          {cells.map((c, i) => {
            const isSelected = c.dateStr === value;
            const isToday = c.dateStr === todayStr;
            return (
              <button
                key={i}
                style={{
                  ...s.cell,
                  ...(c.inMonth ? {} : s.cellDimmed),
                  ...(isSelected ? s.cellSelected : {}),
                  ...(isToday && !isSelected ? s.cellToday : {}),
                }}
                onClick={() => select(c.dateStr)}
              >
                {c.day}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  // --- Render month grid ---
  const renderMonths = () => {
    const selectedParsed = parseValue(value);
    return (
      <>
        <div style={s.header}>
          <button style={s.arrow} onClick={prevYear}>‹</button>
          <button style={s.headerLabel} onClick={() => setView('years')}>
            {viewYear}
          </button>
          <button style={s.arrow} onClick={nextYear}>›</button>
        </div>
        <div style={s.grid4}>
          {MONTH_SHORT.map((m, i) => {
            const isSelected = selectedParsed.year === viewYear && selectedParsed.month === i;
            return (
              <button
                key={m}
                style={{ ...s.cellWide, ...(isSelected ? s.cellSelected : {}) }}
                onClick={() => select(`${viewYear}-${pad2(i + 1)}-01`)}
              >
                {m}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  // --- Render year grid ---
  const renderYears = () => {
    const years = Array.from({ length: 12 }, (_, i) => yearBlockStart + i);
    const selectedParsed = parseValue(value);
    return (
      <>
        <div style={s.header}>
          <button style={s.arrow} onClick={prevYearBlock}>‹</button>
          <span style={s.headerLabelStatic}>
            {yearBlockStart} — {yearBlockStart + 11}
          </span>
          <button style={s.arrow} onClick={nextYearBlock}>›</button>
        </div>
        <div style={s.grid4}>
          {years.map((y) => {
            const isSelected = selectedParsed.year === y;
            return (
              <button
                key={y}
                style={{ ...s.cellWide, ...(isSelected ? s.cellSelected : {}) }}
                onClick={() => select(`${y}-01-01`)}
              >
                {y}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const displayText = value ? formatDateDisplay(value) : 'Select date';

  return (
    <div ref={wrapperRef} style={s.wrapper}>
      <span style={s.label}>{label}</span>
      <button
        style={s.trigger}
        onClick={() => setIsOpen((o) => !o)}
      >
        {displayText}
      </button>

      {isOpen && (
        <div style={s.popup}>
          {view === 'days' && renderDays()}
          {view === 'months' && renderMonths()}
          {view === 'years' && renderYears()}
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative' as const,
    marginBottom: '0.4rem',
  },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    color: 'rgba(255, 255, 255, 0.45)',
    marginBottom: '0.2rem',
  },
  trigger: {
    width: '100%',
    padding: '0.45rem 0.6rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    textAlign: 'left' as const,
    cursor: 'pointer',
    outline: 'none',
  },
  popup: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    zIndex: 25,
    background: 'rgba(20, 20, 35, 0.97)',
    border: '1px solid rgba(100, 180, 255, 0.25)',
    borderRadius: '10px',
    padding: '0.6rem',
    backdropFilter: 'blur(12px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  arrow: {
    background: 'none',
    border: 'none',
    color: 'rgba(100, 180, 255, 0.8)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  headerLabel: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    fontFamily: 'inherit',
  },
  headerLabelStatic: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  grid7: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '1px',
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  },
  dayLabel: {
    textAlign: 'center' as const,
    fontSize: '0.65rem',
    color: 'rgba(255, 255, 255, 0.3)',
    padding: '0.2rem 0',
  },
  cell: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '0.75rem',
    padding: '0.35rem 0',
    textAlign: 'center' as const,
    cursor: 'pointer',
    borderRadius: '4px',
    fontFamily: 'inherit',
    lineHeight: 1.2,
  },
  cellDimmed: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  cellSelected: {
    background: 'rgba(100, 180, 255, 0.2)',
    color: 'rgba(100, 180, 255, 0.95)',
    fontWeight: 600,
  },
  cellToday: {
    border: '1px solid rgba(100, 180, 255, 0.3)',
  },
  cellWide: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: '0.78rem',
    padding: '0.5rem 0.25rem',
    textAlign: 'center' as const,
    cursor: 'pointer',
    borderRadius: '6px',
    fontFamily: 'inherit',
  },
};
