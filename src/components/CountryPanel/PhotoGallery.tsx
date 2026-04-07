import { useRef, useState } from 'react';
import type { TravelPhoto } from '../../hooks/useTravelPhotos';

interface PhotoGalleryProps {
  photos: TravelPhoto[];
  loading: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onDelete: (photoId: string, filePath: string) => Promise<boolean>;
}

export default function PhotoGallery({
  photos,
  loading,
  uploading,
  onUpload,
  onDelete,
}: PhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Track which photo is expanded in the lightbox
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Upload each file sequentially
    for (let i = 0; i < files.length; i++) {
      await onUpload(files[i]);
    }

    // Clear the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (photo: TravelPhoto) => {
    setDeletingId(photo.id);
    await onDelete(photo.id, photo.file_path);
    setDeletingId(null);
  };

  return (
    <div style={styles.container}>
      <div style={styles.sectionLabel}>Photos</div>

      {/* Thumbnail grid */}
      {loading ? (
        <div style={styles.loadingText}>Loading photos...</div>
      ) : photos.length > 0 ? (
        <div style={styles.grid}>
          {photos.map((photo) => (
            <div key={photo.id} style={styles.thumbWrapper}>
              {photo.url ? (
                <img
                  src={photo.url}
                  alt={photo.file_name}
                  style={styles.thumb}
                  onClick={() => setExpandedUrl(photo.url!)}
                />
              ) : (
                <div style={styles.thumbPlaceholder}>?</div>
              )}
              <button
                style={styles.deleteBtn}
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id}
                aria-label={`Delete ${photo.file_name}`}
              >
                {deletingId === photo.id ? '...' : '✕'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <button
        style={styles.uploadBtn}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : '+ Add Photos'}
      </button>

      {/* Lightbox overlay */}
      {expandedUrl && (
        <div style={styles.lightbox} onClick={() => setExpandedUrl(null)}>
          <img
            src={expandedUrl}
            alt="Expanded photo"
            style={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            style={styles.lightboxClose}
            onClick={() => setExpandedUrl(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '0.75rem',
  },
  sectionLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '0.8rem',
    textAlign: 'center',
    padding: '0.5rem 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.4rem',
    marginBottom: '0.5rem',
  },
  thumbWrapper: {
    position: 'relative' as const,
    aspectRatio: '1',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
    cursor: 'pointer',
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
  deleteBtn: {
    position: 'absolute' as const,
    top: '2px',
    right: '2px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '0.6rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  uploadBtn: {
    width: '100%',
    padding: '0.45rem',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px dashed rgba(100, 180, 255, 0.2)',
    borderRadius: '8px',
    color: 'rgba(100, 180, 255, 0.6)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  lightbox: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    cursor: 'pointer',
  },
  lightboxImg: {
    maxWidth: '90vw',
    maxHeight: '90vh',
    objectFit: 'contain' as const,
    borderRadius: '8px',
    cursor: 'default',
  },
  lightboxClose: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
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
  },
};
