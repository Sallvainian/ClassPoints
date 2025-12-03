import { useState, useEffect, useCallback } from 'react';
import type { AppState } from '../types';
import { DEFAULT_STATE, migrateState } from '../utils/migrations';

const STORAGE_KEY = 'classroom-points-data';
const DEBOUNCE_MS = 300;

export function usePersistedState() {
  const [state, setStateInternal] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_STATE;

      const parsed = JSON.parse(stored);
      return migrateState(parsed);
    } catch (error) {
      console.error('Failed to load state:', error);
      return DEFAULT_STATE;
    }
  });

  // Debounced save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.error('localStorage quota exceeded');
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [state]);

  const setState = useCallback((newState: AppState) => {
    setStateInternal(newState);
  }, []);

  return { state, setState };
}
