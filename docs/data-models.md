# Data Models

_Last generated: 2026-04-21 — Source of truth: `supabase/migrations/*.sql`, `src/types/database.ts`._

ClassPoints persists all state in a Supabase-hosted PostgreSQL 15+ database. There are **10 tables**, **2 enums**, **1 RPC**, **7 triggers**, and **5 realtime-publishing tables**. Access is authorized via Row Level Security keyed to `auth.uid()` — the client never bypasses RLS.

---

## Quick Schema Map

| Table                 | Purpose                                                | Ownership path to user                                                 |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `classrooms`          | Teacher-owned classroom containers                     | `classrooms.user_id → auth.users`                                      |
| `students`            | Students within a classroom (with denormalized totals) | via `classroom.user_id`                                                |
| `behaviors`           | Point behavior templates (defaults + custom)           | default rows have `user_id = NULL`; custom rows `user_id → auth.users` |
| `point_transactions`  | Immutable audit log of awarded points                  | via `classroom.user_id`                                                |
| `user_sound_settings` | Per-user sound preferences                             | `user_id → auth.users` (UNIQUE)                                        |
| `seating_charts`      | Canvas config, one per classroom                       | via `classroom.user_id`                                                |
| `seating_groups`      | Letter-labeled table groups on a chart                 | via `seating_chart → classroom.user_id`                                |
| `seating_seats`       | 4 seats per group, nullable student assignment         | via `group → chart → classroom.user_id`                                |
| `room_elements`       | Static props on the seating canvas                     | via `seating_chart → classroom.user_id`                                |
| `layout_presets`      | Saved canvas layouts (positions only)                  | `user_id → auth.users`                                                 |

---

## Core Entities

### `classrooms`

The root container. Everything below belongs to a classroom, which belongs to a user.

| Column       | Type                    | Notes                                                                   |
| ------------ | ----------------------- | ----------------------------------------------------------------------- |
| `id`         | `UUID PK`               | `gen_random_uuid()`                                                     |
| `user_id`    | `UUID → auth.users(id)` | `ON DELETE CASCADE`. Auto-filled on INSERT via `set_user_id()` trigger. |
| `name`       | `TEXT NOT NULL`         |                                                                         |
| `created_at` | `TIMESTAMPTZ`           | `DEFAULT NOW()`                                                         |
| `updated_at` | `TIMESTAMPTZ`           | Maintained by `update_updated_at_column()` BEFORE UPDATE trigger        |

Indexes: `idx_classrooms_created_at`, `idx_classrooms_user_id`.
Realtime: **enabled**.

### `students`

Students inherit user ownership through their classroom. Lifetime point totals are denormalized onto the row and maintained by a trigger — **do not aggregate `point_transactions` client-side for display**.

| Column           | Type                         | Notes                                    |
| ---------------- | ---------------------------- | ---------------------------------------- |
| `id`             | `UUID PK`                    |                                          |
| `classroom_id`   | `UUID → classrooms(id)`      | `ON DELETE CASCADE`                      |
| `name`           | `TEXT NOT NULL`              |                                          |
| `avatar_color`   | `TEXT`                       | optional                                 |
| `point_total`    | `INTEGER NOT NULL DEFAULT 0` | trigger-maintained                       |
| `positive_total` | `INTEGER NOT NULL DEFAULT 0` | trigger-maintained (sum of `points > 0`) |
| `negative_total` | `INTEGER NOT NULL DEFAULT 0` | trigger-maintained (sum of `points < 0`) |
| `created_at`     | `TIMESTAMPTZ`                |                                          |

Indexes: `idx_students_classroom_id`.
Realtime: **enabled**. `REPLICA IDENTITY FULL` so DELETE events include `classroom_id`.

Today / this-week totals live **in application memory**, computed via the RPC `get_student_time_totals`. They are not stored columns.

### `behaviors`

Two populations live in one table:

