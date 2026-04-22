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

  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible({ timeout: 30000 });

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.locator('aside').getByRole('heading', { name: /ClassPoints/ })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText('New Classroom')).toBeVisible({ timeout: 15000 });

  await page.waitForTimeout(1000);

  await page.context().storageState({ path: AUTH_FILE });
});
