// Test setup for Vitest
import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// jsdom does not implement matchMedia; ThemeProvider reads it on mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom under Vitest 4 does not always provision a working window.localStorage
// (a `--localstorage-file was provided without a valid path` warning surfaces
// and Storage methods become undefined). ThemeContext reads localStorage in
// its useState initializer, so any component tree wrapping ThemeProvider
// crashes at mount without this shim.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
  };
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    configurable: true,
    value: createMemoryStorage(),
  });
  Object.defineProperty(window, 'sessionStorage', {
    writable: true,
    configurable: true,
    value: createMemoryStorage(),
  });
}

// Drop any state written by the previous test so storage isolation matches
// what a real browser tab boundary would give you.
beforeEach(() => {
  if (typeof window === 'undefined') return;
  window.localStorage.clear();
  window.sessionStorage.clear();
});
