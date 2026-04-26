# ClassPoints Data Models

_Generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

## Overview

ClassPoints uses Supabase Postgres as the source of truth. The current schema is defined by
11 migrations in `supabase/migrations/` and typed in `src/types/database.ts`.

Scan totals:

| Item                               | Count |
| ---------------------------------- | ----: |
| Public tables                      |    10 |
| Enums                              |     2 |
| RPC functions exposed in app types |     1 |
| Trigger functions                  |     8 |
| Triggers                           |    10 |
| RLS policies                       |    43 |
| Indexes                            |    20 |

## Tables

### `classrooms`

Teacher-owned classroom containers.

| Column       | Notes                                                |
| ------------ | ---------------------------------------------------- |
| `id`         | UUID primary key, generated                          |
| `name`       | Required text                                        |
| `created_at` | Timestamp default `now()`                            |
| `updated_at` | Timestamp maintained by trigger                      |
| `user_id`    | Nullable UUID FK to `auth.users(id)`, cascade delete |

Indexes: `idx_classrooms_created_at`, `idx_classrooms_user_id`.

### `students`

Students belong to classrooms. Lifetime point totals are stored on the row and maintained by
`point_transactions` triggers.

| Column           | Notes                                           |
| ---------------- | ----------------------------------------------- |
| `id`             | UUID primary key                                |
| `classroom_id`   | Required FK to `classrooms(id)`, cascade delete |
| `name`           | Required text                                   |
| `avatar_color`   | Optional text                                   |
| `created_at`     | Timestamp default `now()`                       |
| `point_total`    | Trigger-maintained lifetime total               |
| `positive_total` | Trigger-maintained positive total               |
| `negative_total` | Trigger-maintained negative total               |

Indexes: `idx_students_classroom_id`.

### `behaviors`

Behavior templates used to create point transactions. Default behaviors have `user_id IS NULL`.
Custom behaviors are user-owned.

| Column       | Notes                           |
| ------------ | ------------------------------- |
| `id`         | UUID primary key                |
| `name`       | Required text                   |
| `points`     | Integer, -5..5 excluding 0      |
| `icon`       | Required text                   |
| `category`   | `behavior_category` enum        |
| `is_custom`  | Boolean, default true           |
| `created_at` | Timestamp default `now()`       |
| `user_id`    | Optional FK to `auth.users(id)` |

Indexes: `idx_behaviors_category`, `idx_behaviors_user_id`.

### `point_transactions`

Append-style behavior history. Insert/delete events drive student lifetime totals through a trigger.

| Column          | Notes                                                       |
| --------------- | ----------------------------------------------------------- |
| `id`            | UUID primary key                                            |
| `student_id`    | Required FK to `students(id)`, cascade delete               |
| `classroom_id`  | Required FK to `classrooms(id)`, cascade delete             |
| `behavior_id`   | Optional FK to `behaviors(id)`, set null on behavior delete |
| `behavior_name` | Snapshot text                                               |
| `behavior_icon` | Snapshot text                                               |
| `points`        | Required integer                                            |
| `note`          | Optional text                                               |
| `created_at`    | Timestamp default `now()`                                   |
| `batch_id`      | Optional UUID for grouped class/subset awards               |

Indexes: `idx_transactions_student_id`, `idx_transactions_classroom_id`,
`idx_transactions_created_at`, `idx_transactions_student_created`,
`idx_point_transactions_batch_id`, `idx_transactions_classroom_created`.

### `user_sound_settings`

Per-user sound preferences.

| Column                | Notes                                   |
| --------------------- | --------------------------------------- |
| `id`                  | UUID primary key                        |
| `user_id`             | Required FK to `auth.users(id)`, unique |
| `enabled`             | Boolean default true                    |
| `volume`              | Float 0.0..1.0 default 0.7              |
| `positive_sound`      | Built-in positive sound id              |
| `negative_sound`      | Built-in negative sound id              |
| `custom_positive_url` | Optional URL                            |
| `custom_negative_url` | Optional URL                            |
| `created_at`          | Timestamp                               |
| `updated_at`          | Timestamp maintained by trigger         |

Indexes: `idx_user_sound_settings_user_id`.

### `seating_charts`

One seating chart per classroom.

| Column          | Notes                                                   |
| --------------- | ------------------------------------------------------- |
| `id`            | UUID primary key                                        |
| `classroom_id`  | Required FK to `classrooms(id)`, unique, cascade delete |
| `name`          | Text default `Seating Chart`                            |
| `snap_enabled`  | Boolean default true                                    |
| `grid_size`     | Integer default 40                                      |
| `canvas_width`  | Integer default 1200 in DB                              |
| `canvas_height` | Integer default 800                                     |
| `created_at`    | Timestamp                                               |
| `updated_at`    | Timestamp maintained by trigger                         |

Application default width in `src/types/seatingChart.ts` is 1600, so code and DB defaults differ.

### `seating_groups`

Lettered table groups in a seating chart.

| Column                     | Notes                                               |
| -------------------------- | --------------------------------------------------- |
| `id`                       | UUID primary key                                    |
| `seating_chart_id`         | Required FK to `seating_charts(id)`, cascade delete |
| `letter`                   | Single-character label, unique per chart            |
| `position_x`, `position_y` | Required doubles                                    |
| `rotation`                 | Double default 0                                    |
| `created_at`               | Timestamp                                           |

Trigger `auto_create_group_seats` inserts four seats when a group is created.

### `seating_seats`

Four seats per seating group.

