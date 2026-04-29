import { useTheme } from '../contexts/useTheme';
import { darkenForDarkMode, needsDarkText } from '../utils';

export interface AvatarDisplay {
  bg: string;
  textClass: string;
}

// Non-hook variant for use inside loops: caller supplies theme explicitly.
export function resolveAvatarDisplay(rawColor: string, isDark: boolean): AvatarDisplay {
  if (isDark) {
    return { bg: darkenForDarkMode(rawColor), textClass: 'text-white' };
  }
  return {
    bg: rawColor,
    textClass: needsDarkText(rawColor) ? 'text-gray-800' : 'text-white',
  };
}

// Hook variant: resolves via current theme. Use in components that render
// exactly one avatar per call. For lists, call useTheme() once at the top
// and pass isDark to resolveAvatarDisplay() inside the map.
export function useAvatarColor(rawColor: string): AvatarDisplay {
  const { theme } = useTheme();
  return resolveAvatarDisplay(rawColor, theme === 'dark');
}
