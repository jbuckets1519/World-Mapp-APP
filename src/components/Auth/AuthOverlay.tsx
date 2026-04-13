import { useState } from 'react';
import { supabase } from '../../lib/supabase';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthOverlayProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

export default function AuthOverlay({ onSignIn, onSignUp }: AuthOverlayProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Show a confirmation message after signup or password reset
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await onSignUp(email, password);
        setSignUpSuccess(true);
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (signUpSuccess) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <h2 style={styles.title}>Check your email</h2>
          <p style={styles.subtitle}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account, then log in.
          </p>
          <button
            className="btn-press"
            style={styles.button}
            onClick={() => {
              setSignUpSuccess(false);
              switchMode('login');
              setPassword('');
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // Forgot password screen
  if (mode === 'forgot') {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <h2 style={styles.title}>Reset password</h2>
          {resetSent ? (
            <>
              <p style={styles.subtitle}>
                Check your email for a reset link. We sent it to <strong>{email}</strong>.
              </p>
              <button
                className="btn-press"
                style={styles.button}
                onClick={() => {
                  switchMode('login');
                  setPassword('');
                }}
              >
                Back to login
              </button>
            </>
          ) : (
            <>
              <p style={styles.subtitle}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleResetPassword} style={styles.form}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={styles.input}
                />
                {error && <p style={styles.error}>{error}</p>}
                <button className="btn-press" type="submit" disabled={submitting} style={styles.button}>
                  {submitting ? '...' : 'Send reset link'}
                </button>
              </form>
              <button style={styles.toggle} onClick={() => switchMode('login')}>
                Back to login
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <h2 style={styles.title}>{mode === 'signup' ? 'Create account' : 'Welcome back'}</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          {/* Forgot password link — only on the login form */}
          {mode === 'login' && (
            <button
              type="button"
              style={styles.forgotLink}
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>
          )}
          {error && <p style={styles.error}>{error}</p>}
          <button className="btn-press" type="submit" disabled={submitting} style={styles.button}>
            {submitting
              ? '...'
              : mode === 'signup'
                ? 'Sign up'
                : 'Log in'}
          </button>
        </form>
        <button
          style={styles.toggle}
          onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
        >
          {mode === 'signup'
            ? 'Already have an account? Log in'
            : "Don't have an account? Sign up"}
        </button>
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
    // Semi-transparent so the globe is visible behind
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 20,
  },
  card: {
    width: '340px',
    maxWidth: 'calc(100vw - 2rem)',
    background: 'rgba(16, 18, 28, 0.72)',
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '22px',
    padding: '2rem',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    animation: 'fadeScaleIn 0.22s ease-out',
  },
  title: {
    margin: '0 0 1.25rem',
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.88rem',
    lineHeight: 1.55,
    textAlign: 'center',
    margin: '0 0 1.25rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  input: {
    width: '100%',
    padding: '0.85rem 1.1rem',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '0.85rem',
    background: 'rgba(100, 180, 255, 0.22)',
    border: '1px solid rgba(100, 180, 255, 0.38)',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  toggle: {
    display: 'block',
    width: '100%',
    marginTop: '1rem',
    background: 'none',
    border: 'none',
    color: 'rgba(100, 180, 255, 0.7)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: 'inherit',
  },
  forgotLink: {
    background: 'none',
    border: 'none',
    color: 'rgba(100, 180, 255, 0.6)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    textAlign: 'right' as const,
    fontFamily: 'inherit',
    padding: 0,
    marginTop: '-0.35rem',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.8rem',
    margin: 0,
    textAlign: 'center',
  },
};
