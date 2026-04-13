import { useState } from 'react';
import type { BucketlistItem } from '../../hooks/useBucketlist';
import { BUCKETLIST_MAX } from '../../hooks/useBucketlist';

interface BucketlistPanelProps {
  items: BucketlistItem[];
  loading: boolean;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  onRemove: (placeId: string) => Promise<boolean>;
}

/** Pail/bucket SVG icon — used consistently across the app */
export function PailIcon({ size = 16, filled = false, color = 'rgba(255, 130, 110, 0.8)' }: {
  size?: number; filled?: boolean; color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Handle */}
      <path d="M7 8C7 4.5 10 2 12 2s5 2.5 5 6" fill="none" />
      {/* Rim */}
      <rect x="4" y="8" width="16" height="3" rx="1" />
      {/* Body — tapered bucket shape */}
      <path d="M5 11l1.5 10h11L19 11" />
    </svg>
  );
}

export default function BucketlistPanel({
  items,
  loading,
  showOverlay,
  onToggleOverlay,
  onRemove,
}: BucketlistPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Cities are no longer addable to the bucketlist; hide any legacy city
  // entries that may still exist in the database.
  const visibleItems = items.filter((item) => item.place_type !== 'city');

  const handleRemove = async (placeId: string) => {
    setRemovingId(placeId);
    await onRemove(placeId);
    setRemovingId(null);
  };

  return (
    <>
      {/* Pail icon button */}
      <button
        className="btn-press"
        style={styles.iconBtn}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Bucketlist"
      >
        <PailIcon size={16} />
        {visibleItems.length > 0 && (
          <span style={styles.badge}>{visibleItems.length}</span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <h3 style={styles.title}>Bucketlist</h3>
              <span style={styles.count}>{visibleItems.length}/{BUCKETLIST_MAX}</span>
            </div>
            <button className="btn-press" style={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {visibleItems.length >= BUCKETLIST_MAX && (
            <div style={styles.fullMsg}>Bucketlist is full ({BUCKETLIST_MAX}/{BUCKETLIST_MAX})</div>
          )}

          {/* Globe overlay toggle */}
          <div style={styles.toggleRow}>
            <span style={styles.toggleLabel}>Show on globe</span>
            <button
              style={{
                ...styles.toggleBtn,
                ...(showOverlay ? styles.toggleBtnOn : {}),
              }}
              onClick={onToggleOverlay}
            >
              <span style={{
                ...styles.toggleKnob,
                ...(showOverlay ? styles.toggleKnobOn : {}),
              }} />
            </button>
          </div>

          {/* Item list */}
          <div style={styles.list}>
            {loading ? (
              <p style={styles.emptyText}>Loading...</p>
            ) : visibleItems.length === 0 ? (
              <p style={styles.emptyText}>No places in your bucketlist yet</p>
            ) : (
              visibleItems.map((item) => (
                <div key={item.id} style={styles.item}>
                  <span style={styles.itemName}>{item.place_name}</span>
                  <button
                    className="btn-press"
                    style={styles.removeBtn}
                    onClick={() => handleRemove(item.place_id)}
                    disabled={removingId === item.place_id}
                  >
                    {removingId === item.place_id ? '...' : '✕'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

const ACCENT = 'rgba(255, 130, 110,';

const styles: Record<string, React.CSSProperties> = {
  iconBtn: {
    position: 'fixed',
    top: 'calc(1rem + env(safe-area-inset-top, 0px))',
    right: '1rem',
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
    zIndex: 1000,
    padding: 0,
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    minWidth: '16px',
    height: '16px',
    borderRadius: '8px',
    background: `${ACCENT} 0.85)`,
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: '0.6rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
  },
  panel: {
    position: 'fixed',
    top: 'calc(3.2rem + env(safe-area-inset-top, 0px))',
    right: '1rem',
    width: '260px',
    maxHeight: 'calc(100vh - 7rem - env(safe-area-inset-top, 0px))',
    background: 'rgba(16, 18, 28, 0.62)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '1rem',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
    transformOrigin: 'top right',
    animation: 'fadeScaleIn 0.2s ease-out',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: `${ACCENT} 0.9)`,
  },
  count: {
    fontSize: '0.72rem',
    color: 'rgba(255, 255, 255, 0.35)',
    fontWeight: 400,
  },
  fullMsg: {
    fontSize: '0.75rem',
    color: `${ACCENT} 0.8)`,
    textAlign: 'center',
    padding: '0.4rem',
    marginBottom: '0.5rem',
    background: `${ACCENT} 0.06)`,
    borderRadius: '6px',
    border: `1px solid ${ACCENT} 0.15)`,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0.15rem 0.35rem',
    lineHeight: 1,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  toggleLabel: {
    fontSize: '0.78rem',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  toggleBtn: {
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    cursor: 'pointer',
    position: 'relative',
    padding: 0,
    transition: 'background 0.2s',
  },
  toggleBtnOn: {
    background: `${ACCENT} 0.25)`,
    borderColor: `${ACCENT} 0.4)`,
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.5)',
    transition: 'left 0.2s, background 0.2s',
  },
  toggleKnobOn: {
    left: '18px',
    background: `${ACCENT} 0.9)`,
  },
  list: {
    overflowY: 'auto',
    flex: 1,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.8rem',
    textAlign: 'center',
    margin: '1rem 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.4rem 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  itemName: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    marginRight: '0.5rem',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    borderRadius: '999px',
    lineHeight: 1,
    flexShrink: 0,
  },
};