- **Default behaviors** — `user_id IS NULL`, `is_custom = false`. Seeded in migration `003`. 14 rows (8 positive, 6 negative).
- **Custom behaviors** — user-owned, `is_custom = true`.

`points` is constrained `CHECK (points >= -5 AND points <= 5 AND points != 0)`.

| Column       | Type                             | Notes                                                                                                 |
| ------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`         | `UUID PK`                        |                                                                                                       |
| `user_id`    | `UUID → auth.users(id)` nullable | `NULL` = default, visible to all users; user-set = custom. Auto-filled on INSERT via `set_user_id()`. |
| `name`       | `TEXT NOT NULL`                  |                                                                                                       |
| `points`     | `INTEGER NOT NULL`               | CHECK constraint above                                                                                |
| `icon`       | `TEXT NOT NULL`                  | emoji                                                                                                 |
| `category`   | `behavior_category`              | enum, see below                                                                                       |
| `is_custom`  | `BOOLEAN NOT NULL DEFAULT true`  |                                                                                                       |
| `created_at` | `TIMESTAMPTZ`                    |                                                                                                       |

Indexes: `idx_behaviors_category`, `idx_behaviors_user_id`.
Realtime: **enabled**.

### `point_transactions`

Append-only audit log of every point award. This is the source-of-truth for history views and time-windowed totals. Inserts/deletes fire the `update_student_point_totals` trigger which mutates `students.*_total`.

| Column          | Type                            | Notes                                                  |
| --------------- | ------------------------------- | ------------------------------------------------------ |
| `id`            | `UUID PK`                       |                                                        |
| `student_id`    | `UUID → students(id)`           | `ON DELETE CASCADE`                                    |
| `classroom_id`  | `UUID → classrooms(id)`         | `ON DELETE CASCADE`                                    |
| `behavior_id`   | `UUID → behaviors(id)` nullable | `ON DELETE SET NULL`                                   |
| `behavior_name` | `TEXT NOT NULL`                 | snapshot — survives behavior rename/delete             |
| `behavior_icon` | `TEXT NOT NULL`                 | snapshot                                               |
| `points`        | `INTEGER NOT NULL`              |                                                        |
| `note`          | `TEXT`                          | optional                                               |
| `batch_id`      | `UUID` nullable                 | groups class-wide awards for single-click undo (`006`) |
| `created_at`    | `TIMESTAMPTZ`                   |                                                        |

Indexes: `idx_transactions_student_id`, `idx_transactions_classroom_id`, `idx_transactions_created_at`, `idx_transactions_student_created` (composite), `idx_transactions_classroom_created` (composite), `idx_point_transactions_batch_id` (partial, `WHERE batch_id IS NOT NULL`).
Realtime: **enabled**. `REPLICA IDENTITY FULL` so DELETE events carry `classroom_id` and `points` for sidebar rollback.

---

## Feature-Scoped Entities

### `user_sound_settings`

One row per user (UNIQUE constraint). Controls the sound effects played on point awards.

| Column                      | Type                                | Notes                                |
| --------------------------- | ----------------------------------- | ------------------------------------ |
| `id`                        | `UUID PK`                           |                                      |
| `user_id`                   | `UUID → auth.users(id)`             | `UNIQUE`, `ON DELETE CASCADE`        |
| `enabled`                   | `BOOLEAN NOT NULL DEFAULT true`     |                                      |
| `volume`                    | `FLOAT NOT NULL DEFAULT 0.7`        | `CHECK (volume BETWEEN 0.0 AND 1.0)` |
| `positive_sound`            | `TEXT NOT NULL DEFAULT 'chime'`     |                                      |
| `negative_sound`            | `TEXT NOT NULL DEFAULT 'soft-buzz'` |                                      |
| `custom_positive_url`       | `TEXT`                              | optional                             |
| `custom_negative_url`       | `TEXT`                              | optional                             |
| `created_at` / `updated_at` | `TIMESTAMPTZ`                       | `updated_at` maintained by trigger   |

Realtime: **enabled** for cross-device sync. `REPLICA IDENTITY FULL`.

### Seating Chart Suite (4 tables + 1 props table)

A seating chart is a 4-table structure scoped to one classroom.

#### `seating_charts`

One row per classroom (UNIQUE on `classroom_id`). Stores canvas settings.

| Column                      | Type                                    | Notes                           |
| --------------------------- | --------------------------------------- | ------------------------------- |
| `id`                        | `UUID PK`                               |                                 |
| `classroom_id`              | `UUID → classrooms(id)`                 | `UNIQUE`, `ON DELETE CASCADE`   |
| `name`                      | `TEXT NOT NULL DEFAULT 'Seating Chart'` |                                 |
| `snap_enabled`              | `BOOLEAN NOT NULL DEFAULT true`         |                                 |
| `grid_size`                 | `INTEGER NOT NULL DEFAULT 40`           | px                              |
| `canvas_width`              | `INTEGER NOT NULL DEFAULT 1200`         | px                              |
| `canvas_height`             | `INTEGER NOT NULL DEFAULT 800`          | px                              |
| `created_at` / `updated_at` | `TIMESTAMPTZ`                           | `updated_at` trigger-maintained |

> Client app uses `canvas_width: 1600` as default (see `DEFAULT_SEATING_CHART_SETTINGS` in `src/types/seatingChart.ts`). This is a pre-existing drift between the DB default (`1200`) and the app-layer default (`1600`) — the app default wins for new charts created client-side.

#### `seating_groups`

A labeled table-pair on the canvas. Letters A–Z; UNIQUE per chart.

| Column                      | Type                                  | Notes                              |
| --------------------------- | ------------------------------------- | ---------------------------------- |
| `id`                        | `UUID PK`                             |                                    |
| `seating_chart_id`          | `UUID → seating_charts(id)`           | `ON DELETE CASCADE`                |
| `letter`                    | `CHAR(1) NOT NULL`                    | `UNIQUE(seating_chart_id, letter)` |
| `position_x` / `position_y` | `DOUBLE PRECISION NOT NULL`           | canvas coordinates                 |
| `rotation`                  | `DOUBLE PRECISION NOT NULL DEFAULT 0` | degrees                            |
| `created_at`                | `TIMESTAMPTZ`                         |                                    |

On INSERT, `auto_create_group_seats()` immediately inserts 4 `seating_seats` rows (positions 1–4).

#### `seating_seats`

Four per group. `student_id` is nullable; `UNIQUE(group_id, position_in_group)` ensures no collisions.

| Column              | Type                           | Notes                                                                              |
| ------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `id`                | `UUID PK`                      |                                                                                    |
| `seating_group_id`  | `UUID → seating_groups(id)`    | `ON DELETE CASCADE`                                                                |
| `position_in_group` | `INTEGER NOT NULL`             | `CHECK (BETWEEN 1 AND 4)` — 1=top-left, 2=top-right, 3=bottom-left, 4=bottom-right |
| `student_id`        | `UUID → students(id)` nullable | `ON DELETE SET NULL`                                                               |
| `created_at`        | `TIMESTAMPTZ`                  |                                                                                    |

`ensure_student_single_seat()` trigger raises `EXCEPTION` if the same `student_id` is assigned to two seats in the same chart.

#### `room_elements`

Static canvas props: teacher desks, doors, windows, countertops, sinks.

| Column                      | Type                                    | Notes                                                   |
| --------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `id`                        | `UUID PK`                               |                                                         |
| `seating_chart_id`          | `UUID → seating_charts(id)`             | `ON DELETE CASCADE`                                     |
| `element_type`              | `room_element_type` enum                | see below                                               |
| `label`                     | `TEXT` nullable                         |                                                         |
| `position_x` / `position_y` | `DOUBLE PRECISION NOT NULL`             |                                                         |
| `width`                     | `DOUBLE PRECISION NOT NULL DEFAULT 120` | (was `100`, migration `009` updated to match 40px grid) |
| `height`                    | `DOUBLE PRECISION NOT NULL DEFAULT 80`  | (was `60`, migration `009` updated)                     |
| `rotation`                  | `DOUBLE PRECISION NOT NULL DEFAULT 0`   |                                                         |
| `created_at`                | `TIMESTAMPTZ`                           |                                                         |

#### `layout_presets`

User-owned saved layouts. Stores positions only — never student assignments, so presets are portable across classrooms.

| Column        | Type                    | Notes                                                       |
| ------------- | ----------------------- | ----------------------------------------------------------- |
| `id`          | `UUID PK`               |                                                             |
| `user_id`     | `UUID → auth.users(id)` | `ON DELETE CASCADE`                                         |
| `name`        | `TEXT NOT NULL`         |                                                             |
| `layout_data` | `JSONB NOT NULL`        | See `LayoutPresetData` shape in `src/types/seatingChart.ts` |
| `created_at`  | `TIMESTAMPTZ`           |                                                             |

---

## Enums

```sql
-- Category of a behavior
CREATE TYPE behavior_category AS ENUM ('positive', 'negative');

