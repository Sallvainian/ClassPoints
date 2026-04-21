/**
 * Seed a test user into the LOCAL Supabase stack for E2E tests.
 *
 * Reads credentials from .env.test. Requires VITE_SUPABASE_URL (points at
 * http://127.0.0.1:54321), SUPABASE_SERVICE_ROLE_KEY, VITE_TEST_EMAIL, and
 * VITE_TEST_PASSWORD. Creates the user with email_confirm=true so the auth
 * flow doesn't require an email confirmation step.
 *
 * Safe to run repeatedly — if the user already exists, logs and exits 0.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Minimal .env.test loader so this script has zero extra deps.
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

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = env.VITE_TEST_EMAIL;
const TEST_PASSWORD = env.VITE_TEST_PASSWORD;

for (const [name, value] of Object.entries({
  VITE_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  VITE_TEST_EMAIL: TEST_EMAIL,
  VITE_TEST_PASSWORD: TEST_PASSWORD,
})) {
  if (!value || value.startsWith('REPLACE_')) {
    console.error(`[seed-test-user] ${name} is missing or still a placeholder in .env.test`);
    process.exit(1);
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,
});

if (error) {
  // "User already registered" is safe — previous run already created the user.
  if (/already (registered|exists)/i.test(error.message)) {
    console.log(`[seed-test-user] Test user ${TEST_EMAIL} already exists. OK.`);
    process.exit(0);
  }
  console.error(`[seed-test-user] Failed to create test user: ${error.message}`);
  process.exit(1);
}

console.log(`[seed-test-user] Created test user ${TEST_EMAIL} (id=${data.user.id})`);
