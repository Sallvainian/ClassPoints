import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../contexts/useAuth';

// ── Recovery-link boot seeding ────────────────────────────────────────────────
// Separate file from AuthContext.test.tsx because module mocks are file-level:
// `bootRequestedPasswordRecovery` is a module-eval constant, so flipping it
// per-test is impossible. This file pins that a boot whose URL hash carried
// `type=recovery` (captured before GoTrueClient clears the hash — see
// src/lib/appUrl.ts) seeds the passwordRecovery flag WITHOUT needing the
// PASSWORD_RECOVERY event to arrive after our listener registers.

// Controls the post-init hash-survival probe: false = GoTrueClient consumed
// (cleared) the hash, i.e. recovery SUCCEEDED; true = the hash survived, i.e.
// recovery failed or the link was crafted/token-less.
const mockParseRecoveryFromHash = vi.hoisted(() => vi.fn(() => false));

vi.mock('../lib/appUrl', () => ({
  bootRequestedPasswordRecovery: true,
  parseRecoveryFromHash: mockParseRecoveryFromHash,
  getAuthEmailRedirectUrl: () => 'https://example.test/',
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
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
  };
});

function Probe() {
  const { loading, passwordRecovery } = useAuth();
  return <div data-testid="probe">{JSON.stringify({ loading, passwordRecovery })}</div>;
}

describe('AuthContext recovery-link boot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseRecoveryFromHash.mockReturnValue(false);
  });

  it('seeds passwordRecovery from the module-eval boot-hash capture (hash consumed = recovery succeeded)', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('probe').textContent ?? '{}')).toMatchObject({
        loading: false,
        passwordRecovery: true,
      });
    });
  });

  it('clears the provisional flag when the recovery hash SURVIVED initialization (recovery failed)', async () => {
    // GoTrueClient clears the hash only on successful token consumption. A
    // surviving hash means no recovery session exists — keeping the flag
    // would aim the reset form at whatever session is already signed in
    // (the WRONG teacher on a shared device) or hijack a later normal login.
    mockParseRecoveryFromHash.mockReturnValue(true);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('probe').textContent ?? '{}')).toMatchObject({
        loading: false,
        passwordRecovery: false,
      });
    });
  });
});
