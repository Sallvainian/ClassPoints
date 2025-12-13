# Data Access Patterns

## Hook Composition Pattern

Data hooks are composed in `SupabaseAppContext`:

```tsx
const { classrooms, loading, createClassroom, ... } = useClassrooms();
const { students, addStudent, ... } = useStudents(activeClassroomId);
const { behaviors, ... } = useBehaviors();
const { transactions, awardPoints, ... } = useTransactions(activeClassroomId);
```

**Rules:**

- Each hook manages one table/concern
- Hooks can depend on each other (e.g., `useTransactions` needs `activeClassroomId`)
- Combined loading/error state in context: `loading = a || b || c`

## Query Pattern

Standard Supabase query pattern:

```tsx
const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);

  const { data, error: queryError } = await supabase
    .from('table')
    .select('*, related(count)') // Nested select for counts
    .order('name', { ascending: true });

  if (queryError) {
    setError(new Error(queryError.message));
    setData([]);
  } else {
    setData(data || []);
  }

  setLoading(false);
}, []);
```

**Rules:**

- Always handle errors and set empty array as fallback
- Use `useCallback` for fetch functions
- Include loading state management

## CRUD Operation Pattern

```tsx
const createItem = useCallback(async (input): Promise<Item | null> => {
  const { data, error } = await supabase.from('items').insert(input).select().single();

  if (error) {
    setError(new Error(error.message));
    return null;
  }

  setItems((prev) => [...prev, data]); // Update local state
  return data;
}, []);
```

**Rules:**

- Return `null` on error, actual data on success
- Always `.select()` after insert/update to get the full row
- Update local state after successful operation

---
