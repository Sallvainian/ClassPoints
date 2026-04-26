#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { isStackRunning, readEnvTest, shouldManageLocalStack } from './lib/supabase-host.mjs';

const env = readEnvTest();
const url = env.VITE_SUPABASE_URL ?? '';
const manageRequested = shouldManageLocalStack(url);

let weStartedIt = false;
let child;
let cleaned = false;

const errMessage = (err) => (err instanceof Error ? err.message : String(err));

const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  if (weStartedIt) {
    console.log('\n[dev] Stopping local Supabase');
    try {
      execFileSync('npx', ['supabase', 'stop'], { stdio: 'inherit' });
    } catch (err) {
      console.error('[dev] supabase stop failed:', errMessage(err));
    }
  }
};

// Install lifecycle handlers BEFORE the blocking `supabase start`. If the user
// kills us during startup (or we throw mid-start), 'exit' still runs cleanup.
process.on('exit', cleanup);

const handleSignal = (sig) => () => {
  if (child && !child.killed) {
    child.kill(sig);
    return;
  }
  // No vite child yet — we're either in the supabase-start window or before it.
  // Run cleanup and exit ourselves.
  cleanup();
  const code = sig === 'SIGINT' ? 130 : sig === 'SIGTERM' ? 143 : sig === 'SIGHUP' ? 129 : 1;
  process.exit(code);
};
process.on('SIGINT', handleSignal('SIGINT'));
process.on('SIGTERM', handleSignal('SIGTERM'));
process.on('SIGHUP', handleSignal('SIGHUP'));

if (manageRequested) {
  if (isStackRunning()) {
    console.log(`[dev] Local Supabase already running at ${url} — leaving as-is`);
  } else {
    console.log(`[dev] Starting local Supabase (${url})`);
    // Set BEFORE start so partial-failure cleanup will still attempt `supabase stop`.
    weStartedIt = true;
    try {
      execFileSync('npx', ['supabase', 'start'], { stdio: 'inherit' });
    } catch (err) {
      console.error('[dev] supabase start failed:', errMessage(err));
      cleanup();
      process.exit(1);
    }
  }
} else {
  console.log(
    `[dev] VITE_SUPABASE_URL=${url || '(unset)'} — not a local host, skipping stack management`
  );
}

const passthrough = process.argv.slice(2);
child = spawn('npx', ['vite', '--mode', 'test', ...passthrough], {
  stdio: 'inherit',
});

child.on('error', (err) => {
  console.error('[dev] failed to spawn vite:', errMessage(err));
  cleanup();
  process.exit(1);
});

child.on('exit', (code, signal) => {
  cleanup();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
