import { test, expect } from '../support/fixtures';

test.describe('Authentication resilience', () => {
  test('[P0][AUTH.01-E2E-05] Given a stale cached session, When the app boots, Then it returns to login without a spinner loop', async ({
    page,
  }) => {
    // Given: the default Playwright storageState authenticated successfully.
    await page.goto('/');
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 30_000,
    });

    // Corrupt the Supabase auth token that storageState placed in localStorage.
    const corrupted = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(
        (candidate) => candidate.startsWith('sb-') && candidate.endsWith('-auth-token')
      );
      if (!key) return false;

      const raw = localStorage.getItem(key);
      if (!raw) return false;

      const session = JSON.parse(raw) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        expires_in?: number;
      };

      session.access_token = 'stale.invalid.jwt';
      session.refresh_token = 'stale-refresh-token';
      session.expires_at = Math.floor(Date.now() / 1000) + 3600;
      session.expires_in = 3600;
      localStorage.setItem(key, JSON.stringify(session));
      return true;
    });

    expect(corrupted).toBe(true);

    // When: the app boots with a forged cached session.
    await page.reload();

    // Then: AuthContext validates, purges stale sb-* storage, and routes to login.
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
    await expect(page.getByText('Loading your dashboard...')).toHaveCount(0);

    const authKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('sb-'))
    );
    expect(authKeys).toEqual([]);
  });
});
