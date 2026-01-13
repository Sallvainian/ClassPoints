# ClassPoints Data Models

## Overview

ClassPoints uses a relational data model stored in Supabase (PostgreSQL). All tables have Row Level Security (RLS) enabled for multi-tenant isolation.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 Core Entities                                    │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐            │
│  │   Classroom  │         │   Student    │         │  Behavior    │            │
│  ├──────────────┤         ├──────────────┤         ├──────────────┤            │
│  │ id (PK)      │◄───────┐│ id (PK)      │         │ id (PK)      │            │
│  │ user_id (FK) │        ││ classroom_id ├────────▶│ user_id (FK) │            │
│  │ name         │        ││ name         │         │ name         │            │
│  │ created_at   │        ││ avatar_color │         │ points       │            │
│  │ updated_at   │        ││ created_at   │         │ icon         │            │
│  └──────────────┘        │└──────────────┘         │ category     │            │
│         │                │        │                │ is_custom    │            │
│         │                │        │                └──────────────┘            │
│         │                │        │                       │                    │
│         ▼                │        ▼                       ▼                    │
│  ┌──────────────────────────────────────────────────────────────┐              │
│  │                      PointTransaction                        │              │
│  ├──────────────────────────────────────────────────────────────┤              │
│  │ id, student_id (FK), classroom_id (FK), behavior_id (FK)     │              │
│  │ behavior_name, behavior_icon, points, note, batch_id         │              │
│  └──────────────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Seating Chart Feature                                 │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐            │
│  │  SeatingChart  │      │  SeatingGroup  │      │   SeatingSeat  │            │
│  ├────────────────┤      ├────────────────┤      ├────────────────┤            │
│  │ id (PK)        │◄─────│ chart_id (FK)  │◄─────│ group_id (FK)  │            │
│  │ classroom_id   │      │ position_x     │      │ position       │            │
│  │ name           │      │ position_y     │      │ student_id(FK) │────┐       │
│  │ is_active      │      │ rotation       │      │ created_at     │    │       │
│  └────────────────┘      └────────────────┘      └────────────────┘    │       │
│         │                                                              │       │
│         │  ┌────────────────┐      ┌────────────────┐                  │       │
│         │  │  RoomElement   │      │  LayoutPreset  │                  │       │
│         │  ├────────────────┤      ├────────────────┤                  │       │
│         └─▶│ chart_id (FK)  │      │ id (PK)        │                  │       │
│            │ type           │      │ user_id (FK)   │                  │       │
│            │ position_x/y   │      │ name           │                  │       │
│            │ width/height   │      │ groups_config  │                  │       │
│            │ rotation       │      │ elements_config│                  │       │
│            └────────────────┘      └────────────────┘                  │       │
│                                                        links to students ◄─────┘
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              User Settings                                       │
│  ┌────────────────┐                                                             │
│  │ SoundSettings  │                                                             │
│  ├────────────────┤                                                             │
│  │ id (PK)        │                                                             │
│  │ user_id (FK)   │ ◄── auth.users                                              │
│  │ enabled        │                                                             │
│  │ volume         │                                                             │
│  │ positive_sound │                                                             │
│  │ negative_sound │                                                             │
│  └────────────────┘                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Database Tables

### classrooms

Represents a classroom or class period.

| Column       | Type          | Constraints                             | Description                            |
| ------------ | ------------- | --------------------------------------- | -------------------------------------- |
| `id`         | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier                      |
| `user_id`    | `uuid`        | NOT NULL, FK → auth.users               | Owner of the classroom                 |
| `name`       | `text`        | NOT NULL                                | Display name (e.g., "3rd Period Math") |
| `created_at` | `timestamptz` | DEFAULT now()                           | Creation timestamp                     |
| `updated_at` | `timestamptz` | DEFAULT now()                           | Last update timestamp                  |

**RLS Policies:**

- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

### students

Represents a student within a classroom.

| Column         | Type          | Constraints                                    | Description                            |
| -------------- | ------------- | ---------------------------------------------- | -------------------------------------- |
| `id`           | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4()        | Unique identifier                      |
| `classroom_id` | `uuid`        | NOT NULL, FK → classrooms.id ON DELETE CASCADE | Parent classroom                       |
| `name`         | `text`        | NOT NULL                                       | Student display name                   |
| `avatar_color` | `text`        |                                                | Hex color for avatar (e.g., "#FF6B6B") |
| `created_at`   | `timestamptz` | DEFAULT now()                                  | Creation timestamp                     |

**RLS Policies:**

- SELECT/INSERT/UPDATE/DELETE: via classroom ownership check

### behaviors

Represents a behavior template (positive or negative).

