# Data Models

_Generated 2026-07-17 (exhaustive full rescan; HEAD `e34bbf3` on `main`)._

_Since the prior scan (HEAD `134a1ef`), `supabase/migrations/` gained FOUR files: the atomic seating RPCs (`20260610224711`), the batched time-totals RPC (`20260611145458`), the `batch_kind` column (`20260611173650`), and the totals-trigger `SECURITY DEFINER` fix (`20260717033000`). The project also gained its first Edge Function (`delete-account`)._

## Overview

ClassPoints uses Postgres via Supabase. The schema is defined across **17 migrations** in `supabase/migrations/` (`ls supabase/migrations | wc -l` → 17): the zero-padded `001_initial_schema.sql` → `012_add_insubordination_behavior.sql`, plus five timestamp-prefixed files emitted by `supabase migration new` (`20260429181608_harden_database_linter_findings.sql`, `20260610224711_seating_atomic_writes.sql`, `20260611145458_batch_time_totals_rpc.sql`, `20260611173650_add_batch_kind.sql`, `20260717033000_totals_trigger_security_definer.sql`). Migrations apply in lexicographic order, so the zero-padded set sorts before the timestamped files. **New migrations should be created with `supabase migration new <name>`** (timestamp-prefixed; sorts after the legacy zero-padded set) — do not reuse or renumber an existing zero-padded prefix. All tables have Row-Level Security enabled and policies keyed on `auth.uid()`. Type definitions are auto-generated to `src/types/database.ts`; the camelCase app shapes live in `src/types/index.ts` and the boundary transforms in `src/types/transforms.ts`. One Supabase **Edge Function** exists: `supabase/functions/delete-account/` (see Edge Functions below).

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

