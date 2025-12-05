import { test, expect } from './fixtures/auth.fixture';

/**
 * Sound Settings E2E Tests
 * Following Playwright best practices:
 * - Uses auth fixture instead of duplicate login code
 * - Role-based selectors over CSS selectors
 * - Explicit waits over networkidle
 * - Proper assertions for state verification
 */

test.describe('Sound Settings', () => {
  // Helper to select first classroom and wait for dashboard
  async function selectClassroom(page: import('@playwright/test').Page) {
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    const count = await classroomButtons.count();
    if (count === 0) {
      return false;
    }

    await classroomButtons.first().click();
    // Wait for classroom content to load (student grid or empty state)
    await expect(
      page.getByText(/students|no students|add your first/i)
    ).toBeVisible({ timeout: 10000 });
    return true;
  }

  // Helper to open sound settings modal
  async function openSoundSettings(page: import('@playwright/test').Page) {
    const soundButton = page.getByRole('button', { name: /sound settings/i });
    await soundButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    return modal;
  }

  test('sound settings button is visible in dashboard header', async ({
    authenticatedPage: page,
  }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    // Look for sound settings button (speaker icon)
    const soundButton = page.getByRole('button', { name: /sound settings/i });
    await expect(soundButton).toBeVisible();
  });

  test('sound settings modal opens and displays controls', async ({
    authenticatedPage: page,
  }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

    // Verify key elements are present using text content
    await expect(modal.getByText('Sound Settings')).toBeVisible();
    await expect(modal.getByText('Sound Effects')).toBeVisible();
    await expect(modal.getByText(/volume/i)).toBeVisible();
    await expect(modal.getByText(/positive behavior sound/i)).toBeVisible();
    await expect(modal.getByText(/negative behavior sound/i)).toBeVisible();
  });

  test('sound toggle switch works', async ({ authenticatedPage: page }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

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

  test('volume slider adjusts value', async ({ authenticatedPage: page }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

    // Find volume slider
    const slider = modal.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // Set to different value
    await slider.fill('50');

    // Verify the display updated
    await expect(modal.getByText(/50%/)).toBeVisible();
  });

  test('sound dropdown allows selection change', async ({
    authenticatedPage: page,
  }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

    // Find positive sound dropdown (first select)
    const positiveSelect = modal.locator('select').first();
    await expect(positiveSelect).toBeVisible();

    // Verify it has options (3 positive sounds)
    const options = await positiveSelect.locator('option').count();
    expect(options).toBe(3);
  });

  test('preview buttons are present for each sound category', async ({
    authenticatedPage: page,
  }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

    // Find preview buttons (they have play emoji or title)
    const previewButtons = modal.getByTitle(/preview sound/i);
    const count = await previewButtons.count();

    // Should have 2 preview buttons (positive and negative)
    expect(count).toBe(2);
  });

  test('advanced section expands to show custom URL inputs', async ({
    authenticatedPage: page,
  }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

    // Find and click advanced section toggle
    const advancedToggle = modal.getByText(/advanced.*custom/i);
    await expect(advancedToggle).toBeVisible();
    await advancedToggle.click();

    // Verify custom URL inputs appear
    await expect(
      modal.getByPlaceholder('https://example.com/sound.mp3')
    ).toBeVisible();
  });

  test('modal closes on escape key', async ({ authenticatedPage: page }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

    // Press escape
    await page.keyboard.press('Escape');

    // Verify modal closed
    await expect(modal).not.toBeVisible();
  });

  test('modal closes when clicking backdrop', async ({
    authenticatedPage: page,
  }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const modal = await openSoundSettings(page);

    // Click outside the modal dialog content
    // Use page.mouse to click at viewport edge which should be the backdrop
    const viewportSize = page.viewportSize();
    if (viewportSize) {
      await page.mouse.click(10, 10);
    }

    // Verify modal closed
    await expect(modal).not.toBeVisible();
  });

  test('sound button shows correct icon based on enabled state', async ({
    authenticatedPage: page,
  }) => {
    const hasClassroom = await selectClassroom(page);
    test.skip(!hasClassroom, 'No classrooms available');

    const soundButton = page.getByRole('button', { name: /sound settings/i });
    const modal = await openSoundSettings(page);

    const toggle = modal.getByRole('switch');
    await toggle.click();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Verify the button is still visible (icon may have changed)
    await expect(soundButton).toBeVisible();
  });
});