| Column       | Type          | Constraints                             | Description                     |
| ------------ | ------------- | --------------------------------------- | ------------------------------- |
| `id`         | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier               |
| `user_id`    | `uuid`        | FK → auth.users                         | Owner (NULL for defaults)       |
| `name`       | `text`        | NOT NULL                                | Behavior name (e.g., "On Task") |
| `points`     | `integer`     | NOT NULL                                | Points value (+/- integer)      |
| `icon`       | `text`        | NOT NULL                                | Emoji icon (e.g., "📚")         |
| `category`   | `text`        | NOT NULL                                | "positive" or "negative"        |
| `is_custom`  | `boolean`     | DEFAULT false                           | User-created vs system default  |
| `created_at` | `timestamptz` | DEFAULT now()                           | Creation timestamp              |

**RLS Policies:**

- SELECT: `user_id = auth.uid() OR user_id IS NULL` (include system defaults)
- INSERT/UPDATE/DELETE: `user_id = auth.uid()`

### point_transactions

Records each point award/deduction event.

| Column          | Type          | Constraints                                    | Description                                        |
| --------------- | ------------- | ---------------------------------------------- | -------------------------------------------------- |
| `id`            | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4()        | Unique identifier                                  |
| `student_id`    | `uuid`        | NOT NULL, FK → students.id ON DELETE CASCADE   | Recipient student                                  |
| `classroom_id`  | `uuid`        | NOT NULL, FK → classrooms.id ON DELETE CASCADE | Parent classroom                                   |
| `behavior_id`   | `uuid`        | FK → behaviors.id ON DELETE SET NULL           | Original behavior (nullable for deleted behaviors) |
| `user_id`       | `uuid`        | NOT NULL, FK → auth.users                      | User who awarded points                            |
| `behavior_name` | `text`        | NOT NULL                                       | Denormalized behavior name (preserved history)     |
| `behavior_icon` | `text`        | NOT NULL                                       | Denormalized icon (preserved history)              |
| `points`        | `integer`     | NOT NULL                                       | Points awarded (+/-)                               |
| `note`          | `text`        |                                                | Optional note                                      |
| `batch_id`      | `uuid`        |                                                | Groups class-wide awards for batch undo            |
| `created_at`    | `timestamptz` | DEFAULT now()                                  | Award timestamp                                    |

**Special Configuration:**

- `REPLICA IDENTITY FULL` for complete DELETE event payloads in Realtime

**RLS Policies:**

- SELECT/INSERT/UPDATE/DELETE: via classroom ownership check

### sound_settings

User sound effect preferences.

| Column           | Type          | Constraints                             | Description                  |
| ---------------- | ------------- | --------------------------------------- | ---------------------------- |
| `id`             | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier            |
| `user_id`        | `uuid`        | NOT NULL, UNIQUE, FK → auth.users       | User reference               |
| `enabled`        | `boolean`     | DEFAULT true                            | Sound effects enabled        |
| `volume`         | `float`       | DEFAULT 0.7                             | Volume level (0.0-1.0)       |
| `positive_sound` | `text`        | DEFAULT 'chime'                         | Sound for positive behaviors |
| `negative_sound` | `text`        | DEFAULT 'buzz'                          | Sound for negative behaviors |
| `created_at`     | `timestamptz` | DEFAULT now()                           | Creation timestamp           |
| `updated_at`     | `timestamptz` | DEFAULT now()                           | Last update timestamp        |

**RLS Policies:**

- SELECT/INSERT/UPDATE: `user_id = auth.uid()`

---

## Seating Chart Tables

### seating_charts

Main seating chart entity (one per classroom).

| Column         | Type          | Constraints                                            | Description           |
| -------------- | ------------- | ------------------------------------------------------ | --------------------- |
| `id`           | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4()                | Unique identifier     |
| `classroom_id` | `uuid`        | NOT NULL, UNIQUE, FK → classrooms.id ON DELETE CASCADE | Parent classroom      |
| `user_id`      | `uuid`        | NOT NULL, FK → auth.users                              | Owner                 |
| `name`         | `text`        | DEFAULT 'Main'                                         | Chart name            |
| `is_active`    | `boolean`     | DEFAULT true                                           | Active chart flag     |
| `created_at`   | `timestamptz` | DEFAULT now()                                          | Creation timestamp    |
| `updated_at`   | `timestamptz` | DEFAULT now()                                          | Last update timestamp |

**Constraints:**

- UNIQUE on `classroom_id` (one active chart per classroom)

**RLS Policies:**

- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

### seating_groups

Table groups (4-seat clusters) within a seating chart.

