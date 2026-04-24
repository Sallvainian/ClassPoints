import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import type { User, Session, AuthError } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ success: boolean; error?: AuthError }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: AuthError }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: AuthError }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: AuthError }>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  // Tracks the previously-seen user id across auth events. Supabase emits
  // INITIAL_SESSION on mount, which we must NOT treat as a transition — only
  // clear the query cache when a different user appears after one was present
  // (account switch / shared-iPad scenario), so user A's cache can't flash on
  // user B's first render.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const prev = prevUserIdRef.current;
      // Only clear on a genuine user-id transition away from a known user.
      // First event (prev === undefined) and null→null no-ops pass through.
      if (prev !== undefined && prev !== null && prev !== nextUserId) {
        queryClient.clear();
      }
      prevUserIdRef.current = nextUserId;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name?: string
    ): Promise<{ success: boolean; error?: AuthError }> => {
      setError(null);
      setLoading(true);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
          },
        },
      });

      setLoading(false);

      if (signUpError) {
        setError(signUpError);
        return { success: false, error: signUpError };
      }

      // If email confirmation is required, user won't be signed in yet
      if (data.user && !data.session) {
        return { success: true };
      }

      return { success: true };
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: AuthError }> => {
      setError(null);
      setLoading(true);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (signInError) {
        setError(signInError);
        return { success: false, error: signInError };
      }

      return { success: true };
    },
    []
  );

  const signOut = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
    // Defense-in-depth: also clear on the explicit signOut path so we don't
    // depend on the auth-change listener winning the race against the next
    // sign-in. onAuthStateChange's gated clear handles account-switch; this
    // handles the plain "log out" path where prevUserId → null.
    queryClient.clear();
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<{ success: boolean; error?: AuthError }> => {
      setError(null);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError);
        return { success: false, error: resetError };
      }

      return { success: true };
    },
    []
  );

  const updatePassword = useCallback(
    async (password: string): Promise<{ success: boolean; error?: AuthError }> => {
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError);
        return { success: false, error: updateError };
      }

      return { success: true };
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
