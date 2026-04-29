import { networkInterfaces, platform as osPlatform } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
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
 * Returns true if `docker info` succeeds — i.e. the daemon is reachable.
 *
 * `supabase start` requires a running Docker daemon. On macOS that means
 * OrbStack / Docker Desktop / Colima must be up. When the daemon dies,
 * `supabase start` fails with a "cannot connect to docker socket" error
 * that's easy to mistake for a Supabase bug. This check lets the dev
 * script bring Docker up first and surface clear errors when it can't.
 */
export function isDockerRunning() {
  try {
    execFileSync('docker', ['info'], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the Docker daemon is up; start it if not.
 *
 * Detection order on macOS: OrbStack (preferred — fastest cold-start) →
 * Docker Desktop → Colima. We never STOP Docker — it's a shared resource
 * other tools may depend on. We only START it if it's not already running.
 *
 * On Linux, dockerd is typically managed by systemd; we don't try to start
 * it ourselves, just print a hint.
 *
 * Returns true if the daemon is reachable after the attempt (polled up to
 * ~30s for cold-start), false otherwise.
 */
export function ensureDockerRunning() {
  if (isDockerRunning()) return true;

  if (osPlatform() === 'darwin') {
    if (existsSync('/Applications/OrbStack.app')) {
      console.log('[dev] Docker daemon down — starting OrbStack');
      try {
        execFileSync('orbctl', ['start'], { stdio: 'inherit', timeout: 30000 });
      } catch {
        // orbctl may have failed; fall back to GUI launch
        try {
          execFileSync('open', ['-a', 'OrbStack'], { stdio: 'ignore' });
        } catch {
          // give up — final isDockerRunning poll below will report failure
        }
      }
    } else if (existsSync('/Applications/Docker.app')) {
      console.log('[dev] Docker daemon down — starting Docker Desktop');
      try {
        execFileSync('open', ['-a', 'Docker'], { stdio: 'ignore' });
      } catch {
        // ignore — final poll will catch it
      }
    } else {
      // Colima — last resort
      try {
        execFileSync('colima', ['start'], { stdio: 'inherit', timeout: 30000 });
      } catch {
        return false; // no recognized Docker provider installed
      }
    }
  } else if (osPlatform() === 'linux') {
    console.error(
      '[dev] Docker daemon not reachable. Try: `sudo systemctl start docker` (or your distro equivalent).'
    );
    return false;
  } else {
    return false; // unsupported platform
  }

  // Poll for the daemon to come up — `docker info` fails fast against a
  // missing socket, so we sleep between attempts via execFileSync('sleep').
  const deadlineMs = Date.now() + 30000;
  while (Date.now() < deadlineMs) {
    if (isDockerRunning()) return true;
    try {
      execFileSync('sleep', ['0.5'], { stdio: 'ignore' });
    } catch {
      // shell sleep missing — fall through and retry immediately
    }
  }
  return false;
}

/**
 * Run `supabase start`, recovering once from the stale-state condition where
 * the CLI's internal "is started" state disagrees with the actual container
 * state — usually because the DB container was killed by Docker/OrbStack
 * restart or OS sleep. Symptom: `supabase start` exits non-zero with
 * "supabase start is already running." plus "supabase_db_<project> container
 * is not running: exited". `supabase stop` clears the state and a retry
 * succeeds. Without recovery the dev script fails on every wake-from-sleep.
 */
export function startSupabaseWithRecovery(label = '[supabase]') {
  try {
    execFileSync('supabase', ['start'], { stdio: 'inherit' });
    return;
  } catch {
    console.warn(`${label} supabase start failed — clearing stale state and retrying once`);
  }
  try {
    execFileSync('supabase', ['stop'], { stdio: 'inherit' });
  } catch {
    // Best-effort: even if stop reports an error, the retry below is the real signal.
  }
  execFileSync('supabase', ['start'], { stdio: 'inherit' });
}

/**
 * Probe whether the local Supabase stack is actually serving traffic at `url`.
 *
 * Why not `supabase status`? It exits 0 even when containers are missing
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
