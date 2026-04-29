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
    let cancelled = false;

    /**
     * Manually purge any cached Supabase auth keys from localStorage.
     * Last-resort fallback when supabase.auth.signOut itself fails (which can
     * happen if the auth endpoint is unreachable). Without this, a stale JWT
     * stays in storage and the GoTrueClient's auto-refresh loops forever.
     */
    const purgeAuthStorage = () => {
      try {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('sb-')) localStorage.removeItem(k);
        }
      } catch {
        // localStorage unavailable (private browsing edge case) — nothing to purge
      }
    };

    /**
     * On boot, the GoTrueClient hydrates from localStorage and immediately
     * starts auto-refreshing the access token. If the cached session was
     * issued by a different Supabase instance (project switched, local stack
     * recreated, JWT secret rotated) OR the auth endpoint is unreachable,
     * the refresh fails and the client retries forever — bricking the page.
     *
     * Mitigation: validate the cached session against the server with a
     * bounded timeout. If it doesn't validate, clear local state so the app
     * routes to the login screen instead of spinning.
     */
    const init = async () => {
      try {
        const {
          data: { session: cached },
        } = await supabase.auth.getSession();

        if (!cached) {
          if (!cancelled) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Validate against the server with a wall-clock bound — we can't
        // trust the cached session alone. supabase.auth.getUser() accepts no
        // AbortSignal in @supabase/auth-js, and the underlying fetch has no
        // default timeout, so a dead /auth/v1/user endpoint would hang boot
        // indefinitely without this race.
        const userPromise = supabase.auth.getUser();
        // Detach: if the timeout wins the race, this promise stays pending
        // and may later reject (e.g. when GoTrue's internal lock timeout
        // fires). Without a no-op handler that surfaces as an unhandled
        // rejection.
        userPromise.catch(() => {});

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('auth validation timeout')), 5000);
        });

        let validateError: unknown = null;
        try {
          const { error } = await Promise.race([userPromise, timeoutPromise]);
          validateError = error;
        } catch (e) {
          validateError = e;
        } finally {
          clearTimeout(timeoutId);
        }

        if (validateError) {
          console.warn(
            '[auth] cached session is stale (refresh/validate failed); clearing local state',
            validateError
          );
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // signOut itself can hit the network — purge directly
          }
          purgeAuthStorage();
          if (!cancelled) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setSession(cached);
          setUser(cached.user);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[auth] init failed:', err);
        purgeAuthStorage();
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    void init();

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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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
