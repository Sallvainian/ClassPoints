# ClassPoints Data Models

## Overview

ClassPoints uses a relational data model stored in Supabase (PostgreSQL). All 5 tables have Row Level Security (RLS) enabled for multi-tenant isolation.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐  │
│    │   Classroom  │         │   Student    │         │  Behavior    │  │
│    ├──────────────┤         ├──────────────┤         ├──────────────┤  │
│    │ id (PK)      │◄───────┐│ id (PK)      │         │ id (PK)      │  │
│    │ user_id (FK) │        ││ classroom_id ├────────▶│ user_id (FK) │  │
│    │ name         │        ││ name         │         │ name         │  │
│    │ created_at   │        ││ avatar_color │         │ points       │  │
│    │ updated_at   │        ││ created_at   │         │ icon         │  │
│    └──────────────┘        │└──────────────┘         │ category     │  │
│           │                │        │                │ is_custom    │  │
│           │                │        │                │ created_at   │  │
│           │                │        │                └──────────────┘  │
│           │                │        │                       │          │
│           ▼                │        ▼                       ▼          │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                      PointTransaction                        │    │
│    ├──────────────────────────────────────────────────────────────┤    │
│    │ id (PK)                                                      │    │
│    │ student_id (FK) ──────────────────────────────────────────┘  │    │
│    │ classroom_id (FK) ────────────────────────────────────┘      │    │
│    │ behavior_id (FK) ─────────────────────────────────────────┘  │    │
│    │ user_id (FK)                                                 │    │
│    │ behavior_name     (denormalized for history)                 │    │
│    │ behavior_icon     (denormalized for history)                 │    │
│    │ points                                                       │    │
│    │ note                                                         │    │
│    │ batch_id          (for class-wide undo)                      │    │
│    │ created_at                                                   │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
│    ┌──────────────────────┐                                            │
│    │  UserSoundSettings   │                                            │
│    ├──────────────────────┤                                            │
│    │ id (PK)              │                                            │
│    │ user_id (FK, UNIQUE) │                                            │
│    │ enabled              │                                            │
│    │ volume               │                                            │
│    │ positive_sound_url   │                                            │
│    │ negative_sound_url   │                                            │
│    │ created_at           │                                            │
│    │ updated_at           │                                            │
│    └──────────────────────┘                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Tables

### classrooms

Represents a classroom or class period.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| `user_id` | `uuid` | NOT NULL, FK → auth.users | Owner of the classroom |
| `name` | `text` | NOT NULL | Display name (e.g., "3rd Period Math") |
| `created_at` | `timestamptz` | DEFAULT now() | Creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT now() | Last update timestamp |

**RLS Policies:**
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

### students

Represents a student within a classroom.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| `classroom_id` | `uuid` | NOT NULL, FK → classrooms.id ON DELETE CASCADE | Parent classroom |
| `name` | `text` | NOT NULL | Student display name |
| `avatar_color` | `text` | | Hex color for avatar (e.g., "#FF6B6B") |
| `created_at` | `timestamptz` | DEFAULT now() | Creation timestamp |

**RLS Policies:**
- SELECT/INSERT/UPDATE/DELETE: via classroom ownership check

### behaviors

Represents a behavior template (positive or negative).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| `user_id` | `uuid` | FK → auth.users | Owner (NULL for defaults) |
| `name` | `text` | NOT NULL | Behavior name (e.g., "On Task") |
| `points` | `integer` | NOT NULL | Points value (+/- integer) |
| `icon` | `text` | NOT NULL | Emoji icon (e.g., "📚") |
| `category` | `text` | NOT NULL | "positive" or "negative" |
| `is_custom` | `boolean` | DEFAULT false | User-created vs system default |
| `created_at` | `timestamptz` | DEFAULT now() | Creation timestamp |

**RLS Policies:**
- SELECT: `user_id = auth.uid() OR user_id IS NULL` (include system defaults)
- INSERT/UPDATE/DELETE: `user_id = auth.uid()`