| Column          | Type                 | Notes                                                                                                                                                                                                              |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`            | UUID PK              |                                                                                                                                                                                                                    |
| `student_id`    | UUID FK students     | NOT NULL, ON DELETE CASCADE                                                                                                                                                                                        |
| `classroom_id`  | UUID FK classrooms   | NOT NULL, ON DELETE CASCADE                                                                                                                                                                                        |
| `behavior_id`   | UUID FK behaviors    | Nullable, ON DELETE SET NULL                                                                                                                                                                                       |
| `behavior_name` | TEXT NOT NULL        | Snapshot for history display                                                                                                                                                                                       |
| `behavior_icon` | TEXT NOT NULL        | Snapshot for history display                                                                                                                                                                                       |
| `points`        | INTEGER NOT NULL     |                                                                                                                                                                                                                    |
| `note`          | TEXT                 | nullable                                                                                                                                                                                                           |
| `batch_id`      | UUID                 | nullable. Groups class-wide / multi-select awards for batch undo.                                                                                                                                                  |
| `batch_kind`    | TEXT                 | nullable. `'class' \| 'subset'` via the named CHECK `point_transactions_batch_kind_check` (`20260611173650:10-13`; deferred #7 — durable cross-device undo labels). NULL on single-student awards and legacy rows. |
| `created_at`    | TIMESTAMPTZ NOT NULL | NOW() default                                                                                                                                                                                                      |

Indexes: `idx_transactions_student_id`, `idx_transactions_classroom_id`, `idx_transactions_created_at` (DESC), `idx_transactions_student_created` (composite), `idx_transactions_classroom_created` (added in 011 for the time-totals RPC), `idx_point_transactions_batch_id` (partial — `WHERE batch_id IS NOT NULL`).

Realtime: enabled, REPLICA IDENTITY FULL (so DELETE payloads carry full row).

Triggers:

- `trigger_update_student_totals` (AFTER INSERT OR DELETE on `point_transactions`) — calls `update_student_point_totals()` to bump/decrement `students.point_total` / `positive_total` / `negative_total`. Lifetime totals are O(1) reads from `students`, not derived from a SUM at query time. **`SECURITY DEFINER` since `20260717033000`**: the account-deletion cascade (`auth.admin.deleteUser` → classrooms → students → point_transactions) fires this trigger as `supabase_auth_admin`, which holds no grants on `public.students` — under the previous `SECURITY INVOKER` the UPDATE failed with SQLSTATE `42501` and the whole user deletion 500'd (found by integration test `[DEL.INT-01]`). Body and pinned empty `search_path` are unchanged; EXECUTE stays revoked from `PUBLIC`/`anon`/`authenticated`.

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

Called ONCE by `useStudents.queryFn` (rows filtered to its classroom client-side) and ONCE by `useClassrooms.queryFn` (home view aggregates). It replaced the per-classroom `get_student_time_totals(p_classroom_id, …)` — migration `20260611145458_batch_time_totals_rpc.sql` (deferred #8) created the batched function and DROPPED the legacy one in the same migration (`:80`), collapsing the prior Promise.all per-classroom fan-out to one round-trip.

Grants follow the harden-migration conventions: `SET search_path = ''`, EXECUTE revoked from `anon`/`PUBLIC` and granted explicitly to `authenticated` and `service_role` (`20260611145458:70-71`).

### Atomic seating RPCs (`20260610224711_seating_atomic_writes.sql`, deferred #27)

Four single-transaction `plpgsql` functions — all `RETURNS void`, **`SECURITY INVOKER`**, `SET search_path = ''`, EXECUTE revoked from `PUBLIC`/`anon` and granted to `authenticated`/`service_role` (`:365-375`). They are the ONLY client write path for multi-statement seat operations (`useSeatingChart` calls each via one `supabase.rpc(...)`):

| Function                 | Signature                                              | Behavior                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seating_assign_student` | `(p_chart_id uuid, p_seat_id uuid, p_student_id uuid)` | Verifies seat-in-chart + student-in-classroom, clears the student's existing seat in the chart, then sets the new one.                                                      |
| `seating_swap_students`  | `(p_seat_id_1 uuid, p_seat_id_2 uuid)`                 | Locks both rows id-sorted (`ORDER BY ss.id FOR UPDATE`, `:129-130`), same-chart guard, reads occupants server-side (the client sends only seat ids).                        |
| `seating_randomize`      | `(p_chart_id uuid, p_assignments jsonb)`               | NULL-strict count-match validation, clears all chart seats, then applies the full assignment set.                                                                           |
| `seating_apply_preset`   | `(p_chart_id uuid, p_layout jsonb)`                    | Shape-validates the camelCase jsonb BEFORE writes, then settings-update → delete groups/room_elements → reinsert (seats auto-created by `trigger_auto_create_group_seats`). |

Inside the functions, clear and set are deliberately SEPARATE statements — the `trigger_ensure_student_single_seat` BEFORE trigger stays the invariant enforcer, and a merged UPDATE raises flakily on permutations (`:18-23`). `unassignStudent` stays a plain single-row table update (already atomic). Together with the batched time-totals RPC these form the app-facing RPC surface; the `update_*` and `private.*` trigger functions have EXECUTE revoked from all client roles (they run only as trigger bodies).

## Edge Functions

### `delete-account` (`supabase/functions/delete-account/index.ts`, 67 LOC — NEW, PR #137)

In-app account deletion (App Store Guideline 5.1.1(v)):

