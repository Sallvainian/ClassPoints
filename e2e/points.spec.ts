import { test, expect } from '@playwright/test';

test.describe('Point Awards', () => {
  // Helper to create a classroom with a student
  async function setupClassroomWithStudent(page: import('@playwright/test').Page) {
    await page.goto('/');
    await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
      timeout: 15000,
    });

    // Create a new classroom
    const classroomName = `Points Test ${Date.now()}`;
    await page.getByText('New Classroom').click();
    await expect(page.getByLabel('Classroom Name')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Classroom Name').fill(classroomName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('aside').getByText(classroomName)).toBeVisible({ timeout: 10000 });

    // Click on the classroom to make sure it's active (in sidebar)
    await page.locator('aside').getByText(classroomName).click();

    // Open settings to add a student - use button role
    await page.getByRole('button', { name: /Settings/ }).click();
    await expect(page.getByRole('heading', { name: 'Classroom Settings' })).toBeVisible({
      timeout: 10000,
    });

    // Add a student
    const studentName = `Test Student ${Date.now()}`;
    await page.getByPlaceholder('Add new student...').fill(studentName);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(studentName).first()).toBeVisible({ timeout: 10000 });

    // Return to dashboard
    await page.getByRole('button', { name: 'Done' }).click();

    // Wait for student to appear in the main content area (not sidebar)
    await expect(page.locator('main').getByText(studentName)).toBeVisible({ timeout: 10000 });

    return { classroomName, studentName };
  }

  test('should open award modal when clicking student', async ({ page }) => {
    const { studentName } = await setupClassroomWithStudent(page);

    // Click on the student card
    await page.getByRole('button', { name: new RegExp(studentName) }).click();

    // Award modal should open with student name
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('[role="dialog"]').getByText(studentName)).toBeVisible();

    // Should show behavior options
    await expect(page.getByText('Select a behavior to award points')).toBeVisible();
  });

  test('should award positive points', async ({ page }) => {
    const { studentName } = await setupClassroomWithStudent(page);

    // Click on the student card
    await page.getByRole('button', { name: new RegExp(studentName) }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click on a positive behavior (On Task - +1 point)
    await page.getByRole('button', { name: /On Task/i }).click();

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Student's points should be updated (should show +1)
    const studentCard = page.getByRole('button', { name: new RegExp(studentName) });
    await expect(studentCard).toContainText(/\+1/);
  });

  test('should award negative points', async ({ page }) => {
    const { studentName } = await setupClassroomWithStudent(page);

    // Click on the student card
    await page.getByRole('button', { name: new RegExp(studentName) }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click on a negative behavior (Off Task - -1 point)
    await page.getByRole('button', { name: /Off Task/i }).click();

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Student's points should be updated (should show -1)
    const studentCard = page.getByRole('button', { name: new RegExp(studentName) });
    await expect(studentCard).toContainText(/-1/);
  });

  test('should display updated point total after multiple awards', async ({ page }) => {
    const { studentName } = await setupClassroomWithStudent(page);

    // Award positive points twice
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: new RegExp(studentName) }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: /On Task/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    }

    // Student should have +2 points total
    const studentCard = page.getByRole('button', { name: new RegExp(studentName) });
    await expect(studentCard).toContainText(/\+2/);
  });
});
