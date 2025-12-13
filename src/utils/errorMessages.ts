/**
 * Centralized error messages for consistent user-facing error text.
 * All error messages should be user-friendly and actionable.
 */
export const ERROR_MESSAGES = {
  // Point operations
  AWARD_POINTS: 'Failed to award points. Please try again.',
  AWARD_CLASS: 'Failed to award points to class. Please try again.',
  AWARD_STUDENTS: 'Failed to award points. Please try again.',
  UNDO: 'Failed to undo. Please try again.',
  UNDO_BATCH: 'Failed to undo award. Please try again.',
  CLEAR_POINTS: 'Failed to clear points. Please try again.',

  // Classroom operations
  CREATE_CLASSROOM: 'Failed to create classroom. Please try again.',
  UPDATE_CLASSROOM: 'Failed to update classroom. Please try again.',
  DELETE_CLASSROOM: 'Failed to delete classroom. Please try again.',

  // Student operations
  ADD_STUDENT: 'Failed to add student. Please try again.',
  UPDATE_STUDENT: 'Failed to update student. Please try again.',
  REMOVE_STUDENT: 'Failed to remove student. Please try again.',

  // Behavior operations
  ADD_BEHAVIOR: 'Failed to add behavior. Please try again.',
  UPDATE_BEHAVIOR: 'Failed to update behavior. Please try again.',
  DELETE_BEHAVIOR: 'Failed to delete behavior. Please try again.',

  // Generic
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection and try again.',
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