- **Identity comes EXCLUSIVELY from the verified JWT** — never the request body (`index.ts:3-5`): a user-scoped client (anon key + caller's `Authorization` header, `persistSession: false`) validates via `auth.getUser()` (`:45-52`); missing/invalid session → 401.
- A service-role admin client then runs `admin.auth.admin.deleteUser(user.id)` (`:60`) — only the auth user is deleted directly; **every user-owned row cascades** via the four `auth.users` FKs (`classrooms` `002:9`, `behaviors` `002:12`, `user_sound_settings` `007:7`, `layout_presets` `008:81`; students/transactions/seating cascade transitively via classrooms). Default behaviors (`user_id NULL`) survive (`:6-11`).
- CORS: `Access-Control-Allow-Origin: *`, `POST`/`OPTIONS` only; non-POST → 405 (`:17-36`).
- `verify_jwt = true` is pinned in `supabase/config.toml` (`[functions.delete-account]`) so the platform rejects unauthenticated calls before the function runs; the in-code checks are belt-and-suspenders for local serving.
- Client side: `useDeleteAccount` (`src/hooks/useDeleteAccount.ts`, 21 LOC) invokes it via `supabase.functions.invoke('delete-account', { method: 'POST' })` with no body; `DeleteAccountModal` requires typing the account email to confirm, runs deletion THEN `signOut()`.
- The deletion cascade is why `update_student_point_totals()` had to become `SECURITY DEFINER` (`20260717033000` — see the `point_transactions` trigger note).

## Schema hardening (`20260429181608_harden_database_linter_findings.sql`)

This timestamp-prefixed migration resolves Supabase database-linter findings without revoking the table grants the REST/Data API needs:

- **`DROP EXTENSION IF EXISTS pg_graphql`** — the app uses supabase-js table queries, not GraphQL, so dropping `pg_graphql` clears the GraphQL-schema-exposure warning without touching table SELECT grants.
- **`CREATE SCHEMA private`** with `REVOKE ALL ... FROM PUBLIC, anon, authenticated` — holds the SECURITY DEFINER trigger helpers (`set_user_id`, `auto_create_group_seats`, `ensure_student_single_seat`) out of the client-exposed `public` schema.
- **`SET search_path = ''`** on every recreated function — pins an immutable, empty search path (functions reference fully-qualified `public.*` names internally).
- Trigger reassignment: each affected trigger is dropped and recreated to call the `private.*` helper; the old `public.*` copies are dropped.

## Triggers (named)

Function schemas reflect the harden migration (`20260429181608_*`): trigger-only helpers that set `user_id` / create seats / enforce single-seat were moved to a `private` schema; the `public.update_*` helpers stay in `public` but are recreated with `SET search_path = ''` and have EXECUTE revoked from `anon`/`authenticated`/`PUBLIC`.

| Trigger                                    | Table                 | Event                                 | Function                                                                                                          |
| ------------------------------------------ | --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `update_classrooms_updated_at`             | `classrooms`          | BEFORE UPDATE                         | `public.update_updated_at_column()`                                                                               |
| `set_classrooms_user_id`                   | `classrooms`          | BEFORE INSERT                         | `private.set_user_id()`                                                                                           |
| `set_behaviors_user_id`                    | `behaviors`           | BEFORE INSERT                         | `private.set_user_id()`                                                                                           |
| `trigger_update_student_totals`            | `point_transactions`  | AFTER INSERT OR DELETE                | `public.update_student_point_totals()` — `SECURITY DEFINER` since `20260717033000` (account-deletion cascade fix) |
| `trigger_update_sound_settings_updated_at` | `user_sound_settings` | BEFORE UPDATE                         | `public.update_sound_settings_updated_at()`                                                                       |
| `trigger_auto_create_group_seats`          | `seating_groups`      | AFTER INSERT                          | `private.auto_create_group_seats()`                                                                               |
| `trigger_ensure_student_single_seat`       | `seating_seats`       | BEFORE INSERT OR UPDATE OF student_id | `private.ensure_student_single_seat()`                                                                            |
| `trigger_update_seating_chart_timestamp`   | `seating_charts`      | BEFORE UPDATE                         | `public.update_seating_chart_timestamp()`                                                                         |

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

- `src/types/database.ts` (522 LOC) — auto-generated Postgres types. Pattern: `Database['public']['Tables']['X']['Row' | 'Insert' | 'Update']`. Convenience aliases: `Classroom`, `NewClassroom`, `UpdateClassroom`, etc. `point_transactions` Row/Insert/Update now carry `batch_kind: string | null`. New value-domain type `BatchKind = 'class' | 'subset'` (`:472`) and `TimeTotalsRow` (`:521-522`, derived from the batched RPC's Returns). The `Functions` block lists `get_student_time_totals_all_for_user` (the per-classroom `get_student_time_totals` is gone) plus the four seating RPCs (`seating_assign_student`, `seating_swap_students`, `seating_randomize`, `seating_apply_preset`, all `Returns: undefined`). No soft-delete: there is no `deleted_at` column anywhere.
- `src/types/index.ts` — camelCase app shapes (`Behavior`, `Student`, `Classroom`, `PointTransaction`, `AppState`, `StudentPoints`, `UndoableAction`). `PointTransaction` carries a synthetic, session-ephemeral `failed?` marker (`:36`) set ONLY on client-side rows injected by `DashboardView` from `failedBatchStore` — never on a real DB transaction. Re-exports `*` from `./seatingChart` (cleanup target; the explicit-export rule applies to new code).
- `src/types/seatingChart.ts` (296 LOC) — DB types, app types, transforms, AND the Zod boundary schema colocated for that domain: `ROOM_ELEMENT_TYPES` (`:14`, single const deriving BOTH the TS union and the `z.enum`), `layoutPresetDataSchema` (`:86-112`), `LayoutPresetData = z.infer<...>` (`:114`), `LayoutPresetValidationError` (`:227-241`), and `dbToLayoutPreset` which `safeParse`s `layout_data` on every read (`:244`) — the old `as LayoutPresetData` cast is gone (#15).
- `src/types/transforms.ts` (173 LOC) — forward `dbToBehavior`, `dbToClassroom` (with `ClassroomAggregate` payload), `dbToStudent` (with `timeTotals` payload), `dbToPointTransaction` (passthrough `{ ...row }` spread, `:77-79` — the Db shape leaks intentionally and `batch_kind` rides through automatically; consumers read `DbPointTransaction` directly via `useTransactions`), plus the Phase-4 app-shape (camelCase) transforms `dbStudentToApp` and `dbClassroomToApp`, relocated from the dissolved AppContext `mapped*` bridges (consumed by `useAppClassrooms`/`useActiveClassroom`; thin and transitional).

### Adding a column — checklist

1. Create the migration with `supabase migration new <name>`, then write the SQL into the generated timestamp-prefixed file under `supabase/migrations/`. It sorts after the legacy zero-padded set (lexicographic order); do not reuse or renumber a `0NN` prefix.
2. Add to `DbX` Row/Insert/Update in `src/types/database.ts`.
3. If user-facing, add to the `X` app type in `src/types/index.ts`.
4. Update `transformX()` in `src/types/transforms.ts` — UNLESS it's `dbToPointTransaction` (`{ ...row }` passthrough automatically picks up new fields).
5. Verify the `queryFn` `.select(...)` clause: `.select('*')` picks up new columns automatically; explicit-column `.select('id, name')` (e.g. `useClassrooms.ts:23-25`) drops them silently.

## Current realtime subscriptions (HEAD)

Exactly **2** production subscription sites (`grep -rn "table: '" src/hooks` excluding tests → 2) — the ADR-005 §6 target is met:

- `useStudents.ts:46` — subscribes to `students` ONLY (any event, classroom-filtered), invalidate-not-merge. The prior `point_transactions` DELETE local-decrement subscription was removed in `ea9f406`; cross-device award AND undo totals now flow through the DB trigger's `students` UPDATE (migration `011:45-47`) → refetch.
- `useTransactions.ts:83` — subscribes to `point_transactions` (any event, classroom-filtered), invalidate-not-merge.
- `useLayoutPresets.ts` — NO subscription. The legacy `layout_presets` subscription was deleted with the #11 TanStack migration (PR #112, 2026-06-09).
- `useSeatingChart.ts` — NO realtime subscription, by design ("Seating is a non-realtime domain (ADR-005 §6, CAP-4): freshness comes from onSettled invalidation only", `useSeatingChart.ts:104-105`). The cross-device drag-sync use case was dropped 2026-05-13.