| Column       | Type          | Constraints                                        | Description         |
| ------------ | ------------- | -------------------------------------------------- | ------------------- |
| `id`         | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4()            | Unique identifier   |
| `chart_id`   | `uuid`        | NOT NULL, FK → seating_charts.id ON DELETE CASCADE | Parent chart        |
| `position_x` | `float`       | NOT NULL, DEFAULT 100                              | X coordinate        |
| `position_y` | `float`       | NOT NULL, DEFAULT 100                              | Y coordinate        |
| `rotation`   | `float`       | NOT NULL, DEFAULT 0                                | Rotation in degrees |
| `created_at` | `timestamptz` | DEFAULT now()                                      | Creation timestamp  |

**Triggers:**

- `auto_create_seats_trigger`: Automatically creates 4 seats when group is inserted

**RLS Policies:**

- SELECT/INSERT/UPDATE/DELETE: via chart ownership check

### seating_seats

Individual seats within a group (4 per group).

| Column       | Type          | Constraints                                        | Description                                                            |
| ------------ | ------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `id`         | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4()            | Unique identifier                                                      |
| `group_id`   | `uuid`        | NOT NULL, FK → seating_groups.id ON DELETE CASCADE | Parent group                                                           |
| `position`   | `integer`     | NOT NULL, CHECK (0-3)                              | Seat position (0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right) |
| `student_id` | `uuid`        | FK → students.id ON DELETE SET NULL                | Assigned student                                                       |
| `created_at` | `timestamptz` | DEFAULT now()                                      | Creation timestamp                                                     |

**Constraints:**

- UNIQUE on `(group_id, position)` - one seat per position
- CHECK on `position` - must be 0, 1, 2, or 3

**Triggers:**

- `enforce_single_seat_trigger`: Ensures each student is assigned to only one seat per chart

**RLS Policies:**

- SELECT/INSERT/UPDATE/DELETE: via chart ownership check

### room_elements

Static room elements (teacher desk, doors, windows).

| Column       | Type          | Constraints                                        | Description                                                                          |
| ------------ | ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`         | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4()            | Unique identifier                                                                    |
| `chart_id`   | `uuid`        | NOT NULL, FK → seating_charts.id ON DELETE CASCADE | Parent chart                                                                         |
| `type`       | `text`        | NOT NULL                                           | Element type: 'teacher_desk', 'door', 'window', 'whiteboard', 'cabinet', 'bookshelf' |
| `position_x` | `float`       | NOT NULL, DEFAULT 50                               | X coordinate                                                                         |
| `position_y` | `float`       | NOT NULL, DEFAULT 50                               | Y coordinate                                                                         |
| `width`      | `float`       | NOT NULL, DEFAULT 120                              | Width in pixels                                                                      |
| `height`     | `float`       | NOT NULL, DEFAULT 60                               | Height in pixels                                                                     |
| `rotation`   | `float`       | NOT NULL, DEFAULT 0                                | Rotation in degrees                                                                  |
| `created_at` | `timestamptz` | DEFAULT now()                                      | Creation timestamp                                                                   |

**RLS Policies:**

- SELECT/INSERT/UPDATE/DELETE: via chart ownership check

### layout_presets

Saved layout templates for reuse.

| Column            | Type          | Constraints                             | Description                        |
| ----------------- | ------------- | --------------------------------------- | ---------------------------------- |
| `id`              | `uuid`        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier                  |
| `user_id`         | `uuid`        | NOT NULL, FK → auth.users               | Owner                              |
| `name`            | `text`        | NOT NULL                                | Preset name                        |
| `groups_config`   | `jsonb`       | NOT NULL                                | Array of group positions/rotations |
| `elements_config` | `jsonb`       | NOT NULL                                | Array of element configurations    |
| `is_system`       | `boolean`     | DEFAULT false                           | System-provided preset             |
| `created_at`      | `timestamptz` | DEFAULT now()                           | Creation timestamp                 |

**RLS Policies:**

- SELECT: `user_id = auth.uid() OR is_system = true`
- INSERT/UPDATE/DELETE: `user_id = auth.uid()`

---

## TypeScript Types

### Domain Types (src/types/index.ts)

```typescript
export type BehaviorCategory = 'positive' | 'negative';

export interface Behavior {
  id: string;
  name: string;
  points: number;
  icon: string;
  category: BehaviorCategory;
  isCustom: boolean;
  createdAt: number;
}

export interface Student {
  id: string;
  name: string;
  avatarColor?: string;
}

export interface Classroom {
  id: string;
  name: string;
  students: Student[];
  createdAt: number;
  updatedAt: number;
  pointTotal?: number;
}

