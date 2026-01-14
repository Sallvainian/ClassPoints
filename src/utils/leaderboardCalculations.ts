import type { AppStudent, AppClassroom } from '../contexts/HybridAppContext';

/**
 * Milestone point values for "Rising Stars" category
 */
export const MILESTONES = [1, 5, 10, 25, 50, 69, 75, 100] as const;

/**
 * Entry displayed in the leaderboard
 */
export interface LeaderboardEntry {
  student: AppStudent;
  value: number | string;
  subtitle?: string;
}

/**
 * Get top students by overall point total
 */
export function getOverallLeaders(students: AppStudent[], limit = 5): LeaderboardEntry[] {
  return [...students]
    .sort((a, b) => b.pointTotal - a.pointTotal)
    .slice(0, limit)
    .map((student) => ({
      student,
      value: student.pointTotal,
    }));
}

/**
 * Get students with points earned today, sorted by today's total
 */
export function getTodayStars(students: AppStudent[], limit = 5): LeaderboardEntry[] {
  return [...students]
    .filter((s) => s.todayTotal > 0)
    .sort((a, b) => b.todayTotal - a.todayTotal)
    .slice(0, limit)
    .map((student) => ({
      student,
      value: student.todayTotal,
      subtitle: 'today',
    }));
}

/**
 * Get the top student from each classroom
 */
export function getClassChampions(classrooms: AppClassroom[], limit = 5): LeaderboardEntry[] {
  const champions: LeaderboardEntry[] = [];
  for (const classroom of classrooms) {
    const champion = [...classroom.students].sort((a, b) => b.pointTotal - a.pointTotal)[0];
    if (champion) {
      champions.push({
        student: champion,
        value: champion.pointTotal,
        subtitle: classroom.name,
      });
    }
  }
  return champions.slice(0, limit);
}

/**
 * Get students with points earned this week, sorted by weekly total
 */
export function getThisWeekLeaders(students: AppStudent[], limit = 5): LeaderboardEntry[] {
  return [...students]
    .filter((s) => s.thisWeekTotal > 0)
    .sort((a, b) => b.thisWeekTotal - a.thisWeekTotal)
    .slice(0, limit)
    .map((student) => ({
      student,
      value: student.thisWeekTotal,
      subtitle: 'this week',
    }));
}

/**
 * Get students with best positive/negative point ratio
 * Higher ratio = more positive points relative to negative points
 */
export function getBestBehaved(students: AppStudent[], limit = 5): LeaderboardEntry[] {
  return [...students]
    .filter((s) => s.positiveTotal > 0)
    .map((student) => {
      const negAbs = Math.abs(student.negativeTotal ?? 0);
      const divisor = Math.max(1, Number.isFinite(negAbs) ? negAbs : 0);
      const ratio = student.positiveTotal / divisor;
      return { student, ratio };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit)
    .map(({ student, ratio }) => ({
      student,
      value: ratio === Infinity || !Number.isFinite(ratio) ? '∞' : ratio.toFixed(1),
      subtitle: 'ratio',
    }));
}

/**
 * Get students who have reached milestone point values
 */
export function getRisingStars(students: AppStudent[], limit = 5): LeaderboardEntry[] {
  return [...students]
    .filter((s) => MILESTONES.includes(s.pointTotal as (typeof MILESTONES)[number]))
    .sort((a, b) => b.pointTotal - a.pointTotal)
    .slice(0, limit)
    .map((student) => ({
      student,
      value: `${student.pointTotal} pts`,
      subtitle: 'milestone reached!',
    }));
}
