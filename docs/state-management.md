# ClassPoints State Management

_Generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

## Summary

ClassPoints is in the middle of a server-state migration. The target architecture is:

- Supabase server state through TanStack Query.
- UI/session state through focused React state and the remaining `AppContext` facade.
- Cross-device live updates through explicitly scoped Supabase Realtime subscriptions.

Today, the core domains are TanStack-backed, while seating/layout domains still use legacy
hand-rolled state.

## Provider Tree

```text
QueryClientProvider
  App
    AuthProvider
      AuthGuard
        ThemeProvider
          SoundProvider
            AppProvider
              AppContent
```

Provider responsibilities:

| Provider              | File                                | Responsibility                                                                 |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `QueryClientProvider` | `src/main.tsx`                      | Shared TanStack Query client                                                   |
| `AuthProvider`        | `src/contexts/AuthContext.tsx`      | Supabase session/user, auth actions, query cache clear on sign-out/user switch |
| `AuthGuard`           | `src/components/auth/AuthGuard.tsx` | Blocks app data providers until authenticated                                  |
| `ThemeProvider`       | `src/contexts/ThemeContext.tsx`     | Light/dark theme in `localStorage`                                             |
| `SoundProvider`       | `src/contexts/SoundContext.tsx`     | User-scoped sound settings and audio buffers                                   |
| `AppProvider`         | `src/contexts/AppContext.tsx`       | Legacy `useApp()` facade plus active classroom/session state                   |

## QueryClient Defaults

Defined in `src/lib/queryClient.ts`:

| Option                 | Value      | Why it matters                                                 |
| ---------------------- | ---------- | -------------------------------------------------------------- |
| `staleTime`            | 30 seconds | Reduces refetch churn during rapid point awards                |
| `gcTime`               | 10 minutes | Avoids loading flashes during classroom sessions               |
| `refetchOnWindowFocus` | false      | Prevents focus refetch racing optimistic mutation invalidation |
| `refetchOnReconnect`   | true       | Refresh after network recovery                                 |
| query `retry`          | 1          | One retry for reads                                            |
| mutation `retry`       | 0          | Mutations should fail visibly                                  |
| `structuralSharing`    | true       | Keeps adapter bridge output stable                             |

## Query Key Registry

`src/lib/queryKeys.ts` is the single source for query keys.

| Domain         | Builders                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| Classrooms     | `queryKeys.classrooms.all`, `queryKeys.classrooms.detail(id)`            |
| Students       | `queryKeys.students.all`, `queryKeys.students.byClassroom(classroomId)`  |
| Transactions   | `queryKeys.transactions.all`, `queryKeys.transactions.list(classroomId)` |
| Behaviors      | `queryKeys.behaviors.all`                                                |
| Layout presets | `queryKeys.layoutPresets.all`                                            |
| Seating chart  | `queryKeys.seatingChart.*` builders exist for target migration           |

Do not construct inline keys in new data code; read paths and invalidation paths must use the
same builder.

## Hook Status

| Hook                      | State model                                | Notes                                                      |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `useClassrooms`           | TanStack `useQuery` + mutations            | Aggregates student totals and RPC time totals              |
| `useStudents`             | TanStack `useQuery` + mutations + Realtime | Owns student cache and time-total merge behavior           |
| `useTransactions`         | TanStack `useQuery` + mutations + Realtime | Includes canonical optimistic `useAwardPoints` mutation    |
| `useBehaviors`            | TanStack `useQuery` + mutations            | Thin query/mutation wrapper                                |
| `useRealtimeSubscription` | Lifecycle helper                           | Owns Supabase channel setup/cleanup and reconnect callback |
| `useLayoutPresets`        | Legacy `useState` / `useEffect`            | Uses legacy realtime callbacks and non-query return shape  |
| `useSeatingChart`         | Legacy `useState` / `useEffect`            | 1118-line hook with broad operation surface                |
| `useDisplaySettings`      | Local state + `localStorage`               | Card size, point totals, view mode                         |
| `useRotatingCategory`     | Local timer state                          | Leaderboard category rotation                              |
| `useSoundEffects`         | Context-derived audio state                | Plays built-in/custom sounds                               |
| `useAvatarColor`          | Theme-derived helper                       | Resolves avatar background/text contrast                   |
| `usePersistedState`       | Legacy localStorage state                  | Exported but currently unused outside barrel               |

