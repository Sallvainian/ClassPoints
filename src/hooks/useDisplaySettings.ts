import { useState, useEffect, useCallback } from 'react';

export type CardSize = 'small' | 'medium' | 'large';

export interface DisplaySettings {
  cardSize: CardSize;
  showPointTotals: boolean;
}

const STORAGE_KEY = 'classpoints-display-settings';

const DEFAULT_SETTINGS: DisplaySettings = {
  cardSize: 'medium',
  showPointTotals: false,
};

function loadSettings(): DisplaySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        cardSize: ['small', 'medium', 'large'].includes(parsed.cardSize)
          ? parsed.cardSize
          : DEFAULT_SETTINGS.cardSize,
        showPointTotals:
          typeof parsed.showPointTotals === 'boolean'
            ? parsed.showPointTotals
            : DEFAULT_SETTINGS.showPointTotals,
      };
    }
  } catch {
    // Ignore parse errors, use defaults
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: DisplaySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors (e.g., private browsing)
  }
}

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>(loadSettings);

  // Sync to localStorage when settings change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const setCardSize = useCallback((size: CardSize) => {
    setSettings((prev) => ({ ...prev, cardSize: size }));
  }, []);

  const setShowPointTotals = useCallback((show: boolean) => {
    setSettings((prev) => ({ ...prev, showPointTotals: show }));
  }, []);

  const toggleShowPointTotals = useCallback(() => {
    setSettings((prev) => ({ ...prev, showPointTotals: !prev.showPointTotals }));
  }, []);

  return {
    settings,
    setCardSize,
    setShowPointTotals,
    toggleShowPointTotals,
  };
}
