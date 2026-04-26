#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { isStackRunning, readEnvTest, shouldManageLocalStack } from './lib/supabase-host.mjs';

const env = readEnvTest();
const url = env.VITE_SUPABASE_URL ?? '';
const manageRequested = shouldManageLocalStack(url);
let weStartedIt = false;

if (manageRequested) {
  if (isStackRunning()) {
    console.log(`[dev] Local Supabase already running at ${url} — leaving as-is`);
  } else {
    console.log(`[dev] Starting local Supabase (${url})`);
    execFileSync('npx', ['supabase', 'start'], { stdio: 'inherit' });
    weStartedIt = true;
  }
} else {
  console.log(
    `[dev] VITE_SUPABASE_URL=${url || '(unset)'} — not a local host, skipping stack management`
  );
}

const passthrough = process.argv.slice(2);
const child = spawn('npx', ['vite', '--mode', 'test', ...passthrough], {
  stdio: 'inherit',
});

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  if (weStartedIt) {
    console.log('\n[dev] Stopping local Supabase');
    try {
      execFileSync('npx', ['supabase', 'stop'], { stdio: 'inherit' });
    } catch (err) {
      console.error('[dev] supabase stop failed:', err.message);
    }
  }
};

const forwardSignal = (sig) => () => {
  if (!child.killed) child.kill(sig);
};
process.on('SIGINT', forwardSignal('SIGINT'));
process.on('SIGTERM', forwardSignal('SIGTERM'));
process.on('SIGHUP', forwardSignal('SIGHUP'));

child.on('exit', (code, signal) => {
  cleanup();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
