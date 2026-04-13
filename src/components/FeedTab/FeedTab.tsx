import { memo, useRef, useState, useCallback } from 'react';
import type { ActivityItem } from '../../hooks/useActivityFeed';
import { TAB_BAR_HEIGHT } from '../Navigation';
import { Badge, resolveBadge } from '../Achievements/Achievements';

interface FeedTabProps {
  feed: ActivityItem[];
  loading: boolean;
  refreshing: boolean;
  followingCount: number;
  onRefresh: () => Promise<void> | void;
  /** Called when user taps an activity that refers to a country/state/city.
   *  Receives the posting user's id so the parent can open their friend
   *  activity page (not the current user's map). */
  onNavigateToPlace: (userId: string, placeId: string, placeType: string) => void;
  /** Called when user taps a friend's avatar or username to view their profile */
  onViewProfile: (userId: string) => void;
}

/**
 * Format a timestamp as a short relative string ("2 hours ago", "3 days ago").
 * Stays locale-light and avoids pulling in dayjs/date-fns for a single format.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk} week${diffWk === 1 ? '' : 's'} ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return `${diffMo} month${diffMo === 1 ? '' : 's'} ago`;
  const diffYr = Math.round(diffDay / 365);
  return `${diffYr} year${diffYr === 1 ? '' : 's'} ago`;
}

/** Username fallback chain for display. */
function displayName(profile: ActivityItem['profile']): string {
  return profile?.username || profile?.display_name || 'Someone';
}

/** Human-readable visit-date range for a feed card, or null if none set. */
function formatVisitDates(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (iso: string) => {
    // YYYY-MM-DD — parse as local date (not UTC) so the day doesn't drift.
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  if (start && end) {
    if (start === end) return fmt(start);
    return `${fmt(start)} — ${fmt(end)}`;
  }
  return fmt((start ?? end)!);
}

const NOTES_PREVIEW_LIMIT = 150;

/** Circular avatar — image if provided, otherwise the username's first letter. */
function Avatar({
  profile,
  onClick,
}: {
  profile: ActivityItem['profile'];
  onClick?: (e: React.MouseEvent) => void;
}) {
  const initial = (profile?.username || profile?.display_name || '?')[0].toUpperCase();
  const interactive = Boolean(onClick);
  const baseStyle = {
    ...styles.avatar,
    ...(interactive ? { cursor: 'pointer' as const } : {}),
  };
  if (profile?.avatar_url) {
    return (
      <div
        role={interactive ? 'button' : undefined}
        aria-label={interactive ? 'View profile' : undefined}
        onClick={onClick}
        style={{ ...baseStyle, backgroundImage: `url(${profile.avatar_url})` }}
      />
    );
  }
  return (
    <div
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? 'View profile' : undefined}
      onClick={onClick}
      style={baseStyle}
    >
      <span style={styles.avatarInitial}>{initial}</span>
    </div>
  );
}

