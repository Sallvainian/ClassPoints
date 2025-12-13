# State Management Patterns

## Optimistic Updates Pattern

UI updates immediately before server confirmation:

```tsx
// In SupabaseAppContext.awardPoints()
updateStudentPointsOptimistically(studentId, behavior.points); // 1. Update UI
updateClassroomPointsOptimistically(classroomId, behavior.points);
return await awardPointsHook(studentId, classroomId, behavior); // 2. Then server
```

**Rules:**

- Always update UI optimistically for responsive UX
- Realtime subscriptions handle eventual consistency
- On DELETE events (undo), update state from realtime payload

## Realtime Subscription Pattern

Using `useRealtimeSubscription` hook for live updates:

```tsx
useRealtimeSubscription<Classroom>({
  table: 'classrooms',
  onInsert: (classroom) => {
    setClassrooms((prev) => [...prev, classroom].sort(...));
  },
  onUpdate: (classroom) => {
    setClassrooms((prev) => prev.map(c => c.id === classroom.id ? {...} : c));
  },
  onDelete: ({ id }) => {
    setClassrooms((prev) => prev.filter(c => c.id !== id));
  },
});
```

**Rules:**

- Use refs for callbacks to avoid stale closures (the hook handles this)
- Clean up channels on unmount (handled by the hook)
- For INSERT events with optimistic updates, check for duplicates before adding
- Tables need `REPLICA IDENTITY FULL` for complete DELETE payloads

## Undo Window Pattern

10-second undo window for point transactions:

```tsx
const UNDO_WINDOW_MS = 10000;

const getRecentUndoableAction = useCallback(() => {
  const now = Date.now();
  const recentTimestamp = new Date(recent.created_at).getTime();
  if (now - recentTimestamp > UNDO_WINDOW_MS) return null;
  // ...
}, [transactions]);
```

**Rules:**

- Undo only available within 10 seconds
- Batch transactions (class-wide awards) use `batch_id` for grouped undo
- `UndoToast` component handles the undo UI

## Batch Transaction Pattern

Class-wide point awards use `batch_id` for grouped operations:

```tsx
const batchId = crypto.randomUUID();
const newTransactions = students.map((student) => ({
  ...transactionData,
  batch_id: batchId, // Links all transactions together
}));
```

**Rules:**

- All transactions in a batch share the same `batch_id`
- Undo batch deletes ALL transactions with that `batch_id`
- UI shows batch info (student count, total points)

---
