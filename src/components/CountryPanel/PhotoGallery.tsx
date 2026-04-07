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
 * Full-screen modal gallery. Shows one photo at a time with
 * left/right navigation, upload, and delete.
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
  const [index, setIndex] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Keep index in bounds when photos change (upload / delete)
  useEffect(() => {
    if (photos.length === 0) {
      setIndex(0);
    } else if (index >= photos.length) {
      setIndex(photos.length - 1);
    }
  }, [photos.length, index]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(photos.length - 1, i + 1)), [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, onClose]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await onUpload(files[i]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async () => {
    const photo = photos[index];
    if (!photo) return;
    setDeletingId(photo.id);
    await onDelete(photo.id, photo.file_path);
    setDeletingId(null);
  };

  const current = photos[index];
  const hasPhotos = photos.length > 0;
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  return (
    <div style={styles.overlay}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <span style={styles.counter}>
          {hasPhotos ? `${index + 1} / ${photos.length}` : 'No photos yet'}
        </span>
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close gallery">
          ✕
        </button>
      </div>

      {/* Main content area */}
      <div style={styles.stage}>
        {loading ? (
          <div style={styles.emptyText}>Loading photos...</div>
        ) : hasPhotos && current ? (
          <>
            {/* Left arrow */}
            <button
              style={{ ...styles.arrowBtn, ...styles.arrowLeft, ...(hasPrev ? {} : styles.arrowDisabled) }}
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="Previous photo"
            >
              ‹
            </button>

            {/* Photo */}
            <img
              src={current.url}
              alt={current.file_name}
              style={styles.photo}
            />

            {/* Right arrow */}
            <button
              style={{ ...styles.arrowBtn, ...styles.arrowRight, ...(hasNext ? {} : styles.arrowDisabled) }}
              onClick={goNext}
              disabled={!hasNext}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        ) : (
          <div style={styles.emptyText}>
            No photos yet — add some below
          </div>
        )}
      </div>

      {/* Bottom bar with actions */}
      <div style={styles.bottomBar}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <button
          style={styles.actionBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : '+ Add Photos'}
        </button>

        {hasPhotos && current && (
          <button
            style={{ ...styles.actionBtn, ...styles.deleteBtn }}
            onClick={handleDelete}
            disabled={deletingId === current.id}
          >
            {deletingId === current.id ? 'Deleting...' : 'Delete Photo'}
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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

  // -- Top bar --
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

  // -- Stage (photo area) --
  stage: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '0 3.5rem',
    minHeight: 0,
  },
  photo: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain' as const,
    borderRadius: '6px',
    userSelect: 'none' as const,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '0.95rem',
  },

  // -- Arrow buttons --
  arrowBtn: {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255, 255, 255, 0.08)',
    border: 'none',
    color: '#fff',
    fontSize: '2rem',
    cursor: 'pointer',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    transition: 'background 0.15s',
  },
  arrowLeft: { left: '0.5rem' },
  arrowRight: { right: '0.5rem' },
  arrowDisabled: {
    opacity: 0.2,
    cursor: 'default',
  },

  // -- Bottom bar --
  bottomBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.75rem',
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
  deleteBtn: {
    background: 'rgba(255, 80, 80, 0.1)',
    borderColor: 'rgba(255, 80, 80, 0.25)',
    color: 'rgba(255, 80, 80, 0.8)',
  },
};
