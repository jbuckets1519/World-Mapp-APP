import { useState, useEffect, useRef } from 'react';
import type { ProfileData } from '../../hooks/useProfile';
import type { VisitedPlace } from '../../hooks/useTravelData';
import TravelStats from './TravelStats';

const MAX_BIO_WORDS = 50;

interface ProfileEditorProps {
  profile: ProfileData;
  saving: boolean;
  places: VisitedPlace[];
  totalPhotoCount: number;
  onSave: (updates: { username?: string; bio?: string }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  onClose: () => void;
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

export default function ProfileEditor({
  profile,
  saving,
  places,
  totalPhotoCount,
  onSave,
  onUploadAvatar,
  onClose,
}: ProfileEditorProps) {
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when profile changes
  useEffect(() => {
    setUsername(profile.username ?? '');
    setBio(profile.bio ?? '');
    setSaveStatus('idle');
  }, [profile]);

  const wordCount = countWords(bio);
  const overLimit = wordCount > MAX_BIO_WORDS;

  const handleBioChange = (value: string) => {
    // Allow typing but enforce limit on save
    setBio(value);
  };

  const handleSave = async () => {
    if (overLimit) return;

    const ok = await onSave({
      username: username.trim() || undefined,
      bio: bio.trim() || undefined,
    });

    setSaveStatus(ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadAvatar(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Edit Profile</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Avatar */}
        <div style={styles.avatarSection}>
          <div
            style={{
              ...styles.avatar,
              backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : undefined,
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {!profile.avatar_url && (
              <span style={styles.avatarPlaceholder}>
                {(username || profile.email || '?')[0].toUpperCase()}
              </span>
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
        </div>

        {/* Username */}
        <label style={styles.label}>Username</label>
        <input
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={30}
          style={styles.input}
        />

        {/* Bio */}
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
          onChange={(e) => handleBioChange(e.target.value)}
          style={{
            ...styles.textarea,
            ...(overLimit ? styles.textareaOver : {}),
          }}
        />
        {overLimit && (
          <p style={styles.overWarning}>Bio must be {MAX_BIO_WORDS} words or fewer</p>
        )}

        {/* Email (read-only) */}
        <label style={styles.label}>Email</label>
        <div style={styles.readOnly}>{profile.email ?? 'Not set'}</div>

        {/* Save */}
        <button
          style={{
            ...styles.saveBtn,
            ...(saveStatus === 'saved' ? styles.saveBtnSaved : {}),
            ...(saveStatus === 'error' ? styles.saveBtnError : {}),
          }}
          onClick={handleSave}
          disabled={saving || overLimit}
        >
          {saving
            ? 'Saving...'
            : saveStatus === 'saved'
              ? 'Saved!'
              : saveStatus === 'error'
                ? 'Failed — try again'
                : 'Save Profile'}
        </button>

        {/* Travel stats dashboard */}
        <TravelStats places={places} photoCount={totalPhotoCount} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: 30,
  },
  card: {
    width: '360px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 4rem)',
    overflowY: 'auto' as const,
    background: 'rgba(15, 15, 25, 0.97)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '14px',
    padding: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  title: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#fff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '0.2rem 0.4rem',
    lineHeight: 1,
  },
  avatarSection: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  avatar: {
    width: '80px',
    height: '80px',
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
  },
  avatarPlaceholder: {
    fontSize: '1.8rem',
    fontWeight: 600,
    color: 'rgba(100, 180, 255, 0.7)',
  },
  avatarOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.2rem',
    background: 'rgba(0, 0, 0, 0.6)',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.65rem',
    textAlign: 'center',
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
    minHeight: '80px',
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
  readOnly: {
    padding: '0.55rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.85rem',
  },
  saveBtn: {
    width: '100%',
    padding: '0.65rem',
    marginTop: '1.25rem',
    background: 'rgba(100, 180, 255, 0.2)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.85rem',
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
