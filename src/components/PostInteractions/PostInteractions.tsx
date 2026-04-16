import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReactions, REACTION_EMOJIS } from '../../hooks/useReactions';
import { useComments, MAX_COMMENT_LENGTH, type Comment } from '../../hooks/useComments';
import { useAuth } from '../../hooks/useAuth';

/**
 * Post interactions — shared reactions bar + comments section for a post.
 *
 * Used by:
 *   • CountryActivity's PostViewer (full-screen post overlay)
 *   • FeedTab (inline under each post card)
 *
 * The parent controls whether this is a friend's post (readOnly) or not.
 * Reactions are always allowed; comments can always be added by any
 * authenticated user, but delete is only ever shown on the user's own
 * comments — the server's RLS is the real enforcement.
 */

export interface PostInteractionsHandle {
  /** Imperatively add a heart reaction — used by double-tap on the photo. */
  triggerHeart: () => void;
}

interface PostInteractionsProps {
  postId: string;
  /** Compact mode drops padding and visual weight for inline feed cards. */
  compact?: boolean;
}

// Share a single stylesheet for all the small animations used here.
const animationStyles = `
@keyframes piPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.35); }
  100% { transform: scale(1); }
}
@keyframes piFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// ─── Relative timestamp (copied from FeedTab to keep components decoupled) ──

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return 'now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo`;
  const diffYr = Math.round(diffDay / 365);
  return `${diffYr}y`;
}

function commentDisplayName(profile: Comment['profile']): string {
  return profile?.username || profile?.display_name || 'Someone';
}

// ─── Reactions bar ──────────────────────────────────────────────────

interface ReactionsBarProps {
  postId: string;
  compact: boolean;
  // Expose triggerHeart out to the parent via imperative handle.
  onExposeHandle: (triggerHeart: () => void) => void;
}

