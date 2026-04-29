import { test, expect } from '../support/fixtures';

test.describe('App bootstrap (smoke)', () => {
  test('Given an authenticated session, When the app loads, Then the dashboard chrome is visible', async ({
    page,
  }) => {
    // Given: storageState from auth.setup.ts is already applied.
    // When:
    await page.goto('/');

    // Then:
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible();
    await expect(page.locator('aside').getByText('Classrooms', { exact: true })).toBeVisible();
  });
});

test.describe('User factory lifecycle (sample)', () => {
  test('Given a userFactory fixture, When create() is called, Then the user exists and is auto-cleaned afterward', async ({
    userFactory,
  }) => {
    // Given: factory provided by the merged fixture, cleanup wired by Playwright.
    // When:
    const user = await userFactory.create();

    // Then:
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.email).toMatch(/@classpoints\.local$/);
    // Cleanup runs automatically when the test ends (see fixtures/index.ts).
  });
});
