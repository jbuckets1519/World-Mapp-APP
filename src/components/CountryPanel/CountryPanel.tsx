import type { GeoJsonFeature } from '../../types';

interface CountryPanelProps {
  country: GeoJsonFeature;
  text: string;
  onTextChange: (text: string) => void;
  onClose: () => void;
}

const styles = {
  panel: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    width: '320px',
    maxWidth: 'calc(100vw - 2rem)',
    background: 'rgba(15, 15, 25, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.2)',
    borderRadius: '12px',
    padding: '1.25rem',
    zIndex: 10,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  countryName: {
    fontSize: '1.1rem',
    fontWeight: 600 as const,
    color: '#fff',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
    lineHeight: 1,
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    padding: '0.75rem',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    outline: 'none',
  },
};

export default function CountryPanel({
  country,
  text,
  onTextChange,
  onClose,
}: CountryPanelProps) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.countryName}>{country.properties.NAME}</h2>
        <button
          style={styles.closeButton}
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>
      <textarea
        style={styles.textarea}
        placeholder="Write something about this country..."
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        autoFocus
      />
    </div>
  );
}
