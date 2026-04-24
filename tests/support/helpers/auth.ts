import type { Page } from '@playwright/test';

// NOTE: This is a fallback login-through-UI helper for tests that do NOT use
// the (to-be-ported) storageState pattern. Once `tests/auth.setup.ts` is
// ported from the legacy config, most tests should rely on storageState
// instead of calling this helper.
export async function loginViaUi(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto('/');
  await page.getByTestId('auth-email').fill(credentials.email);
  await page.getByTestId('auth-password').fill(credentials.password);
  await page.getByTestId('auth-submit').click();
  await page.waitForURL(/\/(dashboard|classes)/);
}
