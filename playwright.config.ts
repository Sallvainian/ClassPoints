import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// E2E force-overrides shell env. Unlike app runtime, tests must be
// reproducible from .env.test alone — a leaked fnox session in the
// shell (prod URL/creds) would silently hit real Supabase with real
// credentials. .env.test wins, always.
// NOTE: Vite's `loadEnv(..., '')` merges process.env in and lets shell
// vars shadow the dotenv file, which defeats the override. Parse the
// file directly instead.
const parseDotEnv = (path: string): Record<string, string> => {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
};
const testEnv = parseDotEnv(join(process.cwd(), '.env.test'));
for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] = value;
}

// Safety check: allow-list the networks a non-production Supabase stack could
// live on — loopback, RFC1918 LAN, and Tailscale CGNAT — and refuse everything
// else. Fail-closed: if we can't prove the host is private, we don't run.
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
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Never reuse an existing dev server for E2E — a manually-started server may be
    // pointed at production Supabase. Force a fresh spawn with the .env.test values.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: testEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: testEnv.VITE_SUPABASE_ANON_KEY,
    },
  },
});
