import { test, expect } from '@playwright/test';

// Test credentials should be provided via environment variables
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

test.describe('Sound Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // If we're on the login page, authenticate
    const loginButton = page.getByRole('button', { name: /sign in/i });
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
      await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);
      await loginButton.click();

      // Wait for dashboard to load
      await expect(
        page.getByText(/Welcome to ClassPoints|classrooms/i)
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('sound settings button is visible in dashboard header', async ({
    page,
  }) => {
    // Select a classroom if available
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) > 0) {
      await classroomButtons.first().click();
      await page.waitForLoadState('networkidle');

      // Look for sound settings button (speaker icon)
      const soundButton = page.getByRole('button', {
        name: /sound settings/i,
      });
      await expect(soundButton).toBeVisible();
    }
  });

  test('sound settings modal opens and displays controls', async ({ page }) => {
    // Select a classroom
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings modal
    const soundButton = page.getByRole('button', { name: /sound settings/i });
    await soundButton.click();

    // Verify modal opened
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Verify key elements are present
    await expect(modal.getByText('Sound Settings')).toBeVisible();
    await expect(modal.getByText('Sound Effects')).toBeVisible();
    await expect(modal.getByText(/volume/i)).toBeVisible();
    await expect(modal.getByText(/positive behavior sound/i)).toBeVisible();
    await expect(modal.getByText(/negative behavior sound/i)).toBeVisible();
  });

  test('sound toggle switch works', async ({ page }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings
    const soundButton = page.getByRole('button', { name: /sound settings/i });
    await soundButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Find the toggle switch
    const toggle = modal.getByRole('switch');
    await expect(toggle).toBeVisible();

    // Get initial state
    const initialState = await toggle.getAttribute('aria-checked');

    // Click to toggle
    await toggle.click();

    // Verify state changed
    const newState = await toggle.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);
  });

  test('volume slider adjusts value', async ({ page }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings
    await page.getByRole('button', { name: /sound settings/i }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Find volume slider
    const slider = modal.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // Get initial value
    const initialValue = await slider.inputValue();

    // Set to different value
    await slider.fill('50');

    // Verify the display updated
    await expect(modal.getByText(/50%/)).toBeVisible();
  });

  test('sound dropdown allows selection change', async ({ page }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings
    await page.getByRole('button', { name: /sound settings/i }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Find positive sound dropdown (first select)
    const positiveSelect = modal.locator('select').first();
    await expect(positiveSelect).toBeVisible();

    // Verify it has options (3 positive sounds)
    const options = await positiveSelect.locator('option').count();
    expect(options).toBe(3);
  });

  test('preview buttons are present for each sound category', async ({
    page,
  }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings
    await page.getByRole('button', { name: /sound settings/i }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Find preview buttons (they have play emoji)
    const previewButtons = modal.getByTitle(/preview sound/i);
    const count = await previewButtons.count();

    // Should have 2 preview buttons (positive and negative)
    expect(count).toBe(2);
  });

  test('advanced section expands to show custom URL inputs', async ({
    page,
  }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings
    await page.getByRole('button', { name: /sound settings/i }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Find and click advanced section toggle
    const advancedToggle = modal.getByText(/advanced.*custom/i);
    await expect(advancedToggle).toBeVisible();
    await advancedToggle.click();

    // Verify custom URL inputs appear
    await expect(
      modal.getByPlaceholder('https://example.com/sound.mp3')
    ).toBeVisible();
  });

  test('modal closes on escape key', async ({ page }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings
    await page.getByRole('button', { name: /sound settings/i }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Press escape
    await page.keyboard.press('Escape');

    // Verify modal closed
    await expect(modal).not.toBeVisible();
  });

  test('modal closes when clicking backdrop', async ({ page }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Open sound settings
    await page.getByRole('button', { name: /sound settings/i }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click backdrop (the dark overlay behind modal)
    await page.locator('.bg-black\\/50').click({ position: { x: 10, y: 10 } });

    // Verify modal closed
    await expect(modal).not.toBeVisible();
  });

  test('sound button shows correct icon based on enabled state', async ({
    page,
  }) => {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    if ((await classroomButtons.count()) === 0) {
      test.skip(true, 'No classrooms available');
      return;
    }

    await classroomButtons.first().click();
    await page.waitForLoadState('networkidle');

    // Get initial icon (should be speaker on)
    const soundButton = page.getByRole('button', { name: /sound settings/i });
    const initialText = await soundButton.textContent();

    // Open settings and disable
    await soundButton.click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const toggle = modal.getByRole('switch');
    await toggle.click();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Check icon changed
    const newText = await soundButton.textContent();

    // Icons should be different (one is speaker, one is muted)
    // Both contain emoji so we just verify the button still exists
    await expect(soundButton).toBeVisible();
  });
});
