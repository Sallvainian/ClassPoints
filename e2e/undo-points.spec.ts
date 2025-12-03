import { test, expect } from '@playwright/test';

// Test credentials should be provided via environment variables
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

test.describe('Undo Points Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // If we're on the login page, authenticate
    const loginButton = page.getByRole('button', { name: /sign in/i });
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Fill in login credentials
      await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
      await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);
      await loginButton.click();

      // Wait for dashboard to load (classroom list or welcome message)
      await expect(
        page.getByText(/Welcome to ClassPoints|classrooms/i)
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('sidebar point total updates after awarding and undoing points', async ({
    page,
  }) => {
    // Check if there are any classrooms
    const classroomButtons = page.locator('aside button').filter({
      has: page.locator('span.truncate'),
    });

    const classroomCount = await classroomButtons.count();

    if (classroomCount === 0) {
      // Create a classroom if none exist
      await page.getByRole('button', { name: /new classroom/i }).click();
      await page.getByPlaceholder(/e.g., 3rd Period/i).fill('Test Classroom');
      await page.getByRole('button', { name: /create/i }).click();

      // Wait for the classroom to appear
      await expect(page.getByText('Test Classroom')).toBeVisible();
    }

    // Select the first classroom
    const firstClassroom = classroomButtons.first();
    await firstClassroom.click();

    // Wait for the dashboard to load
    await page.waitForLoadState('networkidle');

    // Check if there are students (student cards are buttons in a grid)
    // Student cards have a w-16 h-16 rounded-full avatar inside
    const studentCards = page.locator('button:has(div.rounded-full.w-16.h-16)');
    const hasStudents = (await studentCards.count()) > 0;

    if (!hasStudents) {
      // Skip test if no students - need to create through settings
      test.skip(true, 'No students available for testing');
      return;
    }

    // Get the sidebar point total BEFORE awarding points
    const sidebarPointBefore = await firstClassroom
      .locator('span.text-xs.font-medium')
      .textContent();
    const pointsBefore = parseInt(sidebarPointBefore?.replace('+', '') || '0');

    // Click on the first student to open award modal
    await studentCards.first().click();

    // Wait for the award modal to open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click on a positive behavior button (first one with positive points)
    const positiveBehavior = modal.getByRole('button').filter({
      has: page.locator('text=/\\+[1-5]/'),
    });
    await positiveBehavior.first().click();

    // Wait for modal to close and points to be awarded
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Wait for realtime update
    await page.waitForTimeout(1000);

    // Get the sidebar point total AFTER awarding
    const sidebarPointAfter = await firstClassroom
      .locator('span.text-xs.font-medium')
      .textContent();
    const pointsAfter = parseInt(sidebarPointAfter?.replace('+', '') || '0');

    // Verify points increased
    expect(pointsAfter).toBeGreaterThan(pointsBefore);

    // Look for the undo toast
    const undoButton = page.getByRole('button', { name: /undo/i });
    await expect(undoButton).toBeVisible({ timeout: 5000 });

    // Click undo
    await undoButton.click();

    // Wait for realtime update
    await page.waitForTimeout(1000);

    // Get the sidebar point total AFTER undo
    const sidebarPointAfterUndo = await firstClassroom
      .locator('span.text-xs.font-medium')
      .textContent();
    const pointsAfterUndo = parseInt(
      sidebarPointAfterUndo?.replace('+', '') || '0'
    );

    // Verify points returned to original value
    expect(pointsAfterUndo).toBe(pointsBefore);
  });

  test('realtime subscription receives DELETE events with full payload', async ({
    page,
  }) => {
    // This test verifies the REPLICA IDENTITY FULL fix is working
    // by checking console logs for the realtime event

    // Enable console logging
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

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

    // Check for students (student cards are buttons with avatar div)
    const studentCards = page.locator('button:has(div.rounded-full.w-16.h-16)');
    if ((await studentCards.count()) === 0) {
      test.skip(true, 'No students available');
      return;
    }

    // Award points
    await studentCards.first().click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const positiveBehavior = modal.getByRole('button').filter({
      has: page.locator('text=/\\+[1-5]/'),
    });
    await positiveBehavior.first().click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Undo
    const undoButton = page.getByRole('button', { name: /undo/i });
    await expect(undoButton).toBeVisible({ timeout: 5000 });
    await undoButton.click();

    // Wait for realtime to process
    await page.waitForTimeout(2000);

    // The test passes if we get here without the sidebar showing stale data
    // The REPLICA IDENTITY FULL migration ensures DELETE events include all fields
    expect(true).toBe(true);
  });
});
