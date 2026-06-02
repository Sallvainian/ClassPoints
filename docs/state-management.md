# State Management

_Generated 2026-06-02 (exhaustive full rescan; HEAD `c9ca66f` on `main`)._

## Summary

ClassPoints has a two-layer state model:

1. **Server state** lives in TanStack Query for migrated domains (`useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`) and in hand-rolled `useState + useEffect` for the two legacy hooks (`useLayoutPresets`, `useSeatingChart`). The migrated four are the canonical templates for new code.
2. **UI / session state** lives in component-local `useState` for transient UI, in `AppContext` for the single cross-cutting selection (active classroom), and in 3 dedicated contexts for orthogonal concerns (auth, theme, sound).

**Phase 4 (commit `d8cde26`) dissolved the AppContext server-data facade.** `AppContext.tsx` dropped from ~710 LOC to **33** — it now holds ONLY `activeClassroomId` + `setActiveClassroom`. The ~20 mutation wrappers, the camelCase adapter bridges, the point/transaction selectors, the undo-window machinery, and the batch-correlation map were relocated to direct TanStack hooks plus five thin transitional modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `pointSelectors`, `batchKindStore`). See "AppContext" and "Phase 4 transitional modules" below.

Per-device prefs use `localStorage` directly (`useDisplaySettings`, `ThemeContext`). Cross-device prefs use Supabase tables (`SoundContext` → `user_sound_settings`).

## Provider stack

`src/main.tsx` mounts (`DevtoolsGate` is a sibling of `<App />` inside `QueryClientProvider`):

```tsx
<StrictMode>
  <QueryClientProvider client={queryClient}>
    <App />
    <DevtoolsGate />
  </QueryClientProvider>
</StrictMode>
```

`DevtoolsGate` lives in `src/components/DevtoolsGate.tsx`; its DEV-only gated dynamic-import dead-code-elimination pattern is unchanged — see Component Inventory and ADR-005 / `npm run check:bundle`.

`src/App.tsx` (`:115-128`) wraps `<AppContent />`:

```
AuthProvider
  AuthGuard         (renders <AuthPage /> when no user)
    ThemeProvider
      SoundProvider
        AppProvider
          AppContent
```

`AppContent` (`App.tsx:42`) reads only `setActiveClassroom` from `useApp()` (`:43`) and the roster from `useAppClassrooms()` (`:44`); it lazy-loads 5 top-level views (`MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`, `App.tsx:13-27`) inside `<Suspense>`.

## QueryClient defaults (`src/lib/queryClient.ts`)

ADR-005 §1 — load-bearing for the optimistic-mutation phases (unchanged this range):

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

Note: `students.byClassroom` deliberately keys ONLY on classroom id (no extra "list" segment) because Phase 3 merges the students-table columns + `get_student_time_totals` RPC into a single `byClassroom` cache (`queryKeys.ts:12-16`). The prior `timeTotalsByClassroom` separate key was never used at a call site and is dropped — don't reintroduce it.

## Migrated hooks (TanStack)

### `useClassrooms` (`src/hooks/useClassrooms.ts`)

Returns `UseQueryResult<ClassroomWithCount[], Error>`. **NO realtime subscription** (`:12-14`) — `useStudents` is the single owner; `useClassrooms` refreshes via cross-hook invalidation. The `queryFn` (`:16-100`):

1. Two parallel `.select()` queries: classrooms (with embedded `students(count)`) and ALL students (only the columns needed for aggregation).
2. `Promise.all` over `get_student_time_totals` per classroom (one RPC per classroom for the home view).
3. Builds a per-classroom aggregate (lifetime totals from `students.point_total/positive_total/negative_total`, plus per-student `today_total / this_week_total` from RPC).
4. Maps each classroom row through `dbToClassroom` with the precomputed `ClassroomAggregate`.

