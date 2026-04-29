import { defineConfig, devices } from '@playwright/test';
import { readEnvTest } from './scripts/lib/supabase-host.mjs';

// E2E force-overrides shell env. Tests must be reproducible from .env.test
// alone — a leaked fnox session in the shell (prod URL/creds) would silently
// hit real Supabase with real credentials. Vite's loadEnv merges process.env
// in and lets shell vars shadow the dotenv file, so we parse .env.test
// directly via dotenv (handles quoted values, escapes, comments).
const testEnv = readEnvTest();
for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] = value;
}

// Allow-list of networks where a non-production Supabase stack could live —
// loopback, RFC1918, Tailscale CGNAT. Fail-closed against everything else.
// Parses hostname so `https://127.0.0.1.evil.com` can't slip through a
// substring match.
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return '';
  }
})();
const isPrivateHost =
  supabaseHost === 'localhost' ||
  supabaseHost === '127.0.0.1' ||
  /^10\./.test(supabaseHost) ||
  /^192\.168\./.test(supabaseHost) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(supabaseHost) || // RFC1918 172.16.0.0/12
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(supabaseHost); // Tailscale CGNAT 100.64.0.0/10
if (!isPrivateHost) {
  throw new Error(
    `E2E refuses to run against ${supabaseHost || '(unparseable URL)'} — only loopback, RFC1918, and Tailscale CGNAT are allowed. ` +
      `Start a local stack with \`npx supabase start\` or point VITE_SUPABASE_URL at a private network host.`
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
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
    // Raw vite — globalSetup owns Supabase lifecycle. `npm run dev` would race
    // with globalSetup over stack management.
    command: 'npx vite --mode test',
    url: 'http://localhost:5173',
    // Never reuse: a manually-started dev server may be pointed at production
    // Supabase. Force a fresh spawn with the .env.test values.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: testEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: testEnv.VITE_SUPABASE_ANON_KEY,
    },
  },
});
