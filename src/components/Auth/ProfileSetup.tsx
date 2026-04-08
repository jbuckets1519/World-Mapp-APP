import { useState, useRef } from 'react';
import type { ProfileData } from '../../hooks/useProfile';

const MAX_BIO_WORDS = 50;

interface ProfileSetupProps {
  profile: ProfileData;
  saving: boolean;
  onSave: (updates: { username?: string; bio?: string }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  /** Called after the user successfully saves — dismisses the setup */
  onComplete: () => void;
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

/**
 * First-time profile setup modal. Cannot be dismissed — the user must
 * set at least a username before they can use the app.
 */
export default function ProfileSetup({
  profile,
  saving,
  onSave,
  onUploadAvatar,
  onComplete,
}: ProfileSetupProps) {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = countWords(bio);
  const overLimit = wordCount > MAX_BIO_WORDS;
  const canSave = username.trim().length >= 2 && !overLimit;

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);

    const ok = await onSave({
      username: username.trim(),
      bio: bio.trim() || undefined,
    });

    if (ok) {
      onComplete();
    } else {
      setError('That username may already be taken. Try another one.');
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadAvatar(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const initial = (username || profile.email || '?')[0].toUpperCase();

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome! Set up your profile</h2>
        <p style={styles.subtitle}>Choose a username to get started.</p>

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
              <span style={styles.avatarInitial}>{initial}</span>
            )}
            <div style={styles.avatarOverlay}>Add photo</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarSelect}
          />
        </div>

        {/* Username (required) */}
        <label style={styles.label}>
          Username <span style={styles.required}>*</span>
        </label>
        <input
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={30}
          style={styles.input}
          autoFocus
        />
        {username.length > 0 && username.trim().length < 2 && (
          <p style={styles.hint}>Must be at least 2 characters</p>
        )}

        {/* Bio (optional) */}
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
          placeholder="Tell people about yourself... (optional)"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          style={{
            ...styles.textarea,
            ...(overLimit ? styles.textareaOver : {}),
          }}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{
            ...styles.saveBtn,
            ...(!canSave ? styles.saveBtnDisabled : {}),
          }}
          onClick={handleSave}
          disabled={saving || !canSave}
        >
          {saving ? 'Saving...' : 'Get Started'}
        </button>
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
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: 25,
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
    padding: '1.75rem',
  },
  title: {
    margin: '0 0 0.3rem',
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.85rem',
    textAlign: 'center',
    margin: '0 0 1.25rem',
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
  avatarInitial: {
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
  required: {
    color: 'rgba(255, 80, 80, 0.7)',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    minHeight: '70px',
    padding: '0.6rem 0.75rem',
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
  hint: {
    color: 'rgba(255, 200, 50, 0.7)',
    fontSize: '0.72rem',
    margin: '0.25rem 0 0 0',
  },
  error: {
    color: 'rgba(255, 80, 80, 0.8)',
    fontSize: '0.8rem',
    textAlign: 'center',
    margin: '0.75rem 0 0 0',
  },
  saveBtn: {
    width: '100%',
    padding: '0.7rem',
    marginTop: '1.25rem',
    background: 'rgba(100, 180, 255, 0.2)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
};
