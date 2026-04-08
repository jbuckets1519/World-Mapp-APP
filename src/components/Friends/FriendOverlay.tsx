import { useState, useRef, useEffect } from 'react';
import type { FollowRelation } from '../../types';

interface FriendOverlayProps {
  following: FollowRelation[];
  activeFriendId: string | null;
  loadingPlaces: boolean;
  onSelectFriend: (friendId: string) => void;
  onClear: () => void;
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
}: FriendOverlayProps) {
  const [open, setOpen] = useState(false);
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

  // Don't show if user isn't following anyone
  if (following.length === 0) return null;

  const activeFriend = activeFriendId
    ? following.find((f) => f.following_id === activeFriendId)
    : null;

  const activeName = activeFriend
    ? activeFriend.profile.display_name || activeFriend.profile.email || 'Friend'
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
    top: '8.4rem',
    left: '1rem',
    zIndex: 20,
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
};
