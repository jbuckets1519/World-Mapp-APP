import { useRef, useState, useCallback, useEffect } from 'react';
import type { TravelPhoto } from '../../hooks/useTravelPhotos';

interface PhotoGalleryProps {
  photos: TravelPhoto[];
  loading: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onDelete: (photoId: string, filePath: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Full-screen modal gallery. Shows a thumbnail grid of all photos.
 * Clicking a thumbnail opens the photo viewer overlay (one photo at a time,
 * large, with arrow navigation and smooth transitions).
 */
export default function PhotoGallery({
  photos,
  loading,
  uploading,
  onUpload,
  onDelete,
  onClose,
}: PhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Index of the photo open in the viewer, or null if viewer is closed
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Keyboard: Escape closes viewer first, then gallery
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewerIndex !== null) setViewerIndex(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerIndex, onClose]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await onUpload(files[i]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (photo: TravelPhoto) => {
    setDeletingId(photo.id);
    await onDelete(photo.id, photo.file_path);
    setDeletingId(null);
  };

  const hasPhotos = photos.length > 0;

  return (
    <div style={galleryStyles.overlay}>
      {/* Top bar */}
      <div style={galleryStyles.topBar}>
        <span style={galleryStyles.counter}>
          {hasPhotos ? `${photos.length} photo${photos.length !== 1 ? 's' : ''}` : 'No photos yet'}
        </span>
        <button style={galleryStyles.closeBtn} onClick={onClose} aria-label="Close gallery">
          ✕
        </button>
      </div>

      {/* Thumbnail grid */}
      <div style={galleryStyles.gridArea}>
        {loading ? (
          <div style={galleryStyles.emptyText}>Loading photos...</div>
        ) : hasPhotos ? (
          <div style={galleryStyles.grid}>
            {photos.map((photo, i) => (
              <div key={photo.id} style={galleryStyles.thumbWrapper}>
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt={photo.file_name}
                    style={galleryStyles.thumb}
                    onClick={() => setViewerIndex(i)}
                  />
                ) : (
                  <div style={galleryStyles.thumbPlaceholder}>?</div>
                )}
                <button
                  style={galleryStyles.thumbDeleteBtn}
                  onClick={() => handleDelete(photo)}
                  disabled={deletingId === photo.id}
                  aria-label={`Delete ${photo.file_name}`}
                >
                  {deletingId === photo.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={galleryStyles.emptyText}>No photos yet — add some below</div>
        )}
      </div>

      {/* Upload button */}
      <div style={galleryStyles.bottomBar}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <button
          style={galleryStyles.actionBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : '+ Add Photos'}
        </button>
      </div>

      {/* Photo viewer overlay — opens when a thumbnail is clicked */}
      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

// ─── Photo Viewer (single-photo, large, with navigation) ───────────

interface PhotoViewerProps {
  photos: TravelPhoto[];
  startIndex: number;
  onClose: () => void;
}

function PhotoViewer({ photos, startIndex, onClose }: PhotoViewerProps) {
  const [index, setIndex] = useState(startIndex);

  // Keep index in bounds if photos array changes while viewer is open
  useEffect(() => {
    if (photos.length === 0) {
      onClose();
    } else if (index >= photos.length) {
      setIndex(photos.length - 1);
    }
  }, [photos.length, index, onClose]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(photos.length - 1, i + 1)),
    [photos.length],
  );

  // Arrow key navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, onClose]);

  const current = photos[index];
  if (!current) return null;

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  return (
    <div style={viewerStyles.backdrop} onClick={onClose}>
      <div style={viewerStyles.container} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button style={viewerStyles.closeBtn} onClick={onClose} aria-label="Close viewer">
          ✕
        </button>

        {/* Counter */}
        <div style={viewerStyles.counter}>
          {index + 1} / {photos.length}
        </div>

        {/* Left arrow */}
        <button
          style={{
            ...viewerStyles.arrowBtn,
            ...viewerStyles.arrowLeft,
            ...(hasPrev ? {} : viewerStyles.arrowDisabled),
          }}
          onClick={goPrev}
          disabled={!hasPrev}
          aria-label="Previous photo"
        >
          ‹
        </button>

        {/* Photo with fade transition */}
        <img
          key={current.id}
          src={current.url}
          alt={current.file_name}
          style={viewerStyles.photo}
        />

        {/* Right arrow */}
        <button
          style={{
            ...viewerStyles.arrowBtn,
            ...viewerStyles.arrowRight,
            ...(hasNext ? {} : viewerStyles.arrowDisabled),
          }}
          onClick={goNext}
          disabled={!hasNext}
          aria-label="Next photo"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Gallery styles ────────────────────────────────────────────────

const galleryStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(5, 5, 15, 0.95)',
    backdropFilter: 'blur(8px)',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    flexShrink: 0,
  },
  counter: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.85rem',
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: 'none',
    color: '#fff',
    fontSize: '1.4rem',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  gridArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 1.25rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.5rem',
  },
  thumbWrapper: {
    position: 'relative' as const,
    aspectRatio: '1',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
    transition: 'transform 0.15s',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: '1.2rem',
  },
  thumbDeleteBtn: {
    position: 'absolute' as const,
    top: '4px',
    right: '4px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '0.65rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.95rem',
    textAlign: 'center',
    paddingTop: '3rem',
  },
  bottomBar: {
    display: 'flex',
    justifyContent: 'center',
    padding: '1rem 1.25rem',
    flexShrink: 0,
  },
  actionBtn: {
    padding: '0.55rem 1.25rem',
    background: 'rgba(100, 180, 255, 0.12)',
    border: '1px solid rgba(100, 180, 255, 0.25)',
    borderRadius: '8px',
    color: 'rgba(100, 180, 255, 0.85)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

// ─── Viewer styles ─────────────────────────────────────────────────

const viewerStyles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.88)',
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  container: {
    position: 'relative',
    width: '90vw',
    height: '90vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
  },
  closeBtn: {
    position: 'absolute',
    top: '0',
    right: '0',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    zIndex: 2,
  },
  counter: {
    position: 'absolute',
    top: '0.5rem',
    left: '0.5rem',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '0.8rem',
    zIndex: 2,
  },
  photo: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain' as const,
    borderRadius: '6px',
    userSelect: 'none' as const,
    animation: 'fadeIn 0.2s ease',
  },
  arrowBtn: {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#fff',
    fontSize: '2.2rem',
    cursor: 'pointer',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    transition: 'background 0.15s',
    zIndex: 2,
  },
  arrowLeft: { left: '0' },
  arrowRight: { right: '0' },
  arrowDisabled: {
    opacity: 0.15,
    cursor: 'default',
  },
};
