import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Theme = 'default' | 'christmas';

interface ThemeContextValue {
  theme: Theme;
  isChristmas: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'classpoints-theme';

function getDefaultTheme(): Theme {
  // Check localStorage first
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'default' || stored === 'christmas') {
    return stored;
  }

  // Auto-enable in December
  const isDecember = new Date().getMonth() === 11;
  return isDecember ? 'christmas' : 'default';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getDefaultTheme);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'christmas') {
      root.classList.add('christmas');
    } else {
      root.classList.remove('christmas');
    }

    // Persist preference
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState(current => current === 'christmas' ? 'default' : 'christmas');
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const value: ThemeContextValue = {
    theme,
    isChristmas: theme === 'christmas',
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
