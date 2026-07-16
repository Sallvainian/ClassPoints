import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase, AuthValidationTimeoutError, isNetworkClassAuthError } from '../lib/supabase';
import {
  bootRequestedPasswordRecovery,
  getAuthEmailRedirectUrl,
  parseRecoveryFromHash,
} from '../lib/appUrl';
import { networkStatus } from '../services/NetworkStatus';
import { queryClient } from '../lib/queryClient';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { AuthContext, type AuthContextValue } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [authSuspended, setAuthSuspended] = useState(false);
  // Seeded from the module-eval hash capture: GoTrueClient consumes the
  // recovery hash (and emits PASSWORD_RECOVERY) possibly before this provider's
  // effect registers onAuthStateChange — see src/lib/appUrl.ts header.
  const [passwordRecovery, setPasswordRecovery] = useState(bootRequestedPasswordRecovery);
  // Tracks the previously-seen user id across auth events. Supabase emits
  // INITIAL_SESSION on mount, which we must NOT treat as a transition — only
  // clear the query cache when a different user appears after one was present
  // (account switch / shared-iPad scenario), so user A's cache can't flash on
  // user B's first render.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Initialize auth state
  useEffect(() => {
    let cancelled = false;
    // Effect-local coordination between init(), the network listener, and the
    // auth listener below. Deliberately NOT React state or refs: all three
    // callbacks share this one closure, so there is no stale-closure surface,
    // and none of the flags need to trigger renders by themselves.
    let revalidatePending = false; // a cached session was kept without server validation
    let suspendedLocal = false; // closure mirror of authSuspended, for the reconnect kick
    let prevOnline: boolean | null = null;

    /**
     * Manually purge any cached Supabase auth keys from localStorage.
     * Last-resort fallback when supabase.auth.signOut itself fails (which can
     * happen if the auth endpoint is unreachable). Without this, a stale JWT
     * stays in storage and the GoTrueClient's auto-refresh loops forever.
     */
    const purgeAuthStorage = () => {
      try {
        // Standard Storage iteration (length/key) rather than Object.keys:
        // identical in browsers, and it also works on Storage implementations
        // that don't expose items as enumerable own properties (jsdom shims).
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k !== null) keys.push(k);
        }
        for (const k of keys) {
          if (k.startsWith('sb-')) localStorage.removeItem(k);
        }
      } catch {
        // localStorage unavailable (private browsing edge case) — nothing to purge
      }
    };

    /** Direct storage probe: does a Supabase session blob exist at all? */
    const storageHasAuthToken = () => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k !== null && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
        }
      } catch {
        // localStorage unavailable — treat as no session
      }
      return false;
    };

    /** The genuine-rejection path: the server said this session is dead. */
    const purgeAndSignOut = async () => {
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
    };

    /**
     * On boot, the GoTrueClient hydrates from localStorage and immediately
     * starts auto-refreshing the access token. If the cached session was
     * issued by a different Supabase instance (project switched, local stack
     * recreated, JWT secret rotated), the refresh fails and the client
     * retries forever — bricking the page.
     *
     * Mitigation: validate the cached session against the server with a
     * bounded timeout, but discriminate WHY validation failed:
     *  - genuine rejection (401/403, session missing) → purge, route to login;
     *  - network-class failure (offline, timeout, 5xx/429) → the session is
     *    not proven invalid; keep it and let GoTrue's auto-refresh ticker
     *    recover once connectivity returns. Purging here would log a teacher
     *    out — and destroy the tokens recovery needs — just for being offline.
     */
    const init = async () => {
      try {
        // getSession() is normally a local storage read, but with an EXPIRED
        // cached token it performs the refresh inline — and on network-class
        // failures auth-js retries with exponential backoff for up to ~30s.
        // Unbounded, that means half a minute of boot spinner before the
        // offline gate can appear, so race it like getUser below. 8s (vs
        // getUser's 5s) leaves room for one slow refresh round-trip plus the
        // first backoff steps on a flaky-but-alive network.
        const sessionPromise = supabase.auth.getSession();
        sessionPromise.catch(() => {});

        let sessionTimeoutId: ReturnType<typeof setTimeout> | undefined;
        const sessionTimeout = new Promise<never>((_, reject) => {
          sessionTimeoutId = setTimeout(() => reject(new AuthValidationTimeoutError()), 8000);
        });

        let sessionResult: Awaited<typeof sessionPromise>;
        try {
          sessionResult = await Promise.race([sessionPromise, sessionTimeout]);
        } catch (raceError) {
          if (!(raceError instanceof AuthValidationTimeoutError)) throw raceError;
          // Timed out mid-refresh (or pathological lock contention). Suspend
          // ONLY when storage proves a session blob exists — a logged-out user
          // must land on the login form, and with no session there is no
          // ticker activity that would ever clear a wrongly-shown gate.
          const suspend = storageHasAuthToken();
          suspendedLocal = suspend;
          if (!cancelled) {
            setAuthSuspended(suspend);
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          // The abandoned getSession() keeps running (auth-js retry loop). A
          // late SUCCESS must still land: a refresh emits TOKEN_REFRESHED (the
          // listener below handles it), but a slow LOCAL read of a non-expired
          // session emits nothing — apply it here. Skipping the getUser
          // validation for this path is accepted: it's the same trust level as
          // ticker recovery, and the stale-instance brick this validation
          // guards against never yields a session from a failing refresh.
          void sessionPromise
            .then(({ data: { session: late } }) => {
              if (cancelled || !late) return;
              suspendedLocal = false;
              setAuthSuspended(false);
              setSession(late);
              setUser(late.user);
            })
            .catch(() => {});
          return;
        } finally {
          clearTimeout(sessionTimeoutId);
        }

        const {
          data: { session: cached },
          error: sessionError,
        } = sessionResult;

        // The boot-hash recovery capture is PROVISIONAL. GoTrueClient clears
        // the hash only when it successfully consumed the recovery tokens
        // (inside _getSessionFromURL, before getSession() can resolve). A
        // recovery hash that SURVIVED initialization therefore means no
        // recovery session was established — crafted/token-less link, or the
        // link's server-side validation failed. Keeping the flag would aim the
        // reset form at whatever session already exists (on a shared device:
        // the WRONG teacher's account). The PASSWORD_RECOVERY event, which
        // only fires on success, independently re-sets the flag if needed.
        if (bootRequestedPasswordRecovery && parseRecoveryFromHash(window.location.hash)) {
          if (!cancelled) setPasswordRecovery(false);
        }

        if (!cached) {
          // No usable session. getSession() reports WHY via its error:
          //  - null / genuine rejection → logged out (a dead session was
          //    already removed from storage by auth-js itself);
          //  - network-class (typically an offline boot whose cached access
          //    token expired, so the refresh attempt couldn't reach the
          //    server) → auth-js KEPT the session in storage and its 30s
          //    ticker keeps re-attempting: suspend instead of showing the
          //    login form. Recovery lands via onAuthStateChange below.
          // Cosmetic race, accepted: INITIAL_SESSION(null) may render the
          // login form for a frame before this branch flips to the gate.
          const suspend = sessionError != null && isNetworkClassAuthError(sessionError);
          suspendedLocal = suspend;
          if (!cancelled) {
            setAuthSuspended(suspend);
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
          timeoutId = setTimeout(() => reject(new AuthValidationTimeoutError()), 5000);
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

        if (validateError && !isNetworkClassAuthError(validateError)) {
          console.warn(
            '[auth] cached session is stale (rejected by server); clearing local state',
            validateError
          );
          await purgeAndSignOut();
          return;
        }

        if (validateError) {
          // Network-class: the server was unreachable, not disapproving. Keep
          // the cached session so the app renders and GoTrue self-heals once
          // online; arm a one-shot revalidation for the next offline→online
          // transition to promptly catch genuinely revoked sessions.
          console.warn(
            '[auth] session validation deferred (network-class failure); keeping cached session',
            validateError
          );
          revalidatePending = true;
        }

        if (!cancelled) {
          setSession(cached);
          setUser(cached.user);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[auth] init failed:', err);
        // Unknown throw (getSession itself failing — lock timeouts, storage
        // exceptions): we can't tell whether a session exists, so fall to the
        // login form either way, but purge only on non-network errors. If a
        // real session survives in storage, the ticker's eventual refresh
        // flips the UI to signed-in via the auth listener.
        if (!isNetworkClassAuthError(err)) purgeAuthStorage();
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    };

    void init();

    /**
     * One-shot revalidation of a session kept on a network-class boot failure.
     * Disarms before awaiting; re-arms only if the check itself fails network-
     * class again (browsers fire 'online' for captive portals and flapping
     * Wi-Fi — a false positive must not burn the shot). No timeout race here:
     * the app is already rendered, and a genuinely dead session has an
     * independent safety net (the ticker's refresh gets a non-retryable
     * rejection → auth-js removes the session → SIGNED_OUT → listener below).
     */
    const revalidate = async () => {
      revalidatePending = false;
      const { error: revalidateError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!revalidateError) return;
      if (isNetworkClassAuthError(revalidateError)) {
        revalidatePending = true;
        return;
      }
      console.warn(
        '[auth] kept session rejected on revalidation; clearing local state',
        revalidateError
      );
      await purgeAndSignOut();
    };

    const unsubscribeNetwork = networkStatus.subscribe(({ isOnline }) => {
      const was = prevOnline;
      prevOnline = isOnline;
      // subscribe() invokes the listener synchronously with the CURRENT
      // state (NetworkStatus.ts) — only genuine false→true transitions count.
      if (was === null) return;
      if (was || !isOnline) return;
      if (revalidatePending) void revalidate();
      if (suspendedLocal) {
        // Kick: getSession() on an expired stored session attempts the
        // refresh immediately instead of waiting ≤30s for GoTrue's ticker.
        // Result deliberately ignored — success emits TOKEN_REFRESHED and the
        // auth listener does the state work. (auth-js caches refresh FAILURES
        // for 60s; a kick inside that cooldown no-ops and the ticker remains
        // the backstop, bounding recovery at ~60–90s worst case.)
        void supabase.auth.getSession().catch(() => {});
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const prev = prevUserIdRef.current;
      // Only clear on a genuine user-id transition away from a known user.
      // First event (prev === undefined) and null→null no-ops pass through.
      if (prev !== undefined && prev !== null && prev !== nextUserId) {
        queryClient.clear();
      }
      if (event === 'PASSWORD_RECOVERY') {
        // Belt-and-suspenders with the module-eval boot capture: this fires
        // when our registration DID beat GoTrueClient's setTimeout(0) emit.
        setPasswordRecovery(true);
      }
      if (session) {
        // A delivered session means the server just validated us
        // (SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION with a live
        // session): leave suspension and settle any pending revalidation.
        suspendedLocal = false;
        revalidatePending = false;
        setAuthSuspended(false);
      } else if (event === 'SIGNED_OUT') {
        // Covers auth-js removing a genuinely dead session on its own (a
        // non-retryable refresh once back online) — fall to the login form,
        // not a stuck gate. Also disarm any pending revalidation: it
        // referenced the session that just died, and firing it while signed
        // out would purge-and-sign-out a login form (getUser returns
        // AuthSessionMissingError, which is not network-class).
        suspendedLocal = false;
        revalidatePending = false;
        setAuthSuspended(false);
      }
      prevUserIdRef.current = nextUserId;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      unsubscribeNetwork();
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
    // A stale recovery flag must not survive sign-out — it would dump the
    // NEXT login straight onto the reset-password form.
    setPasswordRecovery(false);
    // Defense-in-depth: also clear on the explicit signOut path so we don't
    // depend on the auth-change listener winning the race against the next
    // sign-in. onAuthStateChange's gated clear handles account-switch; this
    // handles the plain "log out" path where prevUserId → null.
    queryClient.clear();
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<{ success: boolean; error?: AuthError }> => {
      setError(null);

      // App root, not a path: GitHub Pages 404s unknown SPA routes, and the
      // recovery landing keys off the root URL's hash (src/lib/appUrl.ts).
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthEmailRedirectUrl(),
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

  const updateEmail = useCallback(
    async (email: string): Promise<{ success: boolean; error?: AuthError }> => {
      setError(null);

      // With Supabase's "secure email change" ON (the default) confirmation
      // links go to BOTH the current and new addresses; with it OFF only the
      // new address gets one. Either way the links land on the app root like
      // every other auth email — this call is identical under both settings.
      const { error: updateError } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: getAuthEmailRedirectUrl() }
      );

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

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    error,
    authSuspended,
    passwordRecovery,
    clearPasswordRecovery,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateEmail,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
