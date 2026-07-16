import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import {
  AuthRetryableFetchError,
  AuthApiError,
  type Session,
  type AuthChangeEvent,
} from '@supabase/supabase-js';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../contexts/useAuth';

// ── AuthContext boot resilience ───────────────────────────────────────────────
// Pins the offline-cold-start state machine: network-class validation failures
// KEEP the cached session (and sb-* storage) so GoTrue's ticker can recover it;
// genuine server rejections purge exactly as before (the unit-level twin of
// E2E AUTH.01-E2E-05). Also pins the suspended branch (getSession error was
// previously ignored), the reconnect one-shot revalidation + suspended kick,
// and the PASSWORD_RECOVERY flag.
//
// Mock strategy: the supabase factory spreads the REAL module so the classifier
// under test (isNetworkClassAuthError / AuthValidationTimeoutError) stays live;
// only the client's auth surface is controllable. Error fixtures are REAL
// auth-js instances — no hand-rolled shapes. networkStatus is the REAL
// singleton driven through jsdom window online/offline events, so the
// immediate-fire-on-subscribe guard is exercised for real.

const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockResetPasswordForEmail = vi.hoisted(() => vi.fn());
const mockUpdateUser = vi.hoisted(() => vi.fn());
const capturedAuthCallback = vi.hoisted(() => ({
  current: undefined as ((event: AuthChangeEvent, session: Session | null) => void) | undefined,
}));

// Env is stubbed BEFORE importOriginal — src/lib/supabase.ts throws at eval
// without creds (CI's Unit Tests step runs credless).
vi.mock('../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
        signOut: mockSignOut,
        resetPasswordForEmail: mockResetPasswordForEmail,
        updateUser: mockUpdateUser,
        onAuthStateChange: vi.fn(
          (cb: (event: AuthChangeEvent, session: Session | null) => void) => {
            capturedAuthCallback.current = cb;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          }
        ),
      },
    },
  };
});

const SESSION = {
  access_token: 'valid-access-token',
  refresh_token: 'valid-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'user-1', email: 'teacher@example.com' },
} as unknown as Session;

const retryableError = () => new AuthRetryableFetchError('fetch failed', 0);
const rejectedError = () => new AuthApiError('invalid JWT', 403, 'bad_jwt');

function Probe() {
  const { user, loading, authSuspended, passwordRecovery, signOut, resetPassword, updateEmail } =
    useAuth();
  return (
    <div>
      <div data-testid="probe">
        {JSON.stringify({ user: !!user, loading, authSuspended, passwordRecovery })}
      </div>
      <button onClick={() => void signOut()}>probe-sign-out</button>
      <button onClick={() => void resetPassword('teacher@example.com')}>
        probe-reset-password
      </button>
      <button onClick={() => void updateEmail('new@example.com')}>probe-update-email</button>
    </div>
  );
}

function probeState() {
  return JSON.parse(screen.getByTestId('probe').textContent ?? '{}') as {
    user: boolean;
    loading: boolean;
    authSuspended: boolean;
    passwordRecovery: boolean;
  };
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

async function settled() {
  await waitFor(() => expect(probeState().loading).toBe(false));
}

const SB_KEY = 'sb-local-auth-token';

/** false→true transition as the app sees it: offline then online window events. */
async function goOfflineThenOnline() {
  await act(async () => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    // Let the listener's async revalidate/kick settle.
    await Promise.resolve();
  });
}

