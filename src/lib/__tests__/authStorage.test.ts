/**
 * authStorage — the Capacitor Preferences session-storage adapter plus the
 * relocated purge/probe helpers (formerly closures in AuthContext).
 *
 * No env stub needed: authStorage.ts deliberately does not import
 * ../lib/supabase (supabase.ts imports IT — the reverse edge would be a
 * cycle), so nothing here evaluates the env-throwing module.
 *
 * Platform gating is the core contract under test: when
 * Capacitor.isNativePlatform() is false (web), the helpers must never touch
 * Preferences — the web behavior must stay byte-identical to the old
 * localStorage-only closures. localStorage itself comes from the in-memory
 * shim in src/test/setup.ts, cleared per-test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prefsStore = vi.hoisted(() => new Map<string, string>());
const isNative = vi.hoisted(() => ({ value: false }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNative.value },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefsStore.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      prefsStore.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      prefsStore.delete(key);
    }),
    keys: vi.fn(async () => ({ keys: [...prefsStore.keys()] })),
  },
}));

import { Preferences } from '@capacitor/preferences';
import { capacitorPreferencesStorage, purgeAuthStorage, storageHasAuthToken } from '../authStorage';

const mockedPreferences = vi.mocked(Preferences);

beforeEach(() => {
  prefsStore.clear();
  isNative.value = false;
  vi.clearAllMocks();
});

describe('capacitorPreferencesStorage adapter', () => {
  it('round-trips a value and returns null for a missing key', async () => {
    expect(await capacitorPreferencesStorage.getItem('sb-x-auth-token')).toBeNull();

    await capacitorPreferencesStorage.setItem('sb-x-auth-token', '{"access_token":"jwt"}');
    expect(await capacitorPreferencesStorage.getItem('sb-x-auth-token')).toBe(
      '{"access_token":"jwt"}'
    );

    await capacitorPreferencesStorage.removeItem('sb-x-auth-token');
    expect(await capacitorPreferencesStorage.getItem('sb-x-auth-token')).toBeNull();
  });

  it('propagates Preferences errors instead of swallowing them', async () => {
    // GoTrue handles storage failures itself; a swallowed setItem rejection
    // would turn a failed session write into silent data loss.
    mockedPreferences.set.mockRejectedValueOnce(new Error('disk full'));
    await expect(capacitorPreferencesStorage.setItem('sb-x-auth-token', 'v')).rejects.toThrow(
      'disk full'
    );

    mockedPreferences.get.mockRejectedValueOnce(new Error('io error'));
    await expect(capacitorPreferencesStorage.getItem('sb-x-auth-token')).rejects.toThrow(
      'io error'
    );
  });
});

describe('purgeAuthStorage', () => {
  it('on native sweeps only sb-* keys from BOTH stores', async () => {
    isNative.value = true;
    localStorage.setItem('sb-x-auth-token', 'session');
    localStorage.setItem('sb-x-other', 'meta');
    localStorage.setItem('keep-me', 'unrelated');
    prefsStore.set('sb-x-auth-token', 'session');
    prefsStore.set('sb-x-other', 'meta');
    prefsStore.set('keep-me', 'unrelated');

    await purgeAuthStorage();

    expect(localStorage.getItem('sb-x-auth-token')).toBeNull();
    expect(localStorage.getItem('sb-x-other')).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('unrelated');
    expect(prefsStore.has('sb-x-auth-token')).toBe(false);
    expect(prefsStore.has('sb-x-other')).toBe(false);
    expect(prefsStore.get('keep-me')).toBe('unrelated');
  });

  it('on web sweeps localStorage and never calls Preferences', async () => {
    localStorage.setItem('sb-x-auth-token', 'session');
    localStorage.setItem('keep-me', 'unrelated');
    prefsStore.set('sb-x-auth-token', 'stray');

    await purgeAuthStorage();

    expect(localStorage.getItem('sb-x-auth-token')).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('unrelated');
    expect(prefsStore.get('sb-x-auth-token')).toBe('stray');
    expect(mockedPreferences.keys).not.toHaveBeenCalled();
    expect(mockedPreferences.remove).not.toHaveBeenCalled();
  });

  it('still sweeps localStorage and resolves when Preferences.keys rejects', async () => {
    isNative.value = true;
    localStorage.setItem('sb-x-auth-token', 'session');
    mockedPreferences.keys.mockRejectedValueOnce(new Error('bridge down'));

    await expect(purgeAuthStorage()).resolves.toBeUndefined();
    expect(localStorage.getItem('sb-x-auth-token')).toBeNull();
  });
});

describe('storageHasAuthToken', () => {
  it('on native finds a token in either store', async () => {
    isNative.value = true;

    expect(await storageHasAuthToken()).toBe(false);

    prefsStore.set('sb-x-auth-token', 'session');
    expect(await storageHasAuthToken()).toBe(true);

    prefsStore.clear();
    localStorage.setItem('sb-x-auth-token', 'session');
    expect(await storageHasAuthToken()).toBe(true);
  });

  it('requires BOTH the sb- prefix and the -auth-token suffix', async () => {
    isNative.value = true;
    localStorage.setItem('sb-x-refresh', 'nope');
    prefsStore.set('x-auth-token', 'nope');

    expect(await storageHasAuthToken()).toBe(false);
  });

  it('on web ignores Preferences entirely', async () => {
    prefsStore.set('sb-x-auth-token', 'session');

    expect(await storageHasAuthToken()).toBe(false);
    expect(mockedPreferences.keys).not.toHaveBeenCalled();
  });

  it('resolves false when Preferences.keys rejects (native, token only there)', async () => {
    isNative.value = true;
    prefsStore.set('sb-x-auth-token', 'session');
    mockedPreferences.keys.mockRejectedValueOnce(new Error('bridge down'));

    expect(await storageHasAuthToken()).toBe(false);
  });
});
