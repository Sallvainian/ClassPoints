# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassPoints is a React classroom management app for teachers to track student behavior points. It uses Supabase for real-time data synchronization and supports offline fallback.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
npm test             # Vitest unit tests (watch mode)
npm run test:e2e     # Playwright E2E tests (requires TEST_EMAIL, TEST_PASSWORD env vars)
npm run test:e2e:ui  # Playwright with UI
```

**Single test file:** `npm test -- src/test/specificFile.test.ts`

**Pre-commit hook:** Runs lint-staged + typecheck automatically.

## Architecture

### Context Hierarchy (Order Matters)

```
AuthProvider          → User authentication (Supabase Auth)
  AuthGuard           → Route protection
    SoundProvider     → Sound effects
      HybridAppProvider → Main app state
        AppContent    → Views and routing
```

### Data Flow Pattern

**Single Source of Truth:** All components access state via `useApp()` hook - never import contexts directly.

```tsx
// ALWAYS do this:
const { classrooms, students, awardPoints } = useApp();

// NEVER do this:
const context = useContext(AppContext); // Wrong
```

### Context Layer Responsibilities

| Context              | Purpose                                    | Notes           |
| -------------------- | ------------------------------------------ | --------------- |
| `AuthContext`        | Supabase auth, session                     | Use `useAuth()` |
| `HybridAppContext`   | Unified state facade with offline fallback | Use `useApp()`  |
| `SupabaseAppContext` | Supabase operations, realtime sync         | Internal only   |

### Data Hooks (Feature-Level)

Each domain has a dedicated hook with CRUD + realtime subscriptions:

- `useClassrooms` - Classroom management with student summaries
- `useStudents` - Student data with stored point totals
- `useBehaviors` - Behavior templates (positive/negative)
- `useTransactions` - Point transactions with batch support
- `useSeatingChart` - Seating chart editor state

### Realtime Subscriptions

Use `useRealtimeSubscription` for Supabase realtime:

```tsx
useRealtimeSubscription<DbStudent>({
  table: 'students',
  filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
  onInsert: (student) => setStudents((prev) => [...prev, transform(student)]),
  onUpdate: (student) =>
    setStudents((prev) => prev.map((s) => (s.id === student.id ? transform(student) : s))),
  onDelete: ({ id }) => setStudents((prev) => prev.filter((s) => s.id !== id)),
});
```

**Critical:** Always cleanup subscriptions in useEffect return.

### Optimistic Updates Pattern

Updates follow this sequence for responsive UI:

1. Update local state immediately
2. Send request to Supabase
3. On error: rollback local state and let realtime resync

### Point Totals

Student point totals (`point_total`, `positive_total`, `negative_total`, `today_total`, `this_week_total`) are stored in the database and maintained by DB triggers. Components read stored totals, not recalculated from transactions.

## Types

- `src/types/index.ts` - App-level types (Student, Classroom, Behavior)
- `src/types/database.ts` - Supabase schema types with convenience aliases
- `src/types/seatingChart.ts` - Seating chart specific types

Database types use `snake_case`, app types use `camelCase`. Contexts handle the mapping.

## Environment Variables

Required in `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

For E2E tests:

```
TEST_EMAIL=...
TEST_PASSWORD=...
```

## Project-Specific Rules

Detailed patterns in `.claude/rules/`:

- `components.md` - Component structure, naming, props
- `contexts.md` - Context hierarchy, state operations
- `hooks.md` - Hook patterns, cleanup requirements
- `state-management.md` - Global/feature/local state layers
- `testing.md` - Vitest and Playwright patterns
- `utils.md` - Utility function patterns

### Key Constraints

1. **Hooks before returns:** All hooks must be called before any early returns
2. **No direct context access:** Always use `useApp()`, never import context directly
3. **Cleanup subscriptions:** Every realtime subscription needs cleanup
4. **Optimistic updates:** UI updates before server confirmation, rollback on error
