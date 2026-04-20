# State Management Patterns

**Applies to:** `src/**/*.{ts,tsx}`

---

## Architecture Overview

ClassPoints uses a **hooks-first architecture** with three state layers:

| Layer       | Scope                           | Tool                      | Example                               |
| ----------- | ------------------------------- | ------------------------- | ------------------------------------- |
| **Global**  | App-wide, persistent            | `AppContext` + `useApp()` | User, classrooms, active classroom    |
| **Feature** | Single feature, Supabase-backed | Custom hooks              | `useSeatingChart`, `useLayoutPresets` |
| **Local**   | Single component                | `useState`, `useReducer`  | Modal open state, form inputs         |

---

## State Layer Guidelines

### 1. Global State (AppContext)

Use for data needed across many components:

- Current user authentication
- Active classroom selection
- Classrooms list
- Behaviors list (shared across modals)

```tsx
// ALWAYS access via useApp() hook - never import context directly
const { activeClassroom, setActiveClassroom, behaviors } = useApp();
```

### 2. Feature State (Custom Hooks)

Use for feature-specific data with Supabase backing:

```ts
// Each feature gets its own hook with full CRUD + realtime
export function useSeatingChart(classroomId: string | null) {
  const [chart, setChart] = useState<SeatingChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch on mount
  useEffect(() => { fetchChart(); }, [classroomId]);

  // Realtime subscription
  useRealtimeSubscription({ table: 'seating_charts', ... });

  // CRUD operations with optimistic updates
  const createChart = useCallback(async () => { ... }, []);
  const updateChart = useCallback(async () => { ... }, []);

  return { chart, loading, error, createChart, updateChart, ... };
}
```

### 3. Local State (useState/useReducer)

Use for ephemeral UI state:

```tsx
// Simple toggle/input state
const [isOpen, setIsOpen] = useState(false);
const [inputValue, setInputValue] = useState('');

// Complex state with multiple related fields - use useReducer
const [state, dispatch] = useReducer(reducer, initialState);
```

---

## Required Patterns

### Optimistic Updates

Always update local state immediately, then sync with server:

```ts
const updateItem = useCallback(async (id: string, updates: Partial<Item>) => {
  // 1. Optimistic update - instant UI feedback
  setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));

  // 2. Server update
  const { error } = await supabase.from('items').update(updates).eq('id', id);

  // 3. Rollback on error (or let realtime subscription handle it)
  if (error) {
    setError(new Error(error.message));
    await refetch(); // Revert to server state
  }
}, []);
```

### Loading & Error States

Every data-fetching hook MUST return loading and error states:

```ts
interface UseDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

### Memoization Strategy

```tsx
// useMemo: Expensive computations or derived data
const sortedStudents = useMemo(
  () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
  [students]
);

// useCallback: Functions passed to children or used in deps
const handleClick = useCallback((id: string) => {
  setSelectedId(id);
}, []); // Empty deps = stable reference

// React.memo: Components that receive stable props
const StudentCard = React.memo(function StudentCard({ student, onClick }: Props) {
  return <div onClick={() => onClick(student.id)}>...</div>;
});
```

### Realtime Subscriptions

Use the `useRealtimeSubscription` hook for all Supabase realtime:

```ts
useRealtimeSubscription<DbStudent>({
  table: 'students',
  filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
  onInsert: (student) => setStudents((prev) => [...prev, transform(student)]),
  onUpdate: (student) =>
    setStudents((prev) => prev.map((s) => (s.id === student.id ? transform(student) : s))),
  onDelete: ({ id }) => setStudents((prev) => prev.filter((s) => s.id !== id)),
});
```

---

## Anti-Patterns (NEVER DO)

### State Location Mistakes

```tsx
// BAD: Duplicating server state in multiple places
const [students, setStudents] = useState([]); // In component A
const [students, setStudents] = useState([]); // In component B - OUT OF SYNC!