Mutations: `useCreateClassroom`, `useUpdateClassroom`, `useDeleteClassroom` (`:103-148`). All invalidate `queryKeys.classrooms.all`.

### `useStudents` (`src/hooks/useStudents.ts`)

Returns `UseQueryResult<StudentWithPoints[], Error>`. The SINGLE realtime owner of the `students` table (`:45-51`).

`queryFn` (`:70-106`):

1. `.select('*')` of `students` filtered by `classroom_id`, ordered by name.
2. `get_student_time_totals` RPC for the same classroom (non-fatal: a `rpcError` warns and time totals fall back to 0; lifetime columns are unaffected, `:89-92`).
3. Map each student row through `dbToStudent` with the timeTotals payload (defaults to `{ today_total: 0, this_week_total: 0 }` for students with no rows).

**Realtime — invalidate-not-merge (refactored in `ea9f406`).** This is the key change from the prior doc: there is no longer a merge-on-update path and no separate `point_transactions` DELETE subscription in `useStudents`.

- A single `students`-table subscription with `onChange` AND `onReconnect` both wired to one `refresh` function (`:40-51`).
- `refresh` (`:40-44`) calls ONLY `qc.invalidateQueries` for `students.byClassroom(classroomId)` and `classrooms.all` — never `setQueryData`. The refetch re-reads the authoritative all-time columns AND re-runs `get_student_time_totals`, so every counter (all-time, today, week, roster) refreshes identically.
- The DB trigger emits a `students` UPDATE on every `point_transactions` INSERT/DELETE (migration `011:45-47`), so this one channel covers cross-device **awards AND undos** plus roster changes. The per-tap RPC refetch cost is accepted (ADR-005 §7).
- `onReconnect` runs the same `refresh` so events missed during a realtime drop (CHANNEL_ERROR / TIMED_OUT / CLOSED → SUBSCRIBED) get a catch-up refetch — this channel is the sole cross-device refresh path for student totals.

Visibility-change effect (`:56-68`): on `visibilitychange → visible`, invalidate the byClassroom key — covers cross-midnight and cross-Sunday transitions that produce no realtime event.

Mutations: `useAddStudent`, `useAddStudents`, `useUpdateStudent`, `useRemoveStudent`. All invalidate `students.byClassroom` (or `students.all`) AND `classrooms.all`.

### `useTransactions` (`src/hooks/useTransactions.ts`)

Returns `UseQueryResult<DbPointTransaction[], Error>` — the only migrated hook that intentionally returns the DB shape. Owns the `point_transactions` realtime subscription (any event, classroom-filtered, `:56-66`); `onChange` invalidates `transactions.list(classroomId)` AND `classrooms.all` (invalidate-not-merge).

Mutations:

- **`useAwardPoints`** (`:96`) — THE canonical Phase 2 optimistic mutation. ADR-005 §4 (a)–(e) compliance comments inline (`:84-95`). Patches THREE caches in `onMutate` (`:118`): `transactions.list`, `classrooms.all`, AND `students.byClassroom` (the 3rd cache patch, `:188`, absorbs student-level optimism that previously lived in `AppContext`). Deterministic optimistic id `optimistic-${studentId}-${behaviorId}-${timestamp}` (`:131`) + `alreadyPatched` dedup guard (`:137`) for duplicate/StrictMode-double mutation invocations. Null-guarded `onError` rollback (`:211-227`). `onSettled` invalidates all three keys (`:228-232`). Errors surface via the caller's mutation state (`mutation.error` / `isError`) — e.g. in the award modals — not through `AppContext`.
- `useUndoTransaction` — DELETE by transaction id. `onSettled` invalidates `transactions.all`, `classrooms.all`, `students.all`.
- `useUndoBatchTransaction` — DELETE by `batch_id` for class-wide / multi-select undo. Throws explicitly if `batchId` is empty (`:280`) — otherwise `.eq('batch_id', '')` would silently no-op or `.eq('batch_id', null)` would mass-delete every single-student transaction.
- `useClearStudentPoints` — DELETE all transactions for a student (settings flow).
- `useResetClassroomPoints` — DELETE all transactions in a classroom.
- `useAdjustStudentPoints` — INSERT a delta transaction to reach a target total. Throws `AdjustNoOpError` (custom class, `:22-27`) when delta = 0 — wrappers discriminate via `instanceof AdjustNoOpError`, NOT a string match. Caller passes `currentPointTotal` from React closure (NOT read from cache, which may be mid-invalidate from an unrelated mutation).

