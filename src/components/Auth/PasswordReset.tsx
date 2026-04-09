import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface PasswordResetProps {
  onComplete: () => void;
}

/**
 * Shown when the user arrives via a Supabase password-recovery link.
 * Lets them set a new password, then redirects to the normal app.
 */
export default function PasswordReset({ onComplete }: PasswordResetProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        {success ? (
          <>
            <h2 style={styles.title}>Password updated</h2>
            <p style={styles.subtitle}>
              Your password has been reset successfully.
            </p>
            <button style={styles.button} onClick={onComplete}>
              Continue
            </button>
          </>
        ) : (
          <>
            <h2 style={styles.title}>Set new password</h2>
            <p style={styles.subtitle}>
              Enter your new password below.
            </p>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={styles.input}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                style={styles.input}
              />
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" disabled={submitting} style={styles.button}>
                {submitting ? '...' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 25,
  },
  card: {
    width: '340px',
    maxWidth: 'calc(100vw - 2rem)',
    background: 'rgba(15, 15, 25, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '14px',
    padding: '2rem',
  },
  title: {
    margin: '0 0 1.25rem',
    fontSize: '1.3rem',
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    textAlign: 'center',
    margin: '0 0 1.25rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.7rem 0.85rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '0.7rem',
    background: 'rgba(100, 180, 255, 0.2)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.8rem',
    margin: 0,
    textAlign: 'center',
  },
};