function ReactionsBar({ postId, compact, onExposeHandle }: ReactionsBarProps) {
  const { counts, mine, toggleReaction, addReaction } = useReactions(postId);
  // Tracks which emoji is currently playing the pop animation. Cleared by
  // the onAnimationEnd handler so a second tap re-triggers the pop.
  const [popping, setPopping] = useState<string | null>(null);

  // Re-run the imperative handle setter whenever addReaction's identity
  // changes, so the parent's ref always points at the freshest closure.
  const triggerHeart = useCallback(() => {
    setPopping('❤️');
    addReaction('❤️');
  }, [addReaction]);
  // One-shot wire-up per render — the parent ref only needs the latest fn.
  onExposeHandle(triggerHeart);

  const handleTap = (emoji: string) => {
    setPopping(emoji);
    toggleReaction(emoji);
  };

  return (
    <div style={compact ? styles.reactionsBarCompact : styles.reactionsBar}>
      {REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const active = Boolean(mine[emoji]);
        const isPopping = popping === emoji;
        return (
          <button
            key={emoji}
            type="button"
            className="btn-press"
            style={{
              ...styles.reactionBtn,
              ...(active ? styles.reactionBtnActive : styles.reactionBtnInactive),
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTap(emoji);
            }}
            aria-pressed={active}
            aria-label={`React with ${emoji}`}
          >
            <span
              style={{
                ...styles.reactionEmoji,
                ...(active ? {} : styles.reactionEmojiInactive),
                ...(isPopping ? { animation: 'piPop 420ms ease-out' } : {}),
              }}
              onAnimationEnd={() => setPopping(null)}
            >
              {emoji}
            </span>
            {count > 0 && (
              <span
                style={{
                  ...styles.reactionCount,
                  ...(active ? styles.reactionCountActive : {}),
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Comments section ───────────────────────────────────────────────

interface CommentsSectionProps {
  postId: string;
  compact: boolean;
}

function CommentsSection({ postId, compact }: CommentsSectionProps) {
  const { user } = useAuth();
  const { comments, loading, submitting, addComment, deleteComment } = useComments(postId);
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  // Hover state for each own-comment row, so the trash icon appears only
  // on pointer hover — on touch we always show it since there's no hover.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (expanded || comments.length <= 2) return comments;
    // Show the 2 most recent (tail of the chronologically-sorted list).
    return comments.slice(-2);
  }, [comments, expanded]);

  const hiddenCount = comments.length - visible.length;
  const remaining = MAX_COMMENT_LENGTH - draft.length;
  const canSubmit = draft.trim().length > 0 && remaining >= 0 && !submitting && Boolean(user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canSubmit) return;
    const ok = await addComment(draft);
    if (ok) setDraft('');
  };

  return (
    <div
      style={compact ? styles.commentsSectionCompact : styles.commentsSection}
      onClick={(e) => e.stopPropagation()}
    >
      {loading && comments.length === 0 ? (
        <div style={styles.commentsEmpty}>Loading comments…</div>
      ) : comments.length === 0 ? (
        <div style={styles.commentsEmpty}>Be the first to comment</div>
      ) : (
        <>
          {hiddenCount > 0 && !expanded && (
            <button
              type="button"
              style={styles.viewAllBtn}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
            >
              View all {comments.length} comments
            </button>
          )}
          <ul style={styles.commentList}>
            {visible.map((c) => {
              const isOwn = user?.id === c.user_id;
              const initial = commentDisplayName(c.profile)[0]?.toUpperCase() ?? '?';
              return (
                <li
                  key={c.id}
                  style={styles.commentRow}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId((id) => (id === c.id ? null : id))}
                >
                  <div
                    style={{
                      ...styles.commentAvatar,
                      ...(c.profile?.avatar_url
                        ? { backgroundImage: `url(${c.profile.avatar_url})` }
                        : {}),
                    }}
                  >
                    {!c.profile?.avatar_url && (
                      <span style={styles.commentAvatarInitial}>{initial}</span>
                    )}
                  </div>
                  <div style={styles.commentBody}>
                    <span style={styles.commentHeader}>
                      <span style={styles.commentName}>{commentDisplayName(c.profile)}</span>
                      <span style={styles.commentTime}>{relativeTime(c.created_at)}</span>
                    </span>
                    <span style={styles.commentText}>{c.text}</span>
                  </div>
                  {isOwn && (hoveredId === c.id || isTouchDevice()) && (
                    <button
                      type="button"
                      style={styles.commentDeleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteComment(c.id);
                      }}
                      aria-label="Delete comment"
                    >
                      🗑
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {user && (
        <form style={styles.commentForm} onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="Add a comment..."
            maxLength={MAX_COMMENT_LENGTH}
            style={styles.commentInput}
          />
          {draft.length > MAX_COMMENT_LENGTH * 0.8 && (
            <span style={styles.commentCounter}>{remaining}</span>
          )}
          <button
            type="submit"
            style={{
              ...styles.commentSendBtn,
              ...(canSubmit ? {} : styles.commentSendBtnDisabled),
            }}
            disabled={!canSubmit}
            aria-label="Send comment"
          >
            →
          </button>
        </form>
      )}
    </div>
  );
}

// Crude touch-device detection — only used to decide whether to show the
// delete icon persistently vs. on hover, so being wrong is harmless.
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
}

// ─── Composite component ────────────────────────────────────────────

const PostInteractions = forwardRef<PostInteractionsHandle, PostInteractionsProps>(
  function PostInteractions({ postId, compact = false }, ref) {
    // A ref holds the latest triggerHeart from ReactionsBar's render. The
    // imperative handle forwards to it so the parent's ref always calls
    // into the freshest closure (addReaction depends on current reactions).
    const triggerRef = useRef<() => void>(() => {});
    useImperativeHandle(ref, () => ({
      triggerHeart: () => triggerRef.current(),
    }));
    const exposeHandle = useCallback((fn: () => void) => {
      triggerRef.current = fn;
    }, []);

    return (
      <div style={compact ? styles.wrapperCompact : styles.wrapper}>
        <style>{animationStyles}</style>
        <ReactionsBar postId={postId} compact={compact} onExposeHandle={exposeHandle} />
        <CommentsSection postId={postId} compact={compact} />
      </div>
    );
  },
);

export default memo(PostInteractions);

// ─── Styles ─────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '100%',
  },
  wrapperCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    width: '100%',
    marginTop: '0.6rem',
  },

  // ── Reactions bar ──
  reactionsBar: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.55rem 0.65rem',
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
  },
  reactionsBarCompact: {
    display: 'flex',
    gap: '0.4rem',
    padding: '0.35rem 0.1rem 0.1rem',
  },
  reactionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.3rem',
    padding: '0.4rem 0.5rem',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '999px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    transition: 'background 160ms ease, border-color 160ms ease, transform 120ms ease',
  },
  reactionBtnInactive: {
    // Muted outline style when no one (or at least not the user) has reacted
    color: 'rgba(255, 255, 255, 0.55)',
  },
  reactionBtnActive: {
    background: 'rgba(255, 180, 110, 0.16)',
    borderColor: 'rgba(255, 180, 110, 0.45)',
    color: 'rgba(255, 210, 160, 0.95)',
  },
  reactionEmoji: {
    fontSize: '1.05rem',
    lineHeight: 1,
    display: 'inline-block',
  },
  reactionEmojiInactive: {
    // Desaturate + slightly fade inactive emojis so the bar reads as "muted"
    filter: 'grayscale(0.7) opacity(0.7)',
  },
  reactionCount: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.6)',
    minWidth: '0.7rem',
    textAlign: 'center' as const,
  },
  reactionCountActive: {
    color: 'rgba(255, 210, 160, 1)',
  },

  // ── Comments ──
  commentsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    padding: '0.75rem 0.85rem',
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
  },
  commentsSectionCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    padding: '0.3rem 0.1rem 0.1rem',
  },
  commentsEmpty: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '0.78rem',
    textAlign: 'center' as const,
    padding: '0.3rem 0',
  },
  viewAllBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'rgba(140, 200, 255, 0.75)',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  commentList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  commentRow: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.55rem',
    animation: 'piFadeIn 220ms ease-out',
  },
  commentAvatar: {
    flexShrink: 0,
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background:
      'linear-gradient(135deg, rgba(100,180,255,0.3), rgba(180,120,255,0.3)) center/cover',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  commentAvatarInitial: {
    lineHeight: 1,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.45rem',
    flexWrap: 'wrap' as const,
  },
  commentName: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  commentTime: {
    fontSize: '0.7rem',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  commentText: {
    fontSize: '0.85rem',
    color: 'rgba(255, 255, 255, 0.82)',
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
  },
  commentDeleteBtn: {
    flexShrink: 0,
    width: '22px',
    height: '22px',
    padding: 0,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    color: 'rgba(255, 120, 120, 0.75)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  commentForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingTop: '0.2rem',
  },
  commentInput: {
    flex: 1,
    minWidth: 0,
    padding: '0.5rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  commentCounter: {
    fontSize: '0.7rem',
    color: 'rgba(255, 255, 255, 0.45)',
    minWidth: '1.6rem',
    textAlign: 'right' as const,
  },
  commentSendBtn: {
    flexShrink: 0,
    width: '34px',
    height: '34px',
    padding: 0,
    borderRadius: '50%',
    background: 'rgba(100, 180, 255, 0.22)',
    border: '1px solid rgba(100, 180, 255, 0.4)',
    color: 'rgba(180, 220, 255, 1)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
};
