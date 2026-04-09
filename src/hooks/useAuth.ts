import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True when the user arrives via a password recovery link */
  isPasswordRecovery: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isPasswordRecovery: false,
  });

  useEffect(() => {
    // Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({ ...s, user: session?.user ?? null, session, loading: false }));
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState((s) => ({
          ...s,
          user: session?.user ?? null,
          session,
          loading: false,
          // Flag recovery so the app can show the new-password form
          isPasswordRecovery: event === 'PASSWORD_RECOVERY' ? true : s.isPasswordRecovery,
        }));
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  /** Call after the user has successfully set a new password */
  const clearPasswordRecovery = useCallback(() => {
    setState((s) => ({ ...s, isPasswordRecovery: false }));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    isPasswordRecovery: state.isPasswordRecovery,
    signUp,
    signIn,
    signOut,
    clearPasswordRecovery,
  };
}