| Column              | Notes                                                     |
| ------------------- | --------------------------------------------------------- |
| `id`                | UUID primary key                                          |
| `seating_group_id`  | Required FK to `seating_groups(id)`, cascade delete       |
| `position_in_group` | Integer 1..4, unique per group                            |
| `student_id`        | Optional FK to `students(id)`, set null on student delete |
| `created_at`        | Timestamp                                                 |

Trigger `ensure_student_single_seat` prevents assigning the same student to multiple seats in
one seating chart.

### `room_elements`

Canvas objects such as teacher desk, door, window, countertop, and sink.

| Column                     | Notes                                                 |
| -------------------------- | ----------------------------------------------------- |
| `id`                       | UUID primary key                                      |
| `seating_chart_id`         | Required FK to `seating_charts(id)`, cascade delete   |
| `element_type`             | `room_element_type` enum                              |
| `label`                    | Optional text                                         |
| `position_x`, `position_y` | Required doubles                                      |
| `width`, `height`          | Doubles, default currently 120x80 after migration 009 |
| `rotation`                 | Double default 0                                      |
| `created_at`               | Timestamp                                             |

### `layout_presets`

User-owned saved seating layouts. Layout data is JSONB and stores positions/settings, not student
assignments.

| Column        | Notes                                           |
| ------------- | ----------------------------------------------- |
| `id`          | UUID primary key                                |
| `user_id`     | Required FK to `auth.users(id)`, cascade delete |
| `name`        | Required text                                   |
| `layout_data` | Required JSONB                                  |
| `created_at`  | Timestamp                                       |

## Enums

| Enum                | Values                                                 |
| ------------------- | ------------------------------------------------------ |
| `behavior_category` | `positive`, `negative`                                 |
| `room_element_type` | `teacher_desk`, `door`, `window`, `countertop`, `sink` |

## RPCs

### `get_student_time_totals`

Arguments:

- `p_classroom_id UUID`
- `p_start_of_today TIMESTAMPTZ`
- `p_start_of_week TIMESTAMPTZ`

Returns:

- `student_id UUID`
- `today_total INTEGER`
- `this_week_total INTEGER`

The function only scans transactions since `p_start_of_week`, which bounds query cost for
dashboard time-window counters.

## Triggers And Functions

| Function                           | Trigger/use                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| `update_updated_at_column`         | Updates `classrooms.updated_at`                                |
| `set_user_id`                      | Auto-fills `user_id` for `classrooms` and custom `behaviors`   |
| `update_sound_settings_updated_at` | Updates `user_sound_settings.updated_at`                       |
| `auto_create_group_seats`          | Creates four `seating_seats` after a group insert              |
| `ensure_student_single_seat`       | Blocks duplicate student assignment in a chart                 |
| `update_seating_chart_timestamp`   | Updates `seating_charts.updated_at`                            |
| `update_student_point_totals`      | Maintains student lifetime totals on transaction insert/delete |
| `get_student_time_totals`          | RPC used by `useStudents` and `useClassrooms`                  |

## RLS Model

RLS is enabled on every public table.

| Table group           | Authorization model                                                 |
| --------------------- | ------------------------------------------------------------------- |
| `classrooms`          | Direct `auth.uid() = user_id` policies                              |
| `students`            | User owns the parent classroom                                      |
| `behaviors`           | Defaults visible to all authenticated users; custom rows user-owned |
| `point_transactions`  | User owns the parent classroom                                      |
| `user_sound_settings` | Direct user ownership                                               |
| Seating chart tables  | User owns the related classroom through chart/group joins           |
| `layout_presets`      | Direct user ownership                                               |

## Realtime And Replica Identity

Migration publication history:

- `point_transactions`
- `classrooms`
- `students`
- `behaviors`
- `user_sound_settings`

Replica identity full is configured for:

- `point_transactions`
- `students`
- `user_sound_settings`

Current React code subscribes to:

- `students`
- `point_transactions`
- `layout_presets` (legacy hook; note that no migration currently adds it to the publication)

Any table whose DELETE payload is used by Realtime code needs `REPLICA IDENTITY FULL` and a fallback
path for RLS-filtered `payload.old` rows.

## Type Mapping

Database row, insert, and update types live in `src/types/database.ts`. App-facing camelCase types
live in `src/types/index.ts`.

Transforms:

| Transform              | Behavior                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `dbToBehavior`         | snake_case DB row -> app `Behavior`                         |
| `dbToClassroom`        | DB classroom plus aggregate payload -> `ClassroomWithCount` |
| `dbToStudent`          | DB student plus RPC time totals -> `StudentWithPoints`      |
| `dbToPointTransaction` | passthrough for legacy snake_case transaction consumers     |

Seating chart transforms live in `src/types/seatingChart.ts`.

## Migration Inventory

| File                                  | Purpose                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `001_initial_schema.sql`              | Core classrooms, students, behaviors, transactions, initial permissive RLS, default behaviors |
| `002_add_user_auth.sql`               | User ownership, auth-scoped RLS, `set_user_id` triggers                                       |
| `003_sync_default_behaviors.sql`      | Replaces seed behaviors with 14 defaults                                                      |
| `004_enable_realtime.sql`             | Adds initial realtime publication tables                                                      |
| `005_replica_identity_full.sql`       | Full DELETE payloads for transactions/students                                                |
| `006_add_batch_id.sql`                | Batch undo support for grouped awards                                                         |
| `007_add_sound_settings.sql`          | Sound settings table, policies, realtime                                                      |
| `008_add_seating_charts.sql`          | Seating chart schema, policies, triggers                                                      |
| `009_fix_room_element_dimensions.sql` | Room element dimension defaults                                                               |
| `010_add_room_element_types.sql`      | Window, countertop, sink enum values                                                          |
| `011_add_student_point_totals.sql`    | Stored lifetime totals, trigger, time-total RPC                                               |
