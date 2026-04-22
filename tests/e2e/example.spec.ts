import { test, expect } from '../support/fixtures';

test.describe('example: app bootstrap', () => {
  test('renders the landing screen', async ({ page }) => {
    // Given the app is reachable via the Playwright webServer
    // When the user visits the root URL
    await page.goto('/');

    // Then the page responds with a title (placeholder assertion — replace
    // with a data-testid-based check against a real landing element once the
    // UI is stable, e.g. `await expect(page.getByTestId('app-root')).toBeVisible();`)
    await expect(page).toHaveTitle(/ClassPoints|Vite|React/i);
  });
});

test.describe('example: data factory lifecycle', () => {
  test(
    'creates and cleans up a seeded user',
    { tag: '@requires-service-role' },
    async ({ userFactory }) => {
      // Given a Supabase admin client (requires SUPABASE_SERVICE_ROLE_KEY in .env.test)
      // When the test asks the factory for a user
      const user = await userFactory.create();

      // Then the user has the expected shape; the fixture teardown will delete it
      expect(user.id).toMatch(/[0-9a-f-]{8,}/i);
      expect(user.email).toContain('@classpoints.local');
    }
  );
});
