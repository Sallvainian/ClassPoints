---
paths:
  - 'supabase/migrations/**/*.sql'
---

# Database Migration Patterns

---

## File Naming

**Format:** `{number}_{description}.sql`

Examples:

- `008_add_seating_charts.sql`
- `011_add_student_point_totals.sql`

Increment the number from the last migration file.

---

## Migration Structure

```sql
-- Migration: 012_description_here
-- Description: Brief explanation of what this migration does

-- ============================================
-- 1. SECTION NAME
-- ============================================
-- SQL statements...
```

Use numbered sections with clear headers for readability.

---

## New Table Checklist

Every new table MUST have:

1. **Primary Key:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
2. **Foreign Keys:** All relationships with `ON DELETE CASCADE` where appropriate
3. **Timestamps:** `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
4. **Indexes:** On foreign keys and frequently queried columns
5. **RLS Enabled:** `ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;`
6. **RLS Policies:** For SELECT, INSERT, UPDATE, DELETE
7. **Replica Identity:** For realtime (see below)

### Table Template

```sql
CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_name_user ON table_name(user_id);

ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

---

## RLS Policy Templates

### Direct user_id ownership

```sql
CREATE POLICY "Users see own data"
  ON table_name FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users create own data"
  ON table_name FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own data"
  ON table_name FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own data"
  ON table_name FOR DELETE
  USING (user_id = auth.uid());
```

### Via parent table (e.g., students via classrooms)

```sql
CREATE POLICY "Users see students in own classrooms"
  ON students FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM classrooms
    WHERE classrooms.id = students.classroom_id
    AND classrooms.user_id = auth.uid()
  ));
```

---

## Realtime Support

For tables that need realtime updates:

```sql
-- Set REPLICA IDENTITY FULL for realtime DELETE events
ALTER TABLE table_name REPLICA IDENTITY FULL;
```

**Required for:** Any table using `useRealtimeSubscription` hook.

---

## Trigger Functions

### Auto-update timestamp

```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timestamp
  BEFORE UPDATE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
```

### Update denormalized totals

```sql
CREATE OR REPLACE FUNCTION update_student_point_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE students SET
      point_total = point_total + NEW.points
    WHERE id = NEW.student_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE students SET
      point_total = point_total - OLD.points
    WHERE id = OLD.student_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

---

## RPC Functions

For complex queries the client shouldn't build:

```sql
CREATE OR REPLACE FUNCTION get_student_time_totals(
  p_classroom_id UUID,
  p_start_of_today TIMESTAMPTZ
)
RETURNS TABLE (
  student_id UUID,
  today_total INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.student_id,
    COALESCE(SUM(pt.points)::INTEGER, 0) AS today_total
  FROM point_transactions pt
  WHERE pt.classroom_id = p_classroom_id
    AND pt.created_at >= p_start_of_today
  GROUP BY pt.student_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Column Modifications

```sql
-- Add column with default
ALTER TABLE students
ADD COLUMN IF NOT EXISTS point_total INTEGER NOT NULL DEFAULT 0;

-- Backfill existing data
UPDATE students s SET
  point_total = COALESCE(
    (SELECT SUM(points) FROM point_transactions WHERE student_id = s.id),
    0
  );
```

---

## Anti-Patterns

- **NEVER** forget RLS policies on new tables
- **NEVER** forget indexes on foreign keys
- **NEVER** skip REPLICA IDENTITY for realtime tables
- **AVOID** complex queries in app code - use RPC functions
- **AVOID** recalculating totals on read - use triggers for denormalization

---

## Testing Migrations

```bash
# Apply locally
npx supabase db reset

# Check for errors
npx supabase db diff
```