// GOOD: Single source of truth via hook or context
const { students } = useApp(); // Same data everywhere
```

### Prop Drilling

```tsx
// BAD: Passing data through 5+ component levels
<App classroom={classroom}>
  <Dashboard classroom={classroom}>
    <Content classroom={classroom}>
      <Grid classroom={classroom}>
        <Card classroom={classroom} /> // Nightmare to maintain

// GOOD: Access via hook at point of use
function Card() {
  const { activeClassroom } = useApp();
  return <div>{activeClassroom.name}</div>;
}
```

### Unstable References

```tsx
// BAD: New object/array every render = infinite loops & wasted renders
function Parent() {
  return <Child options={{ sort: 'asc' }} items={items.filter((x) => x.active)} />;
}

// GOOD: Memoize objects and computed arrays
function Parent() {
  const options = useMemo(() => ({ sort: 'asc' }), []);
  const activeItems = useMemo(() => items.filter((x) => x.active), [items]);
  return <Child options={options} items={activeItems} />;
}
```

### Missing Cleanup

```tsx
// BAD: Memory leak - subscription never cleaned up
useEffect(() => {
  const channel = supabase.channel('changes').subscribe();
  // No return!
}, []);

// GOOD: Always cleanup
useEffect(() => {
  const channel = supabase.channel('changes').subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

### State Updates During Render

```tsx
// BAD: Causes infinite render loop
function Component({ value }) {
  const [state, setState] = useState(value);
  if (value !== state) setState(value); // NEVER do this!

// GOOD: Sync via useEffect or key prop
function Component({ value }) {
  const [state, setState] = useState(value);
  useEffect(() => setState(value), [value]);
}
// Or: <Component key={value} initialValue={value} />
```

---

## State Derivation

Prefer computed/derived state over synchronized state:

```tsx
// BAD: Synchronized state that can drift
const [students, setStudents] = useState([]);
const [studentCount, setStudentCount] = useState(0);
// Now you must remember to update BOTH!

// GOOD: Derive from single source of truth
const [students, setStudents] = useState([]);
const studentCount = students.length; // Always correct

// For expensive derivations, memoize:
const averagePoints = useMemo(
  () => students.reduce((sum, s) => sum + s.pointTotal, 0) / students.length,
  [students]
);
```

---

## When to Lift State

Lift state to the **lowest common ancestor** that needs it:

```
StudentGrid          <- If only Grid + Cards need selection state
├── StudentCard
├── StudentCard
└── StudentCard

Dashboard            <- If multiple siblings need it
├── StudentGrid
├── Sidebar          <- Also needs to show selection count
└── ActionBar        <- Also needs selected students
```

If lifting causes prop drilling through 3+ levels, create a feature-specific context or use the global `useApp()`.

---

## TypeScript Requirements

### Explicit State Types

```ts
// Always type useState when not inferable
const [student, setStudent] = useState<Student | null>(null);
const [students, setStudents] = useState<Student[]>([]);
const [error, setError] = useState<Error | null>(null);
```

### Hook Return Types

```ts
interface UseStudentsReturn {
  students: Student[];
  loading: boolean;
  error: Error | null;
  addStudent: (name: string) => Promise<Student | null>;
  removeStudent: (id: string) => Promise<boolean>;
}

export function useStudents(classroomId: string): UseStudentsReturn {
  // ...
}
```

### Generic Hooks

```ts
// Reusable async state hook — uses AbortController to actually cancel
// in-flight requests (not just suppress setState after unmount).
// Pattern precedent: src/utils/validateAudioUrl.ts
function useAsyncState<T>(
  asyncFn: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    asyncFn(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, deps);

  return { data, loading, error };
}
```

---

## Performance Checklist

Before merging, verify:

- [ ] No unnecessary re-renders (use React DevTools Profiler)
- [ ] Expensive computations wrapped in `useMemo`
- [ ] Callbacks passed to children wrapped in `useCallback`
- [ ] Large lists use virtualization or pagination
- [ ] Realtime subscriptions properly cleaned up
- [ ] No state updates in render phase
- [ ] Loading states prevent UI flash
