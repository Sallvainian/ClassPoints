import type { AppState } from '../types';
import { createDefaultBehaviors } from './defaults';

const CURRENT_VERSION = 1;

export const DEFAULT_STATE: AppState = {
  version: CURRENT_VERSION,
  classrooms: [],
  behaviors: createDefaultBehaviors(),
  transactions: [],
  lastActiveClassroomId: null,
};

export function migrateState(state: unknown): AppState {
  if (!state || typeof state !== 'object') {
    return DEFAULT_STATE;
  }

  const version = (state as Record<string, unknown>).version;

  if (typeof version !== 'number') {
    return DEFAULT_STATE;
  }

  // Ensure behaviors exist (migrate from older versions)
  const parsed = state as AppState;
  if (!parsed.behaviors || parsed.behaviors.length === 0) {
    parsed.behaviors = createDefaultBehaviors();
  }

  // Ensure transactions array exists
  if (!parsed.transactions) {
    parsed.transactions = [];
  }

  // Ensure classrooms array exists (renamed from classes)
  if (!parsed.classrooms) {
    parsed.classrooms = [];
  }

  // Future migrations would go here
  // if (version < 2) state = migrateV1toV2(state);

  return parsed;
}
