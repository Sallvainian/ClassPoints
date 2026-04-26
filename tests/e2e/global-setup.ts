import { execFileSync } from 'node:child_process';
import { isStackRunning, shouldManageLocalStack } from '../../scripts/lib/supabase-host.mjs';

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL ?? '';
  if (!shouldManageLocalStack(url)) return;
  if (isStackRunning()) {
    process.env.__CLASSPOINTS_MANAGED_SUPABASE = '0';
    return;
  }
  console.log(`[playwright] Starting local Supabase (${url})`);
  execFileSync('npx', ['supabase', 'start'], { stdio: 'inherit' });
  process.env.__CLASSPOINTS_MANAGED_SUPABASE = '1';
}