describe('AuthContext boot resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedAuthCallback.current = undefined;
    // setup.ts clears storage in its own beforeEach; seed a fake auth token so
    // purge/no-purge assertions have something to observe.
    window.localStorage.setItem(SB_KEY, JSON.stringify({ access_token: 'x' }));
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: SESSION.user }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockUpdateUser.mockResolvedValue({ data: { user: SESSION.user }, error: null });
  });

  afterEach(() => {
    // Reset the real NetworkStatus singleton to online for the next test.
    window.dispatchEvent(new Event('online'));
  });

  it('keeps the cached session and sb-* storage when getUser fails network-class', async () => {
    mockGetSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: retryableError() });

    renderProvider();
    await settled();

    expect(probeState()).toMatchObject({ user: true, authSuspended: false });
    expect(window.localStorage.getItem(SB_KEY)).not.toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('purges and logs out when getUser reports a genuine rejection (unit pin of AUTH.01-E2E-05)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: rejectedError() });

    renderProvider();
    await settled();

    expect(probeState()).toMatchObject({ user: false, authSuspended: false });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(window.localStorage.getItem(SB_KEY)).toBeNull();
  });

  it('treats a hung getUser as network-class via the 5s timeout sentinel and keeps the session', async () => {
    vi.useFakeTimers();
    try {
      mockGetSession.mockResolvedValue({ data: { session: SESSION }, error: null });
      mockGetUser.mockReturnValue(new Promise(() => {})); // never resolves

      renderProvider();
      // Flush getSession's microtask so the timeout race is armed, then fire it.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5001);
      });

      expect(probeState()).toMatchObject({ user: true, loading: false, authSuspended: false });
      expect(window.localStorage.getItem(SB_KEY)).not.toBeNull();
      expect(mockSignOut).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('suspends (no purge) when getSession returns no session with a network-class error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: retryableError() });

    renderProvider();
    await settled();

    expect(probeState()).toMatchObject({ user: false, authSuspended: true });
    expect(window.localStorage.getItem(SB_KEY)).not.toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('plain signed-out boot (no session, no error) is NOT suspended', async () => {
    renderProvider();
    await settled();

    expect(probeState()).toMatchObject({ user: false, authSuspended: false });
  });

  it('does NOT suspend when getSession fails with a genuine (non-network) error', async () => {
    // e.g. the refresh token was revoked server-side: auth-js already removed
    // the dead session from storage itself — this is a real logout, and a gate
    // here would strand the teacher with no way to sign back in.
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    });

    renderProvider();
    await settled();

    expect(probeState()).toMatchObject({ user: false, authSuspended: false });
  });

  describe('null-session auth events against a suspended boot', () => {
    async function bootSuspended() {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: retryableError() });
      renderProvider();
      await settled();
      expect(probeState().authSuspended).toBe(true);
    }

    it('SIGNED_OUT clears suspension (auth-js removed a genuinely dead session once online)', async () => {
      await bootSuspended();

      act(() => {
        capturedAuthCallback.current?.('SIGNED_OUT', null);
      });

      expect(probeState()).toMatchObject({ user: false, authSuspended: false });
    });

    it('INITIAL_SESSION(null) does NOT clear suspension', async () => {
      await bootSuspended();

      act(() => {
        capturedAuthCallback.current?.('INITIAL_SESSION', null);
      });

      expect(probeState()).toMatchObject({ user: false, authSuspended: true });
    });
  });

  it('SIGNED_OUT disarms a pending revalidation (no spurious purge from a later reconnect)', async () => {
    // Boot keeps an unvalidated session (revalidation armed) …
    mockGetSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: retryableError() });
    renderProvider();
    await settled();
    expect(probeState().user).toBe(true);

    // … then the session dies via SIGNED_OUT. The armed shot referenced it.
    act(() => {
      capturedAuthCallback.current?.('SIGNED_OUT', null);
    });

    await goOfflineThenOnline();

    // Disarmed: no second getUser — a fired shot would see
    // AuthSessionMissingError (not network-class) and purge a login form.
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signOut clears a lingering passwordRecovery flag', async () => {
    renderProvider();
    await settled();

    act(() => {
      capturedAuthCallback.current?.('PASSWORD_RECOVERY', SESSION);
    });
    expect(probeState().passwordRecovery).toBe(true);

    await act(async () => {
      screen.getByRole('button', { name: 'probe-sign-out' }).click();
      await Promise.resolve();
    });

    expect(probeState().passwordRecovery).toBe(false);
  });

  it('resetPassword sends the app-root redirect (never a /reset-password path)', async () => {
    renderProvider();
    await settled();

    await act(async () => {
      screen.getByRole('button', { name: 'probe-reset-password' }).click();
      await Promise.resolve();
    });

    // jsdom origin + Vite test BASE_URL ('/'): the resolved app root.
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('teacher@example.com', {
      redirectTo: `${window.location.origin}/`,
    });
  });

  it('updateEmail requests the change with the app-root confirmation redirect', async () => {
    renderProvider();
    await settled();

    await act(async () => {
      screen.getByRole('button', { name: 'probe-update-email' }).click();
      await Promise.resolve();
    });

    expect(mockUpdateUser).toHaveBeenCalledWith(
      { email: 'new@example.com' },
      { emailRedirectTo: `${window.location.origin}/` }
    );
  });

  describe('reconnect revalidation of a kept-unvalidated session', () => {
    async function bootKeptSession() {
      mockGetSession.mockResolvedValue({ data: { session: SESSION }, error: null });
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: retryableError() });
      renderProvider();
      await settled();
      expect(probeState().user).toBe(true);
    }

    it('purges and logs out when revalidation gets a genuine rejection', async () => {
      await bootKeptSession();
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new AuthApiError('session revoked', 401, 'session_not_found'),
      });

      await goOfflineThenOnline();

      await waitFor(() => expect(probeState().user).toBe(false));
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(window.localStorage.getItem(SB_KEY)).toBeNull();
    });

    it('re-arms when revalidation itself fails network-class (second transition retries)', async () => {
      await bootKeptSession();
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: retryableError() });

      await goOfflineThenOnline();
      expect(mockGetUser).toHaveBeenCalledTimes(2); // boot + first revalidation

      mockGetUser.mockResolvedValueOnce({ data: { user: SESSION.user }, error: null });
      await goOfflineThenOnline();
      expect(mockGetUser).toHaveBeenCalledTimes(3); // re-armed shot fired

      expect(probeState().user).toBe(true);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('stays signed in when revalidation succeeds', async () => {
      await bootKeptSession();
      mockGetUser.mockResolvedValueOnce({ data: { user: SESSION.user }, error: null });

      await goOfflineThenOnline();

      expect(mockGetUser).toHaveBeenCalledTimes(2);
      expect(probeState().user).toBe(true);
      expect(window.localStorage.getItem(SB_KEY)).not.toBeNull();
    });

    it("does not revalidate off the subscription's immediate synchronous fire", async () => {
      await bootKeptSession();
      // No offline→online transition dispatched: the initial subscribe fire
      // alone must not consume the one-shot.
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });
  });

  it('suspended + reconnect fires the getSession kick, and TOKEN_REFRESHED clears suspension', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: retryableError() });
    renderProvider();
    await settled();
    expect(probeState().authSuspended).toBe(true);
    expect(mockGetSession).toHaveBeenCalledTimes(1);

    await goOfflineThenOnline();
    expect(mockGetSession).toHaveBeenCalledTimes(2); // the kick

    act(() => {
      capturedAuthCallback.current?.('TOKEN_REFRESHED', SESSION);
    });

    expect(probeState()).toMatchObject({ user: true, authSuspended: false });
  });

  it('sets the passwordRecovery flag on a PASSWORD_RECOVERY auth event', async () => {
    renderProvider();
    await settled();
    expect(probeState().passwordRecovery).toBe(false);

    act(() => {
      capturedAuthCallback.current?.('PASSWORD_RECOVERY', SESSION);
    });

    expect(probeState()).toMatchObject({ user: true, passwordRecovery: true });
  });

  describe('bounded getSession (boot must not hang on the offline refresh-retry loop)', () => {
    // With an expired token and no network, auth-js retries the inline refresh
    // with backoff for up to ~30s — getSession() blocks that whole time. The
    // 8s race caps the boot spinner; storage decides suspended-vs-logged-out.
    it('suspends after 8s when storage holds a session blob', async () => {
      vi.useFakeTimers();
      try {
        mockGetSession.mockReturnValue(new Promise(() => {})); // refresh loop never settles

        renderProvider();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(8001);
        });

        expect(probeState()).toMatchObject({
          user: false,
          loading: false,
          authSuspended: true,
        });
        expect(window.localStorage.getItem(SB_KEY)).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('falls to logged-out (not a stuck gate) after 8s when storage has no session', async () => {
      vi.useFakeTimers();
      try {
        window.localStorage.removeItem(SB_KEY);
        mockGetSession.mockReturnValue(new Promise(() => {}));

        renderProvider();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(8001);
        });

        expect(probeState()).toMatchObject({
          user: false,
          loading: false,
          authSuspended: false,
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('applies a late-resolving session after the timeout (no auth event fires for a slow local read)', async () => {
      vi.useFakeTimers();
      try {
        let resolveSession!: (value: { data: { session: Session | null }; error: null }) => void;
        mockGetSession.mockReturnValue(
          new Promise((resolve) => {
            resolveSession = resolve;
          })
        );

        renderProvider();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(8001);
        });
        expect(probeState()).toMatchObject({ user: false, authSuspended: true });

        await act(async () => {
          resolveSession({ data: { session: SESSION }, error: null });
          await Promise.resolve();
        });

        expect(probeState()).toMatchObject({ user: true, authSuspended: false });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('outer-catch discrimination (getSession itself throwing)', () => {
    it('network-class throw with a stored session: suspended, storage kept', async () => {
      mockGetSession.mockRejectedValue(new TypeError('Failed to fetch'));

      renderProvider();
      await settled();

      expect(probeState()).toMatchObject({ user: false, authSuspended: true });
      expect(window.localStorage.getItem(SB_KEY)).not.toBeNull();
    });

    it('network-class throw with NO stored session: logged out, not suspended', async () => {
      window.localStorage.removeItem(SB_KEY);
      mockGetSession.mockRejectedValue(new TypeError('Failed to fetch'));

      renderProvider();
      await settled();

      expect(probeState()).toMatchObject({ user: false, authSuspended: false });
    });

    it('unknown throw: logged out AND purged', async () => {
      mockGetSession.mockRejectedValue(new Error('boom'));

      renderProvider();
      await settled();

      expect(probeState()).toMatchObject({ user: false, authSuspended: false });
      expect(window.localStorage.getItem(SB_KEY)).toBeNull();
    });
  });
});
