import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { ProfileData } from '../../hooks/useProfile';
import type { VisitedPlace } from '../../hooks/useTravelData';
import type { UserProfile } from '../../types';
import TravelStats from './TravelStats';
import { Achievements } from '../Achievements';
import { TAB_BAR_HEIGHT } from '../Navigation';
import { isUNMember } from '../../data/un-members';
import { COUNTRY_TO_CONTINENT } from '../../data/continents';
import type { Continent } from '../../data/continents';

interface ProfileViewProps {
  userId: string;
  /** Logged-in user's id — used to hide the Follow button next to themselves */
  currentUserId: string | null;
  /** Function to check if the current (logged-in) user is following any given userId */
  isFollowing: (userId: string) => boolean;
  onFollow: (targetId: string) => Promise<boolean>;
  onUnfollow: (targetId: string) => Promise<boolean>;
  onClose: () => void;
  /** Switch to globe tab and show this friend's visited places */
  onViewMap?: (friendId: string) => void;
}

// Navigation stack — each frame is either a profile page or a followers/
// following list page. Tapping navigates deeper; the back button pops.
type Frame =
  | { kind: 'profile'; userId: string }
  | { kind: 'list'; userId: string; listType: 'followers' | 'following' };

/**
 * Read-only profile modal for viewing another user's profile.
 *
 * Supports recursive navigation: from a profile you can open the followers
 * or following list, tap a user in that list to open their profile, open
 * THEIR followers, and so on. A persistent back button walks the stack
 * back one frame at a time; popping past the root closes the modal.
 */
