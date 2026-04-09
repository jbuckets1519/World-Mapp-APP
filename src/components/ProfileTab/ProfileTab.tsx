import { useState, useRef, useEffect, useCallback } from 'react';
import type { ProfileData } from '../../hooks/useProfile';
import type { VisitedPlace } from '../../hooks/useTravelData';
import type { UserProfile, FollowRelation } from '../../types';
import TravelStats from '../Auth/TravelStats';
import { TAB_BAR_HEIGHT } from '../Navigation';

const MAX_BIO_WORDS = 50;

interface ProfileTabProps {
  profile: ProfileData;
  saving: boolean;
  places: VisitedPlace[];
  totalPhotoCount: number;
  onSave: (updates: { username?: string; bio?: string }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  onSignOut: () => void;
  // Friends props
  following: FollowRelation[];
  followers: FollowRelation[];
  friendsLoading: boolean;
  onSearchUsers: (query: string) => Promise<UserProfile[]>;
  onFollow: (targetId: string) => Promise<boolean>;
  onUnfollow: (targetId: string) => Promise<boolean>;
  isFollowing: (targetId: string) => boolean;
  onViewProfile: (userId: string) => void;
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

type FriendTab = 'following' | 'followers';

export default function ProfileTab({
  profile,
  saving,
  places,
  totalPhotoCount,
  onSave,
  onUploadAvatar,
  onSignOut,
  following,
  followers,
  friendsLoading,
  onSearchUsers,
  onFollow,
  onUnfollow,
  isFollowing,
  onViewProfile,
}: ProfileTabProps) {
  // --- Profile editing state ---
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Friends state ---
  const [friendTab, setFriendTab] = useState<FriendTab>('following');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset edit form when profile changes
  useEffect(() => {
    setUsername(profile.username ?? '');
    setBio(profile.bio ?? '');
    setSaveStatus('idle');
  }, [profile]);

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

  const wordCount = countWords(bio);
  const overLimit = wordCount > MAX_BIO_WORDS;

  const handleSave = async () => {
    if (overLimit) return;
    const ok = await onSave({
      username: username.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    setSaveStatus(ok ? 'saved' : 'error');
    if (ok) setEditing(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadAvatar(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    return p.username || p.display_name || p.email || 'Unknown user';
  };

  const displayName = profile.username || profile.display_name || profile.email || '?';
  const initial = (profile.username || profile.email || '?')[0].toUpperCase();

  return (
    <div style={styles.container}>
      <div style={styles.scrollArea}>
        {/* ---- Profile Header ---- */}
        <div style={styles.profileHeader}>
          <div
            style={{
              ...styles.avatar,
              backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : undefined,
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {!profile.avatar_url && (
              <span style={styles.avatarPlaceholder}>{initial}</span>
            )}
            <div style={styles.avatarOverlay}>Change</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarSelect}
          />

          <div style={styles.profileInfo}>
            <h2 style={styles.displayName}>{displayName}</h2>
            {profile.bio && !editing && (
              <p style={styles.bioText}>{profile.bio}</p>
            )}
            {profile.email && (
              <span style={styles.emailText}>{profile.email}</span>
            )}
          </div>

          <div style={styles.profileActions}>
            {!editing && (
              <button style={styles.editBtn} onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            <button style={styles.logoutBtn} onClick={onSignOut}>
              Log out
            </button>
          </div>
        </div>

        {/* ---- Inline Profile Editor ---- */}
        {editing && (
          <div style={styles.editSection}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              style={styles.input}
            />

            <label style={styles.label}>
              Bio
              <span style={{
                ...styles.wordCount,
                ...(overLimit ? styles.wordCountOver : {}),
              }}>
                {wordCount}/{MAX_BIO_WORDS} words
              </span>
            </label>
            <textarea
              placeholder="Tell people about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{
                ...styles.textarea,
                ...(overLimit ? styles.textareaOver : {}),
              }}
            />
            {overLimit && (
              <p style={styles.overWarning}>Bio must be {MAX_BIO_WORDS} words or fewer</p>
            )}

            <div style={styles.editBtnRow}>
              <button style={styles.cancelBtn} onClick={() => {
                setEditing(false);
                setUsername(profile.username ?? '');
                setBio(profile.bio ?? '');
              }}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.saveBtn,
                  ...(saveStatus === 'saved' ? styles.saveBtnSaved : {}),
                  ...(saveStatus === 'error' ? styles.saveBtnError : {}),
                }}
                onClick={handleSave}
                disabled={saving || overLimit}
              >
                {saving ? 'Saving...'
                  : saveStatus === 'saved' ? 'Saved!'
                  : saveStatus === 'error' ? 'Failed — try again'
                  : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* ---- Travel Stats ---- */}
        <TravelStats places={places} photoCount={totalPhotoCount} />

        {/* ---- Friends Section ---- */}
        <div style={styles.friendsSection}>
          <h3 style={styles.sectionHeading}>Friends</h3>

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

          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(friendTab === 'following' ? styles.tabActive : {}) }}
              onClick={() => setFriendTab('following')}
            >
              Following ({following.length})
            </button>
            <button
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
                  <div style={styles.userInfo} onClick={() => onViewProfile(rel.follower_id)} role="button">
                    <div style={styles.userNameLink}>{displayUser(rel.profile)}</div>
                    {rel.profile.email && rel.profile.username && (
                      <div style={styles.userEmail}>{rel.profile.email}</div>
                    )}
                  </div>
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
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    bottom: `${TAB_BAR_HEIGHT}px`,
    background: 'rgba(8, 8, 18, 1)',
    zIndex: 5,
  },
  scrollArea: {
    height: '100%',
    overflowY: 'auto' as const,
    padding: '1.5rem',
    maxWidth: '480px',
    margin: '0 auto',
  },

  // --- Profile Header ---
  profileHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid rgba(100, 180, 255, 0.1)',
  },
  avatar: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(100, 180, 255, 0.15)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative' as const,
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarPlaceholder: {
    fontSize: '1.6rem',
    fontWeight: 600,
    color: 'rgba(100, 180, 255, 0.7)',
  },
  avatarOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.15rem',
    background: 'rgba(0, 0, 0, 0.6)',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.6rem',
    textAlign: 'center',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  bioText: {
    margin: '0.3rem 0 0',
    fontSize: '0.8rem',
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  emailText: {
    fontSize: '0.72rem',
    color: 'rgba(255, 255, 255, 0.3)',
  },
  profileActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
    flexShrink: 0,
  },
  editBtn: {
    padding: '0.3rem 0.75rem',
    background: 'rgba(100, 180, 255, 0.15)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.9)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  logoutBtn: {
    padding: '0.3rem 0.75rem',
    background: 'none',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // --- Inline Edit Section ---
  editSection: {
    padding: '1rem 0',
    borderBottom: '1px solid rgba(100, 180, 255, 0.1)',
  },
  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.75rem',
    marginBottom: '0.3rem',
    marginTop: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.55rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    minHeight: '70px',
    padding: '0.55rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  },
  textareaOver: {
    borderColor: 'rgba(255, 80, 80, 0.4)',
  },
  wordCount: {
    fontSize: '0.7rem',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  wordCountOver: {
    color: 'rgba(255, 80, 80, 0.8)',
  },
  overWarning: {
    color: 'rgba(255, 80, 80, 0.7)',
    fontSize: '0.72rem',
    margin: '0.25rem 0 0 0',
  },
  editBtnRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.75rem',
  },
  cancelBtn: {
    flex: 1,
    padding: '0.55rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    flex: 1,
    padding: '0.55rem',
    background: 'rgba(100, 180, 255, 0.2)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.82rem',
    fontWeight: 500,
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

  // --- Friends Section ---
  friendsSection: {
    marginTop: '1.25rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid rgba(100, 180, 255, 0.1)',
  },
  sectionHeading: {
    margin: '0 0 0.75rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: '0.03em',
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  searchResults: {
    marginTop: '0.5rem',
    marginBottom: '0.5rem',
  },
  tabs: {
    display: 'flex',
    marginTop: '0.75rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
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
