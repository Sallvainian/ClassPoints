# Data Models

_Generated 2026-04-29 (exhaustive full rescan)._

## Overview

ClassPoints uses Postgres via Supabase. The schema is defined in `supabase/migrations/001_initial_schema.sql` through `011_add_student_point_totals.sql` (11 migrations). All tables have Row-Level Security enabled and policies keyed on `auth.uid()`. Type definitions are auto-generated to `src/types/database.ts`; the camelCase app shapes live in `src/types/index.ts` and the boundary transforms in `src/types/transforms.ts`.

## Tables

### `classrooms`

| Column       | Type                 | Notes                                                                  |
| ------------ | -------------------- | ---------------------------------------------------------------------- |
| `id`         | UUID PK              | `gen_random_uuid()` default                                            |
| `user_id`    | UUID FK auth.users   | Cascade delete. Auto-set by `set_user_id()` trigger if NULL on insert. |
| `name`       | TEXT NOT NULL        |                                                                        |
| `created_at` | TIMESTAMPTZ NOT NULL | NOW() default                                                          |
| `updated_at` | TIMESTAMPTZ NOT NULL | NOW() default + `update_updated_at_column()` BEFORE UPDATE trigger     |

Indexes: `idx_classrooms_created_at` (DESC), `idx_classrooms_user_id`.

RLS: own-classrooms only (4 policies — SELECT/INSERT/UPDATE/DELETE).

### `students`

| Column           | Type                       | Notes                                         |
| ---------------- | -------------------------- | --------------------------------------------- |
| `id`             | UUID PK                    |                                               |
| `classroom_id`   | UUID FK classrooms         | NOT NULL, ON DELETE CASCADE                   |
| `name`           | TEXT NOT NULL              |                                               |
| `avatar_color`   | TEXT                       | nullable                                      |
| `point_total`    | INTEGER NOT NULL DEFAULT 0 | Maintained by trigger on `point_transactions` |
| `positive_total` | INTEGER NOT NULL DEFAULT 0 | Maintained by trigger                         |
| `negative_total` | INTEGER NOT NULL DEFAULT 0 | Maintained by trigger                         |
| `created_at`     | TIMESTAMPTZ NOT NULL       | NOW() default                                 |

Indexes: `idx_students_classroom_id`. Realtime: enabled, REPLICA IDENTITY FULL.

RLS: SELECT/INSERT/UPDATE/DELETE all gated through parent classroom's `auth.uid()`.

### `behaviors`

