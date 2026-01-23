# Data Models - ClassPoints

## Overview

ClassPoints uses PostgreSQL via Supabase BaaS with 10 tables organized into 3 domains:

- **Core Domain** - Classrooms, students, behaviors, and point transactions
- **Seating Domain** - Seating charts, groups, seats, and room elements
- **Settings Domain** - User preferences and layout presets

## Database Schema

### Core Tables

#### classrooms

Primary entity for organizing students and tracking points.

| Column     | Type        | Constraints                   | Description                                  |
| ---------- | ----------- | ----------------------------- | -------------------------------------------- |
| id         | UUID        | PK, DEFAULT gen_random_uuid() | Unique identifier                            |
| name       | TEXT        | NOT NULL                      | Classroom display name                       |
| user_id    | UUID        | FK → auth.users               | Owner (for RLS)                              |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       | Creation timestamp                           |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       | Last modification (auto-updated via trigger) |

**Indexes:** `idx_classrooms_created_at DESC`

#### students

Individual students within classrooms with denormalized point totals.

| Column         | Type        | Constraints                           | Description                                |
| -------------- | ----------- | ------------------------------------- | ------------------------------------------ |
| id             | UUID        | PK, DEFAULT gen_random_uuid()         | Unique identifier                          |
| classroom_id   | UUID        | FK → classrooms(id) ON DELETE CASCADE | Parent classroom                           |
| name           | TEXT        | NOT NULL                              | Student display name                       |
| avatar_color   | TEXT        | NULLABLE                              | Visual distinction color                   |
| point_total    | INTEGER     | DEFAULT 0                             | Cumulative net points (trigger-maintained) |
| positive_total | INTEGER     | DEFAULT 0                             | Cumulative positive points                 |
| negative_total | INTEGER     | DEFAULT 0                             | Cumulative negative points                 |
| created_at     | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()               | Creation timestamp                         |

**Indexes:** `idx_students_classroom_id`

#### behaviors

Point behavior templates (positive and negative).

| Column     | Type                         | Constraints                                          | Description                        |
| ---------- | ---------------------------- | ---------------------------------------------------- | ---------------------------------- |
| id         | UUID                         | PK, DEFAULT gen_random_uuid()                        | Unique identifier                  |
| name       | TEXT                         | NOT NULL                                             | Behavior display name              |
| points     | INTEGER                      | CHECK (points >= -5 AND points <= 5 AND points != 0) | Point value (+1 to +5 or -1 to -5) |
| icon       | TEXT                         | NOT NULL                                             | Emoji icon                         |
| category   | ENUM('positive', 'negative') | NOT NULL                                             | Behavior type                      |
| is_custom  | BOOLEAN                      | DEFAULT true                                         | System vs user-created             |
| user_id    | UUID                         | FK → auth.users                                      | Owner (NULL = system default)      |
| created_at | TIMESTAMPTZ                  | DEFAULT NOW()                                        | Creation timestamp                 |

**Indexes:** `idx_behaviors_category`

#### point_transactions

Immutable audit log of all point awards.

| Column        | Type        | Constraints                           | Description                                      |
| ------------- | ----------- | ------------------------------------- | ------------------------------------------------ |
| id            | UUID        | PK, DEFAULT gen_random_uuid()         | Unique identifier                                |
| student_id    | UUID        | FK → students(id) ON DELETE CASCADE   | Recipient student                                |
| classroom_id  | UUID        | FK → classrooms(id) ON DELETE CASCADE | Parent classroom                                 |
| behavior_id   | UUID        | FK → behaviors(id) ON DELETE SET NULL | Source behavior (nullable for deleted behaviors) |
| behavior_name | TEXT        | NOT NULL                              | Snapshot of behavior name at award time          |
| behavior_icon | TEXT        | NOT NULL                              | Snapshot of behavior icon at award time          |
| points        | INTEGER     | NOT NULL                              | Points awarded (positive or negative)            |
| batch_id      | UUID        | NULLABLE                              | Groups class-wide awards for batch undo          |
| note          | TEXT        | NULLABLE                              | Optional teacher note                            |
| created_at    | TIMESTAMPTZ | DEFAULT NOW()                         | Award timestamp                                  |

