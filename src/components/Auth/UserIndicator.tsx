interface UserIndicatorProps {
  email: string;
  onSignOut: () => void;
}

export default function UserIndicator({ email, onSignOut }: UserIndicatorProps) {
  return (
    <div style={styles.container}>
      <span style={styles.email}>{email}</span>
      <button style={styles.button} onClick={onSignOut}>
        Log out
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.35rem 0.75rem',
    background: 'rgba(15, 15, 25, 0.7)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    fontSize: '0.75rem',
    zIndex: 10,
  },
  email: {
    color: 'rgba(255, 255, 255, 0.6)',
    maxWidth: '160px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  button: {
    background: 'none',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.7rem',
    padding: '0.2rem 0.5rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
