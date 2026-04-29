import type { Page } from '@playwright/test';

// Fallback login-via-UI helper for tests that intentionally don't use the
// `setup` project + `storageState` pattern (e.g., a test that needs to
// authenticate as a freshly-created user mid-spec). Most tests should rely
// on storageState — see `playwright.config.ts` `projects` for the wiring.
export async function loginViaUi(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/(dashboard|classes)?$/);
}
