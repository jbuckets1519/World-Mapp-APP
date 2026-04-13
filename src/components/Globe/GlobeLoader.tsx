// Fallback shown while the lazy-loaded Globe chunk (react-globe.gl + three.js)
// streams in. Matches the app's dark theme so it doesn't flash white.
export default function GlobeLoader() {
  return (
    <div style={styles.container}>
      <div style={styles.spinner} />
      <p style={styles.label}>Loading globe…</p>
      <style>{keyframes}</style>
    </div>
  );
}

const keyframes = `
@keyframes globeLoaderSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes globeLoaderFade {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'rgb(8, 8, 18)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    zIndex: 1,
    animation: 'globeLoaderFade 200ms ease-out',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2px solid rgba(100, 180, 255, 0.15)',
    borderTopColor: 'rgba(100, 180, 255, 0.85)',
    animation: 'globeLoaderSpin 900ms linear infinite',
  },
  label: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: '0.85rem',
    letterSpacing: '0.02em',
  },
};
