---
paths:
  - 'src/lib/supabase.ts'
  - 'src/contexts/SupabaseAppContext.tsx'
  - 'src/hooks/useRealtimeSubscription.ts'
  - 'src/hooks/use*.ts'
---

# Supabase Patterns

---

## Client Setup

```ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**Required:** Always use typed client with `Database` generic.

---

## Data Operations

### Query Pattern

```ts
// ALWAYS destructure { data, error }
const { data, error } = await supabase.from('students').select('*').eq('classroom_id', classroomId);

// Handle error FIRST
if (error) {
  console.error('Failed to fetch students:', error);
  throw new Error(error.message);
}

// Then use data
return data;
```

### Insert Pattern

```ts
const { data, error } = await supabase
  .from('students')
  .insert({ name, classroom_id: classroomId })
  .select()
  .single();

if (error) throw new Error(error.message);
return data;
```

### Update Pattern

```ts
const { error } = await supabase.from('students').update({ name: newName }).eq('id', studentId);

if (error) throw new Error(error.message);
```

### Delete Pattern

```ts
const { error } = await supabase.from('students').delete().eq('id', studentId);

if (error) throw new Error(error.message);
```

---

## Realtime Subscriptions

### useRealtimeSubscription Hook

```ts
useRealtimeSubscription<DbStudent>({
  table: 'students',
  filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
  onInsert: (record) => setStudents((prev) => [...prev, transform(record)]),
  onUpdate: (record) =>
    setStudents((prev) => prev.map((s) => (s.id === record.id ? transform(record) : s))),
  onDelete: ({ id }) => setStudents((prev) => prev.filter((s) => s.id !== id)),
});
```

### Manual Subscription (when needed)

```ts
useEffect(() => {
  const channel = supabase
    .channel(`${tableName}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, handleChange)
    .subscribe();

  // CRITICAL: Always cleanup
  return () => {
    supabase.removeChannel(channel);
  };
}, [tableName]);
```

### Filter Syntax

```ts
// Filter by classroom_id
filter: `classroom_id=eq.${classroomId}`;

// Filter by user_id
filter: `user_id=eq.${userId}`;

// No filter (all records)
filter: undefined;
```

---

## Optimistic Updates

**Pattern:** Update UI immediately, then sync with server, rollback on error.

```ts
const updateStudent = useCallback(
  async (id: string, updates: Partial<Student>) => {
    // 1. Save current state for rollback
    const previousStudents = students;

    // 2. Optimistic update - instant UI
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));

    // 3. Server update
    const { error } = await supabase.from('students').update(updates).eq('id', id);

    // 4. Rollback on error
    if (error) {
      setStudents(previousStudents);
      setError(new Error(error.message));
    }
  },
  [students]
);
```

---

## RLS Policies

All tables use Row Level Security. Common patterns:

```sql
-- Users can only see their own data
CREATE POLICY "Users see own data"
  ON students FOR SELECT
  USING (user_id = auth.uid());

-- Users can only modify their own data
CREATE POLICY "Users modify own data"
  ON students FOR ALL
  USING (user_id = auth.uid());
```

**In code:** RLS is automatic - queries only return allowed rows.

---

## Anti-Patterns

- **NEVER** forget to destructure `{ data, error }` - always check error first
- **NEVER** skip subscription cleanup in useEffect
- **NEVER** assume data exists without checking error
- **AVOID** multiple separate queries when `.select()` with relations works

---

## Type Mapping

Database uses `snake_case`, app uses `camelCase`. Transform at context boundary:

```ts
// Database type
interface DbStudent {
  id: string;
  classroom_id: string;
  point_total: number;
}

// App type
interface Student {
  id: string;
  classroomId: string;
  pointTotal: number;
}

// Transform function
function transformStudent(db: DbStudent): Student {
  return {
    id: db.id,
    classroomId: db.classroom_id,
    pointTotal: db.point_total,
  };
}
```
