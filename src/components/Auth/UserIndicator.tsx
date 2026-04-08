import type { ProfileData } from '../../hooks/useProfile';

interface UserIndicatorProps {
  email: string;
  profile: ProfileData | null;
  onSignOut: () => void;
  onEditProfile: () => void;
}

export default function UserIndicator({
  email,
  profile,
  onSignOut,
  onEditProfile,
}: UserIndicatorProps) {
  const displayName = profile?.username || profile?.display_name || email;
  const avatarUrl = profile?.avatar_url;
  const initial = (profile?.username || email || '?')[0].toUpperCase();

  return (
    <div style={styles.container}>
      {/* Avatar / initial — click to edit profile */}
      <button style={styles.avatarBtn} onClick={onEditProfile} aria-label="Edit profile">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={styles.avatarImg} />
        ) : (
          <span style={styles.avatarInitial}>{initial}</span>
        )}
      </button>

      <span style={styles.name}>{displayName}</span>

      <button style={styles.button} onClick={onSignOut}>
        Log out
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.3rem 0.7rem 0.3rem 0.35rem',
    background: 'rgba(15, 15, 25, 0.7)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    fontSize: '0.75rem',
    zIndex: 10,
  },
  avatarBtn: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'rgba(100, 180, 255, 0.15)',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  avatarInitial: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(100, 180, 255, 0.8)',
  },
  name: {
    color: 'rgba(255, 255, 255, 0.6)',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  button: {
    background: 'none',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.7rem',
    padding: '0.2rem 0.5rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
