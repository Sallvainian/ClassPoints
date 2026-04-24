// Forward-direction (DB → App) transforms. Called inside TanStack Query `queryFn`
// to produce camelCase, ms-timestamp app types from snake_case Postgres rows.

import type { Behavior as DbBehavior } from './database';
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
