import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(process.cwd(), '.auth', 'user.json');
const AUTH_DIR = path.dirname(AUTH_FILE);

setup('authenticate', async ({ page }) => {
  const email = process.env.VITE_TEST_EMAIL;
  const password = process.env.VITE_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('VITE_TEST_EMAIL and VITE_TEST_PASSWORD must be set');
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Post-auth markers — sidebar rendered = auth tokens are already in
  // cookies/localStorage. We don't wait for the main dashboard pane to load
  // (it lazy-imports TeacherDashboard and stays on "Loading your dashboard..."
  // for empty-state users until the first query resolves — irrelevant for
  // storageState capture).
  await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('aside').getByText('Classrooms', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});