-- Kind of room element (migration 008 added teacher_desk + door; 010 added the rest)
CREATE TYPE room_element_type AS ENUM (
    'teacher_desk', 'door', 'window', 'countertop', 'sink'
);
```

---

## RPC Functions

### `get_student_time_totals(p_classroom_id, p_start_of_today, p_start_of_week)`

Returns a set of `(student_id, today_total, this_week_total)` rows for all students in the classroom who had activity in the current week.

- **Why an RPC, not a view:** date boundaries are caller-supplied (respecting the user's timezone), and the query scans `point_transactions` with the composite index `idx_transactions_classroom_created`.
- **Called from:** `src/hooks/useStudents.ts` / `useTransactions.ts`. Returns `[]` for students with no recent activity — callers must default to `0`.

---

## Triggers Summary

| Trigger                                    | Table                 | Timing                                | Purpose                                               |
| ------------------------------------------ | --------------------- | ------------------------------------- | ----------------------------------------------------- |
| `update_classrooms_updated_at`             | `classrooms`          | BEFORE UPDATE                         | Bump `updated_at`                                     |
| `set_classrooms_user_id`                   | `classrooms`          | BEFORE INSERT                         | Auto-fill `user_id` from `auth.uid()`                 |
| `set_behaviors_user_id`                    | `behaviors`           | BEFORE INSERT                         | Auto-fill `user_id` from `auth.uid()` (when non-NULL) |
| `trigger_update_student_totals`            | `point_transactions`  | AFTER INSERT / AFTER DELETE           | Maintain `students.{point,positive,negative}_total`   |
| `trigger_update_sound_settings_updated_at` | `user_sound_settings` | BEFORE UPDATE                         | Bump `updated_at`                                     |
| `trigger_update_seating_chart_timestamp`   | `seating_charts`      | BEFORE UPDATE                         | Bump `updated_at`                                     |
| `trigger_auto_create_group_seats`          | `seating_groups`      | AFTER INSERT                          | Create 4 rows in `seating_seats`                      |
| `trigger_ensure_student_single_seat`       | `seating_seats`       | BEFORE INSERT OR UPDATE OF student_id | RAISE if student already seated in same chart         |

---

## Realtime Publication

Tables included in `supabase_realtime`:

- `classrooms`, `students`, `behaviors`, `point_transactions` (migration `004`)
- `user_sound_settings` (migration `007`)

Seating tables are **not** on realtime — the seating editor assumes one active editor per classroom and reconciles on save.

`REPLICA IDENTITY FULL` is set on:

- `point_transactions`, `students` (migration `005`)
- `user_sound_settings` (migration `007`)

**Rule:** any table receiving realtime DELETE events that the client needs to react to must be `REPLICA IDENTITY FULL`. Without it, DELETE payloads arrive with only the PK, and optimistic rollback cannot touch denormalized totals.

---

## Row Level Security Patterns

Three patterns are used across the 10 tables:

**1. Direct user_id (5 tables)** — `classrooms`, `behaviors` (custom), `user_sound_settings`, `layout_presets`, and the `user_id IS NULL` case for default behaviors.

```sql
USING (auth.uid() = user_id)
-- or for defaults (behaviors only):
USING (user_id IS NULL OR user_id = auth.uid())
```

**2. Via classroom ownership (2 tables)** — `students`, `point_transactions`.

```sql
USING (EXISTS (
  SELECT 1 FROM classrooms
  WHERE classrooms.id = <this>.classroom_id
    AND classrooms.user_id = auth.uid()
))
```

**3. Via seating chart → classroom (3 tables)** — `seating_groups`, `seating_seats`, `room_elements`. (`seating_charts` itself uses pattern 2.)

```sql
USING (EXISTS (
  SELECT 1 FROM seating_groups
    JOIN seating_charts ON seating_charts.id = seating_groups.seating_chart_id
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
  WHERE seating_groups.id = seating_seats.seating_group_id
    AND classrooms.user_id = auth.uid()
))
```

All four operations (SELECT/INSERT/UPDATE/DELETE) have a policy on every table. **Do not rely on service-role access from the client** — the anon key is constrained by these policies, which is the authorization boundary.

---

## App ↔ DB Type Mapping

- DB row types live in `src/types/database.ts` (auto-generated via `npx supabase gen types typescript --project-id …`). They use `snake_case`.
- App-level types live in `src/types/index.ts` and `src/types/seatingChart.ts`. They use `camelCase`.
- Transform at the context/hook boundary — never let a `snake_case` field leak into a component. Seating types have explicit `dbToSeatingChart` / `dbToSeatingGroup` / `dbToRoomElement` / `dbToLayoutPreset` helpers. Core types (classroom, student, behavior, transaction) are transformed inline in hooks.

> Note: `src/types/index.ts` defines `Student` with `todayTotal` and `thisWeekTotal` as required fields, but the database has no such columns — these are computed at fetch time from the `get_student_time_totals` RPC and merged onto the row by `useStudents`. When writing new code that creates `Student` objects (tests, fixtures), set these to `0`.

---

## Migration Log

All 11 migrations, in order:

| #   | File                                  | Scope                                                                                     |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| 001 | `001_initial_schema.sql`              | Initial: classrooms, students, behaviors (with seed), point_transactions. Permissive RLS. |
| 002 | `002_add_user_auth.sql`               | Add `user_id` to classrooms/behaviors, drop permissive RLS, install user-scoped policies. |
| 003 | `003_sync_default_behaviors.sql`      | Reseed default behaviors (14 rows) to match `localStorage` defaults.                      |
| 004 | `004_enable_realtime.sql`             | Add classrooms/students/behaviors/point_transactions to `supabase_realtime`.              |
| 005 | `005_replica_identity_full.sql`       | `REPLICA IDENTITY FULL` on point_transactions + students.                                 |
| 006 | `006_add_batch_id.sql`                | Add `batch_id` to point_transactions for class-wide undo.                                 |
| 007 | `007_add_sound_settings.sql`          | `user_sound_settings` table + RLS + trigger + realtime.                                   |
| 008 | `008_add_seating_charts.sql`          | Seating chart suite (4 tables) + `room_elements` + `layout_presets` + 3 triggers.         |
| 009 | `009_fix_room_element_dimensions.sql` | Backfill element dimensions to match 40px grid; update defaults.                          |
| 010 | `010_add_room_element_types.sql`      | Extend `room_element_type` enum with window/countertop/sink.                              |
| 011 | `011_add_student_point_totals.sql`    | Add denormalized totals to students + trigger + `get_student_time_totals` RPC + indexes.  |

**Next migration number:** `012_*.sql` (zero-padded sequential prefix — increment from the last file).
