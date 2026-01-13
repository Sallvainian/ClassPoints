import { test, expect } from '@playwright/test';

test.describe('Classroom Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for dashboard to load (sidebar visible)
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test('should display New Classroom button', async ({ page }) => {
    await expect(page.getByText('New Classroom')).toBeVisible({ timeout: 10000 });
  });

  test('should create a new classroom', async ({ page }) => {
    // Generate unique classroom name
    const classroomName = `Test Classroom ${Date.now()}`;

    // Click new classroom button
    await page.getByText('New Classroom').click();

    // Wait for modal to appear
    await expect(page.getByRole('heading', { name: 'Create New Classroom' })).toBeVisible({
      timeout: 10000,
    });

    // Fill in classroom name
    await page.getByLabel('Classroom Name').fill(classroomName);

    // Submit form - use exact match and within modal context
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Modal should close and classroom should appear in sidebar
    await expect(page.getByRole('heading', { name: 'Create New Classroom' })).not.toBeVisible({
      timeout: 10000,
    });
    // Use sidebar selector to be specific
    await expect(page.locator('aside').getByText(classroomName)).toBeVisible({ timeout: 10000 });
  });

  test('should switch between classrooms', async ({ page }) => {
    // First, create two classrooms
    const classroom1 = `Class A ${Date.now()}`;
    const classroom2 = `Class B ${Date.now()}`;

    // Create first classroom
    await page.getByText('New Classroom').click();
    await expect(page.getByLabel('Classroom Name')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Classroom Name').fill(classroom1);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('aside').getByText(classroom1)).toBeVisible({ timeout: 10000 });

    // Create second classroom
    await page.getByText('New Classroom').click();
    await expect(page.getByLabel('Classroom Name')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Classroom Name').fill(classroom2);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('aside').getByText(classroom2)).toBeVisible({ timeout: 10000 });

    // Click on first classroom to switch (in sidebar)
    await page.locator('aside').getByText(classroom1).click();

    // First classroom should be active (verify it's in sidebar)
    const classroom1Button = page.locator('aside button').filter({ hasText: classroom1 });
    await expect(classroom1Button).toBeVisible();
  });

  test('should show sidebar with classrooms section', async ({ page }) => {
    // This test checks the UI has the sidebar visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Should either have classrooms list or empty message
    // Just verify the sidebar structure is there
    await expect(page.getByText('New Classroom')).toBeVisible();
  });
});
