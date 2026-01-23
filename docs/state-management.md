# State Management - ClassPoints

## Architecture Overview

ClassPoints uses a **React Context architecture** with three layers:

1. **AuthContext** - Supabase authentication state
2. **SupabaseAppContext** - Full data layer with Supabase operations
3. **HybridAppContext** - Online/offline facade with sync status

Components access state through a single `useApp()` hook that provides a unified API facade.

## Context Hierarchy

```
<AuthProvider>                    ← Authentication state
  <AuthGuard>                     ← Route protection
    <HybridAppProvider>           ← Online/offline switching
      <SupabaseAppProvider>       ← Full Supabase data layer
        <App />                   ← Main application
```

## Core Contexts

### AuthContext

**Location:** `src/contexts/AuthContext.tsx`

Manages Supabase authentication state and session.

```typescript
interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signUp: (email: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthError | null>;
}
```

**Usage:**

```tsx
const { user, signIn, signOut } = useAuth();
```

### HybridAppContext (Primary)

**Location:** `src/contexts/HybridAppContext.tsx`

The main application context that combines Supabase operations with offline support.

```typescript
interface HybridAppContextValue {
  // Loading/error states
  loading: boolean;
  error: Error | null;
  syncStatus: SyncStatus;

  // State (read-only)
  classrooms: AppClassroom[];
  behaviors: AppBehavior[];
  transactions: PointTransaction[];
  activeClassroomId: string | null;
  activeClassroom: AppClassroom | null;
  students: AppStudent[];

  // Classroom operations
  createClassroom: (name: string) => Promise<Classroom | null>;
  updateClassroom: (id: string, updates: Partial<Classroom>) => Promise<void>;
  deleteClassroom: (id: string) => Promise<void>;
  setActiveClassroom: (id: string | null) => void;

  // Student operations
  addStudent: (classroomId: string, name: string) => Promise<Student | null>;
  addStudents: (classroomId: string, names: string[]) => Promise<Student[]>;
  updateStudent: (
    classroomId: string,
    studentId: string,
    updates: Partial<Student>
  ) => Promise<void>;
  removeStudent: (classroomId: string, studentId: string) => Promise<void>;

  // Behavior operations
  addBehavior: (behavior: Omit<Behavior, 'id' | 'created_at'>) => Promise<Behavior | null>;
  updateBehavior: (id: string, updates: Partial<Behavior>) => Promise<void>;
  deleteBehavior: (id: string) => Promise<void>;
  resetBehaviorsToDefault: () => Promise<void>;

  // Point operations
  awardPoints: (
    classroomId: string,
    studentId: string,
    behaviorId: string,
    note?: string
  ) => Promise<PointTransaction | null>;
  awardClassPoints: (
    classroomId: string,
    behaviorId: string,
    note?: string
  ) => Promise<PointTransaction[]>;
  awardPointsToStudents: (
    classroomId: string,
    studentIds: string[],
    behaviorId: string,
    note?: string
  ) => Promise<PointTransaction[]>;
  undoTransaction: (transactionId: string) => Promise<void>;
  undoBatchTransaction: (batchId: string) => Promise<void>;
  getStudentPoints: (studentId: string) => StudentPoints;
  getClassPoints: (classroomId: string, studentIds?: string[]) => StudentPoints;
  getStudentTransactions: (studentId: string, limit?: number) => PointTransaction[];
  getClassroomTransactions: (classroomId: string, limit?: number) => PointTransaction[];
  getRecentUndoableAction: () => UndoableAction | null;
  clearStudentPoints: (classroomId: string, studentId: string) => Promise<void>;
  adjustStudentPoints: (
    classroomId: string,
    studentId: string,
    targetPoints: number,
    note?: string
  ) => Promise<PointTransaction | null>;
  resetClassroomPoints: (classroomId: string) => Promise<void>;
}
```

**Usage:**

```tsx
const { classrooms, activeClassroom, awardPoints } = useApp();
```

### SupabaseAppContext

**Location:** `src/contexts/SupabaseAppContext.tsx`

Internal context that handles all Supabase operations. Not directly accessed by components.

