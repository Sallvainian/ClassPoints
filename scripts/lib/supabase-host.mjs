import { networkInterfaces } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

export function readEnvTest(cwd = process.cwd()) {
  try {
    return dotenv.parse(readFileSync(join(cwd, '.env.test'), 'utf8'));
  } catch {
    return {};
  }
}

function collectLocalIps() {
  const set = new Set(['localhost', '127.0.0.1', '::1']);
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) set.add(i.address);
  }
  try {
    const out = execFileSync('tailscale', ['ip'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((ip) => set.add(ip));
  } catch {
    // tailscale CLI not installed or not running — networkInterfaces already covers it
  }
  return set;
}

export function shouldManageLocalStack(supabaseUrl) {
  if (!supabaseUrl) return false;
  let host;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    return false;
  }
  return collectLocalIps().has(host);
}

/**
 * Probe whether the local Supabase stack is actually serving traffic at `url`.
 *
 * Why not `npx supabase status`? It exits 0 even when containers are missing
 * (it logs `failed to inspect container health: No such container ...` to
 * stderr and returns success anyway). That false positive made dev.mjs decide
 * the stack was already up after a previous run had torn it down — leaving
 * `weStartedIt=false`, so the script never restarted the stack and never
 * cleaned it up on exit. A plain HTTP probe tests exactly what the app does:
 * "can I reach the URL?" — and is correct under every container state.
 */
export function isStackRunning(url) {
  if (!url) return false;
  try {
    execFileSync(
      'curl',
      ['-s', '-o', '/dev/null', '-m', '2', `${url.replace(/\/$/, '')}/auth/v1/health`],
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    return true; // any HTTP response (200/4xx/5xx) means the gateway is up
  } catch {
    return false; // connection refused, DNS failure, timeout
  }
}
