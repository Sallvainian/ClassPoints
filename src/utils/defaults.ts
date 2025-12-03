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
