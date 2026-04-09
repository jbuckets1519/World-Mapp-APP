import { useState } from 'react';
import type { BucketlistItem } from '../../hooks/useBucketlist';

interface BucketlistPanelProps {
  items: BucketlistItem[];
  loading: boolean;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  onRemove: (placeId: string) => Promise<boolean>;
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

  const handleRemove = async (placeId: string) => {
    setRemovingId(placeId);
    await onRemove(placeId);
    setRemovingId(null);
  };

  return (
    <>
      {/* Bucket icon button */}
      <button
        style={styles.iconBtn}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Bucketlist"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255, 220, 100, 0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 6l1 14h14l1-14M9 6V4h6v2" />
          <path d="M10 10v6M14 10v6" />
        </svg>
        {items.length > 0 && (
          <span style={styles.badge}>{items.length}</span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <h3 style={styles.title}>Bucketlist</h3>
            <button style={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
          </div>

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
            ) : items.length === 0 ? (
              <p style={styles.emptyText}>No places in your bucketlist yet</p>
            ) : (
              items.map((item) => (
                <div key={item.id} style={styles.item}>
                  <span style={styles.itemName}>{item.place_name}</span>
                  <button
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

const styles: Record<string, React.CSSProperties> = {
  iconBtn: {
    position: 'fixed',
    top: '3.5rem',
    right: '1rem',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 15, 25, 0.7)',
    border: '1px solid rgba(255, 220, 100, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    zIndex: 10,
    padding: 0,
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    minWidth: '16px',
    height: '16px',
    borderRadius: '8px',
    background: 'rgba(255, 220, 100, 0.85)',
    color: '#111',
    fontSize: '0.6rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
  },
  panel: {
    position: 'fixed',
    top: '5.5rem',
    right: '1rem',
    width: '260px',
    maxHeight: 'calc(100vh - 7rem)',
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 220, 100, 0.2)',
    borderRadius: '12px',
    padding: '1rem',
    zIndex: 15,
    display: 'flex',
    flexDirection: 'column',
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
    color: 'rgba(255, 220, 100, 0.9)',
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
    background: 'rgba(255, 220, 100, 0.25)',
    borderColor: 'rgba(255, 220, 100, 0.4)',
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
    background: 'rgba(255, 220, 100, 0.9)',
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
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '0.2rem 0.35rem',
    borderRadius: '4px',
    lineHeight: 1,
    flexShrink: 0,
  },
};
