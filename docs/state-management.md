# State Management

_Generated 2026-04-28 (deep-scan rescan)._

## Summary

ClassPoints has a two-layer state model:

1. **Server state** lives in TanStack Query for migrated domains (`useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`) and in hand-rolled `useState + useEffect` for legacy ones (`useLayoutPresets`, `useSeatingChart`). Migration is in progress; the migrated four are the canonical templates for new code.
2. **UI / session state** lives in component-local `useState` for transient UI, in `AppContext` for cross-cutting things (active classroom, modal flags, batch correlation refs), and in 3 dedicated contexts for orthogonal concerns (auth, theme, sound).

Per-device prefs use `localStorage` directly (`useDisplaySettings`, `ThemeContext`). Cross-device prefs use Supabase tables (`SoundContext` → `user_sound_settings`).

## Provider stack

`src/main.tsx` mounts:

```tsx
<StrictMode>
  <QueryClientProvider client={queryClient}>
    <App />
    <DevtoolsGate />
  </QueryClientProvider>
</StrictMode>
```

`src/App.tsx` wraps `<AppContent />`:

```
AuthProvider
  AuthGuard         (renders <AuthPage /> when no user)
    ThemeProvider
      SoundProvider
        AppProvider
          AppContent
```

## QueryClient defaults (`src/lib/queryClient.ts`)

ADR-005 §1 — load-bearing for the optimistic-mutation phases:

```ts
{
  queries: {
    staleTime: 30_000,            // 30s — background refresh without hammering Supabase during rapid taps
    gcTime: 10 * 60_000,          // 10min — active workflow keeps queries mounted longer than the 5min default
    refetchOnWindowFocus: false,  // Phase 2 optimistic mutations would race with focus refetch
    refetchOnReconnect: true,
    retry: 1,
    networkMode: 'online',
    structuralSharing: true,      // ref-stable data → ref-stable adapter output (load-bearing for Phases 1–3)
  },
  mutations: {
    retry: 0,
    networkMode: 'online',
  },
}
```

Do NOT override these defaults per-hook unless ADR-005 explicitly authorizes it.

## Query keys (`src/lib/queryKeys.ts`)

Single source of truth. Callers MUST import from here; never construct keys inline. Reads AND invalidations both go through these builders so they cannot drift.

```ts
queryKeys.classrooms.all; // ['classrooms']
queryKeys.classrooms.detail(id); // ['classrooms', 'detail', id]
queryKeys.students.all; // ['students']
queryKeys.students.byClassroom(classroomId); // ['students', classroomId]
queryKeys.transactions.all; // ['transactions']
queryKeys.transactions.list(classroomId); // ['transactions', 'list', classroomId]
queryKeys.behaviors.all; // ['behaviors']
queryKeys.layoutPresets.all; // ['layoutPresets'] — legacy
queryKeys.seatingChart.all; // ['seatingChart'] — legacy
queryKeys.seatingChart.metaByClassroom(classroomId);
queryKeys.seatingChart.groupsByChart(chartId);
queryKeys.seatingChart.roomElementsByChart(chartId);
```

Note: `students.byClassroom` deliberately keys ONLY on classroom id (no extra "list" segment) because Phase 3 merges the students-table columns + `get_student_time_totals` RPC into a single `byClassroom` cache. The prior `timeTotalsByClassroom` separate key was never used at a call site.

## Migrated hooks (TanStack)

### `useClassrooms` (`src/hooks/useClassrooms.ts`)

Phase 2. Returns `UseQueryResult<ClassroomWithCount[], Error>`. The `queryFn` does:

1. Two parallel `.select()` queries: classrooms (with embedded `students(count)`) and ALL students (only the columns needed for aggregation).
2. `Promise.all` over `get_student_time_totals` per classroom (one RPC per classroom for the home view).
3. Builds a per-classroom aggregate (lifetime totals from `students.point_total/positive_total/negative_total`, plus per-student `today_total / this_week_total` from RPC).
4. Maps each classroom row through `dbToClassroom` with the precomputed `ClassroomAggregate`.