### `useBehaviors` (`src/hooks/useBehaviors.ts`)

Returns `UseQueryResult<Behavior[], Error>`. Sorted by category ascending then points descending. NO realtime — refreshes only on mutation. Canonical templates: thin query (`:17-30`), plain mutation `useAddBehavior` (`:32-42`).

Mutations: `useAddBehavior`, `useUpdateBehavior`, `useDeleteBehavior`. All invalidate `behaviors.all`.

## Phase 4 transitional modules (do NOT clone as new patterns)

These five modules exist solely to bridge the callers of the dissolved AppContext facade. They are explicitly transitional — copy the canonical TanStack hooks above for new code, not these.

| Module                           | LOC | Role                                                                                                                                                                                                                                                                                                             | Consumers                                                                     |
| -------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/hooks/useBatchAward.ts`     | 122 | Per-student award fan-out — `awardClass` (`:36`, was `awardClassPoints`) / `awardSubset` (`:78`, was `awardPointsToStudents`). Reads the roster from the `useStudents` cache via `qc.getQueryData` (no 2nd realtime channel); loops `useAwardPoints` over it; tags batch kind in `batchKindStore` (`:46`/`:94`). | `ClassAwardModal`, `MultiAwardModal`                                          |
| `src/hooks/useUndoableAction.ts` | 95  | The 10-second undo window (`UNDO_WINDOW_MS`, `:10`; `getRecentUndoableAction`, `:30`), relocated verbatim from AppContext. Reads transactions via `useTransactions` and the roster from cache; batch-aware aggregation when `batch_id` is set (`:43`).                                                           | `DashboardView`                                                               |
| `src/hooks/useAppClassrooms.ts`  | 60  | Thin camelCase wrappers `useAppClassrooms` (`:12`) / `useActiveClassroom` (`:32`) over `useClassrooms`/`useStudents`, using `dbClassroomToApp`/`dbStudentToApp`. Removed by the casing-normalization follow-up (deferred #22).                                                                                   | App, Sidebar, TeacherDashboard, ProfileView, ClassSettingsView, DashboardView |
| `src/lib/batchKindStore.ts`      | 33  | Module-level `Map<batchId, 'class' \| 'subset'>` (`:17`) shared between `useBatchAward` (writer) and `useUndoableAction` (reader) — different component mounts, so it MUST be module scope, not hook state. Device-local, ephemeral; cross-device/post-reload undo falls back to the 'Entire Class' label.       | `useBatchAward`, `useUndoableAction`                                          |
| `src/utils/pointSelectors.ts`    | 74  | Read-only point/transaction derivations relocated from AppContext: `studentTransactions` (`:19`), `classroomTransactions` (`:29`), `studentPoints` (`:41`, READS stored totals), `classPoints` (`:55`, SUMS stored totals across a subset; no-subset → zeros). Never sums `transaction.points` for display.      | `DashboardView`, `AwardPointsModal`                                           |

**Silent-partial-failure (audit cluster #2, REAL sev 5) — STILL OPEN, relocated.** `useBatchAward`'s `awardClass`/`awardSubset` run per-student `Promise.all` and silently filter rejected promises to nulls (per-item `.catch((err) => { console.error(...); return null; })`, `:62-65` and `:107-110`; survivors via `results.filter((r): r is DbPointTransaction => r !== null)`, `:69`/`:114`). The orchestrator returns only successful results; per-item failures vanish. The header comment (`:16-18`) preserves the silent filter verbatim as a Phase-4 SPEC non-goal. Do NOT infer a clean throw-on-failure contract at the batch call sites just because the underlying `useAwardPoints` mutation throws.

## Generic realtime hook (`src/hooks/useRealtimeSubscription.ts`)

Wraps `supabase.channel(...).on('postgres_changes', ...).subscribe(...)`. Key behaviors:

- **Channel naming**: `${table}-changes-${filter || 'all'}-${crypto.randomUUID()}` (`:106`). The per-mount UUID fixes StrictMode dev double-mount: cleanup → remount happens in the same millisecond, so `Date.now()` collided and the second `.on('postgres_changes', ...)` on a rejoining channel threw (`:101-106`). The mechanism is unchanged under React 19.
- **Callbacks via refs** — a `useEffect` updates `*Ref.current` on every callback prop change (`:64-70`) so the channel does not re-subscribe.
- **`onChange` is preferred** (`:19`) over the legacy `onInsert`/`onUpdate`/`onDelete` triple (`:21-23`). When both are passed, `onChange` wins and a DEV-only warning fires (`:77-83`). The only current legacy consumer is `useLayoutPresets`; new callers must use `onChange`.
- **Status callbacks**: `onStatusChange` fires on every transition (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED). `onReconnect` (`:32`) fires when SUBSCRIBED returns from a failure state — wire it to a refetch so events that arrived while offline aren't silently missed (as `useStudents` does).

## Legacy hand-rolled hooks

### `useLayoutPresets` (`src/hooks/useLayoutPresets.ts`)

170 LOC. Returns `{ presets, loading, error, savePreset, deletePreset, refetch }`. Still uses the legacy realtime callbacks (`onInsert`/`onUpdate`) and a `setState`-in-effect fetch. **DO NOT clone this shape.** Target state is a thin TanStack hook with on-demand invalidation, not realtime (deferred item #11).

### `useSeatingChart` (`src/hooks/useSeatingChart.ts`)

1122 LOC. Returns a 23-value object. No realtime subscription (already matches the target). **DO NOT clone this shape.** Use the canonical `useStudents` / `useTransactions` templates instead. Reshape is deferred item #12.

## React contexts

Each context is split across two sibling files to satisfy `react-refresh/only-export-components` (Fast Refresh requires a module to export only components). The `XContext.tsx` file exports the Provider component **only**; the matching `useX.ts` sibling exports the context value type, the `createContext(...)` object, and the `useX()` consumer hook. `src/contexts/` holds 9 files: 4 provider `*.tsx`, 4 hook `*.ts` siblings, and `AppContext.test.tsx`.

| Provider (`*.tsx`)                   | Type + context + hook (`*.ts`)                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `AppContext.tsx` (`AppProvider`)     | `useApp.ts` (`AppContextValue`, `useApp`)                                      |
| `AuthContext.tsx` (`AuthProvider`)   | `useAuth.ts` (`AuthContextValue`, `useAuth`)                                   |
| `SoundContext.tsx` (`SoundProvider`) | `useSoundContext.ts` (`SoundSettings`, `SoundContextValue`, `useSoundContext`) |
| `ThemeContext.tsx` (`ThemeProvider`) | `useTheme.ts` (`Theme`, `ThemeContextValue`, `useTheme`)                       |

### `AppContext` (`src/contexts/AppContext.tsx`, **33 LOC**; type + `useApp` hook in `src/contexts/useApp.ts`, 21 LOC)

**Phase 4 dissolved the server-data facade (`d8cde26`).** `AppProvider` now holds ONLY the active-classroom selection:

- `activeClassroomId` — initialized from `localStorage` under the named constant `ACTIVE_CLASSROOM_STORAGE_KEY = 'app:activeClassroomId'` (`:4`, `:13-16`), persisted through `setActiveClassroom` (`:18-25`), exposed via a memoized `value` (`:27-30`).
- `setActiveClassroom(id)` — sets React state and writes/removes the localStorage key.

The `AppContextValue` interface (`useApp.ts:3-11`) is exactly `{ activeClassroomId, setActiveClassroom }`. Everything else the old facade carried was relocated:

| Old AppContext responsibility                                                                           | Now lives in                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `awardClassPoints` / `awardPointsToStudents` fan-out                                                    | `useBatchAward` (`awardClass` / `awardSubset`)                                                             |
| `getRecentUndoableAction` + 10s undo window + `batchKindRef`                                            | `useUndoableAction` + `batchKindStore`                                                                     |
| `mappedClassrooms` / `mappedStudents` / `activeClassroom` bridges                                       | `useAppClassrooms` / `useActiveClassroom` + `dbClassroomToApp`/`dbStudentToApp` (`transforms.ts:113,:134`) |
| `getStudentTransactions` / `getClassroomTransactions` / `getStudentPointsStored` / `getClassPoints`     | `pointSelectors.ts`                                                                                        |
| `createClassroom` / `addStudent` / `updateStudent` / … / `adjustStudentPoints` / `resetClassroomPoints` | direct TanStack mutation hooks (`useClassrooms`/`useStudents`/`useTransactions`/`useBehaviors`)            |

**New components MUST call the mutation hooks (or `useBatchAward`) directly and MUST NOT re-add server-data fields, wrappers, or selectors to `AppContext`.** The old "server data via `useApp()`" hazard is structurally eliminated — keep it that way.

**Undo derivation** now lives in `DashboardView` (`src/components/dashboard/DashboardView.tsx`): it reads `activeClassroomId` from `useApp()` (`:36`) and `{ getRecentUndoableAction, forget }` from `useUndoableAction(activeClassroomId)` (`:43`). `getRecentUndoableAction` is a `useCallback` over the TanStack-cached transactions/roster, so it updates immediately on cache change. `DashboardView` derives `undoableAction` via `useMemo` keyed on `[getRecentUndoableAction, tick]` (`:87`), with a 1s `setInterval` `tick` (`:72-75`) that forces re-evaluation so the wall-clock window expires on time, and a `dismissedTxnRef` (`:73`, set at `:162`) that hides the toast for one render after an undo until the post-undo cache update propagates.

### `AuthContext` (`src/contexts/AuthContext.tsx`; type + `useAuth` hook in `src/contexts/useAuth.ts`)

_Unchanged this range._ Owns the Supabase auth lifecycle. The "stale-JWT graceful degrade" is the load-bearing feature:

1. On boot, `getSession()` reads from localStorage.
2. If a cached session exists, validate with `supabase.auth.getUser()` (`:70`).
3. The validation is wrapped in `Promise.race([userPromise, timeoutPromise])` (`:84`) where `timeoutPromise` rejects after 5s (`:78`). `getUser()` accepts no `AbortSignal` and the underlying fetch has no default timeout, so the race is what bounds a hung `/auth/v1/user` — the timeout genuinely fires (the earlier unwired `AbortController` was replaced). If validation throws or times out: `signOut({ scope: 'local' })`, `purgeAuthStorage()` (`:29`, removes every `sb-*` key from `localStorage`, `:102`/`:118`), route to login.
4. `onAuthStateChange` tracks user-id transitions via `prevUserIdRef` (`:17`). The first event (`prev === undefined`) is INITIAL_SESSION and is NOT a transition. A genuine user-id transition → `queryClient.clear()` (`:138`) so user A's cache can't flash on user B's first render.
5. `signOut()` also clears the QueryClient (`:217`) — defense-in-depth that doesn't depend on the listener winning the race.

### `SoundContext` (`src/contexts/SoundContext.tsx`; type + `useSoundContext` hook in `src/contexts/useSoundContext.ts`)

- Owns `AudioContext` + preloaded sound buffers. Synthesizes all `SOUND_DEFINITIONS` on first user interaction (autoplay-policy compliant); throws `'AudioContext not supported'` (`:63`) when the API is unavailable.
- Loads `user_sound_settings` from Supabase on user change. Handles `PGRST116` (no rows) by falling back to `DEFAULT_SETTINGS` (`:138`) and rethrows the original error otherwise (`throw fetchError`, `:141`) — the load-bearing example of code-discriminating Supabase error handling: it needs `.code`, so the `throw <original>` form is required, NOT `throw new Error(error.message)`.
- `updateSettings()` upserts to Supabase with optimistic local update + revert on failure.
- `SoundProvider` sits BELOW auth in the tree because it reads `useAuth()`.

### `ThemeContext` (`src/contexts/ThemeContext.tsx`; type + `useTheme` hook in `src/contexts/useTheme.ts`)

Trivial. `theme: 'light' | 'dark'`, persisted to `localStorage:theme`. Initial value comes from localStorage, falling back to `prefers-color-scheme: dark`. Adds/removes `.dark` class on `<html>`.

## Per-device UI prefs (`useDisplaySettings`)

`localStorage:classpoints-display-settings` JSON: `{ cardSize, showPointTotals, viewMode }`. Defaults `'medium' / false / 'alphabetical'`. Validates types on read; falls back to defaults on bad JSON.

## Adapter contracts (ADR-005 §2)

- **Throw-the-original** (`if (error) throw <original>`) — preserves `error.code` (`PGRST116`, `42501`, …), `error.details`, `error.hint`. Required when consumers discriminate by code. Current sites: `SoundContext.tsx:141` (`throw fetchError`, after `fetchError.code === 'PGRST116'` at `:138`) and `ClassSettingsView.tsx:393` (`throw err`). Preferred for new query/mutation code.
- **Throw-message-only** (`if (error) throw new Error(error.message)`) — currently dominant: exactly **16** sites, all in the four server-state hooks (`useBehaviors.ts`, `useClassrooms.ts`, `useStudents.ts`, `useTransactions.ts`). Drops `error.code`. Audit cluster #1 (REAL) — migration debt toward an `unwrap()` helper or `throw error`.

## State migration / persistence helpers

- `usePersistedState` — debounced (300ms) localStorage save under key `classroom-points-data`. Used by the migration wizard for the legacy `AppState` shape; `migrateState` in `src/utils/migrations.ts` upgrades old payloads.
- `migrateToSupabase` (`src/utils/migrateToSupabase.ts`) — `hasLocalStorageData()` decides whether to surface the migration wizard view in `App.tsx` (`App.tsx:47`).

## What NOT to do

- Don't add fields, wrapper functions, selectors, or server data to `AppContext`. It is UI/session state only; new components call hooks (or `useBatchAward`) directly.
- Don't clone the Phase 4 transitional modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `batchKindStore`, `pointSelectors`) as new patterns — they exist to bridge dissolved-facade callers.
- Don't construct query keys inline. Always use `queryKeys.X.builder(...)`.
- Don't override `queryClient` defaults per-hook (staleTime, gcTime, refetchOnWindowFocus, structuralSharing).
- Don't hand-merge realtime payloads into the cache for the live-sync domains. Invalidate-and-refetch (`useStudents` / `useTransactions`).
- Don't read previous cache state from a component closure inside `onMutate`. Use `qc.getQueryData(key)`.
- Don't use `Date.now()` for realtime channel names. Use `crypto.randomUUID()`.
- Don't subscribe `useClassrooms` to `students` realtime — `useStudents` is the single owner. Use cross-hook invalidation instead.
- Don't clone the legacy hand-rolled hook shapes (`useLayoutPresets`, `useSeatingChart`).
