import { memo, useState, useRef, useEffect, useCallback } from 'react';
import type { UserProfile, FollowRelation } from '../../types';
import { TAB_BAR_HEIGHT } from '../Navigation';

type FriendTab = 'following' | 'followers';

interface FriendsTabProps {
  following: FollowRelation[];
  followers: FollowRelation[];
  friendsLoading: boolean;
  onSearchUsers: (query: string) => Promise<UserProfile[]>;
  onFollow: (targetId: string) => Promise<boolean>;
  onUnfollow: (targetId: string) => Promise<boolean>;
  isFollowing: (targetId: string) => boolean;
  onViewProfile: (userId: string) => void;
}

function FriendsTab({
  following,
  followers,
  friendsLoading,
  onSearchUsers,
  onFollow,
  onUnfollow,
  isFollowing,
  onViewProfile,
}: FriendsTabProps) {
  const [friendTab, setFriendTab] = useState<FriendTab>('following');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced user search
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

  const handleFollow = useCallback(async (targetId: string) => {
    setActionLoading(targetId);
    await onFollow(targetId);
    setActionLoading(null);
    setSearchQuery('');
    setSearchResults([]);
  }, [onFollow]);

  const handleUnfollow = useCallback(async (targetId: string) => {
    setActionLoading(targetId);
    await onUnfollow(targetId);
    setActionLoading(null);
  }, [onUnfollow]);

  const displayUser = (p: UserProfile): string => {
    return p.username || p.display_name || 'Unknown user';
  };

  return (
    <div style={styles.container}>
      <div style={styles.scrollArea}>
        <h2 style={styles.heading}>Friends</h2>

        {/* Search */}
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
                <div style={styles.userInfo} onClick={() => onViewProfile(user.id)} role="button">
                  <div style={styles.userNameLink}>{displayUser(user)}</div>
                </div>
                {isFollowing(user.id) ? (
                  <span style={styles.followingTag}>Following</span>
                ) : (
                  <button
                    className="btn-press"
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

        {/* Following / Followers tabs */}
        <div style={styles.tabs}>
          <button
            className="btn-press"
            style={{ ...styles.tab, ...(friendTab === 'following' ? styles.tabActive : {}) }}
            onClick={() => setFriendTab('following')}
          >
            Following ({following.length})
          </button>
          <button
            className="btn-press"
            style={{ ...styles.tab, ...(friendTab === 'followers' ? styles.tabActive : {}) }}
            onClick={() => setFriendTab('followers')}
          >
            Followers ({followers.length})
          </button>
        </div>

        {/* List */}
        <div style={styles.friendList}>
          {friendsLoading ? (
            <div style={styles.hint}>Loading...</div>
          ) : friendTab === 'following' ? (
            following.length === 0 ? (
              <div style={styles.hint}>You're not following anyone yet</div>
            ) : (
              following.map((rel) => (
                <div key={rel.id} style={styles.userRow}>
                  <div style={styles.userInfo} onClick={() => onViewProfile(rel.following_id)} role="button">
                    <div style={styles.userNameLink}>{displayUser(rel.profile)}</div>
                  </div>
                  <button
                    className="btn-press"
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
                <div style={styles.userInfo} onClick={() => onViewProfile(rel.follower_id)} role="button">
                  <div style={styles.userNameLink}>{displayUser(rel.profile)}</div>
                </div>
                {!isFollowing(rel.follower_id) ? (
                  <button
                    className="btn-press"
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
    </div>
  );
}

export default memo(FriendsTab);

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
    background: 'rgba(8, 8, 18, 1)',
    zIndex: 5,
  },
  scrollArea: {
    height: '100%',
    overflowY: 'auto' as const,
    padding: '2.25rem 1.75rem 2.5rem',
    paddingTop: 'calc(2.25rem + env(safe-area-inset-top, 0px))',
    maxWidth: '480px',
    margin: '0 auto',
    animation: 'tabFadeIn 260ms ease-out',
  },
  heading: {
    margin: '0 0 1.25rem',
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: '-0.01em',
  },
  searchInput: {
    width: '100%',
    padding: '0.7rem 1rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  searchResults: {
    marginTop: '0.75rem',
    marginBottom: '0.75rem',
  },
  tabs: {
    display: 'flex',
    marginTop: '1.25rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  tab: {
    flex: 1,
    padding: '0.75rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'color 220ms ease-out, border-color 220ms ease-out',
  },
  tabActive: {
    color: 'rgba(140, 200, 255, 0.95)',
    borderBottomColor: 'rgba(140, 200, 255, 0.7)',
  },
  friendList: {
    padding: '0.5rem 0 1rem',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    gap: '0.5rem',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
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
    padding: '0.4rem 1rem',
    background: 'rgba(100, 180, 255, 0.18)',
    border: '1px solid rgba(100, 180, 255, 0.35)',
    borderRadius: '999px',
    color: 'rgba(100, 180, 255, 0.95)',
    fontSize: '0.72rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  unfollowBtn: {
    padding: '0.4rem 1rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: '0.72rem',
    fontWeight: 500,
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
