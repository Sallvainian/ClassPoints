# Hook Patterns

**Applies to:** `src/hooks/**/*.ts`

---

## Naming Conventions

- **Files:** camelCase with `use` prefix (`useClassrooms.ts`)
- **Hook functions:** camelCase with `use` prefix
- **Return types:** Explicit interface or inline type

---

## Structure Pattern

```ts
import { useState, useEffect, useCallback } from 'react';

interface UseHookNameReturn {
  data: Type;
  loading: boolean;
  error: Error | null;
  action: () => void;
}

export function useHookName(param: ParamType): UseHookNameReturn {
  const [data, setData] = useState<Type | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Setup logic
    return () => {
      // Cleanup - ALWAYS clean up subscriptions
    };
  }, [dependencies]);

  const action = useCallback(() => {
    // Action logic
  }, [dependencies]);

  return { data, loading, error, action };
}
```

---

## Required Patterns

- Export from `src/hooks/index.ts` barrel file
- Return explicit types (interface or inline)
- Always clean up subscriptions in useEffect return
- Use `useCallback` for functions returned to consumers
- Handle loading and error states

---

## Anti-Patterns

- **NEVER** forget cleanup in useEffect (causes memory leaks)
- **NEVER** omit dependencies in useEffect/useCallback
- **AVOID** returning unstable references (new objects/arrays each render)
- **AVOID** side effects outside useEffect

---

## Realtime Subscription Pattern

```ts
export function useRealtimeData(tableName: string) {
  useEffect(() => {
    const channel = supabase
      .channel(`${tableName}_changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, handleChange)
      .subscribe();

    // CRITICAL: Always unsubscribe
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName]);
}
```

---

## Examples

**Good:**

```ts
export function useStudents(classroomId: string) {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const subscription = subscribeToStudents(classroomId, setStudents);
    return () => subscription.unsubscribe(); // Cleanup!
  }, [classroomId]);

  return students;
}
```

**Bad:**

```ts
export function useStudents(classroomId: string) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    subscribeToStudents(classroomId, setStudents);
    // No cleanup - MEMORY LEAK!
  }, []); // Missing dependency - BUG!

  return students;
}
```