NO realtime subscription on `classrooms` — refreshes via cross-hook invalidation triggered in `useStudents` and `useTransactions`.

Mutations: `useCreateClassroom`, `useUpdateClassroom`, `useDeleteClassroom`. All invalidate `queryKeys.classrooms.all`.

### `useStudents` (`src/hooks/useStudents.ts`)

Phase 3. Returns `UseQueryResult<StudentWithPoints[], Error>`. The SINGLE realtime owner for both `students` AND `point_transactions` DELETE events.

`queryFn`:

1. `.select('*')` of `students` filtered by `classroom_id`, ordered by name.
2. `get_student_time_totals` RPC for the same classroom.
3. Map each student row through `dbToStudent` with the timeTotals payload (defaults to `{ today_total: 0, this_week_total: 0 }` for students with no rows).

Realtime — `students` table:

- INSERT → dedup-by-id append (server row already carries 0 totals).
- UPDATE → merge-patch the row, **preserving `today_total` / `this_week_total`** (DB trigger bumps lifetime totals on every award; if we invalidated here, the RPC would re-fire on every tap). Time totals are kept fresh via (1) point_transactions DELETE realtime, (2) visibility-change handler, (3) mutation `onSettled` invalidations.
- DELETE → filter by id.
- Every event also invalidates `queryKeys.classrooms.all` so cross-hook aggregates refresh.

Realtime — `point_transactions` DELETE only:

- Locally decrements lifetime AND time-windowed totals on the affected student. Uses `getDateBoundaries()` to decide whether the deleted transaction was today / this week.
- Fallback: if `payload.old` is incomplete, invalidate the whole list (REPLICA IDENTITY FULL on `point_transactions` should make this unreachable).

Visibility-change effect: on `visibilitychange → visible`, invalidate the byClassroom key — covers cross-midnight and cross-Sunday transitions that don't produce a realtime event.

Mutations: `useAddStudent`, `useAddStudents`, `useUpdateStudent`, `useRemoveStudent`. All invalidate `students.byClassroom` AND `classrooms.all` to refresh aggregates.

### `useTransactions` (`src/hooks/useTransactions.ts`)

Phase 2. Returns `UseQueryResult<DbPointTransaction[], Error>` — the only migrated hook that intentionally returns the DB shape.

Realtime: subscribes to `point_transactions` (any event, classroom-filtered). `onChange` → invalidate `transactions.list(classroomId)` AND `classrooms.all`.

Mutations:

- **`useAwardPoints`** — THE canonical Phase 2 optimistic mutation. ADR-005 §4 (a)–(e) compliance comments inline at lines 86-95. Patches THREE caches in `onMutate`: `transactions.list`, `classrooms.all`, AND `students.byClassroom` (the 3rd cache patch was added in Phase 3 to absorb student-level optimism that previously lived in `AppContext`). Deterministic optimistic id `optimistic-${studentId}-${behaviorId}-${timestamp}` + `alreadyPatched` dedup guard for StrictMode safety. Null-guarded `onError` rollback. `onSettled` invalidates all three keys.
- `useUndoTransaction` — DELETE by transaction id. `onSettled` invalidates `transactions.all`, `classrooms.all`, `students.all`.
- `useUndoBatchTransaction` — DELETE by `batch_id` for class-wide / multi-select undo. Throws explicitly if batchId is empty (otherwise `.eq('batch_id', '')` would silently no-op or `.eq('batch_id', null)` would mass-delete every single-student transaction).
- `useClearStudentPoints` — DELETE all transactions for a student (settings flow).
- `useResetClassroomPoints` — DELETE all transactions in a classroom.
- `useAdjustStudentPoints` — INSERT a delta transaction to reach a target total. Throws `AdjustNoOpError` (custom class) when delta = 0 — wrappers discriminate via `instanceof AdjustNoOpError`, NOT a string match. Caller passes `currentPointTotal` from React closure (NOT read from cache, which may be mid-invalidate from an unrelated mutation).

