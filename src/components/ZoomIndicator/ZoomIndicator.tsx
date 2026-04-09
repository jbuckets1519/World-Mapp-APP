interface ZoomIndicatorProps {
  /** Zoom level from 1 (most zoomed out) to 100 (most zoomed in) */
  level: number;
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: 'calc(1rem + env(safe-area-inset-top, 0px))',
    left: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.65rem',
    background: 'rgba(15, 15, 25, 0.5)',
    border: '1px solid rgba(100, 180, 255, 0.1)',
    borderRadius: '8px',
    fontSize: '0.65rem',
    color: 'rgba(255, 255, 255, 0.3)',
    fontVariantNumeric: 'tabular-nums' as const,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    zIndex: 5,
  },
  value: {
    color: 'rgba(100, 180, 255, 0.5)',
    fontWeight: 500 as const,
    minWidth: '1.5ch',
    textAlign: 'right' as const,
  },
};

export default function ZoomIndicator({ level }: ZoomIndicatorProps) {
  return (
    <div style={styles.container}>
      <span>Zoom</span>
      <span style={styles.value}>{level}</span>
    </div>
  );
}
