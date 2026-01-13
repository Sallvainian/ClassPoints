import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  // These tests don't use the stored auth state
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should display login form when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should see the login form
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in invalid credentials
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should show an error message
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    const email = process.env.VITE_TEST_EMAIL;
    const password = process.env.VITE_TEST_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'Test credentials not configured');
      return;
    }

    await page.goto('/');

    // Fill credentials
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should see dashboard with ClassPoints branding (in sidebar)
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Authenticated User', () => {
  // These tests use the stored auth state (default)

  test('should display dashboard when authenticated', async ({ page }) => {
    await page.goto('/');

    // Should see the dashboard with ClassPoints branding (in sidebar)
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 15000,
    });

    // Should see the sidebar with classroom options - use text selector for flexibility
    await expect(page.getByText('New Classroom')).toBeVisible({ timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for dashboard to load (sidebar visible)
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 15000,
    });

    // Click sign out - it's a button containing "Sign Out" text
    await page.getByText('Sign Out').click();

    // Should return to login page
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({
      timeout: 15000,
    });
  });
});