function FeedTab({
  feed,
  loading,
  refreshing,
  followingCount,
  onRefresh,
  onNavigateToPlace,
  onViewProfile,
}: FeedTabProps) {
  // --- Pull-to-refresh (touch-driven) ---
  // We track touchStartY and release-distance. When the user pulls down from
  // the top of the scroll area by > 70px, we trigger onRefresh on release.
  const scrollRef = useRef<HTMLDivElement>(null);
  // One-shot spin state for the refresh button icon — runs a 500ms rotation
  // on every click, independent of the network refresh duration.
  const [spinning, setSpinning] = useState(false);
  const spinTimeoutRef = useRef<number | null>(null);

  const handleRefreshClick = useCallback(() => {
    setSpinning(true);
    if (spinTimeoutRef.current !== null) window.clearTimeout(spinTimeoutRef.current);
    spinTimeoutRef.current = window.setTimeout(() => setSpinning(false), 500);
    onRefresh();
  }, [onRefresh]);
  const touchStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      // Dampen for a natural rubber-band feel
      setPullDistance(Math.min(100, dy * 0.5));
    }
  };
  const onTouchEnd = () => {
    if (pullDistance > 55) {
      onRefresh();
    }
    setPullDistance(0);
    touchStartY.current = null;
  };

  const handleItemClick = useCallback(
    (item: ActivityItem) => {
      // Only navigate for activity types that reference a place on the globe
      if (!item.place_id || !item.place_type) return;
      if (item.activity_type === 'badge') return;
      onNavigateToPlace(item.user_id, item.place_id, item.place_type);
    },
    [onNavigateToPlace],
  );

  return (
    <div style={styles.container}>
      <style>{`@keyframes feedRefreshSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div
        ref={scrollRef}
        style={styles.scrollArea}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            style={{
              ...styles.pullIndicator,
              height: refreshing ? 42 : pullDistance,
              opacity: refreshing ? 1 : Math.min(1, pullDistance / 55),
            }}
          >
            {refreshing ? 'Refreshing…' : pullDistance > 55 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        )}

        <div style={styles.headerRow}>
          <h2 style={styles.heading}>Feed</h2>
          <button
            style={styles.refreshBtn}
            onClick={handleRefreshClick}
            aria-label="Refresh feed"
          >
            <span
              style={{
                ...styles.refreshIcon,
                ...(spinning ? styles.refreshIconSpinning : {}),
              }}
            >
              ↻
            </span>
          </button>
        </div>

        {loading && feed.length === 0 ? (
          <div style={styles.empty}>Loading activity…</div>
        ) : feed.length === 0 ? (
          <div style={styles.empty}>
            {followingCount === 0
              ? "No activity yet — follow people to see their adventures here"
              : 'No activity yet'}
          </div>
        ) : (
          <div style={styles.list}>
            {feed.map((item) => {
              const handleProfileTap = (e: React.MouseEvent) => {
                e.stopPropagation();
                onViewProfile(item.user_id);
              };
              const name = displayName(item.profile);

              // ── Badge row: preserved from the old feed, unchanged ──────
              if (item.activity_type === 'badge') {
                const badgeInfo = resolveBadge(
                  item.metadata?.badge_category,
                  item.metadata?.badge_name,
                );
                return (
                  <div key={item.id} style={styles.item}>
                    <Avatar profile={item.profile} onClick={handleProfileTap} />
                    <div style={styles.itemBody}>
                      <p style={styles.itemText}>
                        <span role="button" style={styles.itemName} onClick={handleProfileTap}>
                          {name}
                        </span>
                        {` earned ${item.metadata?.badge_name ?? 'a new'} badge`}
                      </p>
                      <span style={styles.itemTime}>{relativeTime(item.created_at)}</span>
                    </div>
                    {badgeInfo && (
                      <div style={styles.badgeIcon} aria-hidden>
                        <Badge tier={badgeInfo.tier} palette={badgeInfo.palette} size={32} locked={false} />
                      </div>
                    )}
                  </div>
                );
              }

              // ── Post row: "BokBok added a post to France" ──────────────
              // Each post is its own static row. The caption lives in
              // `shared_notes` and thumbnails in `shared_photo_urls`, so the
              // same normalizer used by visited cards applies. We only need
              // a different header to show the "added a post to" phrasing.
              if (item.activity_type === 'post') {
                const rawCaption = item.shared_notes ?? '';
                const hasCaption = rawCaption.trim().length > 0;
                const truncatedCap = rawCaption.length > NOTES_PREVIEW_LIMIT;
                const capPreview = truncatedCap
                  ? rawCaption.slice(0, NOTES_PREVIEW_LIMIT).trimEnd() + '…'
                  : rawCaption;
                const postUrls = item.shared_photo_urls ?? [];
                const postThumbs = postUrls.slice(0, 4);
                const extraPost = Math.max(0, postUrls.length - postThumbs.length);
                return (
                  <div
                    key={item.id}
                    className="btn-press"
                    style={{ ...styles.card, cursor: 'pointer' }}
                    onClick={() => handleItemClick(item)}
                    role="button"
                  >
                    <div style={styles.cardHeader}>
                      <Avatar profile={item.profile} onClick={handleProfileTap} />
                      <div style={styles.cardHeaderText}>
                        <p style={styles.postHeaderLine}>
                          <span role="button" style={styles.itemName} onClick={handleProfileTap}>
                            {name}
                          </span>
                          {' added a post to '}
                          <span style={styles.postPlace}>{item.place_name ?? 'a place'}</span>
                        </p>
                      </div>
                    </div>
                    {hasCaption && (
                      <p style={styles.cardNotes}>
                        {capPreview}
                        {truncatedCap && <span style={styles.cardReadMore}> read more</span>}
                      </p>
                    )}
                    {postThumbs.length > 0 && (
                      <div style={styles.cardThumbs}>
                        {postThumbs.map((url, i) => (
                          <div key={url + i} style={styles.cardThumbWrap}>
                            <img src={url} alt="" style={styles.cardThumb} loading="lazy" decoding="async" />
                            {i === postThumbs.length - 1 && extraPost > 0 && (
                              <div style={styles.cardThumbOverlay}>+{extraPost}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <span style={styles.itemTime}>{relativeTime(item.created_at)}</span>
                  </div>
                );
              }

              // ── Living place card ───────────────────────────────────────
              const clickable = Boolean(item.place_id && item.place_type);
              const subtitle = item.metadata?.place_subtitle ?? null;
              const dates = formatVisitDates(
                item.metadata?.visit_start_date,
                item.metadata?.visit_end_date,
              );
              const rawNotes = item.shared_notes ?? '';
              const hasNotes = rawNotes.trim().length > 0;
              const truncated = rawNotes.length > NOTES_PREVIEW_LIMIT;
              const notesPreview = truncated
                ? rawNotes.slice(0, NOTES_PREVIEW_LIMIT).trimEnd() + '…'
                : rawNotes;
              const photoUrls = item.shared_photo_urls ?? [];
              const thumbUrls = photoUrls.slice(0, 4);
              const extraPhotos = Math.max(0, photoUrls.length - thumbUrls.length);
              // Fresh update if updated_at differs from created_at — use a
              // 5-second slack to ignore clock skew between insert + update.
              const createdMs = new Date(item.created_at).getTime();
              const updatedMs = new Date(item.updated_at).getTime();
              const isBumped = updatedMs - createdMs > 5000;
              const timeLabel = isBumped
                ? `updated ${relativeTime(item.updated_at)}`
                : relativeTime(item.created_at);

              return (
                <div
                  key={item.id}
                  className={clickable ? 'btn-press' : undefined}
                  style={{
                    ...styles.card,
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                  onClick={clickable ? () => handleItemClick(item) : undefined}
                  role={clickable ? 'button' : undefined}
                >
                  <div style={styles.cardHeader}>
                    <Avatar profile={item.profile} onClick={handleProfileTap} />
                    <div style={styles.cardHeaderText}>
                      <span role="button" style={styles.itemName} onClick={handleProfileTap}>
                        {name}
                      </span>
                      <span style={styles.cardPlace}>
                        {item.place_name ?? 'a place'}
                        {subtitle && <span style={styles.cardSubtitle}>, {subtitle}</span>}
                      </span>
                      {dates && <span style={styles.cardDates}>{dates}</span>}
                    </div>
                  </div>

                  {hasNotes && (
                    <p style={styles.cardNotes}>
                      {notesPreview}
                      {truncated && <span style={styles.cardReadMore}> read more</span>}
                    </p>
                  )}

                  {thumbUrls.length > 0 && (
                    <div style={styles.cardThumbs}>
                      {thumbUrls.map((url, i) => (
                        <div key={url + i} style={styles.cardThumbWrap}>
                          <img src={url} alt="" style={styles.cardThumb} loading="lazy" decoding="async" />
                          {i === thumbUrls.length - 1 && extraPhotos > 0 && (
                            <div style={styles.cardThumbOverlay}>+{extraPhotos}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <span style={styles.itemTime}>{timeLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(FeedTab);

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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  heading: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: '-0.01em',
  },
  refreshBtn: {
    width: '36px',
    height: '36px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    display: 'inline-block',
    lineHeight: 1,
    transformOrigin: 'center center',
  },
  refreshIconSpinning: {
    animation: 'feedRefreshSpin 500ms ease-in-out',
  },
  pullIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.8rem',
    overflow: 'hidden',
    transition: 'height 160ms ease-out, opacity 160ms ease-out',
  },
  empty: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.88rem',
    textAlign: 'center',
    padding: '3rem 1rem',
    lineHeight: 1.55,
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    padding: '0.9rem 1rem',
    background: 'rgba(255, 255, 255, 0.045)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '18px',
  },
  avatar: {
    width: '40px',
    height: '40px',
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
  avatarInitial: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'rgba(100, 180, 255, 0.8)',
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  itemText: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.88rem',
    lineHeight: 1.45,
    wordBreak: 'break-word' as const,
  },
  itemName: {
    fontWeight: 600,
    color: 'rgba(140, 200, 255, 0.95)',
    cursor: 'pointer',
  },
  itemTime: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.72rem',
  },
  badgeIcon: {
    flexShrink: 0,
    alignSelf: 'center',
    marginLeft: '0.25rem',
  },
  // ── Living place card ─────────────────────────────────────────────
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.65rem',
    padding: '0.95rem 1rem 0.85rem',
    background: 'rgba(255, 255, 255, 0.045)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '18px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.15rem',
  },
  cardPlace: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.92rem',
    fontWeight: 500,
    lineHeight: 1.3,
    wordBreak: 'break-word' as const,
  },
  cardSubtitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: 400,
  },
  cardDates: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.75rem',
  },
  cardNotes: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '0.85rem',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  cardReadMore: {
    color: 'rgba(140, 200, 255, 0.85)',
    fontWeight: 500,
  },
  postHeaderLine: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '0.9rem',
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
  },
  postPlace: {
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  cardThumbs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.4rem',
  },
  cardThumbWrap: {
    position: 'relative' as const,
    aspectRatio: '1',
    borderRadius: '10px',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.04)',
  },
  cardThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  cardThumbOverlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
};
