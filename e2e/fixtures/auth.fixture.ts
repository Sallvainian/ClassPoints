import { test as base, expect, type Page } from '@playwright/test';

// Test credentials from environment
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

/**
 * Custom fixture that handles authentication before tests
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to app
    await page.goto('/');

    // Check if login is required
    const loginButton = page.getByRole('button', { name: /sign in/i });
    const isLoginPage = await loginButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isLoginPage) {
      // Fill credentials
      await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
      await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);
      await loginButton.click();

      // Wait for dashboard - use specific element, not networkidle
      await expect(
        page.getByText(/Welcome to ClassPoints/i).or(page.locator('aside'))
      ).toBeVisible({ timeout: 15000 });
    }

    // Provide authenticated page to test
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };
