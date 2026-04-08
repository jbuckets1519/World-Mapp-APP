import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { ProfileData } from '../../hooks/useProfile';

interface ProfileViewProps {
  userId: string;
  /** Whether the viewer is following this user */
  isFollowing: boolean;
  onFollow: (targetId: string) => Promise<boolean>;
  onUnfollow: (targetId: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Read-only profile modal for viewing another user's profile.
 * Loads their profile data on mount, shows avatar, username, bio,
 * and a follow/unfollow button.
 */
export default function ProfileView({
  userId,
  isFollowing,
  onFollow,
  onUnfollow,
  onClose,
}: ProfileViewProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    setLoading(true);

    supabase
      .from('profiles')
      .select('id, username, display_name, email, avatar_url, bio, is_public')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProfileView] load ERROR:', error.message);
        } else if (data) {
          setProfile(data as ProfileData);
        }
        setLoading(false);
      });
  }, [userId]);

  const handleFollowToggle = async () => {
    setActionLoading(true);
    if (isFollowing) {
      await onUnfollow(userId);
    } else {
      await onFollow(userId);
    }
    setActionLoading(false);
  };

  const displayName = profile?.username || profile?.email || 'User';
  const initial = (profile?.username || profile?.email || '?')[0].toUpperCase();

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>

        {loading ? (
          <div style={styles.loadingText}>Loading profile...</div>
        ) : !profile ? (
          <div style={styles.loadingText}>Profile not found</div>
        ) : (
          <>
            {/* Avatar */}
            <div style={styles.avatarSection}>
              <div
                style={{
                  ...styles.avatar,
                  backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : undefined,
                }}
              >
                {!profile.avatar_url && (
                  <span style={styles.avatarInitial}>{initial}</span>
                )}
              </div>
            </div>

            {/* Username */}
            <h2 style={styles.name}>{displayName}</h2>

            {/* Bio */}
            {profile.bio && (
              <p style={styles.bio}>{profile.bio}</p>
            )}

            {/* Follow / Unfollow button */}
            <button
              style={{
                ...styles.followBtn,
                ...(isFollowing ? styles.followBtnActive : {}),
              }}
              onClick={handleFollowToggle}
              disabled={actionLoading}
            >
              {actionLoading
                ? '...'
                : isFollowing
                  ? 'Following'
                  : 'Follow'}
            </button>
          </>
        )}
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
    width: '320px',
    maxWidth: 'calc(100vw - 2rem)',
    background: 'rgba(15, 15, 25, 0.97)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '14px',
    padding: '1.5rem',
    position: 'relative' as const,
  },
  closeBtn: {
    position: 'absolute' as const,
    top: '0.75rem',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '0.2rem 0.4rem',
    lineHeight: 1,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.9rem',
    textAlign: 'center',
    padding: '2rem 0',
  },
  avatarSection: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
    marginTop: '0.5rem',
  },
  avatar: {
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    background: 'rgba(100, 180, 255, 0.15)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: '2rem',
    fontWeight: 600,
    color: 'rgba(100, 180, 255, 0.7)',
  },
  name: {
    margin: '0 0 0.5rem',
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
  },
  bio: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '0.85rem',
    lineHeight: 1.5,
    textAlign: 'center',
    margin: '0 0 1.25rem',
    whiteSpace: 'pre-wrap' as const,
  },
  followBtn: {
    width: '100%',
    padding: '0.65rem',
    background: 'rgba(100, 180, 255, 0.2)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  followBtnActive: {
    background: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    color: 'rgba(255, 255, 255, 0.5)',
  },
};
