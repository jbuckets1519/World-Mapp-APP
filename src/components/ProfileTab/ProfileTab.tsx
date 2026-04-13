import { memo, useState, useRef, useEffect, useMemo } from 'react';
import type { ProfileData } from '../../hooks/useProfile';
import type { VisitedPlace } from '../../hooks/useTravelData';
import type { FollowRelation } from '../../types';
import TravelStats from '../Auth/TravelStats';
import { Achievements } from '../Achievements';
import { TAB_BAR_HEIGHT } from '../Navigation';
import { isUNMember } from '../../data/un-members';
import { COUNTRY_TO_CONTINENT } from '../../data/continents';
import type { Continent } from '../../data/continents';

const MAX_BIO_WORDS = 50;

interface ProfileTabProps {
  profile: ProfileData;
  saving: boolean;
  places: VisitedPlace[];
  totalPhotoCount: number;
  following: FollowRelation[];
  followers: FollowRelation[];
  onSave: (updates: { username?: string; bio?: string }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  onSignOut: () => void;
  onViewProfile: (userId: string) => void;
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function ProfileTab({
  profile,
  saving,
  places,
  totalPhotoCount,
  following,
  followers,
  onSave,
  onUploadAvatar,
  onSignOut,
  onViewProfile,
}: ProfileTabProps) {
  // --- Social list overlay ---
  const [socialList, setSocialList] = useState<'following' | 'followers' | null>(null);

  // --- Profile editing state ---
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset edit form when profile changes
  useEffect(() => {
    setUsername(profile.username ?? '');
    setBio(profile.bio ?? '');
    setSaveStatus('idle');
  }, [profile]);

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

  const displayName = profile.username || profile.display_name || profile.email || '?';
  const initial = (profile.username || profile.email || '?')[0].toUpperCase();

  // Compute country and continent counts for achievements
  const { achievementCountries, achievementContinents } = useMemo(() => {
    const active = places.filter((p) => p.is_visited !== false);
    const polygons = active.filter((p) => p.place_type === 'country' || p.place_type === 'territory');
    let countryCount = 0;
    const visitedContinents = new Set<Continent>();
    for (const p of polygons) {
      const name = p.place_id.replace(/^(country|territory):/, '');
      if (isUNMember(name)) {
        countryCount++;
        const continent = COUNTRY_TO_CONTINENT[name];
        if (continent) visitedContinents.add(continent);
      }
    }
    return { achievementCountries: countryCount, achievementContinents: visitedContinents.size };
  }, [places]);

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
              <button className="btn-press" style={styles.editBtn} onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            <button className="btn-press" style={styles.logoutBtn} onClick={onSignOut}>
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
              <button className="btn-press" style={styles.cancelBtn} onClick={() => {
                setEditing(false);
                setUsername(profile.username ?? '');
                setBio(profile.bio ?? '');
              }}>
                Cancel
              </button>
              <button
                className="btn-press"
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

        {/* ---- Following / Followers ---- */}
        <div style={styles.socialRow}>
          <button
            className="btn-press"
            style={styles.socialBtn}
            onClick={() => setSocialList('following')}
          >
            <span style={styles.socialCount}>{following.length}</span> Following
          </button>
          <span style={styles.socialDot}>·</span>
          <button
            className="btn-press"
            style={styles.socialBtn}
            onClick={() => setSocialList('followers')}
          >
            <span style={styles.socialCount}>{followers.length}</span> Follower{followers.length === 1 ? '' : 's'}
          </button>
        </div>

        {/* ---- Travel Stats ---- */}
        <TravelStats places={places} photoCount={totalPhotoCount} />

        {/* ---- Achievements ---- */}
        <Achievements countryCount={achievementCountries} continentCount={achievementContinents} />
      </div>

      {/* ---- Social list overlay ---- */}
      {socialList && (
        <div style={styles.socialOverlay} onClick={() => setSocialList(null)}>
          <div style={styles.socialPanel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.socialHeader}>
              <h3 style={styles.socialHeading}>
                {socialList === 'following' ? 'Following' : 'Followers'}
              </h3>
              <button style={styles.socialCloseBtn} onClick={() => setSocialList(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div style={styles.socialListScroll}>
              {(socialList === 'following' ? following : followers).length === 0 ? (
                <p style={styles.socialEmpty}>
                  {socialList === 'following'
                    ? "You're not following anyone yet"
                    : 'No followers yet'}
                </p>
              ) : (
                (socialList === 'following' ? following : followers).map((rel) => {
                  const userId = socialList === 'following' ? rel.following_id : rel.follower_id;
                  const name = rel.profile?.username || rel.profile?.display_name || 'Unknown';
                  return (
                    <button
                      key={rel.id}
                      className="btn-press"
                      style={styles.socialUserRow}
                      onClick={() => {
                        setSocialList(null);
                        onViewProfile(userId);
                      }}
                    >
                      {rel.profile?.avatar_url ? (
                        <div style={{ ...styles.socialAvatar, backgroundImage: `url(${rel.profile.avatar_url})` }} />
                      ) : (
                        <div style={styles.socialAvatar}>
                          <span style={styles.socialAvatarInitial}>{name[0].toUpperCase()}</span>
                        </div>
                      )}
                      <span style={styles.socialUserName}>{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProfileTab);

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

  // --- Profile Header ---
  profileHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.25rem',
    paddingBottom: '2rem',
    marginBottom: '0.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  avatar: {
    width: '84px',
    height: '84px',
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
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.92)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    letterSpacing: '-0.01em',
  },
  bioText: {
    margin: '0.5rem 0 0',
    fontSize: '0.85rem',
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 1.55,
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
    padding: '0.4rem 0.95rem',
    background: 'rgba(100, 180, 255, 0.15)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '999px',
    color: 'rgba(100, 180, 255, 0.95)',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  logoutBtn: {
    padding: '0.4rem 0.95rem',
    background: 'none',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // --- Inline Edit Section ---
  editSection: {
    padding: '1.5rem 0 2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
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
    padding: '0.65rem 0.9rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    minHeight: '80px',
    padding: '0.65rem 0.9rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    color: 'rgba(255, 255, 255, 0.88)',
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
    padding: '0.7rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '0.82rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    flex: 1,
    padding: '0.7rem',
    background: 'rgba(100, 180, 255, 0.22)',
    border: '1px solid rgba(100, 180, 255, 0.38)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: '0.82rem',
    fontWeight: 600,
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

  // --- Social row (following / followers) ---
  socialRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.85rem 0 0.25rem',
  },
  socialBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '0.25rem 0.4rem',
    borderRadius: '6px',
  },
  socialCount: {
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  socialDot: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: '0.9rem',
  },

  // --- Social list overlay ---
  socialOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  socialPanel: {
    width: '100%',
    maxWidth: '380px',
    maxHeight: '70vh',
    background: '#10111c',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  socialHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
  },
  socialHeading: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  socialCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  socialListScroll: {
    overflowY: 'auto' as const,
    padding: '0.5rem 0.75rem 1rem',
  },
  socialEmpty: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '0.82rem',
    textAlign: 'center' as const,
    padding: '2rem 1rem',
    margin: 0,
  },
  socialUserRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.6rem 0.5rem',
    background: 'none',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left' as const,
  },
  socialAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(100, 180, 255, 0.15)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  socialAvatarInitial: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'rgba(100, 180, 255, 0.7)',
  },
  socialUserName: {
    color: 'rgba(100, 180, 255, 0.9)',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
};