### `useBehaviors` (`src/hooks/useBehaviors.ts`)

Phase 1. Returns `UseQueryResult<Behavior[], Error>`. Sorted by category ascending then points descending. NO realtime — refreshes only on mutation.

Mutations: `useAddBehavior`, `useUpdateBehavior`, `useDeleteBehavior`. All invalidate `behaviors.all`.

## Generic realtime hook (`src/hooks/useRealtimeSubscription.ts`)

Wraps `supabase.channel(...).on('postgres_changes', ...).subscribe(...)`. Key behaviors:

- **Channel naming**: `${table}-changes-${filter || 'all'}-${crypto.randomUUID()}`. Per-mount UUID was introduced in commit `e1b3c49` to fix React 18 StrictMode dev double-mount: cleanup → remount happens in the same millisecond, so `Date.now()` collided. Supabase reuses the existing channel for matching topics, and the second `.on('postgres_changes', ...)` on a joining channel throws.
- **Callbacks via refs** — `useEffect` updates `*Ref.current` on every callback prop change so we don't re-subscribe.
- **`onChange` is preferred** over the legacy `onInsert`/`onUpdate`/`onDelete` triple. When both are passed, `onChange` wins and a DEV-only warning fires.
- **Status callbacks**: `onStatusChange` fires on every transition (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED). `onReconnect` fires when SUBSCRIBED returns from one of the failure states — wire to a refetch so events that arrived while offline aren't silently missed.

## Legacy hand-rolled hooks

### `useLayoutPresets` (`src/hooks/useLayoutPresets.ts`)

166 LOC. Returns `{ presets, loading, error, savePreset, deletePreset, refetch }`. **DO NOT clone this shape.** Target state is a thin TanStack hook with on-demand invalidation, not realtime.

### `useSeatingChart` (`src/hooks/useSeatingChart.ts`)

1118 LOC. Returns 23 fields. **DO NOT clone this shape.** Use the canonical `useStudents` / `useTransactions` templates instead. Reshape is deferred per anti-pattern audit cluster #5.

## React contexts

### `AppContext` (`src/contexts/AppContext.tsx`, 797 LOC)

Phase 4 dissolution target. Holds:

- **UI / session state**: `activeClassroomId` (persisted to `localStorage:app:activeClassroomId`), `batchKindRef` (in-memory Map<batchId, 'class' | 'subset'> — local to the originating device, falls back to "Entire Class" for cross-device or post-reload undo).
- **Adapter bridges**: TanStack hooks reshape into the legacy `useApp()` surface — `mappedClassrooms` (camelCase + per-classroom student summaries), `mappedStudents` (camelCase), `activeClassroom` (resolved from `activeClassroomId`).
- **Imperative wrappers**: `createClassroom`, `addStudent`, `updateStudent`, `removeStudent`, `addBehavior`, `updateBehavior`, `deleteBehavior`, `resetBehaviorsToDefault`, `awardPoints`, `awardClassPoints`, `awardPointsToStudents`, `undoTransaction`, `undoBatchTransaction`, `clearStudentPoints`, `adjustStudentPoints`, `resetClassroomPoints`. Each individual wrapper throws on Supabase failure (ADR-005 §2).

**Wrapper-throw nuance** — `awardClassPoints` and `awardPointsToStudents` orchestrate `Promise.all` over per-student awards and SILENTLY filter rejected promises to nulls (lines 419-422 and 465-468). The orchestrator returns the "successful" results; per-item failures vanish. This is anti-pattern audit cluster #2. Two source comments at `ClassAwardModal.tsx:64` and `MultiAwardModal.tsx:62` claim "wrapper throws on error with automatic rollback" — those comments are LIES, scheduled for deletion.

`getRecentUndoableAction()` returns the most recent transaction within a 10-second window, with batch-aware aggregation when `batch_id` is set. Polled by `DashboardView` on a 1Hz interval.

