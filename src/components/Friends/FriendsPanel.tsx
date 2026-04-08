import { useState, useRef, useEffect, useCallback } from 'react';
import type { UserProfile, FollowRelation } from '../../types';

interface FriendsPanelProps {
  following: FollowRelation[];
  followers: FollowRelation[];
  loading: boolean;
  onSearchUsers: (query: string) => Promise<UserProfile[]>;
  onFollow: (targetId: string) => Promise<boolean>;
  onUnfollow: (targetId: string) => Promise<boolean>;
  isFollowing: (targetId: string) => boolean;
  /** Called when the panel opens or closes */
  onOpenChange?: (isOpen: boolean) => void;
  /** Called when the user clicks a username to view their profile */
  onViewProfile?: (userId: string) => void;
}

type Tab = 'following' | 'followers';

export default function FriendsPanel({
  following,
  followers,
  loading,
  onSearchUsers,
  onFollow,
  onUnfollow,
  isFollowing,
  onOpenChange,
  onViewProfile,
}: FriendsPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('following');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Notify parent of open/close
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Debounced user search (username or email)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await onSearchUsers(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, onSearchUsers]);

  const handleFollow = useCallback(
    async (targetId: string) => {
      setActionLoading(targetId);
      await onFollow(targetId);
      setActionLoading(null);
      // Clear search after following
      setSearchQuery('');
      setSearchResults([]);
    },
    [onFollow],
  );

  const handleUnfollow = useCallback(
    async (targetId: string) => {
      setActionLoading(targetId);
      await onUnfollow(targetId);
      setActionLoading(null);
    },
    [onUnfollow],
  );

  // Display name helper
  const displayUser = (profile: UserProfile): string => {
    return profile.username || profile.display_name || profile.email || 'Unknown user';
  };

  if (!open) {
    return (
      <button style={styles.iconBtn} onClick={() => setOpen(true)} aria-label="Friends">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(100, 180, 255, 0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        {following.length > 0 && (
          <span style={styles.badge}>{following.length}</span>
        )}
      </button>
    );
  }

  return (
    <div ref={panelRef} style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Friends</h3>
        <button style={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
      </div>

      {/* Search by username or email */}
      <div style={styles.searchSection}>
        <input
          type="text"
          placeholder="Search by username or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
        {searching && <div style={styles.hint}>Searching...</div>}
        {searchResults.length > 0 && (
          <div style={styles.searchResults}>
            {searchResults.map((user) => (
              <div key={user.id} style={styles.userRow}>
                <div style={styles.userInfo} onClick={() => onViewProfile?.(user.id)} role="button">
                  <div style={styles.userNameLink}>{displayUser(user)}</div>
                  {user.email && user.username && (
                    <div style={styles.userEmail}>{user.email}</div>
                  )}
                </div>
                {isFollowing(user.id) ? (
                  <span style={styles.followingTag}>Following</span>
                ) : (
                  <button
                    style={styles.followBtn}
                    onClick={() => handleFollow(user.id)}
                    disabled={actionLoading === user.id}
                  >
                    {actionLoading === user.id ? '...' : 'Follow'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
          <div style={styles.hint}>No users found</div>
        )}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'following' ? styles.tabActive : {}) }}
          onClick={() => setTab('following')}
        >
          Following ({following.length})
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'followers' ? styles.tabActive : {}) }}
          onClick={() => setTab('followers')}
        >
          Followers ({followers.length})
        </button>
      </div>

      {/* List */}
      <div style={styles.list}>
        {loading ? (
          <div style={styles.hint}>Loading...</div>
        ) : tab === 'following' ? (
          following.length === 0 ? (
            <div style={styles.hint}>You're not following anyone yet</div>
          ) : (
            following.map((rel) => (
              <div key={rel.id} style={styles.userRow}>
                <div style={styles.userInfo} onClick={() => onViewProfile?.(rel.following_id)} role="button">
                  <div style={styles.userNameLink}>{displayUser(rel.profile)}</div>
                  {rel.profile.email && rel.profile.username && (
                    <div style={styles.userEmail}>{rel.profile.email}</div>
                  )}
                </div>
                <button
                  style={styles.unfollowBtn}
                  onClick={() => handleUnfollow(rel.following_id)}
                  disabled={actionLoading === rel.following_id}
                >
                  {actionLoading === rel.following_id ? '...' : 'Unfollow'}
                </button>
              </div>
            ))
          )
        ) : followers.length === 0 ? (
          <div style={styles.hint}>No one is following you yet</div>
        ) : (
          followers.map((rel) => (
            <div key={rel.id} style={styles.userRow}>
              <div style={styles.userInfo} onClick={() => onViewProfile?.(rel.follower_id)} role="button">
                <div style={styles.userNameLink}>{displayUser(rel.profile)}</div>
                {rel.profile.email && rel.profile.username && (
                  <div style={styles.userEmail}>{rel.profile.email}</div>
                )}
              </div>
              {/* Show follow-back button if not already following them */}
              {!isFollowing(rel.follower_id) ? (
                <button
                  style={styles.followBtn}
                  onClick={() => handleFollow(rel.follower_id)}
                  disabled={actionLoading === rel.follower_id}
                >
                  {actionLoading === rel.follower_id ? '...' : 'Follow back'}
                </button>
              ) : (
                <span style={styles.followingTag}>Following</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  iconBtn: {
    position: 'fixed',
    top: '5.8rem',
    left: '1rem',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 15, 25, 0.7)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    cursor: 'pointer',
    zIndex: 20,
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'rgba(100, 180, 255, 0.8)',
    color: '#000',
    fontSize: '0.6rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'fixed',
    top: '5.8rem',
    left: '1rem',
    width: '300px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 7rem)',
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.2)',
    borderRadius: '12px',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
  },
  title: {
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 600,
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0.15rem 0.3rem',
    lineHeight: 1,
  },
  searchSection: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    padding: '0.45rem 0.65rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  searchResults: {
    marginTop: '0.5rem',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '0.55rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabActive: {
    color: 'rgba(100, 180, 255, 0.9)',
    borderBottomColor: 'rgba(100, 180, 255, 0.6)',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0.5rem 0',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 1rem',
    gap: '0.5rem',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  userName: {
    color: '#fff',
    fontSize: '0.82rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  userNameLink: {
    color: 'rgba(100, 180, 255, 0.9)',
    fontSize: '0.82rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    cursor: 'pointer',
  },
  userEmail: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '0.7rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  followBtn: {
    padding: '0.25rem 0.65rem',
    background: 'rgba(100, 180, 255, 0.15)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.9)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  unfollowBtn: {
    padding: '0.25rem 0.65rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  followingTag: {
    padding: '0.25rem 0.65rem',
    color: 'rgba(80, 200, 120, 0.8)',
    fontSize: '0.72rem',
    flexShrink: 0,
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.78rem',
    textAlign: 'center',
    padding: '1rem',
  },
};
