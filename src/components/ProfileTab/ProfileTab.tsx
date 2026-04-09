import { useState, useRef, useEffect, useMemo } from 'react';
import type { ProfileData } from '../../hooks/useProfile';
import type { VisitedPlace } from '../../hooks/useTravelData';
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
  onSave: (updates: { username?: string; bio?: string }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  onSignOut: () => void;
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

export default function ProfileTab({
  profile,
  saving,
  places,
  totalPhotoCount,
  onSave,
  onUploadAvatar,
  onSignOut,
}: ProfileTabProps) {
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

        {/* ---- Achievements ---- */}
        <Achievements countryCount={achievementCountries} continentCount={achievementContinents} />
      </div>
    </div>
  );
}

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
    padding: '1.5rem',
    paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))',
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

};
