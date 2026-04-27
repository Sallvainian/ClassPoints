/**
 * Seed a test user into the LOCAL Supabase stack for E2E tests.
 *
 * Reads credentials from .env.test. Requires VITE_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, VITE_TEST_EMAIL, and VITE_TEST_PASSWORD.
 * Safe to run repeatedly — exits 0 if the user already exists.
 *
 * Note: as of the on-demand Supabase lifecycle, `npm run test:e2e` seeds
 * automatically via Playwright globalSetup. This script remains useful as
 * a manual dev utility (e.g., reset password, verify auth wiring).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedTestUser } from './lib/seed-test-user.mjs';

const envPath = join(process.cwd(), '.env.test');
let raw: string;
try {
  raw = readFileSync(envPath, 'utf8');
} catch {
  console.error(`[seed-test-user] ${envPath} not found. Copy .env.test.example first.`);
  process.exit(1);
}

const env: Record<string, string> = {};
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const config = {
  url: env.VITE_SUPABASE_URL,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  email: env.VITE_TEST_EMAIL,
  password: env.VITE_TEST_PASSWORD,
};

for (const [name, value] of Object.entries({
  VITE_SUPABASE_URL: config.url,
  SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
  VITE_TEST_EMAIL: config.email,
  VITE_TEST_PASSWORD: config.password,
})) {
  if (!value || value.startsWith('REPLACE_')) {
    console.error(`[seed-test-user] ${name} is missing or still a placeholder in .env.test`);
    process.exit(1);
  }
}

try {
  await seedTestUser(config);
  console.log(`[seed-test-user] Test user ${config.email} ready.`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[seed-test-user] ${msg}`);
  process.exit(1);
}
