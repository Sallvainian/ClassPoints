import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { SupportedStorage } from '@supabase/supabase-js';

// Auth session storage helpers, shared by the supabase client (adapter) and
// AuthContext (purge/probe). Deliberately does NOT import ../lib/supabase:
// supabase.ts imports this module, so the reverse edge would be a cycle.
//
// On native (Capacitor iOS/Android) the session must live in Preferences —
// WKWebView localStorage is evictable under storage pressure, which would
// silently log the teacher out. On web nothing changes: the adapter below is
// only handed to createClient when Capacitor.isNativePlatform(), and the
// purge/probe helpers touch Preferences only on native (test-asserted).
//
// GoTrue's default storageKey (`sb-<project-ref>-auth-token`) is preserved —
// supabase.ts overrides only `auth.storage` — so the `sb-` prefix and
// `-auth-token` suffix conventions here match both stores. There is no
// localStorage→Preferences migration: a native install is a fresh origin.

/**
 * GoTrue storage adapter over Capacitor Preferences (native only — supabase.ts
 * gates it). Errors propagate: GoTrue handles storage failures itself, and
 * swallowing them here would turn a failed session write into silent data loss.
 */
export const capacitorPreferencesStorage: SupportedStorage = {
  getItem: async (key: string): Promise<string | null> => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};

const isAuthTokenKey = (k: string) => k.startsWith('sb-') && k.endsWith('-auth-token');

/**
 * All `sb-`-prefixed localStorage keys. Standard Storage iteration
 * (length/key) rather than Object.keys: identical in browsers, and it also
 * works on Storage implementations that don't expose items as enumerable own
 * properties (jsdom shims). Returns [] when localStorage is unavailable
 * (private browsing edge case).
 */
function localStorageSbKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith('sb-')) keys.push(k);
    }
  } catch {
    // localStorage unavailable — nothing to report
  }
  return keys;
}

/** All `sb-`-prefixed Preferences keys. Call only on native. */
async function preferencesSbKeys(): Promise<string[]> {
  try {
    const { keys } = await Preferences.keys();
    return keys.filter((k) => k.startsWith('sb-'));
  } catch {
    // Preferences unavailable — treat as empty rather than failing the sweep
    return [];
  }
}

/**
 * Manually purge any cached Supabase auth keys. Last-resort fallback when
 * supabase.auth.signOut itself fails (which can happen if the auth endpoint
 * is unreachable). Without this, a stale JWT stays in storage and the
 * GoTrueClient's auto-refresh loops forever.
 *
 * localStorage is swept on every platform — on native that is defense-in-depth
 * against stray keys from a build that ran without the Preferences adapter,
 * not a mirror (the adapter never writes localStorage).
 */
export async function purgeAuthStorage(): Promise<void> {
  for (const k of localStorageSbKeys()) {
    try {
      localStorage.removeItem(k);
    } catch {
      // localStorage unavailable — nothing to purge
    }
  }
  if (Capacitor.isNativePlatform()) {
    for (const k of await preferencesSbKeys()) {
      try {
        await Preferences.remove({ key: k });
      } catch {
        // keep sweeping the remaining keys
      }
    }
  }
}

/** Direct storage probe: does a Supabase session blob exist at all? */
export async function storageHasAuthToken(): Promise<boolean> {
  if (localStorageSbKeys().some(isAuthTokenKey)) return true;
  if (Capacitor.isNativePlatform()) {
    return (await preferencesSbKeys()).some(isAuthTokenKey);
  }
  return false;
}
