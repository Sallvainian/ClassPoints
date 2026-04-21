import { v4 as uuidv4 } from 'uuid';
import type { Behavior, BehaviorCategory } from '../types';

interface BehaviorTemplate {
  name: string;
  points: number;
  icon: string;
  category: BehaviorCategory;
}

const BEHAVIOR_TEMPLATES: BehaviorTemplate[] = [
  // Positive behaviors
  { name: 'On Task', points: 1, icon: '📚', category: 'positive' },
  { name: 'Helping Others', points: 2, icon: '🤝', category: 'positive' },
  { name: 'Great Effort', points: 2, icon: '💪', category: 'positive' },
  { name: 'Participation', points: 1, icon: '✋', category: 'positive' },
  { name: 'Excellent Work', points: 3, icon: '⭐', category: 'positive' },
  { name: 'Being Kind', points: 2, icon: '❤️', category: 'positive' },
  { name: 'Following Rules', points: 1, icon: '✅', category: 'positive' },
  { name: 'Working Quietly', points: 1, icon: '🤫', category: 'positive' },

  // Negative behaviors
  { name: 'Off Task', points: -1, icon: '😴', category: 'negative' },
  { name: 'Disruptive', points: -2, icon: '🔊', category: 'negative' },
  { name: 'Unprepared', points: -1, icon: '📝', category: 'negative' },
  { name: 'Unkind Words', points: -2, icon: '💬', category: 'negative' },
  { name: 'Not Following Rules', points: -1, icon: '🚫', category: 'negative' },
  { name: 'Late', points: -1, icon: '⏰', category: 'negative' },
];

// Generate default behaviors with unique IDs
export function createDefaultBehaviors(): Behavior[] {
  const now = Date.now();
  return BEHAVIOR_TEMPLATES.map((template) => ({
    id: uuidv4(),
    ...template,
    isCustom: false,
    createdAt: now,
  }));
}

// Avatar color palette for students
export const AVATAR_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#96CEB4', // Sage
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Lavender
  '#85C1E9', // Light Blue
  '#F8B500', // Amber
  '#00BFA5', // Dojo Green
];

// Get a random avatar color
export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Get a deterministic avatar color based on name (for consistent fallback)
export function getAvatarColorForName(name: string): string {
  // Simple hash function to get consistent color for same name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Calculate relative luminance of a hex color (WCAG formula)
function getLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Determine if a color needs dark text for contrast
export function needsDarkText(hexColor: string): boolean {
  return getLuminance(hexColor) > 0.5;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Convert a light-mode avatar color into a dark-mode-friendly variant.
// Caps lightness at 28% — low enough for white text to hit WCAG AA across
// the yellow/amber end of the palette (those are the worst-case hues).
// Saturation is floored at 55% so darker hues keep their color identity.
export function darkenForDarkMode(hexColor: string): string {
  const { h, s, l } = hexToHsl(hexColor);
  return hslToHex(h, Math.max(s, 55), Math.min(l, 28));
}