export default function ProfileView({
  userId,
  currentUserId,
  isFollowing,
  onFollow,
  onUnfollow,
  onClose,
  onViewMap,
}: ProfileViewProps) {
  const [stack, setStack] = useState<Frame[]>([{ kind: 'profile', userId }]);

  // If the parent reassigns the initial userId (e.g. opens a fresh modal),
  // reset the navigation stack so we don't show someone else's history.
  useEffect(() => {
    setStack([{ kind: 'profile', userId }]);
  }, [userId]);

  const current = stack[stack.length - 1];
  const atRoot = stack.length === 1;

  const push = useCallback((frame: Frame) => {
    setStack((s) => [...s, frame]);
  }, []);

  const back = useCallback(() => {
    if (atRoot) {
      onClose();
      return;
    }
    setStack((s) => s.slice(0, -1));
  }, [atRoot, onClose]);

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <button
          className="btn-press"
          style={styles.closeBtn}
          onClick={back}
          aria-label={atRoot ? 'Close' : 'Back'}
        >
          ←
        </button>

        {current.kind === 'profile' ? (
          <ProfileBody
            key={`p-${current.userId}`}
            userId={current.userId}
            isFollowing={isFollowing}
            onFollow={onFollow}
            onUnfollow={onUnfollow}
            onViewMap={onViewMap}
            onOpenList={(listType) =>
              push({ kind: 'list', userId: current.userId, listType })
            }
          />
        ) : (
          <ListBody
            key={`l-${current.userId}-${current.listType}`}
            userId={current.userId}
            listType={current.listType}
            currentUserId={currentUserId}
            isFollowing={isFollowing}
            onFollow={onFollow}
            onUnfollow={onUnfollow}
            onOpenProfile={(id) => push({ kind: 'profile', userId: id })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Profile body ──────────────────────────────────────────────────

interface ProfileBodyProps {
  userId: string;
  isFollowing: (userId: string) => boolean;
  onFollow: (targetId: string) => Promise<boolean>;
  onUnfollow: (targetId: string) => Promise<boolean>;
  onViewMap?: (friendId: string) => void;
  onOpenList: (listType: 'followers' | 'following') => void;
}

function ProfileBody({
  userId,
  isFollowing,
  onFollow,
  onUnfollow,
  onViewMap,
  onOpenList,
}: ProfileBodyProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);

  // Read the live follow state each render so the button label flips
  // immediately after a follow/unfollow tap.
  const following = isFollowing(userId);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    setLoading(true);

    const loadProfile = supabase
      .from('profiles')
      .select('id, username, display_name, email, avatar_url, bio, is_public')
      .eq('id', userId)
      .maybeSingle();

    const loadPlaces = supabase
      .from('visited_places')
      .select('*')
      .eq('user_id', userId)
      .order('visited_at', { ascending: false });

    const loadPhotoCount = supabase
      .from('travel_photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // "Following" count — how many people this user follows
    const loadFollowingCount = supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    // "Followers" count — how many people follow this user
    const loadFollowerCount = supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    Promise.all([
      loadProfile,
      loadPlaces,
      loadPhotoCount,
      loadFollowingCount,
      loadFollowerCount,
    ]).then(([profileRes, placesRes, photoRes, followingRes, followerRes]) => {
      if (cancelled) return;

      if (profileRes.error) {
        console.error('[ProfileView] profile load ERROR:', profileRes.error.message);
      } else if (profileRes.data) {
        setProfile(profileRes.data as ProfileData);
      }

      if (placesRes.error) {
        console.error('[ProfileView] places load ERROR:', placesRes.error.message);
      } else {
        setPlaces((placesRes.data ?? []) as VisitedPlace[]);
      }

      if (photoRes.error) {
        console.error('[ProfileView] photo count ERROR:', photoRes.error.message);
      } else {
        setPhotoCount(photoRes.count ?? 0);
      }

      if (followingRes.error) {
        console.error('[ProfileView] following count ERROR:', followingRes.error.message);
      } else {
        setFollowingCount(followingRes.count ?? 0);
      }

      if (followerRes.error) {
        console.error('[ProfileView] follower count ERROR:', followerRes.error.message);
      } else {
        setFollowerCount(followerRes.count ?? 0);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleFollowToggle = async () => {
    setActionLoading(true);
    if (following) {
      await onUnfollow(userId);
    } else {
      await onFollow(userId);
    }
    setActionLoading(false);
  };

  // Compute country and continent counts for achievements
  const { achievementCountries, achievementContinents } = useMemo(() => {
    const active = places.filter((p) => p.is_visited !== false);
    const polygons = active.filter(
      (p) => p.place_type === 'country' || p.place_type === 'territory',
    );
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

  const displayName = profile?.username || profile?.display_name || 'User';
  const initial = (profile?.username || profile?.display_name || '?')[0].toUpperCase();

  if (loading) {
    return <div style={styles.loadingText}>Loading profile...</div>;
  }
  if (!profile) {
    return <div style={styles.loadingText}>Profile not found</div>;
  }

  return (
    <>
      <div style={styles.avatarSection}>
        <div
          style={{
            ...styles.avatar,
            backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : undefined,
          }}
        >
          {!profile.avatar_url && <span style={styles.avatarInitial}>{initial}</span>}
        </div>
      </div>

      <h2 style={styles.name}>{displayName}</h2>

      {/* Following / Followers counts — tappable */}
      <div style={styles.countsRow}>
        <button
          className="btn-press"
          style={styles.countBtn}
          onClick={() => onOpenList('following')}
        >
          <strong style={styles.countNumber}>{followingCount}</strong>
          <span style={styles.countLabel}>Following</span>
        </button>
        <span style={styles.countDivider}>·</span>
        <button
          className="btn-press"
          style={styles.countBtn}
          onClick={() => onOpenList('followers')}
        >
          <strong style={styles.countNumber}>{followerCount}</strong>
          <span style={styles.countLabel}>Followers</span>
        </button>
      </div>

      {profile.bio && <p style={styles.bio}>{profile.bio}</p>}

      <button
        className="btn-press"
        style={{
          ...styles.followBtn,
          ...(following ? styles.followBtnActive : {}),
        }}
        onClick={handleFollowToggle}
        disabled={actionLoading}
      >
        {actionLoading ? '...' : following ? 'Following' : 'Follow'}
      </button>

      {following && onViewMap && (
        <button className="btn-press" style={styles.viewMapBtn} onClick={() => onViewMap(userId)}>
          View Map
        </button>
      )}

      <TravelStats places={places} photoCount={photoCount} />
      <Achievements countryCount={achievementCountries} continentCount={achievementContinents} />
    </>
  );
}

// ─── List body (followers / following) ─────────────────────────────

interface ListBodyProps {
  userId: string;
  listType: 'followers' | 'following';
  currentUserId: string | null;
  isFollowing: (userId: string) => boolean;
  onFollow: (targetId: string) => Promise<boolean>;
  onUnfollow: (targetId: string) => Promise<boolean>;
  onOpenProfile: (userId: string) => void;
}

interface ListRow {
  id: string;
  profile: UserProfile;
}

function ListBody({
  userId,
  listType,
  currentUserId,
  isFollowing,
  onFollow,
  onUnfollow,
  onOpenProfile,
}: ListBodyProps) {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    setLoading(true);

    // Load the list owner's display name for the header
    const loadOwner = supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle();

    // For "followers" (people who follow this user) we filter by following_id
    // and join the FOLLOWER profile. For "following" we filter by follower_id
    // and join the FOLLOWING profile.
    const loadList =
      listType === 'followers'
        ? supabase
            .from('follows')
            .select(
              'id, profile:profiles!follows_follower_id_fkey(id, username, display_name, email, avatar_url, bio, is_public)',
            )
            .eq('following_id', userId)
            .order('created_at', { ascending: false })
        : supabase
            .from('follows')
            .select(
              'id, profile:profiles!follows_following_id_fkey(id, username, display_name, email, avatar_url, bio, is_public)',
            )
            .eq('follower_id', userId)
            .order('created_at', { ascending: false });

    Promise.all([loadOwner, loadList]).then(([ownerRes, listRes]) => {
      if (cancelled) return;
      if (ownerRes.data) {
        setOwnerName(
          (ownerRes.data as { username?: string; display_name?: string }).username
            || (ownerRes.data as { display_name?: string }).display_name
            || 'User',
        );
      }
      if (listRes.error) {
        console.error('[ProfileView] list load ERROR:', listRes.error.message);
        setRows([]);
      } else {
        const mapped = (listRes.data ?? [])
          .map((row: Record<string, unknown>) => ({
            id: row.id as string,
            profile: row.profile as UserProfile,
          }))
          .filter((r) => r.profile);
        setRows(mapped);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, listType]);

  const handleToggle = async (targetId: string) => {
    setBusyId(targetId);
    if (isFollowing(targetId)) {
      await onUnfollow(targetId);
    } else {
      await onFollow(targetId);
    }
    setBusyId(null);
  };

  const heading = listType === 'followers'
    ? `${ownerName}'s Followers`
    : `${ownerName} is Following`;

  return (
    <>
      <h2 style={styles.listHeading}>{heading}</h2>
      {loading ? (
        <div style={styles.loadingText}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={styles.loadingText}>
          {listType === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
        </div>
      ) : (
        <div style={styles.list}>
          {rows.map((row) => {
            const p = row.profile;
            const name = p.username || p.display_name || 'User';
            const initial = name[0].toUpperCase();
            const followingThem = isFollowing(p.id);
            return (
              <div key={row.id} style={styles.listRow}>
                <div
                  style={styles.listRowMain}
                  role="button"
                  onClick={() => onOpenProfile(p.id)}
                >
                  <div
                    style={{
                      ...styles.listAvatar,
                      backgroundImage: p.avatar_url ? `url(${p.avatar_url})` : undefined,
                    }}
                  >
                    {!p.avatar_url && <span style={styles.listAvatarInitial}>{initial}</span>}
                  </div>
                  <div style={styles.listNameCol}>
                    <span style={styles.listName}>{name}</span>
                    {p.display_name && p.username && p.display_name !== p.username && (
                      <span style={styles.listSubname}>{p.display_name}</span>
                    )}
                  </div>
                </div>
                {p.id !== currentUserId && (
                  <button
                    className="btn-press"
                    style={{
                      ...styles.listFollowBtn,
                      ...(followingThem ? styles.listFollowBtnActive : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(p.id);
                    }}
                    disabled={busyId === p.id}
                  >
                    {busyId === p.id ? '...' : followingThem ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: 30,
    boxSizing: 'border-box',
  },
  card: {
    width: '340px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100% - 2rem)',
    overflowY: 'auto' as const,
    background: 'rgba(16, 18, 28, 0.72)',
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '22px',
    padding: '1.75rem',
    position: 'relative' as const,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    animation: 'fadeScaleIn 0.22s ease-out',
  },
  closeBtn: {
    position: 'absolute' as const,
    top: '0.75rem',
    left: '0.75rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: '1.4rem',
    cursor: 'pointer',
    padding: '0.2rem 0.5rem',
    lineHeight: 1,
    zIndex: 2,
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
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    letterSpacing: '-0.01em',
  },
  countsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    margin: '0 0 1rem',
  },
  countBtn: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.3rem',
    background: 'none',
    border: 'none',
    padding: '0.35rem 0.5rem',
    borderRadius: '8px',
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  countNumber: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  countLabel: {
    fontSize: '0.78rem',
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: 500,
  },
  countDivider: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.9rem',
  },
  bio: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '0.85rem',
    lineHeight: 1.55,
    textAlign: 'center',
    margin: '0 0 1.25rem',
    whiteSpace: 'pre-wrap' as const,
  },
  followBtn: {
    width: '100%',
    padding: '0.8rem',
    background: 'rgba(100, 180, 255, 0.22)',
    border: '1px solid rgba(100, 180, 255, 0.38)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  followBtnActive: {
    background: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    color: 'rgba(255, 255, 255, 0.55)',
  },
  viewMapBtn: {
    width: '100%',
    padding: '0.8rem',
    marginTop: '0.6rem',
    background: 'rgba(220, 50, 50, 0.8)',
    border: '1px solid rgba(255, 80, 80, 0.5)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  // ── List view ──
  listHeading: {
    margin: '0.25rem 0 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    paddingLeft: '2rem',
    paddingRight: '0.5rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.65rem',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '14px',
  },
  listRowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  listAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'rgba(100, 180, 255, 0.15)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listAvatarInitial: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'rgba(100, 180, 255, 0.8)',
  },
  listNameCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0,
    flex: 1,
  },
  listName: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: '0.9rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  listSubname: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  listFollowBtn: {
    padding: '0.4rem 0.85rem',
    background: 'rgba(100, 180, 255, 0.22)',
    border: '1px solid rgba(100, 180, 255, 0.38)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  listFollowBtnActive: {
    background: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    color: 'rgba(255, 255, 255, 0.55)',
  },
};
