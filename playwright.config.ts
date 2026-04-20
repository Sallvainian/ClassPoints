import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// E2E tests MUST hit a local Supabase stack, never production. Load .env.test
// here so VITE_TEST_EMAIL/PASSWORD are on process.env for auth.setup.ts and
// the dev server spawned by webServer inherits the local VITE_SUPABASE_URL/KEY.
const testEnv = loadEnv('test', process.cwd(), '');
for (const [key, value] of Object.entries(testEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// Safety check: refuse to run against a hosted Supabase URL. The E2E suite
// creates and deletes real rows; pointing at prod by mistake polluted the
// live DB once already.
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
  throw new Error(
    `E2E refuses to run against non-local Supabase (got ${supabaseUrl}). ` +
      `Start the local stack with \`npx supabase start\`, then copy .env.test.example to .env.test.`
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main tests - depend on setup and use stored auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Never reuse an existing dev server for E2E — a manually-started server may be
    // pointed at production Supabase. Force a fresh spawn with the .env.test values.
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_SUPABASE_URL: testEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: testEnv.VITE_SUPABASE_ANON_KEY,
    },
  },
});