export interface PointTransaction {
  id: string;
  studentId: string;
  classroomId: string;
  behaviorId: string;
  behaviorName: string;
  behaviorIcon: string;
  points: number;
  timestamp: number;
  note?: string;
}
```

### Seating Chart Types (src/types/seatingChart.ts)

```typescript
export type RoomElementType =
  | 'teacher_desk'
  | 'door'
  | 'window'
  | 'whiteboard'
  | 'cabinet'
  | 'bookshelf';

export interface SeatingSeat {
  id: string;
  groupId: string;
  position: 0 | 1 | 2 | 3; // 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
  studentId: string | null;
  createdAt: string;
}

export interface SeatingGroup {
  id: string;
  chartId: string;
  positionX: number;
  positionY: number;
  rotation: number;
  createdAt: string;
  seats: SeatingSeat[];
}

export interface RoomElement {
  id: string;
  chartId: string;
  type: RoomElementType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  createdAt: string;
}

export interface SeatingChart {
  id: string;
  classroomId: string;
  userId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  groups: SeatingGroup[];
  roomElements: RoomElement[];
}

export interface LayoutPreset {
  id: string;
  userId: string;
  name: string;
  groupsConfig: Array<{ positionX: number; positionY: number; rotation: number }>;
  elementsConfig: Array<{
    type: RoomElementType;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    rotation: number;
  }>;
  isSystem: boolean;
  createdAt: string;
}

// Helper functions for seat position management
export function getSeatLabel(position: 0 | 1 | 2 | 3): string;
export function getDefaultElementDimensions(type: RoomElementType): {
  width: number;
  height: number;
};
```

### Database Types (src/types/database.ts)

Auto-generated from Supabase schema:

```typescript
export interface Database {
  public: {
    Tables: {
      classrooms: {
        Row: { id: string; user_id: string; name: string; created_at: string; updated_at: string; };
        Insert: { ... };
        Update: { ... };
      };
      students: {
        Row: { id: string; classroom_id: string; name: string; avatar_color: string | null; created_at: string; };
        Insert: { ... };
        Update: { ... };
      };
      behaviors: {
        Row: { id: string; user_id: string | null; name: string; points: number; icon: string; category: string; is_custom: boolean; created_at: string; };
        Insert: { ... };
        Update: { ... };
      };
      point_transactions: {
        Row: { id: string; student_id: string; classroom_id: string; behavior_id: string | null; user_id: string; behavior_name: string; behavior_icon: string; points: number; note: string | null; batch_id: string | null; created_at: string; };
        Insert: { ... };
        Update: { ... };
      };
    };
  };
}
```

## Default Behaviors

The app includes pre-defined behavior templates:

### Positive Behaviors

| Name            | Points | Icon |
| --------------- | ------ | ---- |
| On Task         | +1     | 📚   |
| Helping Others  | +2     | 🤝   |
| Great Effort    | +2     | 💪   |
| Participation   | +1     | ✋   |
| Excellent Work  | +3     | ⭐   |
| Being Kind      | +2     | ❤️   |
| Following Rules | +1     | ✅   |
| Working Quietly | +1     | 🤫   |

### Negative Behaviors

| Name                | Points | Icon |
| ------------------- | ------ | ---- |
| Off Task            | -1     | 😴   |
| Disruptive          | -2     | 🔊   |
| Unprepared          | -1     | 📝   |
| Unkind Words        | -2     | 💬   |
| Not Following Rules | -1     | 🚫   |
| Late                | -1     | ⏰   |

## Data Access Patterns

### Reading Data

```typescript
// Get classrooms with students
const { data } = await supabase
  .from('classrooms')
  .select(
    `
    *,
    students (*)
  `
  )
  .order('created_at', { ascending: false });
```

### Realtime Subscriptions

```typescript
// Subscribe to point transactions for a classroom
supabase
  .channel('transactions')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'point_transactions',
      filter: `classroom_id=eq.${classroomId}`,
    },
    (payload) => handleChange(payload)
  )
  .subscribe();
```

### Batch Operations

```typescript
// Class-wide award with batch_id for undo
const batchId = uuidv4();
const inserts = students.map((student) => ({
  student_id: student.id,
  classroom_id,
  behavior_id,
  batch_id,
  // ... other fields
}));

await supabase.from('point_transactions').insert(inserts);

// Batch undo
await supabase.from('point_transactions').delete().eq('batch_id', batchId);
```

## Migration Support

The app supports migrating from localStorage to Supabase:

1. **Detection**: `hasLocalStorageData()` checks for existing data
2. **Preview**: `getMigrationSummary()` counts entities
3. **Migration**: `migrateToSupabase()` transfers data with progress callbacks
4. **Cleanup**: `clearLocalStorageAfterMigration()` removes old data

This enables smooth transitions for existing users when Supabase is enabled.
