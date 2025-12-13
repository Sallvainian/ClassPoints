# Database Rules

## Table Ownership Rules

| Table                 | Ownership                                             | RLS Pattern             |
| --------------------- | ----------------------------------------------------- | ----------------------- |
| `classrooms`          | `user_id = auth.uid()`                                | Direct ownership        |
| `students`            | Via classroom                                         | Check classroom.user_id |
| `behaviors`           | `user_id IS NULL` (default) OR `user_id = auth.uid()` | Shared + Personal       |
| `point_transactions`  | Via classroom                                         | Check classroom.user_id |
| `user_sound_settings` | `user_id = auth.uid()`                                | Direct ownership        |

**Rules:**

- Always include RLS policies when creating new tables
- Tables inheriting ownership check parent via subquery
- Default behaviors have `user_id = NULL` (shared across all users)

## Constraint Rules

```sql
-- Points must be -5 to 5 (non-zero)
CHECK (points >= -5 AND points <= 5 AND points != 0)

-- Cascading deletes
REFERENCES classrooms(id) ON DELETE CASCADE
```

**Rules:**

- Always use `ON DELETE CASCADE` for child tables
- Add appropriate CHECK constraints for domain rules
- Use ENUM types for fixed categories (`behavior_category`)

## Realtime Rules

```sql
-- Required for DELETE events to include all columns
ALTER TABLE point_transactions REPLICA IDENTITY FULL;
ALTER TABLE students REPLICA IDENTITY FULL;
```

**Rules:**

- Set `REPLICA IDENTITY FULL` on tables where DELETE handlers need column data
- Without this, DELETE only provides primary key

## Index Rules

```sql
-- Standard indexes
CREATE INDEX idx_tablename_columnname ON tablename(columnname);

-- Composite indexes for common queries
CREATE INDEX idx_transactions_student_created
  ON point_transactions(student_id, created_at DESC);
```

**Rules:**

- Index foreign key columns
- Index columns used in ORDER BY
- Use composite indexes for common query patterns

---
