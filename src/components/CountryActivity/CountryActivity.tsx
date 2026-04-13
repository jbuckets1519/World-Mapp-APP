import { useEffect, useRef, useState, memo } from 'react';
import type { Post } from '../../hooks/usePosts';

interface CountryActivityProps {
  countryName: string;
  posts: Post[];
  loading: boolean;
  creating: boolean;
  deleting: boolean;
  /** When true, hide New Post + delete controls (friend view). */
  readOnly: boolean;
  /** Optional label shown in the header when viewing a friend. */
  friendName?: string | null;
  onClose: () => void;
  /** Handler for the New Post submit. Parent owns the upload + feed log. */
  onCreatePost: (files: File[], caption: string) => Promise<boolean>;
  onDeletePost: (post: Post) => Promise<boolean>;
}

/**
 * Full-screen Instagram-style profile page for a single country.
 *
 * Layout:
 *   • Header — back button, country name (+ friend tag), optional "New Post"
 *   • Grid — 3-column thumbnail grid, first photo of each post
 *   • Post viewer — tap a thumb to open a swipeable photo overlay with caption
 *   • New-post sheet — file picker (1–20) + caption textarea + Post button
 */
function CountryActivity({
  countryName,
  posts,
  loading,
  creating,
  deleting,
  readOnly,
  friendName,
  onClose,
  onCreatePost,
  onDeletePost,
}: CountryActivityProps) {
  const [viewerPostId, setViewerPostId] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);

  // Escape closes the topmost overlay first (new-post sheet → viewer → page)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showNewPost) setShowNewPost(false);
      else if (viewerPostId !== null) setViewerPostId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNewPost, viewerPostId, onClose]);

  const activePost = posts.find((p) => p.id === viewerPostId) ?? null;

  return (
    <div style={styles.overlay}>
      <div style={styles.header}>
        <button
          className="btn-press"
          style={styles.backBtn}
          onClick={onClose}
          aria-label="Back"
        >
          ‹
        </button>
        <div style={styles.headerTitleWrap}>
          <h2 style={styles.title}>{countryName}</h2>
          {friendName && <p style={styles.friendTag}>{friendName}'s posts</p>}
        </div>
        <div style={styles.headerRight}>
          {!readOnly && (
            <button
              className="btn-press"
              style={styles.newPostBtn}
              onClick={() => setShowNewPost(true)}
              disabled={creating}
            >
              + New Post
            </button>
          )}
        </div>
      </div>

      <div style={styles.gridArea}>
        {loading ? (
          <div style={styles.emptyText}>Loading posts...</div>
        ) : posts.length === 0 ? (
          <div style={styles.emptyText}>
            {readOnly
              ? 'No posts yet'
              : `No posts yet — tap "New Post" to share your first ${countryName} memory`}
          </div>
        ) : (
          <div style={styles.grid}>
            {posts.map((post) => {
              const thumb = post.photo_urls[0];
              return (
                <button
                  key={post.id}
                  className="btn-press"
                  style={styles.gridCell}
                  onClick={() => setViewerPostId(post.id)}
                  aria-label="Open post"
                >
                  {thumb ? (
                    <img src={thumb} alt="" style={styles.gridImg} loading="lazy" decoding="async" />
                  ) : (
                    <div style={styles.gridPlaceholder}>?</div>
                  )}
                  {post.photo_urls.length > 1 && (
                    <div style={styles.multiBadge}>⊞</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activePost && (
        <PostViewer
          post={activePost}
          readOnly={readOnly}
          deleting={deleting}
          onClose={() => setViewerPostId(null)}
          onDelete={async () => {
            const ok = await onDeletePost(activePost);
            if (ok) setViewerPostId(null);
          }}
        />
      )}

      {showNewPost && !readOnly && (
        <NewPostSheet
          countryName={countryName}
          creating={creating}
          onClose={() => setShowNewPost(false)}
          onSubmit={async (files, caption) => {
            const ok = await onCreatePost(files, caption);
            if (ok) setShowNewPost(false);
            return ok;
          }}
        />
      )}
    </div>
  );
}

// ─── Single-post viewer (swipeable photos + caption) ───────────────

interface PostViewerProps {
  post: Post;
  readOnly: boolean;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

function PostViewer({ post, readOnly, deleting, onClose, onDelete }: PostViewerProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  // Live drag offset in pixels while the user's finger is down. Zero when
  // idle so the track sits at exactly -photoIndex * 100%.
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const urls = post.photo_urls;

  useEffect(() => {
    setPhotoIndex(0);
    setDragDx(0);
    setDragging(false);
  }, [post.id]);

  const goPrev = () => setPhotoIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPhotoIndex((i) => Math.min(urls.length - 1, i + 1));

  // Preload the next two photos so swiping feels instant
  useEffect(() => {
    for (let offset = 1; offset <= 2; offset++) {
      const nextIdx = photoIndex + offset;
      if (nextIdx < urls.length) {
        const img = new Image();
        img.src = urls[nextIdx];
      }
    }
  }, [photoIndex, urls]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.length]);

  // Touch handlers — track the finger as it moves so the photo visibly
  // slides under the user's thumb, then on release either snap to the
  // neighbor (if dragged past ~20% of the width) or spring back.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    let dx = e.touches[0].clientX - touchStartX.current;
    // Rubber-band at the edges so the user feels the end of the carousel
    if ((photoIndex === 0 && dx > 0) || (photoIndex === urls.length - 1 && dx < 0)) {
      dx *= 0.35;
    }
    setDragDx(dx);
  };
  const onTouchEnd = () => {
    if (touchStartX.current === null) return;
    const width = wrapRef.current?.offsetWidth ?? 1;
    const threshold = Math.max(40, width * 0.2);
    if (dragDx > threshold) goPrev();
    else if (dragDx < -threshold) goNext();
    setDragDx(0);
    setDragging(false);
    touchStartX.current = null;
  };

  return (
    <div style={viewer.backdrop} onClick={onClose}>
      {/* Close button is fixed to the viewport corner, NOT the container,
          so it stays put regardless of photo size or caption length. */}
      <button
        style={viewer.closeBtn}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close post"
      >
        ✕
      </button>

      <div style={viewer.container} onClick={(e) => e.stopPropagation()}>
        {/* Fixed-aspect square slideshow — every photo is rendered the same
            size via object-fit: cover, so portraits/landscapes align cleanly. */}
        <div
          ref={wrapRef}
          style={viewer.photoWrap}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {urls.length === 0 ? (
            <div style={viewer.missing}>Photo unavailable</div>
          ) : (
            <div
              style={{
                ...viewer.track,
                // Position the track: full-width photos laid out in a row,
                // shifted by photoIndex plus the live drag offset. While
                // dragging we disable the transition so the photo tracks
                // the finger 1:1; on release the transition snaps or springs.
                transform: `translate3d(calc(${-photoIndex * 100}% + ${dragDx}px), 0, 0)`,
                transition: dragging ? 'none' : 'transform 260ms ease-out',
              }}
            >
              {urls.map((url, i) => {
                // Eager-load current + neighbors so swipes feel instant;
                // lazy-load the rest so opening a 20-photo post isn't slow.
                const near = Math.abs(i - photoIndex) <= 1;
                return (
                  <div key={i} style={viewer.slide}>
                    <img
                      src={url}
                      alt=""
                      style={viewer.photo}
                      draggable={false}
                      loading={near ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {urls.length > 1 && (
            <div style={viewer.dots}>
              {urls.map((_, i) => (
                <span
                  key={i}
                  style={{
                    ...viewer.dot,
                    ...(i === photoIndex ? viewer.dotActive : {}),
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {post.caption && (
          <div style={viewer.captionBox}>
            <p style={viewer.caption}>{post.caption}</p>
          </div>
        )}

        {!readOnly && (
          <button
            className="btn-press"
            style={viewer.deleteBtn}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete post'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── New-post sheet ─────────────────────────────────────────────────

interface NewPostSheetProps {
  countryName: string;
  creating: boolean;
  onClose: () => void;
  onSubmit: (files: File[], caption: string) => Promise<boolean>;
}

const MAX_PHOTOS = 20;

function NewPostSheet({ countryName, creating, onClose, onSubmit }: NewPostSheetProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs for preview thumbnails — revoke on unmount to free memory
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const merged = [...files, ...picked].slice(0, MAX_PHOTOS);
    setFiles(merged);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmit = files.length > 0 && !creating;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(files, caption);
  };

  return (
    <div style={sheet.backdrop} onClick={onClose}>
      <div style={sheet.panel} onClick={(e) => e.stopPropagation()}>
        <div style={sheet.header}>
          <h3 style={sheet.heading}>New post · {countryName}</h3>
          <button style={sheet.closeBtn} onClick={onClose} aria-label="Cancel">
            ✕
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handlePick}
        />

        {files.length === 0 ? (
          <button
            className="btn-press"
            style={sheet.pickBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            + Select photos (up to {MAX_PHOTOS})
          </button>
        ) : (
          <>
            <div style={sheet.previewGrid}>
              {previews.map((url, i) => (
                <div key={url} style={sheet.previewCell}>
                  <img src={url} alt="" style={sheet.previewImg} loading="lazy" decoding="async" />
                  <button
                    style={sheet.previewRemove}
                    onClick={() => removeAt(i)}
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {files.length < MAX_PHOTOS && (
                <button
                  style={sheet.previewAddMore}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add more photos"
                >
                  +
                </button>
              )}
            </div>
            <div style={sheet.counter}>
              {files.length} / {MAX_PHOTOS} photo{files.length === 1 ? '' : 's'}
            </div>
          </>
        )}

        <textarea
          style={sheet.caption}
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
        />

        <button
          className="btn-press"
          style={{
            ...sheet.submitBtn,
            ...(canSubmit ? {} : sheet.submitBtnDisabled),
          }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {creating ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#0a0a14',
    zIndex: 3000,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1.25rem 1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
  },
  backBtn: {
    width: '36px',
    height: '36px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '1.5rem',
    borderRadius: '999px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 1.2,
    wordBreak: 'break-word' as const,
  },
  friendTag: {
    margin: '0.15rem 0 0 0',
    fontSize: '0.75rem',
    color: 'rgba(180, 130, 255, 0.8)',
    fontWeight: 500,
  },
  headerRight: {
    flexShrink: 0,
  },
  newPostBtn: {
    padding: '0.55rem 1rem',
    background: 'rgba(100, 180, 255, 0.14)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '999px',
    color: 'rgba(140, 200, 255, 0.95)',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  gridArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0.75rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
  },
  gridCell: {
    position: 'relative' as const,
    aspectRatio: '1',
    padding: 0,
    background: 'rgba(255, 255, 255, 0.03)',
    border: 'none',
    borderRadius: '2px',
    overflow: 'hidden',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  gridImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  gridPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: '1.2rem',
  },
  multiBadge: {
    position: 'absolute' as const,
    top: '6px',
    right: '6px',
    width: '22px',
    height: '22px',
    borderRadius: '4px',
    background: 'rgba(0, 0, 0, 0.6)',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.9rem',
    textAlign: 'center' as const,
    padding: '4rem 1.5rem',
    lineHeight: 1.5,
  },
};

const viewer: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Solid dark — no transparency. Matches the app's dark shell.
    background: '#0a0a14',
    zIndex: 3100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    cursor: 'pointer',
    // Prevent horizontal overscroll from swipe gestures
    overflow: 'hidden',
  },
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'default',
    gap: '0.9rem',
  },
  // Fixed to the VIEWPORT, not the container — stays put regardless of
  // photo aspect ratio, caption length, or container layout.
  closeBtn: {
    position: 'fixed',
    top: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
    right: '0.75rem',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.12)',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '1.2rem',
    cursor: 'pointer',
    lineHeight: 1,
    zIndex: 3200,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Uniform square slideshow cell. Every photo fills this box via
  // object-fit: cover so portraits, landscapes, and squares all match.
  photoWrap: {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: '1 / 1',
    background: '#000',
    borderRadius: '10px',
    overflow: 'hidden',
    touchAction: 'pan-y' as const,
  },
  // Horizontal track: holds every photo side-by-side at 100% width each.
  // Transformed via translate3d so swipes feel like a physical carousel.
  track: {
    display: 'flex',
    width: '100%',
    height: '100%',
    willChange: 'transform' as const,
  },
  slide: {
    flex: '0 0 100%',
    width: '100%',
    height: '100%',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
  },
  missing: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.9rem',
  },
  // Instagram-style carousel dots
  dots: {
    position: 'absolute' as const,
    bottom: '0.75rem',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.3rem',
    pointerEvents: 'none' as const,
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.45)',
  },
  dotActive: {
    background: 'rgba(255, 255, 255, 1)',
  },
  captionBox: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '0.75rem 0.9rem',
    maxHeight: '25vh',
    overflowY: 'auto' as const,
  },
  caption: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  deleteBtn: {
    padding: '0.6rem',
    background: 'rgba(255, 80, 80, 0.12)',
    border: '1px solid rgba(255, 80, 80, 0.3)',
    borderRadius: '999px',
    color: 'rgba(255, 120, 120, 0.9)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const sheet: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.72)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 3200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '1rem',
  },
  panel: {
    width: '100%',
    maxWidth: '520px',
    maxHeight: '92vh',
    overflowY: 'auto' as const,
    background: '#10111c',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '18px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  pickBtn: {
    padding: '1.4rem',
    background: 'rgba(100, 180, 255, 0.1)',
    border: '1.5px dashed rgba(100, 180, 255, 0.35)',
    borderRadius: '14px',
    color: 'rgba(140, 200, 255, 0.9)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.4rem',
  },
  previewCell: {
    position: 'relative' as const,
    aspectRatio: '1',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.04)',
  },
  previewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  previewRemove: {
    position: 'absolute' as const,
    top: '4px',
    right: '4px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.75)',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '0.65rem',
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  previewAddMore: {
    aspectRatio: '1',
    borderRadius: '8px',
    background: 'rgba(100, 180, 255, 0.08)',
    border: '1.5px dashed rgba(100, 180, 255, 0.3)',
    color: 'rgba(140, 200, 255, 0.8)',
    fontSize: '1.4rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  counter: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '0.75rem',
    textAlign: 'center' as const,
  },
  caption: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '0.75rem',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  submitBtn: {
    padding: '0.75rem',
    background: 'rgba(100, 180, 255, 0.2)',
    border: '1px solid rgba(100, 180, 255, 0.4)',
    borderRadius: '999px',
    color: 'rgba(140, 200, 255, 1)',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  submitBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

export default memo(CountryActivity);