| Column       | Type                          | Notes                                                                                            |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`         | UUID PK                       |                                                                                                  |
| `user_id`    | UUID FK auth.users            | Nullable. NULL = system-default behavior. Auto-set by `set_user_id()` trigger on custom inserts. |
| `name`       | TEXT NOT NULL                 |                                                                                                  |
| `points`     | INTEGER NOT NULL              | CHECK `points >= -5 AND points <= 5 AND points != 0`                                             |
| `icon`       | TEXT NOT NULL                 | Emoji                                                                                            |
| `category`   | `behavior_category` ENUM      | `'positive' \| 'negative'`                                                                       |
| `is_custom`  | BOOLEAN NOT NULL DEFAULT true | Defaults are `is_custom = false`, custom is `true`                                               |
| `created_at` | TIMESTAMPTZ NOT NULL          | NOW() default                                                                                    |

Indexes: `idx_behaviors_category`, `idx_behaviors_user_id`.

RLS: visible when `user_id IS NULL OR user_id = auth.uid()`. INSERT/UPDATE/DELETE require `user_id = auth.uid()`.

**14 system defaults** seeded by `003_sync_default_behaviors.sql` (8 positive + 6 negative). Currently:

- **Positive (8)**: On Task (+1 📚), Helping Others (+2 🤝), Great Effort (+2 💪), Participation (+1 ✋), Excellent Work (+3 ⭐), Being Kind (+2 ❤️), Following Rules (+1 ✅), Working Quietly (+1 🤫)
- **Negative (6)**: Off Task (-1 😴), Disruptive (-2 🔊), Unprepared (-1 📝), Unkind Words (-2 💬), Not Following Rules (-1 🚫), Late (-1 ⏰)

These are duplicated as a TS constant in `AppContext.tsx:DEFAULT_BEHAVIORS` for the `resetBehaviorsToDefault` flow.

### `point_transactions`

| Column          | Type                 | Notes                                                             |
| --------------- | -------------------- | ----------------------------------------------------------------- |
| `id`            | UUID PK              |                                                                   |
| `student_id`    | UUID FK students     | NOT NULL, ON DELETE CASCADE                                       |
| `classroom_id`  | UUID FK classrooms   | NOT NULL, ON DELETE CASCADE                                       |
| `behavior_id`   | UUID FK behaviors    | Nullable, ON DELETE SET NULL                                      |
| `behavior_name` | TEXT NOT NULL        | Snapshot for history display                                      |
| `behavior_icon` | TEXT NOT NULL        | Snapshot for history display                                      |
| `points`        | INTEGER NOT NULL     |                                                                   |
| `note`          | TEXT                 | nullable                                                          |
| `batch_id`      | UUID                 | nullable. Groups class-wide / multi-select awards for batch undo. |
| `created_at`    | TIMESTAMPTZ NOT NULL | NOW() default                                                     |

Indexes: `idx_transactions_student_id`, `idx_transactions_classroom_id`, `idx_transactions_created_at` (DESC), `idx_transactions_student_created` (composite), `idx_transactions_classroom_created` (added in 011 for the time-totals RPC), `idx_point_transactions_batch_id` (partial — `WHERE batch_id IS NOT NULL`).

Realtime: enabled, REPLICA IDENTITY FULL (so DELETE payloads carry full row).

Triggers:

- `trigger_update_student_totals` (AFTER INSERT OR DELETE on `point_transactions`) — calls `update_student_point_totals()` to bump/decrement `students.point_total` / `positive_total` / `negative_total`. Lifetime totals are O(1) reads from `students`, not derived from a SUM at query time.

RLS: SELECT/INSERT/DELETE gated through parent classroom's `auth.uid()`. No UPDATE policy — transactions are append-only (corrections happen via INSERT of a compensating row, e.g. `useAdjustStudentPoints`).

### `user_sound_settings`

| Column                | Type                              | Notes                                                        |
| --------------------- | --------------------------------- | ------------------------------------------------------------ |
| `id`                  | UUID PK                           |                                                              |
| `user_id`             | UUID FK auth.users                | NOT NULL, ON DELETE CASCADE, UNIQUE                          |
| `enabled`             | BOOLEAN NOT NULL DEFAULT true     |                                                              |
| `volume`              | FLOAT NOT NULL DEFAULT 0.7        | CHECK `volume >= 0.0 AND volume <= 1.0`                      |
| `positive_sound`      | TEXT NOT NULL DEFAULT 'chime'     |                                                              |
| `negative_sound`      | TEXT NOT NULL DEFAULT 'soft-buzz' |                                                              |
| `custom_positive_url` | TEXT                              | nullable                                                     |
| `custom_negative_url` | TEXT                              | nullable                                                     |
| `created_at`          | TIMESTAMPTZ NOT NULL              |                                                              |
| `updated_at`          | TIMESTAMPTZ NOT NULL              | + `update_sound_settings_updated_at()` BEFORE UPDATE trigger |

Indexes: `idx_user_sound_settings_user_id`. Realtime: enabled, REPLICA IDENTITY FULL.

RLS: 4 policies — SELECT/INSERT/UPDATE/DELETE all `user_id = auth.uid()`.

### `seating_charts`

1:1 with `classrooms` (UNIQUE constraint).

| Column          | Type                                  | Notes                                                      |
| --------------- | ------------------------------------- | ---------------------------------------------------------- |
| `id`            | UUID PK                               |                                                            |
| `classroom_id`  | UUID FK classrooms                    | NOT NULL, ON DELETE CASCADE, UNIQUE                        |
| `name`          | TEXT NOT NULL DEFAULT 'Seating Chart' |                                                            |
| `snap_enabled`  | BOOLEAN NOT NULL DEFAULT true         |                                                            |
| `grid_size`     | INTEGER NOT NULL DEFAULT 40           |                                                            |
| `canvas_width`  | INTEGER NOT NULL DEFAULT 1200         |                                                            |
| `canvas_height` | INTEGER NOT NULL DEFAULT 800          |                                                            |
| `created_at`    | TIMESTAMPTZ NOT NULL                  |                                                            |
| `updated_at`    | TIMESTAMPTZ NOT NULL                  | + `update_seating_chart_timestamp()` BEFORE UPDATE trigger |

Indexes: `idx_seating_charts_classroom`.

RLS: 4 policies — SELECT/INSERT/UPDATE/DELETE all gated through parent classroom's `auth.uid()`.

### `seating_groups`

Table-pair groups (each has 4 seats).

| Column             | Type                                | Notes                       |
| ------------------ | ----------------------------------- | --------------------------- |
| `id`               | UUID PK                             |                             |
| `seating_chart_id` | UUID FK seating_charts              | NOT NULL, ON DELETE CASCADE |
| `letter`           | CHAR(1) NOT NULL                    | Group label (A-Z)           |
| `position_x`       | DOUBLE PRECISION NOT NULL           |                             |
| `position_y`       | DOUBLE PRECISION NOT NULL           |                             |
| `rotation`         | DOUBLE PRECISION NOT NULL DEFAULT 0 |                             |
| `created_at`       | TIMESTAMPTZ NOT NULL                |                             |

Constraints: UNIQUE `(seating_chart_id, letter)`. Indexes: `idx_seating_groups_chart`.

Triggers:

- `trigger_auto_create_group_seats` (AFTER INSERT) — `auto_create_group_seats()` inserts 4 seats with positions 1/2/3/4.

RLS: 4 policies — gated through parent chart → classroom → `auth.uid()`.

### `seating_seats`

| Column              | Type                   | Notes                                                                            |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `id`                | UUID PK                |                                                                                  |
| `seating_group_id`  | UUID FK seating_groups | NOT NULL, ON DELETE CASCADE                                                      |
| `position_in_group` | INTEGER NOT NULL       | CHECK `BETWEEN 1 AND 4`. 1=top-left, 2=top-right, 3=bottom-left, 4=bottom-right. |
| `student_id`        | UUID FK students       | Nullable, ON DELETE SET NULL                                                     |
| `created_at`        | TIMESTAMPTZ NOT NULL   |                                                                                  |

Constraints: UNIQUE `(seating_group_id, position_in_group)`. Indexes: `idx_seating_seats_group`, `idx_seating_seats_student`.

Triggers:

- `trigger_ensure_student_single_seat` (BEFORE INSERT OR UPDATE OF `student_id`) — `ensure_student_single_seat()` raises an exception if the student is already in another seat in the same chart.

RLS: 4 policies — gated through group → chart → classroom → `auth.uid()`.

### `room_elements`

| Column             | Type                                  | Notes                                                            |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------- |
| `id`               | UUID PK                               |                                                                  |
| `seating_chart_id` | UUID FK seating_charts                | NOT NULL, ON DELETE CASCADE                                      |
| `element_type`     | `room_element_type` ENUM              | `'teacher_desk' \| 'door' \| 'window' \| 'countertop' \| 'sink'` |
| `label`            | TEXT                                  | nullable                                                         |
| `position_x`       | DOUBLE PRECISION NOT NULL             |                                                                  |
| `position_y`       | DOUBLE PRECISION NOT NULL             |                                                                  |
| `width`            | DOUBLE PRECISION NOT NULL DEFAULT 120 | (was 100 before migration 009)                                   |
| `height`           | DOUBLE PRECISION NOT NULL DEFAULT 80  | (was 60 before migration 009)                                    |
| `rotation`         | DOUBLE PRECISION NOT NULL DEFAULT 0   |                                                                  |
| `created_at`       | TIMESTAMPTZ NOT NULL                  |                                                                  |

Indexes: `idx_room_elements_chart`.

Migration 010 added `'window'`, `'countertop'`, `'sink'` to the enum after the initial 008 introduced just `'teacher_desk'` and `'door'`.

RLS: 4 policies — gated through parent chart → classroom → `auth.uid()`.

### `layout_presets`

User-owned, importable JSON layouts (no student assignments).

| Column        | Type                 | Notes                                       |
| ------------- | -------------------- | ------------------------------------------- |
| `id`          | UUID PK              |                                             |
| `user_id`     | UUID FK auth.users   | NOT NULL, ON DELETE CASCADE                 |
| `name`        | TEXT NOT NULL        |                                             |
| `layout_data` | JSONB NOT NULL       | Shape: `{ groups, roomElements, settings }` |
| `created_at`  | TIMESTAMPTZ NOT NULL |                                             |

Indexes: `idx_layout_presets_user`.

RLS: 4 policies — `user_id = auth.uid()`.

## Enums

- `behavior_category` — `'positive'`, `'negative'` (initial schema).
- `room_element_type` — `'teacher_desk'`, `'door'`, `'window'`, `'countertop'`, `'sink'` (added in 008, extended in 010).

## RPC functions

### `get_student_time_totals(p_classroom_id, p_start_of_today, p_start_of_week) → (student_id, today_total, this_week_total)[]`

Returns per-student aggregates for `today_total` and `this_week_total` based on `point_transactions` since the given boundaries. Pre-filters on `created_at >= p_start_of_week` for performance.

Called by `useStudents.queryFn` (single classroom) and `useClassrooms.queryFn` (Promise.all per classroom for the home view aggregates).

## Triggers (named)

| Trigger                                    | Table                 | Event                                 | Function                             |
| ------------------------------------------ | --------------------- | ------------------------------------- | ------------------------------------ |
| `update_classrooms_updated_at`             | `classrooms`          | BEFORE UPDATE                         | `update_updated_at_column()`         |
| `set_classrooms_user_id`                   | `classrooms`          | BEFORE INSERT                         | `set_user_id()`                      |
| `set_behaviors_user_id`                    | `behaviors`           | BEFORE INSERT                         | `set_user_id()`                      |
| `trigger_update_student_totals`            | `point_transactions`  | AFTER INSERT OR DELETE                | `update_student_point_totals()`      |
| `trigger_update_sound_settings_updated_at` | `user_sound_settings` | BEFORE UPDATE                         | `update_sound_settings_updated_at()` |
| `trigger_auto_create_group_seats`          | `seating_groups`      | AFTER INSERT                          | `auto_create_group_seats()`          |
| `trigger_ensure_student_single_seat`       | `seating_seats`       | BEFORE INSERT OR UPDATE OF student_id | `ensure_student_single_seat()`       |
| `trigger_update_seating_chart_timestamp`   | `seating_charts`      | BEFORE UPDATE                         | `update_seating_chart_timestamp()`   |

## Realtime publication

`ALTER PUBLICATION supabase_realtime ADD TABLE`:

- `point_transactions` (migration 004)
- `classrooms` (migration 004) — currently unused by app code; no hook subscribes
- `students` (migration 004)
- `behaviors` (migration 004) — currently unused by app code
- `user_sound_settings` (migration 007)

`REPLICA IDENTITY FULL`:

- `point_transactions` (migration 005) — required for DELETE payloads in the cross-device undo flow
- `students` (migration 005) — REPLICA FULL set even though current app code only uses INSERT/UPDATE on this channel; keeps the door open for DELETE handling
- `user_sound_settings` (migration 007)

## Type-system overview

- `src/types/database.ts` — auto-generated Postgres types. Pattern: `Database['public']['Tables']['X']['Row' | 'Insert' | 'Update']`. Convenience aliases: `Classroom`, `NewClassroom`, `UpdateClassroom`, etc. Function aliases: `Database['public']['Functions']['get_student_time_totals']['Args' | 'Returns']`.
- `src/types/index.ts` — camelCase app shapes (`Behavior`, `Student`, `Classroom`, `PointTransaction`, `AppState`, `StudentPoints`, `UndoableAction`). Re-exports `*` from `./seatingChart` (cleanup target; the explicit-export rule applies to new code).
- `src/types/seatingChart.ts` — DB types, app types, AND transforms colocated in one file (predates the boundary-separation pattern; left as-is for that domain).
- `src/types/transforms.ts` — `dbToBehavior`, `dbToClassroom` (with `ClassroomAggregate` payload), `dbToStudent` (with `timeTotals` payload), `dbToPointTransaction` (passthrough — the Db shape leaks intentionally to 45 legacy consumers via `useApp().transactions`).

### Adding a column — checklist

1. Write `supabase/migrations/0NN_*.sql`.
2. Add to `DbX` Row/Insert/Update in `src/types/database.ts`.
3. If user-facing, add to the `X` app type in `src/types/index.ts`.
4. Update `transformX()` in `src/types/transforms.ts` — UNLESS it's `dbToPointTransaction` (`{ ...row }` passthrough automatically picks up new fields).
5. Verify the `queryFn` `.select(...)` clause: `.select('*')` picks up new columns automatically; explicit-column `.select('id, name')` (e.g. `useClassrooms.ts:23-25`) drops them silently.

## Current realtime subscriptions (HEAD)

- `useStudents.ts` — subscribes to `students` (any event, classroom-filtered) AND to `point_transactions` (DELETE only, classroom-filtered).
- `useTransactions.ts` — subscribes to `point_transactions` (any event, classroom-filtered).
- `useLayoutPresets.ts` — legacy subscription to `layout_presets`.
- `useSeatingChart.ts` — currently NO realtime subscription (target state has 4 seating tables wired up).
