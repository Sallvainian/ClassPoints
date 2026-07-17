import { test, expect } from '../support/fixtures';

// Inverse of AUTH.01-E2E-05 (auth.spec.ts): that spec pins "server REJECTED the
// session → purge + login form"; these pin "server was UNREACHABLE → keep the
// session". Route-aborts scope the outage to the auth endpoints so the app
// itself (document, REST, realtime) stays reachable — context.setOffline would
// fail the document fetch on reload.
test.describe('Offline-boot resilience', () => {
  test('[P0][AUTH.02-E2E-01] Given a valid cached session and an unreachable auth server, When the app boots, Then the dashboard renders and the session is kept', async ({
    page,
  }) => {
    // Abort BEFORE first navigation: boot-time getUser validation (and any
    // refresh attempt) must fail network-class, never reach the server.
    await page.route('**/auth/v1/user*', (route) => route.abort());
    await page.route('**/auth/v1/token*', (route) => route.abort());

    await page.goto('/');

    // The kept session renders the app shell; REST is not blocked, so data loads.
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 30_000,
    });
    // No login form (its unique marker — the dashboard greeting also says
    // "Welcome back", so the heading text can't discriminate).
    await expect(page.getByRole('button', { name: /Sign in/i })).toHaveCount(0);

    // sb-* storage intact — the exact inverse of AUTH.01-E2E-05's toEqual([]).
    const authKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('sb-'))
    );
    expect(authKeys.length).toBeGreaterThan(0);
  });

  test('[P1][AUTH.02-E2E-02] Given an expired cached session and no auth connectivity, When the app boots, Then the offline gate shows and the session recovers once online', async ({
    page,
  }) => {
    // Boot normally so the origin's localStorage is live.
    await page.goto('/');
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 30_000,
    });

    // Expire the REAL session's access token (tokens stay valid — contrast
    // with AUTH.01-E2E-05's forgery): auth-js must attempt a refresh at boot,
    // and with the token endpoint dead, getSession() returns
    // { session: null, error: AuthRetryableFetchError } → the suspended branch.
    const expired = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(
        (candidate) => candidate.startsWith('sb-') && candidate.endsWith('-auth-token')
      );
      if (!key) return false;

      const raw = localStorage.getItem(key);
      if (!raw) return false;

      const session = JSON.parse(raw) as { expires_at?: number; expires_in?: number };
      session.expires_at = Math.floor(Date.now() / 1000) - 3600;
      session.expires_in = -3600;
      localStorage.setItem(key, JSON.stringify(session));
      return true;
    });
    expect(expired).toBe(true);

    await page.route('**/auth/v1/user*', (route) => route.abort());
    await page.route('**/auth/v1/token*', (route) => route.abort());

    await page.reload();

    // The reconnect gate, not the login form — and no purge.
    await expect(page.getByTestId('offline-gate')).toBeVisible({ timeout: 15_000 });
    const authKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('sb-'))
    );
    expect(authKeys.length).toBeGreaterThan(0);

    // Connectivity returns: a fresh boot must recover the session from the
    // kept refresh token. (Second reload rather than an in-place online event:
    // a fresh GoTrueClient sidesteps auth-js's 60s refresh-failure cooldown,
    // which would make an in-place assertion flake; the in-place reconnect
    // kick is unit-pinned in AuthContext.test.tsx. The aborted attempts never
    // reached the server, so the refresh token was never consumed.)
    await page.unroute('**/auth/v1/user*');
    await page.unroute('**/auth/v1/token*');
    await page.reload();

    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 30_000,
    });
  });
});
