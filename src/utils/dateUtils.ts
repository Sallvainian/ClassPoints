/**
 * Date utility functions for time-based point tracking.
 * Uses UTC to ensure consistent timezone handling across the app.
 */

/**
 * Get UTC-based date boundaries for time-based queries.
 * Returns start of today and start of week (Monday) in UTC.
 *
 * @returns Object containing startOfToday and startOfWeek as Date objects
 */
export function getDateBoundaries(): { startOfToday: Date; startOfWeek: Date } {
  const now = new Date();

  // Start of today in UTC (midnight UTC)
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  // Start of week (Monday) in UTC
  // getUTCDay() returns 0 for Sunday, 1 for Monday, etc.
  const dayOfWeek = now.getUTCDay();
  // Calculate days to subtract to get to Monday
  // Sunday (0) -> go back 6 days
  // Monday (1) -> go back 0 days
  // Tuesday (2) -> go back 1 day, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday, 0, 0, 0, 0)
  );

  return { startOfToday, startOfWeek };
}