Key responsibilities:

- Fetch initial data on mount
- Subscribe to realtime updates
- Execute CRUD operations with optimistic updates
- Transform database types to domain types

## Data Flow

```
User Action
    ↓
Component calls useApp().awardPoints(...)
    ↓
HybridAppContext forwards to SupabaseAppContext
    ↓
SupabaseAppContext:
  1. Optimistic UI update (setState)
  2. Supabase mutation
  3. On error: rollback + refetch
    ↓
Supabase triggers realtime event
    ↓
useRealtimeSubscription receives event
    ↓
State updated (confirms optimistic update or syncs)
    ↓
React re-renders
```

## Custom Hooks

### useRealtimeSubscription

**Location:** `src/hooks/useRealtimeSubscription.ts`

Generic hook for Supabase realtime subscriptions.

```typescript
interface RealtimeConfig<T> {
  table: string;
  filter?: string;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (old: { id: string }) => void;
}

function useRealtimeSubscription<T>(config: RealtimeConfig<T>): void;
```

### Feature Hooks

| Hook                 | Purpose                  | State               |
| -------------------- | ------------------------ | ------------------- |
| `useClassrooms`      | Classroom CRUD           | Local               |
| `useStudents`        | Student management       | Local               |
| `useBehaviors`       | Behavior templates       | Local               |
| `useTransactions`    | Point history            | Local               |
| `useSeatingChart`    | Seating chart management | Supabase + realtime |
| `useLayoutPresets`   | Saved layouts            | Supabase            |
| `useSoundEffects`    | Audio playback           | Local               |
| `useDisplaySettings` | UI preferences           | localStorage        |

## State Types

### Domain Types (src/types/index.ts)

```typescript
interface Student {
  id: string;
  name: string;
  avatarColor?: string;
  pointTotal: number;
  positiveTotal: number;
  negativeTotal: number;
  todayTotal: number;
  thisWeekTotal: number;
}

interface Classroom {
  id: string;
  name: string;
  students: Student[];
  createdAt: number;
  updatedAt: number;
  pointTotal?: number;
}

interface Behavior {
  id: string;
  name: string;
  points: number;
  icon: string;
  category: 'positive' | 'negative';
  isCustom: boolean;
  createdAt: number;
}

interface PointTransaction {
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

### Sync Status

```typescript
interface SyncStatus {
  isOnline: boolean;
  pendingOperations: number;
  lastSyncAt: number | null;
  syncError: string | null;
}
```

## Optimistic Updates Pattern

All mutations follow the optimistic update pattern:

```typescript
const updateStudent = useCallback(async (id: string, updates: Partial<Student>) => {
  // 1. Optimistic update - instant UI feedback
  setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));

  // 2. Server update
  const { error } = await supabase.from('students').update(updates).eq('id', id);

  // 3. Rollback on error
  if (error) {
    setError(new Error(error.message));
    await refetch(); // Revert to server state
  }
}, []);
```

## Realtime Subscriptions

Subscriptions are managed per-entity with the `useRealtimeSubscription` hook:

```typescript
useRealtimeSubscription<DbStudent>({
  table: 'students',
  filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
  onInsert: (student) => setStudents((prev) => [...prev, transform(student)]),
  onUpdate: (student) =>
    setStudents((prev) => prev.map((s) => (s.id === student.id ? transform(student) : s))),
  onDelete: ({ id }) => setStudents((prev) => prev.filter((s) => s.id !== id)),
});
```

## Best Practices

### Always Use useApp()

```tsx
// ✅ CORRECT
const { classrooms, awardPoints } = useApp();

// ❌ WRONG - Direct context access
const context = useContext(AppContext);
```

### Handle Loading States

```tsx
function Dashboard() {
  const { loading, error, classrooms } = useApp();

  if (loading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return <ClassroomList classrooms={classrooms} />;
}
```

### Cleanup Subscriptions

```tsx
useEffect(() => {
  const channel = supabase.channel('changes').subscribe();
  return () => supabase.removeChannel(channel); // Always cleanup
}, []);
```
