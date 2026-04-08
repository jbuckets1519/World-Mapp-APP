import { useState, useEffect, useRef } from 'react';

interface PerfMonitorProps {
  polygonCount: number;
  cityCount: number;
}

/**
 * Temporary FPS counter + render stats overlay for performance debugging.
 * Shows real-time FPS, polygon count, and city point count.
 * Delete this component once performance tuning is done.
 */
export default function PerfMonitor({ polygonCount, cityCount }: PerfMonitorProps) {
  const [fps, setFps] = useState(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let raf: number;
    const tick = () => {
      framesRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      // Update FPS display every 500ms
      if (elapsed >= 500) {
        setFps(Math.round((framesRef.current / elapsed) * 1000));
        framesRef.current = 0;
        lastTimeRef.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fpsColor = fps >= 50 ? 'rgba(80, 200, 120, 0.9)'
    : fps >= 30 ? 'rgba(255, 200, 50, 0.9)'
    : 'rgba(255, 80, 80, 0.9)';

  return (
    <div style={styles.container}>
      <div style={{ ...styles.row, color: fpsColor }}>
        <span style={styles.label}>FPS</span>
        <span style={styles.value}>{fps}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Polygons</span>
        <span style={styles.value}>{polygonCount}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Cities</span>
        <span style={styles.value}>{cityCount}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '1rem',
    left: '1rem',
    padding: '0.4rem 0.6rem',
    background: 'rgba(15, 15, 25, 0.8)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    zIndex: 5,
    pointerEvents: 'none',
    userSelect: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  label: {
    opacity: 0.6,
  },
  value: {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right' as const,
    minWidth: '2.5ch',
  },
};