**Indexes:** `idx_transactions_student_id`, `idx_transactions_classroom_id`, `idx_transactions_created_at DESC`, `idx_transactions_student_created`

### Seating Tables

#### seating_charts

Canvas configuration for classroom layout.

| Column        | Type        | Constraints                 | Description              |
| ------------- | ----------- | --------------------------- | ------------------------ |
| id            | UUID        | PK                          | Unique identifier        |
| classroom_id  | UUID        | FK → classrooms(id), UNIQUE | One chart per classroom  |
| name          | TEXT        | DEFAULT 'Seating Chart'     | Display name             |
| snap_enabled  | BOOLEAN     | DEFAULT true                | Grid snapping toggle     |
| grid_size     | INTEGER     | DEFAULT 20                  | Snap grid size in pixels |
| canvas_width  | INTEGER     | DEFAULT 1200                | Canvas width             |
| canvas_height | INTEGER     | DEFAULT 800                 | Canvas height            |
| created_at    | TIMESTAMPTZ | DEFAULT NOW()               | Creation timestamp       |
| updated_at    | TIMESTAMPTZ | DEFAULT NOW()               | Last modification        |

#### seating_groups

Table groupings that contain seats.

| Column           | Type        | Constraints             | Description              |
| ---------------- | ----------- | ----------------------- | ------------------------ |
| id               | UUID        | PK                      | Unique identifier        |
| seating_chart_id | UUID        | FK → seating_charts(id) | Parent chart             |
| letter           | TEXT        | NOT NULL                | Group label (A, B, C...) |
| position_x       | INTEGER     | NOT NULL                | X coordinate on canvas   |
| position_y       | INTEGER     | NOT NULL                | Y coordinate on canvas   |
| rotation         | INTEGER     | DEFAULT 0               | Rotation in degrees      |
| created_at       | TIMESTAMPTZ | DEFAULT NOW()           | Creation timestamp       |

#### seating_seats

Individual seats within groups, optionally assigned to students.

| Column            | Type        | Constraints                 | Description                   |
| ----------------- | ----------- | --------------------------- | ----------------------------- |
| id                | UUID        | PK                          | Unique identifier             |
| seating_group_id  | UUID        | FK → seating_groups(id)     | Parent group                  |
| position_in_group | INTEGER     | NOT NULL                    | Seat order within group (1-4) |
| student_id        | UUID        | FK → students(id), NULLABLE | Assigned student              |
| created_at        | TIMESTAMPTZ | DEFAULT NOW()               | Creation timestamp            |

#### room_elements

Static classroom elements (desks, doors, windows).

| Column           | Type                                                         | Constraints             | Description            |
| ---------------- | ------------------------------------------------------------ | ----------------------- | ---------------------- |
| id               | UUID                                                         | PK                      | Unique identifier      |
| seating_chart_id | UUID                                                         | FK → seating_charts(id) | Parent chart           |
| element_type     | ENUM('teacher_desk', 'door', 'window', 'countertop', 'sink') | NOT NULL                | Element type           |
| label            | TEXT                                                         | NULLABLE                | Optional display label |
| position_x       | INTEGER                                                      | NOT NULL                | X coordinate           |
| position_y       | INTEGER                                                      | NOT NULL                | Y coordinate           |
| width            | INTEGER                                                      | DEFAULT varies by type  | Element width          |
| height           | INTEGER                                                      | DEFAULT varies by type  | Element height         |
| rotation         | INTEGER                                                      | DEFAULT 0               | Rotation in degrees    |
| created_at       | TIMESTAMPTZ                                                  | DEFAULT NOW()           | Creation timestamp     |

### Settings Tables

#### user_sound_settings

Per-user sound effect preferences.

