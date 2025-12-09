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

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Determine if a color needs dark text for contrast
export function needsDarkText(hexColor: string): boolean {
  return getLuminance(hexColor) > 0.4;
}