### point_transactions

Records each point award/deduction event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| `student_id` | `uuid` | NOT NULL, FK → students.id ON DELETE CASCADE | Recipient student |
| `classroom_id` | `uuid` | NOT NULL, FK → classrooms.id ON DELETE CASCADE | Parent classroom |
| `behavior_id` | `uuid` | FK → behaviors.id ON DELETE SET NULL | Original behavior (nullable for deleted behaviors) |
| `user_id` | `uuid` | NOT NULL, FK → auth.users | User who awarded points |
| `behavior_name` | `text` | NOT NULL | Denormalized behavior name (preserved history) |
| `behavior_icon` | `text` | NOT NULL | Denormalized icon (preserved history) |
| `points` | `integer` | NOT NULL | Points awarded (+/-) |
| `note` | `text` | | Optional note |
| `batch_id` | `uuid` | | Groups class-wide awards for batch undo |
| `created_at` | `timestamptz` | DEFAULT now() | Award timestamp |

**Special Configuration:**
- `REPLICA IDENTITY FULL` for complete DELETE event payloads in Realtime

**RLS Policies:**
- SELECT/INSERT/UPDATE/DELETE: via classroom ownership check

### user_sound_settings

Stores user preferences for sound effects (added in migration 007).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| `user_id` | `uuid` | NOT NULL UNIQUE, FK → auth.users | User this setting belongs to |
| `enabled` | `boolean` | DEFAULT true | Master sound toggle |
| `volume` | `numeric` | DEFAULT 0.7 | Volume level (0.0 to 1.0) |
| `positive_sound_url` | `text` | | Custom URL for positive sound |
| `negative_sound_url` | `text` | | Custom URL for negative sound |
| `created_at` | `timestamptz` | DEFAULT now() | Creation timestamp |
| `updated_at` | `timestamptz` | DEFAULT now() | Last update timestamp |

**RLS Policies:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- One row per user (enforced by UNIQUE constraint on user_id)
- Sound URLs are validated on the client side for safety
- Default sounds are Web Audio API synthesized (no external URLs needed)

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
| Name | Points | Icon |
|------|--------|------|
| On Task | +1 | 📚 |
| Helping Others | +2 | 🤝 |
| Great Effort | +2 | 💪 |
| Participation | +1 | ✋ |
| Excellent Work | +3 | ⭐ |
| Being Kind | +2 | ❤️ |
| Following Rules | +1 | ✅ |
| Working Quietly | +1 | 🤫 |

### Negative Behaviors
| Name | Points | Icon |
|------|--------|------|
| Off Task | -1 | 😴 |
| Disruptive | -2 | 🔊 |
| Unprepared | -1 | 📝 |
| Unkind Words | -2 | 💬 |
| Not Following Rules | -1 | 🚫 |
| Late | -1 | ⏰ |

## Data Access Patterns

### Reading Data

```typescript
// Get classrooms with students
const { data } = await supabase
  .from('classrooms')
  .select(`
    *,
    students (*)
  `)
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
      filter: `classroom_id=eq.${classroomId}`
    },
    (payload) => handleChange(payload)
  )
  .subscribe();
```

### Batch Operations

```typescript
// Class-wide award with batch_id for undo
const batchId = uuidv4();
const inserts = students.map(student => ({
  student_id: student.id,
  classroom_id,
  behavior_id,
  batch_id,
  // ... other fields
}));

await supabase.from('point_transactions').insert(inserts);

// Batch undo
await supabase
  .from('point_transactions')
  .delete()
  .eq('batch_id', batchId);
```

## Migration Support

The app supports migrating from localStorage to Supabase:

1. **Detection**: `hasLocalStorageData()` checks for existing data
2. **Preview**: `getMigrationSummary()` counts entities
3. **Migration**: `migrateToSupabase()` transfers data with progress callbacks
4. **Cleanup**: `clearLocalStorageAfterMigration()` removes old data

This enables smooth transitions for existing users when Supabase is enabled.
