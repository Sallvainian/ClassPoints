// Forward-direction (DB → App) transforms. Called inside TanStack Query `queryFn`
// to produce camelCase, ms-timestamp app types from snake_case Postgres rows.

import type {
  Behavior as DbBehavior,
  Classroom as DbClassroom,
  PointTransaction as DbPointTransaction,
} from './database';
import type { Behavior as AppBehavior } from './index';

export function dbToBehavior(row: DbBehavior): AppBehavior {
  return {
    id: row.id,
    name: row.name,
    points: row.points,
    icon: row.icon,
    category: row.category,
    isCustom: row.is_custom,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Student summary for dashboard display (minimal data for leaderboard).
// Includes time-based totals fetched via RPC for today/weekly leaderboards.
export interface StudentSummary {
  id: string;
  name: string;
  avatar_color: string | null;
  point_total: number;
  positive_total: number;
  negative_total: number;
  today_total: number;
  this_week_total: number;
}

// Extended classroom shape: DB row + precomputed aggregates and per-student roll-ups.
export interface ClassroomWithCount extends DbClassroom {
  student_count: number;
  point_total: number;
  positive_total: number;
  negative_total: number;
  student_summaries: StudentSummary[];
}

// Precomputed aggregate payload that `useClassrooms` assembles inside its queryFn
// and hands to `dbToClassroom` — transforms never reach into DB state themselves.
export interface ClassroomAggregate {
  studentCount: number;
  pointTotal: number;
  positiveTotal: number;
  negativeTotal: number;
  studentSummaries: StudentSummary[];
}

export function dbToClassroom(row: DbClassroom, aggregate: ClassroomAggregate): ClassroomWithCount {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_id: row.user_id,
    student_count: aggregate.studentCount,
    point_total: aggregate.pointTotal,
    positive_total: aggregate.positiveTotal,
    negative_total: aggregate.negativeTotal,
    student_summaries: aggregate.studentSummaries,
  };
}

// Point transactions stay in DB snake_case at the hook boundary — the 45 legacy
// consumers read `DbPointTransaction` directly via `useApp().transactions`. The
// transform formalizes the boundary (FR22, invariant #7) without reshaping fields;
// app-shape camelCase conversion is a future-phase consumer-edit item.
export function dbToPointTransaction(row: DbPointTransaction): DbPointTransaction {
  return {
    id: row.id,
    student_id: row.student_id,
    classroom_id: row.classroom_id,
    behavior_id: row.behavior_id,
    behavior_name: row.behavior_name,
    behavior_icon: row.behavior_icon,
    points: row.points,
    note: row.note,
    batch_id: row.batch_id,
    created_at: row.created_at,
  };
}
