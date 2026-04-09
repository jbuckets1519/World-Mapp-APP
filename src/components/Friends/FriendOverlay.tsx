import { useState, useRef, useEffect } from 'react';
import type { FollowRelation } from '../../types';

interface FriendOverlayProps {
  following: FollowRelation[];
  activeFriendId: string | null;
  loadingPlaces: boolean;
  onSelectFriend: (friendId: string) => void;
  onClear: () => void;
  showFriendBucketlist?: boolean;
  onToggleFriendBucketlist?: () => void;
}

/**
 * Small toggle/dropdown below the friends icon that lets the user
 * pick a friend whose visited places to overlay on the globe.
 */
export default function FriendOverlay({
  following,
  activeFriendId,
  loadingPlaces,
  onSelectFriend,
  onClear,
  showFriendBucketlist = false,
  onToggleFriendBucketlist,
}: FriendOverlayProps) {
  const [open, setOpen] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Only show when actively viewing a friend's map (options panel + name display)
  // The "View friend's map" selector has moved to the Friends tab
  if (!activeFriendId) return null;

  const activeFriend = activeFriendId
    ? following.find((f) => f.following_id === activeFriendId)
    : null;

  const activeName = activeFriend
    ? activeFriend.profile.username || activeFriend.profile.display_name || 'Friend'
    : null;

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        style={{
          ...styles.toggleBtn,
          ...(activeFriendId ? styles.toggleBtnActive : {}),
        }}
        onClick={() => {
          if (activeFriendId && !open) {
            // If a friend is active and dropdown closed, clicking clears the overlay
            onClear();
          } else {
            setOpen(!open);
          }
        }}
      >
        {loadingPlaces ? (
          'Loading...'
        ) : activeName ? (
          <>
            <span style={styles.dot} />
            {activeName}
            <span style={styles.clearX} onClick={(e) => { e.stopPropagation(); onClear(); }}>✕</span>
          </>
        ) : (
          'View friend\u2019s map'
        )}
      </button>

      {/* Expandable options section when viewing a friend's map */}
      {activeFriendId && !open && (
        <div style={styles.optionsRow}>
          <button
            style={styles.expandBtn}
            onClick={() => setOptionsExpanded((v) => !v)}
          >
            <span style={{
              ...styles.arrow,
              transform: optionsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>&#9660;</span>
            Options
          </button>
          {optionsExpanded && (
            <div style={styles.optionsPanel}>
              <label style={styles.toggleLabel}>
                <span style={styles.toggleText}>
                  Bucketlist
                </span>
                <button
                  style={{
                    ...styles.toggleSwitch,
                    background: showFriendBucketlist
                      ? 'rgba(255, 100, 100, 0.4)'
                      : 'rgba(255, 255, 255, 0.1)',
                  }}
                  onClick={onToggleFriendBucketlist}
                >
                  <span style={{
                    ...styles.toggleKnob,
                    transform: showFriendBucketlist ? 'translateX(14px)' : 'translateX(0)',
                  }} />
                </button>
              </label>
            </div>
          )}
        </div>
      )}

      {open && (
        <div style={styles.dropdown}>
          {following.map((rel) => {
            const name = rel.profile.display_name || rel.profile.email || 'Unknown';
            const isActive = rel.following_id === activeFriendId;
            return (
              <button
                key={rel.id}
                style={{
                  ...styles.option,
                  ...(isActive ? styles.optionActive : {}),
                }}
                onClick={() => {
                  if (isActive) {
                    onClear();
                  } else {
                    onSelectFriend(rel.following_id);
                  }
                  setOpen(false);
                }}
              >
                <span style={styles.optionDot} />
                <span style={styles.optionName}>{name}</span>
                {isActive && <span style={styles.checkmark}>&#10003;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 'calc(5.8rem + env(safe-area-inset-top, 0px))',
    left: '1rem',
    zIndex: 1000,
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.65rem',
    background: 'rgba(15, 15, 25, 0.7)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  toggleBtnActive: {
    borderColor: 'rgba(180, 130, 255, 0.4)',
    color: 'rgba(180, 130, 255, 0.9)',
    background: 'rgba(180, 130, 255, 0.1)',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(180, 130, 255, 0.8)',
    flexShrink: 0,
  },
  clearX: {
    marginLeft: '0.25rem',
    opacity: 0.5,
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
  dropdown: {
    marginTop: '4px',
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.2)',
    borderRadius: '10px',
    overflow: 'hidden',
    minWidth: '180px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left' as const,
  },
  optionActive: {
    background: 'rgba(180, 130, 255, 0.1)',
  },
  optionDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(180, 130, 255, 0.6)',
    flexShrink: 0,
  },
  optionName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  checkmark: {
    color: 'rgba(180, 130, 255, 0.8)',
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  optionsRow: {
    marginTop: '4px',
  },
  expandBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.25rem 0.55rem',
    background: 'rgba(15, 15, 25, 0.6)',
    border: '1px solid rgba(180, 130, 255, 0.15)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.65rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  arrow: {
    fontSize: '0.5rem',
    transition: 'transform 0.2s ease',
    display: 'inline-block',
  },
  optionsPanel: {
    marginTop: '4px',
    padding: '0.4rem 0.6rem',
    background: 'rgba(15, 15, 25, 0.9)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(180, 130, 255, 0.2)',
    borderRadius: '8px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  toggleText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '0.72rem',
  },
  toggleSwitch: {
    position: 'relative' as const,
    width: '30px',
    height: '16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s ease',
  },
  toggleKnob: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s ease',
  },
};
