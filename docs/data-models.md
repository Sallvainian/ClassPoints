# Data Models

_Generated 2026-06-02 (exhaustive full rescan; HEAD `134a1ef` on `main`)._

_Schema unchanged since the prior scan: `supabase/migrations/` had zero changes in `c9ca66f..134a1ef`, so the table/enum/trigger/RLS content below is preserved. This refresh updates only the TypeScript-side references touched by the atomic batch-award fix (`30da564`, #106) — chiefly the synthetic `failed?` marker added to the `PointTransaction` app type._

## Overview

ClassPoints uses Postgres via Supabase. The schema is defined across **13 migrations** in `supabase/migrations/`: the zero-padded `001_initial_schema.sql` → `012_add_insubordination_behavior.sql`, plus one timestamp-prefixed file, `20260429181608_harden_database_linter_findings.sql`, emitted by the Supabase CLI during the PR #86 linter-hardening work. Migrations apply in lexicographic order, so the zero-padded set sorts before the timestamped file. **New migrations should be created with `supabase migration new <name>`** (timestamp-prefixed; sorts after the legacy zero-padded set) — do not reuse or renumber an existing zero-padded prefix. All tables have Row-Level Security enabled and policies keyed on `auth.uid()`. Type definitions are auto-generated to `src/types/database.ts`; the camelCase app shapes live in `src/types/index.ts` and the boundary transforms in `src/types/transforms.ts`.

## Tables

### `classrooms`

| Column       | Type                 | Notes                                                                          |
| ------------ | -------------------- | ------------------------------------------------------------------------------ |
| `id`         | UUID PK              | `gen_random_uuid()` default                                                    |
| `user_id`    | UUID FK auth.users   | Cascade delete. Auto-set by `private.set_user_id()` trigger if NULL on insert. |
| `name`       | TEXT NOT NULL        |                                                                                |
| `created_at` | TIMESTAMPTZ NOT NULL | NOW() default                                                                  |
| `updated_at` | TIMESTAMPTZ NOT NULL | NOW() default + `update_updated_at_column()` BEFORE UPDATE trigger             |

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

| Column       | Type                          | Notes                                                                                                    |
| ------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `id`         | UUID PK                       |                                                                                                          |
| `user_id`    | UUID FK auth.users            | Nullable. NULL = system-default behavior. Auto-set by `private.set_user_id()` trigger on custom inserts. |
| `name`       | TEXT NOT NULL                 |                                                                                                          |
| `points`     | INTEGER NOT NULL              | CHECK `points >= -5 AND points <= 5 AND points != 0`                                                     |
| `icon`       | TEXT NOT NULL                 | Emoji                                                                                                    |
| `category`   | `behavior_category` ENUM      | `'positive' \| 'negative'`                                                                               |
| `is_custom`  | BOOLEAN NOT NULL DEFAULT true | Defaults are `is_custom = false`, custom is `true`                                                       |
| `created_at` | TIMESTAMPTZ NOT NULL          | NOW() default                                                                                            |

Indexes: `idx_behaviors_category`, `idx_behaviors_user_id`.

RLS: visible when `user_id IS NULL OR user_id = auth.uid()`. INSERT/UPDATE/DELETE require `user_id = auth.uid()`.

**System defaults** — `003_sync_default_behaviors.sql` seeds 14 (8 positive + 6 negative); `012_add_insubordination_behavior.sql` adds one more negative default (idempotent `INSERT ... WHERE NOT EXISTS`), so the DB ships **15** defaults (8 positive + 7 negative):

- **Positive (8)**: On Task (+1 📚), Helping Others (+2 🤝), Great Effort (+2 💪), Participation (+1 ✋), Excellent Work (+3 ⭐), Being Kind (+2 ❤️), Following Rules (+1 ✅), Working Quietly (+1 🤫)
- **Negative (7)**: Off Task (-1 😴), Disruptive (-2 🔊), Unprepared (-1 📝), Unkind Words (-2 💬), Not Following Rules (-1 🚫), Late (-1 ⏰), Insubordination (-5 🚨, added in 012)

These defaults are also hard-coded in **one** TS constant (the prior `AppContext.DEFAULT_BEHAVIORS` / `resetBehaviorsToDefault` pair was deleted with the Phase 4 facade dissolution — `grep DEFAULT_BEHAVIORS src` → 0; the earlier 14-vs-15 drift is gone):

- `src/utils/defaults.ts:33` `createDefaultBehaviors()` — **15 entries, includes Insubordination** (the array literal at `:13-30`), matching the DB. Used by the legacy localStorage→Supabase migration path (`src/utils/migrations.ts`).

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

### `get_student_time_totals_all_for_user(p_start_of_today, p_start_of_week) → (classroom_id, student_id, today_total, this_week_total)[]`

Returns per-student aggregates for `today_total` and `this_week_total` based on `point_transactions` since the given boundaries, for EVERY student in EVERY classroom the caller owns — ownership is bounded by the `point_transactions` RLS policy under explicit `SECURITY INVOKER` (there is no classroom param to spoof). Pre-filters on `created_at >= p_start_of_week` for performance (served by `idx_transactions_created_at`).

Called ONCE by `useStudents.queryFn` (rows filtered to its classroom client-side) and ONCE by `useClassrooms.queryFn` (home view aggregates). It replaced the per-classroom `get_student_time_totals(p_classroom_id, …)` — migration `20260611145458_batch_time_totals_rpc.sql` (deferred #8) created the batched function and DROPPED the legacy one in the same migration, collapsing the prior Promise.all per-classroom fan-out to one round-trip.

Grants follow the harden-migration conventions: `SET search_path = ''`, EXECUTE revoked from `anon`/`PUBLIC` and granted explicitly to `authenticated` and `service_role`. Alongside the four atomic seating RPCs (`20260610224711`), it forms the app-facing RPC surface; the `update_*` and `private.*` trigger functions have EXECUTE revoked from all client roles (they run only as trigger bodies).

## Schema hardening (`20260429181608_harden_database_linter_findings.sql`)

This timestamp-prefixed migration resolves Supabase database-linter findings without revoking the table grants the REST/Data API needs:

- **`DROP EXTENSION IF EXISTS pg_graphql`** — the app uses supabase-js table queries, not GraphQL, so dropping `pg_graphql` clears the GraphQL-schema-exposure warning without touching table SELECT grants.
- **`CREATE SCHEMA private`** with `REVOKE ALL ... FROM PUBLIC, anon, authenticated` — holds the SECURITY DEFINER trigger helpers (`set_user_id`, `auto_create_group_seats`, `ensure_student_single_seat`) out of the client-exposed `public` schema.
- **`SET search_path = ''`** on every recreated function — pins an immutable, empty search path (functions reference fully-qualified `public.*` names internally).
- Trigger reassignment: each affected trigger is dropped and recreated to call the `private.*` helper; the old `public.*` copies are dropped.

## Triggers (named)

Function schemas reflect the harden migration (`20260429181608_*`): trigger-only helpers that set `user_id` / create seats / enforce single-seat were moved to a `private` schema; the `public.update_*` helpers stay in `public` but are recreated with `SET search_path = ''` and have EXECUTE revoked from `anon`/`authenticated`/`PUBLIC`.

| Trigger                                    | Table                 | Event                                 | Function                                    |
| ------------------------------------------ | --------------------- | ------------------------------------- | ------------------------------------------- |
| `update_classrooms_updated_at`             | `classrooms`          | BEFORE UPDATE                         | `public.update_updated_at_column()`         |
| `set_classrooms_user_id`                   | `classrooms`          | BEFORE INSERT                         | `private.set_user_id()`                     |
| `set_behaviors_user_id`                    | `behaviors`           | BEFORE INSERT                         | `private.set_user_id()`                     |
| `trigger_update_student_totals`            | `point_transactions`  | AFTER INSERT OR DELETE                | `public.update_student_point_totals()`      |
| `trigger_update_sound_settings_updated_at` | `user_sound_settings` | BEFORE UPDATE                         | `public.update_sound_settings_updated_at()` |
| `trigger_auto_create_group_seats`          | `seating_groups`      | AFTER INSERT                          | `private.auto_create_group_seats()`         |
| `trigger_ensure_student_single_seat`       | `seating_seats`       | BEFORE INSERT OR UPDATE OF student_id | `private.ensure_student_single_seat()`      |
| `trigger_update_seating_chart_timestamp`   | `seating_charts`      | BEFORE UPDATE                         | `public.update_seating_chart_timestamp()`   |

## Realtime publication

`ALTER PUBLICATION supabase_realtime ADD TABLE`:

- `point_transactions` (migration 004)
- `classrooms` (migration 004) — currently unused by app code; no hook subscribes
- `students` (migration 004)
- `behaviors` (migration 004) — currently unused by app code
- `user_sound_settings` (migration 007)

`REPLICA IDENTITY FULL`:

- `point_transactions` (migration 005) — required for DELETE payloads in the cross-device undo flow
- `students` (migration 005) — required for filtered-DELETE event delivery; `useStudents` is invalidate-not-merge, so it refetches on ANY students-table event (INSERT/UPDATE/DELETE) rather than reading the payload body
- `user_sound_settings` (migration 007)

## Type-system overview

- `src/types/database.ts` — auto-generated Postgres types. Pattern: `Database['public']['Tables']['X']['Row' | 'Insert' | 'Update']`. Convenience aliases: `Classroom`, `NewClassroom`, `UpdateClassroom`, etc. Function aliases: `Database['public']['Functions']['get_student_time_totals_all_for_user']['Args' | 'Returns']`.
- `src/types/index.ts` — camelCase app shapes (`Behavior`, `Student`, `Classroom`, `PointTransaction`, `AppState`, `StudentPoints`, `UndoableAction`). `PointTransaction` carries a synthetic, session-ephemeral `failed?` marker (`:36`) set ONLY on client-side rows injected by `DashboardView` from `failedBatchStore` — never on a real DB transaction. Re-exports `*` from `./seatingChart` (cleanup target; the explicit-export rule applies to new code).
- `src/types/seatingChart.ts` — DB types, app types, AND transforms colocated in one file (predates the boundary-separation pattern; left as-is for that domain).
- `src/types/transforms.ts` — forward `dbToBehavior`, `dbToClassroom` (with `ClassroomAggregate` payload), `dbToStudent` (with `timeTotals` payload), `dbToPointTransaction` (passthrough — the Db shape leaks intentionally; consumers read `DbPointTransaction` directly via `useTransactions`), plus the Phase-4 app-shape (camelCase) transforms `dbStudentToApp` (`:113`) and `dbClassroomToApp` (`:134`), relocated from the dissolved AppContext `mapped*` bridges (consumed by `useAppClassrooms`/`useActiveClassroom`; thin and transitional).

### Adding a column — checklist

1. Create the migration with `supabase migration new <name>`, then write the SQL into the generated timestamp-prefixed file under `supabase/migrations/`. It sorts after the legacy zero-padded set (lexicographic order); do not reuse or renumber a `0NN` prefix.
2. Add to `DbX` Row/Insert/Update in `src/types/database.ts`.
3. If user-facing, add to the `X` app type in `src/types/index.ts`.
4. Update `transformX()` in `src/types/transforms.ts` — UNLESS it's `dbToPointTransaction` (`{ ...row }` passthrough automatically picks up new fields).
5. Verify the `queryFn` `.select(...)` clause: `.select('*')` picks up new columns automatically; explicit-column `.select('id, name')` (e.g. `useClassrooms.ts:23-25`) drops them silently.

## Current realtime subscriptions (HEAD)

- `useStudents.ts` — subscribes to `students` ONLY (any event, classroom-filtered), invalidate-not-merge. The prior `point_transactions` DELETE local-decrement subscription was removed in `ea9f406`; cross-device award AND undo totals now flow through the DB trigger's `students` UPDATE (migration `011:45-47`) → refetch.
- `useTransactions.ts` — subscribes to `point_transactions` (any event, classroom-filtered), invalidate-not-merge.
- `useLayoutPresets.ts` — legacy subscription to `layout_presets`.
- `useSeatingChart.ts` — NO realtime subscription, by design. Previously planned to add 4 seating-table subscriptions for cross-device drag sync; that use case was dropped 2026-05-13. Seating-chart now uses on-demand `invalidateQueries` after mutations.
