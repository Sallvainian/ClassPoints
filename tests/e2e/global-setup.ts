import { execFileSync } from 'node:child_process';
import { isStackRunning, shouldManageLocalStack } from '../../scripts/lib/supabase-host.mjs';
import { seedTestUser } from '../../scripts/lib/seed-test-user.mjs';

const MANAGED = '__CLASSPOINTS_MANAGED_SUPABASE';

const safeStop = () => {
  try {
    execFileSync('npx', ['supabase', 'stop'], { stdio: 'inherit' });
  } catch {
    // Best-effort — surface the original failure, not the cleanup failure.
  }
};

const buildSeedConfig = () => {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.VITE_TEST_EMAIL;
  const password = process.env.VITE_TEST_PASSWORD;
  const missing = Object.entries({
    VITE_SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    VITE_TEST_EMAIL: email,
    VITE_TEST_PASSWORD: password,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`[playwright] Missing required env vars in .env.test: ${missing.join(', ')}`);
  }
  return { url: url!, serviceRoleKey: serviceRoleKey!, email: email!, password: password! };
};

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL ?? '';
  if (!shouldManageLocalStack(url)) return;

  let weStartedIt = false;
  if (!isStackRunning(url)) {
    console.log(`[playwright] Starting local Supabase (${url})`);
    try {
      execFileSync('npx', ['supabase', 'start'], { stdio: 'inherit' });
      process.env[MANAGED] = '1';
      weStartedIt = true;
    } catch (err) {
      safeStop();
      throw err;
    }
  }

  console.log('[playwright] Seeding test user');
  try {
    await seedTestUser(buildSeedConfig());
  } catch (err) {
    if (weStartedIt) safeStop();
    throw err;
  }
}
