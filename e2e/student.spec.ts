import { test, expect } from '@playwright/test';

test.describe('Student Management', () => {
  // Helper to create a classroom and navigate to settings
  async function setupClassroomAndOpenSettings(page: import('@playwright/test').Page) {
    await page.goto('/');
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 15000,
    });

    // Create a new classroom for this test
    const classroomName = `Student Test ${Date.now()}`;
    await page.getByText('New Classroom').click();
    await expect(page.getByLabel('Classroom Name')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Classroom Name').fill(classroomName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Wait for classroom to be created (in sidebar)
    await expect(page.locator('aside').getByText(classroomName)).toBeVisible({ timeout: 10000 });

    // Click on the classroom to make sure it's active (in sidebar)
    await page.locator('aside').getByText(classroomName).click();

    // Open settings - use the button with gear emoji
    await page.getByRole('button', { name: /Settings/ }).click();
    await expect(page.getByRole('heading', { name: 'Classroom Settings' })).toBeVisible({
      timeout: 10000,
    });

    return classroomName;
  }

  test('should add a student', async ({ page }) => {
    await setupClassroomAndOpenSettings(page);

    // Add a student
    const studentName = `Student ${Date.now()}`;
    await page.getByPlaceholder('Add new student...').fill(studentName);
    await page.getByRole('button', { name: 'Add' }).click();

    // Student should appear in the list
    await expect(page.getByText(studentName)).toBeVisible({ timeout: 10000 });
  });

  test('should display student in grid after adding', async ({ page }) => {
    await setupClassroomAndOpenSettings(page);

    // Add a student
    const studentName = `Grid Student ${Date.now()}`;
    await page.getByPlaceholder('Add new student...').fill(studentName);
    await page.getByRole('button', { name: 'Add' }).click();

    // Wait for student to appear in settings
    await expect(page.getByText(studentName)).toBeVisible({ timeout: 10000 });

    // Go back to dashboard
    await page.getByRole('button', { name: 'Done' }).click();

    // Student should appear in the main grid
    await expect(page.getByText(studentName)).toBeVisible({ timeout: 10000 });
  });

  test('should edit student name', async ({ page }) => {
    await setupClassroomAndOpenSettings(page);

    // Add a student first
    const originalName = `Original ${Date.now()}`;
    await page.getByPlaceholder('Add new student...').fill(originalName);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 });

    // Find the student row and click edit button
    const studentRow = page.locator('li').filter({ hasText: originalName });
    await studentRow.getByRole('button', { name: /edit/i }).click();

    // Wait for the edit input to appear (inside the student list)
    const editInput = page.locator('ul input');
    await expect(editInput).toBeVisible({ timeout: 10000 });

    // Clear and fill the new name
    const newName = `Edited ${Date.now()}`;
    await editInput.fill(newName);

    // Save the edit - find the Save button inside the student list row
    await page.locator('ul').getByRole('button', { name: 'Save' }).click();

    // New name should be visible
    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });
  });

  test('should remove student', async ({ page }) => {
    await setupClassroomAndOpenSettings(page);

    // Add a student first
    const studentName = `ToRemove ${Date.now()}`;
    await page.getByPlaceholder('Add new student...').fill(studentName);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(studentName)).toBeVisible({ timeout: 10000 });

    // Find the student row and click remove button
    const studentRow = page.locator('li').filter({ hasText: studentName });
    await studentRow.getByRole('button', { name: /remove|delete/i }).click();

    // Student should no longer be visible
    await expect(page.getByText(studentName)).not.toBeVisible({ timeout: 10000 });
  });
});
