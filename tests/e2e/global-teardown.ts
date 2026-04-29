import { execFileSync } from 'node:child_process';

export default async function globalTeardown() {
  if (process.env.__CLASSPOINTS_MANAGED_SUPABASE !== '1') return;
  console.log('[playwright] Stopping local Supabase');
  try {
    execFileSync('supabase', ['stop'], { stdio: 'inherit' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[playwright] supabase stop failed:', msg);
  }
}
