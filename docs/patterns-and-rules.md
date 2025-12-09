# ClassPoints - Patterns and Rules Reference

> **Purpose**: Comprehensive reference for all patterns, conventions, and rules in the ClassPoints codebase. This is the authoritative guide for maintaining consistency when adding or modifying code.

---

## Table of Contents

1. [Architecture Patterns](#architecture-patterns)
2. [State Management Patterns](#state-management-patterns)
3. [Data Access Patterns](#data-access-patterns)
4. [Component Patterns](#component-patterns)
5. [Type System Rules](#type-system-rules)
6. [Database Rules](#database-rules)
7. [Security Rules](#security-rules)
8. [Naming Conventions](#naming-conventions)
9. [File Organization Rules](#file-organization-rules)

---

## Architecture Patterns

### Provider Hierarchy Pattern

The app uses a strict nested provider pattern. **Order matters** - providers must be nested in this exact sequence:

```tsx
<AuthProvider>           // 1. Authentication state (user, session)
  <AuthGuard>            // 2. Route protection (redirects unauthenticated)
    <SoundProvider>      // 3. Sound effects settings
      <HybridAppProvider>// 4. App data layer (online/offline)
        <AppContent />   // 5. Main application
      </HybridAppProvider>
    </SoundProvider>
  </AuthGuard>
</AuthProvider>
```

**Rules:**
- Never access a context from a component that's not wrapped by that provider
- If adding a new provider, determine where it fits in the hierarchy
- Providers that depend on others must be nested inside them

### Facade Pattern (AppContext)

Components access data through `useApp()` hook, which is a facade over the underlying data layer:

```
Component → useApp() → HybridAppContext → SupabaseAppContext → Supabase Hooks → Supabase Client
```

**Rules:**
- Components **MUST** use `useApp()` for all data operations
- Never import `SupabaseAppContext` directly in components
- Never use `supabase` client directly in components (only in hooks/contexts)

### Hybrid Online/Offline Pattern

The app supports both online (Supabase) and offline (localStorage) modes:

```tsx
// HybridAppContext decides which implementation to use
const value = {
  ...supabaseApp,  // Online: delegates to Supabase
  syncStatus,      // Tracks sync state
};
```

**Rules:**
- All data operations must go through `HybridAppContext`
- Future offline support will queue operations in `SyncManager`
- Don't assume network connectivity in any component

---

## State Management Patterns

### Optimistic Updates Pattern

UI updates immediately before server confirmation:

```tsx
// In SupabaseAppContext.awardPoints()
updateStudentPointsOptimistically(studentId, behavior.points);  // 1. Update UI
updateClassroomPointsOptimistically(classroomId, behavior.points);
return await awardPointsHook(studentId, classroomId, behavior);  // 2. Then server
```

**Rules:**
- Always update UI optimistically for responsive UX
- Realtime subscriptions handle eventual consistency
- On DELETE events (undo), update state from realtime payload

### Realtime Subscription Pattern

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

### Undo Window Pattern

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

### Batch Transaction Pattern

Class-wide point awards use `batch_id` for grouped operations:

```tsx
const batchId = crypto.randomUUID();
const newTransactions = students.map((student) => ({
  ...transactionData,
  batch_id: batchId,  // Links all transactions together
}));
```

**Rules:**
- All transactions in a batch share the same `batch_id`
- Undo batch deletes ALL transactions with that `batch_id`
- UI shows batch info (student count, total points)

---

## Data Access Patterns

### Hook Composition Pattern

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

### Query Pattern

Standard Supabase query pattern:

```tsx
const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);

  const { data, error: queryError } = await supabase
    .from('table')
    .select('*, related(count)')  // Nested select for counts
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

### CRUD Operation Pattern

```tsx
const createItem = useCallback(async (input): Promise<Item | null> => {
  const { data, error } = await supabase
    .from('items')
    .insert(input)
    .select()
    .single();

  if (error) {
    setError(new Error(error.message));
    return null;
  }

  setItems(prev => [...prev, data]);  // Update local state
  return data;
}, []);
```

**Rules:**
- Return `null` on error, actual data on success
- Always `.select()` after insert/update to get the full row
- Update local state after successful operation

---

## Component Patterns

### Component Structure Pattern

```tsx
interface ComponentProps {
  required: string;
  optional?: boolean;
}

export function Component({ required, optional = false }: ComponentProps) {
  // 1. Hooks at top (context, state, refs, effects)
  const { data } = useApp();
  const [localState, setLocalState] = useState(false);

  // 2. Event handlers
  const handleClick = () => {};

  // 3. Early returns for loading/error states
  if (loading) return <Loading />;
  if (error) return <Error error={error} />;

  // 4. Main render
  return <div>...</div>;
}
```

**Rules:**
- All hooks MUST be called before any early returns
- Props interface defined above component
- Export named functions (not default except App.tsx)

### Modal Pattern

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ...specific props
}

export function FeatureModal({ isOpen, onClose, ... }: ModalProps) {
  // Use Modal wrapper component
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Title">
      {/* Modal content */}
    </Modal>
  );
}
```

**Rules:**
- All modals use the `Modal` wrapper component from `components/ui/`
- `isOpen` and `onClose` are required props
- Modal handles backdrop click and escape key

### Index Barrel Export Pattern

Each component folder has an `index.ts` barrel file:

```tsx
// src/components/students/index.ts
export { StudentGrid } from './StudentGrid';
export { StudentPointCard } from './StudentPointCard';
```

**Rules:**
- Every component folder MUST have an `index.ts`
- Export all public components from the index
- Import from folder, not individual files: `import { StudentGrid } from './components/students'`

---

## Type System Rules

### Dual Type System

Two parallel type definitions exist:
1. **Database types** (`src/types/database.ts`) - Snake_case, matches Supabase
2. **Domain types** (`src/types/index.ts`) - CamelCase, used in components

```tsx
// Database type (database.ts)
interface Student {
  id: string;
  classroom_id: string;  // snake_case
  avatar_color: string | null;
}

// Domain type (index.ts)
interface Student {
  id: string;
  classroomId: string;  // camelCase
  avatarColor?: string;
}
```

**Rules:**
- Hooks work with database types internally
- Context maps to domain types before exposing to components
- Components should only see domain types

### Type Alias Convention

```tsx
// Row types (read)
export type Classroom = Database['public']['Tables']['classrooms']['Row'];

// Insert types (create)
export type NewClassroom = Database['public']['Tables']['classrooms']['Insert'];

// Update types (modify)
export type UpdateClassroom = Database['public']['Tables']['classrooms']['Update'];
```

**Rules:**
- `New*` prefix for Insert types
- `Update*` prefix for Update types
- Plain name for Row (read) types

### Strict TypeScript Rules

From `tsconfig.app.json`:

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

**Rules:**
- No unused variables or parameters
- All switch cases must have break/return
- Strict null checking enabled

---

## Database Rules

### Table Ownership Rules

| Table | Ownership | RLS Pattern |
|-------|-----------|-------------|
| `classrooms` | `user_id = auth.uid()` | Direct ownership |
| `students` | Via classroom | Check classroom.user_id |
| `behaviors` | `user_id IS NULL` (default) OR `user_id = auth.uid()` | Shared + Personal |
| `point_transactions` | Via classroom | Check classroom.user_id |
| `user_sound_settings` | `user_id = auth.uid()` | Direct ownership |

**Rules:**
- Always include RLS policies when creating new tables
- Tables inheriting ownership check parent via subquery
- Default behaviors have `user_id = NULL` (shared across all users)

### Constraint Rules

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

### Realtime Rules

```sql
-- Required for DELETE events to include all columns
ALTER TABLE point_transactions REPLICA IDENTITY FULL;
ALTER TABLE students REPLICA IDENTITY FULL;
```

**Rules:**
- Set `REPLICA IDENTITY FULL` on tables where DELETE handlers need column data
- Without this, DELETE only provides primary key

### Index Rules

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

## Security Rules

### Authentication Rules

1. **Session management** handled by Supabase Auth
2. **Token refresh** automatic via Supabase client
3. **AuthGuard** protects all authenticated routes

```tsx
function AuthGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <AuthPage />;

  return children;
}
```

**Rules:**
- Never bypass AuthGuard
- Don't store sensitive data in localStorage
- Use Supabase Auth for all authentication flows

### RLS Policy Pattern

```sql
-- SELECT: Check ownership
CREATE POLICY "Users can view own X" ON table
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Verify ownership on create
CREATE POLICY "Users can create own X" ON table
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Child table pattern (check parent)
CREATE POLICY "Users can view X in own classrooms" ON child_table
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classrooms
      WHERE classrooms.id = child_table.classroom_id
      AND classrooms.user_id = auth.uid()
    )
  );
```

**Rules:**
- Every table MUST have RLS enabled
- Every operation (SELECT, INSERT, UPDATE, DELETE) needs a policy
- Use `auth.uid()` to check current user

### Auto-Set User ID Pattern

```sql
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Rules:**
- Tables with `user_id` should have trigger to auto-set
- Client doesn't need to manually set `user_id`

---

## Naming Conventions

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `StudentGrid.tsx` |
| Hooks | camelCase with `use` prefix | `useClassrooms.ts` |
| Contexts | PascalCase with `Context` suffix | `AuthContext.tsx` |
| Types | camelCase.ts | `database.ts` |
| Utils | camelCase.ts | `migrateToSupabase.ts` |

### Code Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `StudentPointCard` |
| Hooks | camelCase with `use` prefix | `useRealtimeSubscription` |
| Context values | camelCase | `activeClassroomId` |
| Event handlers | `handle` + Event | `handleClick` |
| Boolean props | `is` or `on` prefix | `isOpen`, `onClose` |

### Database Naming

| Type | Convention | Example |
|------|------------|---------|
| Tables | snake_case plural | `point_transactions` |
| Columns | snake_case | `classroom_id` |
| Indexes | `idx_tablename_column` | `idx_students_classroom_id` |
| Policies | Descriptive sentence | `"Users can view own classrooms"` |
| Triggers | `trigger_action_tablename` | `set_classrooms_user_id` |

---

## File Organization Rules

### Directory Structure

```
src/
├── components/        # UI components by feature
│   ├── auth/          # Authentication components
│   ├── behaviors/     # Behavior selection components
│   ├── classes/       # Classroom management
│   ├── common/        # Shared components
│   ├── dashboard/     # Main dashboard
│   ├── layout/        # Layout components (Sidebar, etc.)
│   ├── migration/     # Data migration wizard
│   ├── points/        # Point award/undo components
│   ├── settings/      # Settings views
│   ├── students/      # Student cards/grid
│   └── ui/            # Base UI components (Button, Modal, Input)
├── contexts/          # React Context providers
├── hooks/             # Custom React hooks
├── lib/               # Library configuration (supabase.ts)
├── services/          # Business logic services
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

**Rules:**
- Components organized by feature/domain, not by type
- Each feature folder has its own `index.ts` barrel export
- Base UI components go in `components/ui/`
- Shared/reusable components go in `components/common/`

### Import Order Convention

```tsx
// 1. React imports
import { useState, useEffect, useCallback } from 'react';

// 2. External libraries
import { supabase } from '../lib/supabase';

// 3. Internal contexts/hooks
import { useApp } from '../contexts/AppContext';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

// 4. Components
import { Modal } from '../components/ui';

// 5. Types
import type { Student, Classroom } from '../types/database';
```

---

## Quick Reference Checklist

### Adding a New Component

- [ ] Create in appropriate `src/components/{feature}/` directory
- [ ] Use functional component with TypeScript props interface
- [ ] Use `useApp()` for data access
- [ ] Export from folder's `index.ts`
- [ ] Follow naming conventions

### Adding a New Hook

- [ ] Create in `src/hooks/useHookName.ts`
- [ ] Use `useCallback` for functions, `useMemo` for computed values
- [ ] Export from `src/hooks/index.ts`
- [ ] Follow existing hook patterns

### Adding a New Database Table

- [ ] Create migration in `supabase/migrations/`
- [ ] Add RLS policies for all operations
- [ ] Add `REPLICA IDENTITY FULL` if DELETE handlers need data
- [ ] Add types to `src/types/database.ts`
- [ ] Add domain types to `src/types/index.ts` if needed
- [ ] Create hook for data access
- [ ] Expose through context if needed by components

### Modifying State Operations

- [ ] Update hook if data access pattern changes
- [ ] Update `SupabaseAppContext` if context API changes
- [ ] Update `HybridAppContext` if it affects online/offline
- [ ] Expose through `AppContext` if needed by components
- [ ] Add optimistic updates for responsive UX
- [ ] Add realtime subscription for live updates

---

*Last Updated: 2025-12-09*
*Generated by document-project workflow*