## `AppContext`

`src/contexts/AppContext.tsx` remains the main compatibility layer. It is 797 lines and exposes:

- Active classroom state persisted in `app:activeClassroomId`.
- Legacy mapped app shapes for classrooms/students/behaviors/transactions.
- Imperative wrappers for classroom, student, behavior, and point operations.
- Batch award and undo helpers.
- Derived helpers such as `getStudentPoints`, `getClassPoints`, and `getRecentUndoableAction`.

The facade is useful for existing components but is migration debt. New server-data features should
prefer direct hooks where possible.

### Important wrapper behavior

`awardClassPoints` and `awardPointsToStudents` call per-student mutations in parallel and catch each
item-level rejection, returning only successful rows. This means partial failure is currently
filtered, not surfaced as a thrown orchestrator error. Treat that as a known risk when editing point
award flows.

## Server-State Hooks

### `useClassrooms`

- Query key: `queryKeys.classrooms.all`.
- Reads classrooms with embedded student count.
- Reads all students with stored lifetime totals.
- Calls `get_student_time_totals` per classroom to fill today/week summaries.
- Does not subscribe to Realtime; other hooks invalidate classroom cache.

### `useStudents`

- Query key: `queryKeys.students.byClassroom(classroomId)`.
- Reads students sorted by name.
- Calls `get_student_time_totals` once per classroom query.
- Subscribes to `students` for INSERT/UPDATE/DELETE cache patches.
- Subscribes to `point_transactions` DELETE for cross-device undo/time-total decrement.
- Invalidates on `visibilitychange` to handle day/week boundary transitions.

### `useTransactions`

- Query key: `queryKeys.transactions.list(classroomId)`.
- Subscribes to `point_transactions` and invalidates transaction/classroom caches.
- `useAwardPoints` performs optimistic patches for:
  - transaction list
  - classroom aggregate list
  - student list
- Undo/clear/reset/adjust mutations invalidate transactions, classrooms, and students.

### `useBehaviors`

- Query key: `queryKeys.behaviors.all`.
- Sorts by category and points.
- CRUD mutations invalidate the behavior list.

## Realtime

Current app-level realtime subscriptions:

| Table                | Hook                             | Current behavior                                    |
| -------------------- | -------------------------------- | --------------------------------------------------- |
| `students`           | `useStudents`                    | Merge row changes into student cache                |
| `point_transactions` | `useStudents`, `useTransactions` | DELETE time-total path and transaction invalidation |
| `layout_presets`     | `useLayoutPresets`               | Legacy local-state synchronization                  |

`useRealtimeSubscription` supports:

- `table`, `schema`, `event`, `filter`, `enabled`.
- Preferred `onChange(payload)` callback.
- Legacy `onInsert`, `onUpdate`, `onDelete` callbacks.
- `onStatusChange` and `onReconnect`.
- Cleanup with `supabase.removeChannel(channel)`.

## UI And Local State

| State                                  | Location                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| Current view                           | `App.tsx`, persisted as `app:view` for selected views             |
| Active classroom                       | `AppContext`, persisted as `app:activeClassroomId`                |
| Display settings                       | `useDisplaySettings`, persisted as `classpoints-display-settings` |
| Theme                                  | `ThemeContext`, persisted as `theme`                              |
| Selection mode and modal state         | `DashboardView`                                                   |
| Seating editor local interaction state | `SeatingChartEditor`                                              |
| localStorage migration state           | `MigrationWizard` and `migrateToSupabase` utilities               |

## Data Shape Rules

- DB rows are snake_case and typed in `src/types/database.ts`.
- App-facing shapes are camelCase in `src/types/index.ts`.
- Transform at query boundaries using `src/types/transforms.ts`.
- Transactions intentionally remain DB-shaped for legacy consumers.
- Seating chart transforms live in `src/types/seatingChart.ts`.

## Migration Targets

| Target                 | Why                                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| `useLayoutPresets`     | Convert to TanStack Query and remove legacy realtime callback shape    |
| `useSeatingChart`      | Split broad return shape and move server state to query/mutation hooks |
| `AppContext` wrappers  | Remove server-data pass-throughs after component migration             |
| Batch award error path | Surface partial failures instead of filtering them silently            |
| Supabase error helper  | Preserve `PostgrestError.code` consistently in new/updated hooks       |