| Column              | Type        | Constraints             | Description                |
| ------------------- | ----------- | ----------------------- | -------------------------- |
| id                  | UUID        | PK                      | Unique identifier          |
| user_id             | UUID        | FK → auth.users, UNIQUE | Owner                      |
| enabled             | BOOLEAN     | DEFAULT true            | Sound effects toggle       |
| volume              | REAL        | DEFAULT 0.5             | Volume level (0.0-1.0)     |
| positive_sound      | TEXT        | DEFAULT 'chime'         | Preset for positive awards |
| negative_sound      | TEXT        | DEFAULT 'buzz'          | Preset for negative awards |
| custom_positive_url | TEXT        | NULLABLE                | Custom positive sound URL  |
| custom_negative_url | TEXT        | NULLABLE                | Custom negative sound URL  |
| created_at          | TIMESTAMPTZ | DEFAULT NOW()           | Creation timestamp         |
| updated_at          | TIMESTAMPTZ | DEFAULT NOW()           | Last modification          |

#### layout_presets

Saved seating chart layouts for reuse.

| Column      | Type        | Constraints     | Description                    |
| ----------- | ----------- | --------------- | ------------------------------ |
| id          | UUID        | PK              | Unique identifier              |
| user_id     | UUID        | FK → auth.users | Owner                          |
| name        | TEXT        | NOT NULL        | Preset display name            |
| layout_data | JSONB       | NOT NULL        | Serialized chart configuration |
| created_at  | TIMESTAMPTZ | DEFAULT NOW()   | Creation timestamp             |

## Entity Relationships

```
classrooms (1) ─────────────────────┬──── (N) students
    │                               │         │
    │                               │         └──── (N) point_transactions
    │                               │
    └──── (1) seating_charts ───────┼──── (N) seating_groups ──── (N) seating_seats
                                    │                                    │
                                    │                                    └───► students
                                    │
                                    └──── (N) room_elements

behaviors (1) ──────────────────────────── (N) point_transactions

auth.users (1) ─────┬──── (N) classrooms
                    ├──── (N) behaviors (custom only)
                    ├──── (1) user_sound_settings
                    └──── (N) layout_presets
```

## Database Functions

### get_student_time_totals

Calculates today and this-week point totals for students.

```sql
get_student_time_totals(
  p_classroom_id: UUID,
  p_start_of_today: TIMESTAMPTZ,
  p_start_of_week: TIMESTAMPTZ
) RETURNS TABLE(student_id UUID, today_total INT, this_week_total INT)
```

## Row Level Security (RLS)

All tables have RLS enabled. Policies enforce user-scoped access:

```sql
-- Pattern: Users can only access their own data
CREATE POLICY "Users can view own classrooms" ON classrooms
  FOR SELECT USING (user_id = auth.uid());
```

## Realtime Configuration

Tables with realtime enabled require `REPLICA IDENTITY FULL` for complete DELETE payloads:

```sql
ALTER TABLE students REPLICA IDENTITY FULL;
ALTER TABLE point_transactions REPLICA IDENTITY FULL;
ALTER TABLE seating_groups REPLICA IDENTITY FULL;
ALTER TABLE seating_seats REPLICA IDENTITY FULL;
ALTER TABLE room_elements REPLICA IDENTITY FULL;
```

## Migrations History

| Migration                           | Description                                                      |
| ----------------------------------- | ---------------------------------------------------------------- |
| 001_initial_schema.sql              | Core tables: classrooms, students, behaviors, point_transactions |
| 002_add_user_auth.sql               | Added user_id columns and RLS policies                           |
| 003_sync_default_behaviors.sql      | Seed default behaviors                                           |
| 004_enable_realtime.sql             | Enabled realtime subscriptions                                   |
| 005_replica_identity_full.sql       | REPLICA IDENTITY for DELETE events                               |
| 006_add_batch_id.sql                | Batch ID for class-wide undo                                     |
| 007_add_sound_settings.sql          | User sound preferences                                           |
| 008_add_seating_charts.sql          | Seating chart domain                                             |
| 009_fix_room_element_dimensions.sql | Room element size defaults                                       |
| 010_add_room_element_types.sql      | Additional element types                                         |
| 011_add_student_point_totals.sql    | Denormalized point totals with triggers                          |