`getStudentPoints` / `getClassPoints` read from `students.point_total` etc. (stored columns maintained by the DB trigger), NOT computed from `transactions` at call time.

### `AuthContext` (`src/contexts/AuthContext.tsx`)

Owns the Supabase auth lifecycle. The "stale-JWT graceful degrade" is the load-bearing feature here:

1. On boot, `getSession()` reads from localStorage.
2. If a cached session exists, validate with `supabase.auth.getUser()` under a 5s `AbortController` timeout.
3. If validation throws, errors, or times out: `signOut({ scope: 'local' })`, manually purge every `sb-*` key from `localStorage`, route to login.
4. `onAuthStateChange` listener tracks user-id transitions via `prevUserIdRef`. The first event (`prev === undefined`) is INITIAL_SESSION and is NOT treated as a transition. A genuine user-id transition → `queryClient.clear()` so user A's cache can't flash on user B's first render.
5. `signOut()` also clears the QueryClient — defense-in-depth that doesn't depend on the listener winning the race.

### `SoundContext` (`src/contexts/SoundContext.tsx`)

- Owns `AudioContext` + preloaded sound buffers. Synthesizes all `SOUND_DEFINITIONS` on first user interaction (autoplay-policy compliant).
- Loads `user_sound_settings` from Supabase on user change. Handles `PGRST116` (no rows) by falling back to `DEFAULT_SETTINGS` — loadbearing example of code-discriminating Supabase error handling (need `.code` access, so `if (error) throw error` form is required, NOT `throw new Error(error.message)`).
- `updateSettings()` upserts to Supabase with optimistic local update + revert on failure.

### `ThemeContext` (`src/contexts/ThemeContext.tsx`)

Trivial. `theme: 'light' | 'dark'`, persisted to `localStorage:theme`. Initial value comes from localStorage, falling back to `prefers-color-scheme: dark` media query. Adds/removes `.dark` class on `<html>`.

## Per-device UI prefs (`useDisplaySettings`)

`localStorage:classpoints-display-settings` JSON: `{ cardSize, showPointTotals, viewMode }`. Defaults `'medium' / false / 'alphabetical'`. Validates types on read; falls back to defaults on bad JSON.

## Adapter contracts (ADR-005 §2)

- **Throw-the-original** (`if (error) throw error`) — preserves `error.code` (`PGRST116`, `42501`, …), `error.details`, `error.hint`. Required when consumers need to discriminate by code. Only known load-bearing example today: `SoundContext.tsx:148` (`fetchError.code === 'PGRST116'`).
- **Throw-message-only** (`if (error) throw new Error(error.message)`) — currently dominant: 18 sites in TanStack hooks (audit cluster #1, REAL sev 4) + 9 in `useSeatingChart.ts` (out-of-cluster, same pattern). Drops `error.code`. Audit-tagged for migration to an `unwrap()` helper.

## State migration / persistence helpers

- `usePersistedState` — debounced (300ms) localStorage save under key `classroom-points-data`. Used by the migration wizard for the legacy `AppState` shape; `migrateState` in `src/utils/migrations.ts` upgrades old payloads.
- `migrateToSupabase` (`src/utils/migrateToSupabase.ts`) — `hasLocalStorageData()` decides whether to surface the migration wizard view in `App.tsx`.

## What NOT to do

- Don't add fields, wrapper functions, or new parameters to `AppContext`. New components call hooks directly.
- Don't construct query keys inline. Always use `queryKeys.X.builder(...)`.
- Don't override `queryClient` defaults per-hook (staleTime, gcTime, refetchOnWindowFocus, structuralSharing).
- Don't read previous cache state from a component closure inside `onMutate`. Use `qc.getQueryData(key)`.
- Don't use `Date.now()` for realtime channel names. Use `crypto.randomUUID()`.
- Don't subscribe `useClassrooms` to `students` realtime — `useStudents` is the single owner. Use cross-hook invalidation instead.
- Don't clone the legacy hand-rolled hook shapes (`useLayoutPresets`, `useSeatingChart`).
