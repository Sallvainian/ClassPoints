import { defineConfig } from 'vitest/config';
import { readEnvTest } from './scripts/lib/supabase-host.mjs';

// Force-override shell env from .env.test — same pattern as playwright.config.ts.
// Integration tests hit a real (local) Supabase stack via the service-role
// admin client; a leaked fnox session in the shell could otherwise point them
// at production. .env.test wins, always.
const testEnv = readEnvTest();
for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] = value;
}

// Allow-list guard — same logic as `playwright.config.ts`. Integration tests
// must hit loopback / RFC1918 / Tailscale CGNAT Supabase only. Substring
// matching is unsafe (`https://127.0.0.1.evil.com` would otherwise pass);
// always parse via `new URL(...).hostname`.
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
  /^172\.(1[6-9]|2\d|3[01])\./.test(supabaseHost) ||
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(supabaseHost);
if (!isPrivateHost) {
  throw new Error(
    `Integration tests refuse to run against ${supabaseHost || '(unparseable URL)'} — only loopback, RFC1918, and Tailscale CGNAT are allowed. ` +
      `Start a local stack with \`npx supabase start\` or point VITE_SUPABASE_URL at a private network host.`
  );
}

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: true,
    // Network round trips against local Supabase are slower than unit tests;
    // schema-touching setup hooks (migrations) can take longer still.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
