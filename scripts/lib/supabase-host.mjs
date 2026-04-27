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

export function isStackRunning() {
  try {
    execFileSync('npx', ['supabase', 'status'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}
