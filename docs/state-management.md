# State Management

_Generated 2026-06-02 (exhaustive full rescan; HEAD `134a1ef` on `main`)._

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

Note: `students.byClassroom` deliberately keys ONLY on classroom id (no extra "list" segment) because Phase 3 merges the students-table columns + the batched `get_student_time_totals_all_for_user` RPC results (filtered to the classroom) into a single `byClassroom` cache (`queryKeys.ts:12-17`). The prior `timeTotalsByClassroom` separate key was never used at a call site and is dropped — don't reintroduce it.

## Migrated hooks (TanStack)

### `useClassrooms` (`src/hooks/useClassrooms.ts`)

Returns `UseQueryResult<ClassroomWithCount[], Error>`. **NO realtime subscription** (`:13-15`) — `useStudents` is the single owner; `useClassrooms` refreshes via cross-hook invalidation. The `queryFn` (`:19-108`):

1. Two parallel `.select()` queries: classrooms (with embedded `students(count)`) and ALL students (only the columns needed for aggregation).
2. ONE batched `get_student_time_totals_all_for_user` call covering every classroom (deferred #8 collapsed the prior per-classroom `Promise.all` fan-out; non-fatal — an `rpcError` warns and time totals fall back to 0). The totals map is keyed `classroom_id:student_id`.
3. Builds a per-classroom aggregate (lifetime totals from `students.point_total/positive_total/negative_total`, plus per-student `today_total / this_week_total` from RPC).
4. Maps each classroom row through `dbToClassroom` with the precomputed `ClassroomAggregate`.

Mutations: `useCreateClassroom`, `useUpdateClassroom`, `useDeleteClassroom` (`:112-149`). All invalidate `queryKeys.classrooms.all`.

### `useStudents` (`src/hooks/useStudents.ts`)

Returns `UseQueryResult<StudentWithPoints[], Error>`. The SINGLE realtime owner of the `students` table (`:46-52`).

`queryFn` (`:74-114`):

1. `.select('*')` of `students` filtered by `classroom_id`, ordered by name.
2. The same batched `get_student_time_totals_all_for_user` RPC, rows filtered to this classroom client-side (non-fatal: a `rpcError` warns and time totals fall back to 0; lifetime columns are unaffected).
3. Map each student row through `dbToStudent` with the timeTotals payload (defaults to `{ today_total: 0, this_week_total: 0 }` for students with no rows).

**Realtime — invalidate-not-merge (refactored in `ea9f406`).** This is the key change from the prior doc: there is no longer a merge-on-update path and no separate `point_transactions` DELETE subscription in `useStudents`.

- A single `students`-table subscription with `onChange` AND `onReconnect` both wired to one `refresh` function (`:41-52`).
- `refresh` (`:41-45`) calls ONLY `qc.invalidateQueries` for `students.byClassroom(classroomId)` and `classrooms.all` — never `setQueryData`. The refetch re-reads the authoritative all-time columns AND re-runs the batched `get_student_time_totals_all_for_user` RPC, so every counter (all-time, today, week, roster) refreshes identically.
- The DB trigger emits a `students` UPDATE on every `point_transactions` INSERT/DELETE (migration `011:45-47`), so this one channel covers cross-device **awards AND undos** plus roster changes. Per-tap refetch cost is ~1 batched RPC per invalidated queryFn, O(1) in classroom count (ADR-005 §7; deferred #8 pulled 2026-06-11).
- `onReconnect` runs the same `refresh` so events missed during a realtime drop (CHANNEL_ERROR / TIMED_OUT / CLOSED → SUBSCRIBED) get a catch-up refetch — this channel is the sole cross-device refresh path for student totals.

Visibility-change effect (`:57-69`): on `visibilitychange → visible`, invalidate the byClassroom key — covers cross-midnight and cross-Sunday transitions that produce no realtime event.

Mutations: `useAddStudent`, `useAddStudents`, `useUpdateStudent`, `useRemoveStudent`. All invalidate `students.byClassroom` (or `students.all`) AND `classrooms.all`.

### `useTransactions` (`src/hooks/useTransactions.ts`)

Returns `UseQueryResult<DbPointTransaction[], Error>` — the only migrated hook that intentionally returns the DB shape. Owns the `point_transactions` realtime subscription (any event, classroom-filtered, `:69-79`); `onChange` invalidates `transactions.list(classroomId)` AND `classrooms.all` (invalidate-not-merge, `:73-78`).

Mutations:

- **`useAwardPoints`** (`:110`) — THE canonical single-student Phase 2 optimistic mutation. ADR-005 §4 (a)–(e) compliance comments inline (`:97-109`). Patches THREE caches in `onMutate` (`:132`): `transactions.list`, `classrooms.all`, AND `students.byClassroom` (the 3rd cache patch, `:202`, absorbs student-level optimism that previously lived in `AppContext`). Deterministic optimistic id `optimistic-${studentId}-${behaviorId}-${timestamp}` (`:145`) + `alreadyPatched` dedup guard (`:151`) for duplicate/StrictMode-double mutation invocations. Null-guarded `onError` rollback (`:226-242`). `onSettled` invalidates all three keys (`:243-247`). Errors surface via the caller's mutation state (`mutation.error` / `isError`) — e.g. in the award modals — not through `AppContext`.
- **`useAwardPointsBatch`** (`:262`) — the all-or-nothing batch counterpart to `useAwardPoints` (cluster #2 fix, `30da564`). ONE multi-row `insert(rows).select()` (`:281` — bare `.select()`, NOT `.single()`: N rows are expected) so Postgres commits every row or none; the `011` totals trigger fires per row in the SAME transaction. **Throws the RAW PostgREST error** (`if (error) throw error`, `:282`) so `.code` (SQLSTATE) survives for `useBatchAward`'s failure classification — do NOT wrap it in `new Error(error.message)`. Optimistic lifecycle as ONE batch-level unit (ADR-005 §4): per-cache snapshot, one N-row prepend + one aggregate patch (`delta = points * studentIds.length`, `:310`), idempotency guard keyed on the FIRST row id (`:303-308`), deterministic ids `optimistic-${batchId}-${studentId}` (`:313`), one null-guarded whole-batch rollback (`:376-392`). Call ONLY via `useBatchAward`, never directly from modals.
- `useUndoTransaction` — DELETE by transaction id. `onSettled` invalidates `transactions.all`, `classrooms.all`, `students.all`.
- `useUndoBatchTransaction` — DELETE by `batch_id` for class-wide / multi-select undo. Throws explicitly if `batchId` is empty (`:445`) — otherwise `.eq('batch_id', '')` would silently no-op or `.eq('batch_id', null)` would mass-delete every single-student transaction.
- `useClearStudentPoints` — DELETE all transactions for a student (settings flow).
- `useResetClassroomPoints` — DELETE all transactions in a classroom.
- `useAdjustStudentPoints` — INSERT a delta transaction to reach a target total. Throws `AdjustNoOpError` (custom class, `:22-27`) when delta = 0 — wrappers discriminate via `instanceof AdjustNoOpError`, NOT a string match. Caller passes `currentPointTotal` from React closure (NOT read from cache, which may be mid-invalidate from an unrelated mutation).

### `useBehaviors` (`src/hooks/useBehaviors.ts`)

Returns `UseQueryResult<Behavior[], Error>`. Sorted by category ascending then points descending. NO realtime — refreshes only on mutation. Canonical templates: thin query (`:17-30`), plain mutation `useAddBehavior` (`:32-42`).

Mutations: `useAddBehavior`, `useUpdateBehavior`, `useDeleteBehavior`. All invalidate `behaviors.all`.

## Phase 4 transitional modules (do NOT clone as new patterns)

These five modules exist solely to bridge the callers of the dissolved AppContext facade. They are explicitly transitional — copy the canonical TanStack hooks above for new code, not these.

| Module                           | LOC | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Consumers                                                                     |
| -------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/hooks/useBatchAward.ts`     | 252 | Atomic batch-award orchestrator — `awardClass` (`:227`) / `awardSubset` (`:236`). Reads the roster from the `useStudents` cache via `qc.getQueryData` (no 2nd realtime channel), mints one shared `batchId` + timestamp, tags the kind in `batchKindStore` (`:178`), and fires ONE atomic insert via `useAwardPointsBatch` (`:181`). THROWS `BatchAwardError` (`:27`/`:217`) on any failure — the prior per-student `Promise.all` + silent `.catch(() => null)` filter is GONE (cluster #2 fixed in `30da564`). On failure runs a bounded recovery re-query (`classifyAndRecover`, `:68`; `AbortSignal.timeout(2000)`, `:61`) to name the offending student(s) and disambiguate a lost ack, then records a `failedBatchStore` notice (`:204`). | `ClassAwardModal`, `MultiAwardModal`                                          |
| `src/hooks/useUndoableAction.ts` | 101 | The 10-second undo window (exported `UNDO_WINDOW_MS`, `:13`; `getRecentUndoableAction`, `:36`), relocated verbatim from AppContext. Mounts the ONE dashboard `useTransactions` query and exposes it as `transactionsQuery` (`:29`/`:100`) so `DashboardView` needs no second mount (deferred #22); roster read from cache; batch-aware aggregation when `batch_id` is set (`:49`).                                                                                                                                                                                                                                                                                                                                                             | `DashboardView`                                                               |
| `src/hooks/useAppClassrooms.ts`  | 60  | Thin camelCase wrappers `useAppClassrooms` (`:12`) / `useActiveClassroom` (`:32`) over `useClassrooms`/`useStudents`, using `dbClassroomToApp`/`dbStudentToApp`. Removed by the casing-normalization follow-up (deferred #21).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | App, Sidebar, TeacherDashboard, ProfileView, ClassSettingsView, DashboardView |
| `src/lib/batchKindStore.ts`      | 33  | Module-level `Map<batchId, 'class' \| 'subset'>` (`:17`) shared between `useBatchAward` (writer) and `useUndoableAction` (reader) — different component mounts, so it MUST be module scope, not hook state. Device-local, ephemeral; cross-device/post-reload undo falls back to the 'Entire Class' label.                                                                                                                                                                                                                                                                                                                                                                                                                                     | `useBatchAward`, `useUndoableAction`                                          |
| `src/utils/pointSelectors.ts`    | 74  | Read-only point/transaction derivations relocated from AppContext: `studentTransactions` (`:19`), `classroomTransactions` (`:29`), `studentPoints` (`:41`, READS stored totals), `classPoints` (`:55`, SUMS stored totals across a subset; no-subset → zeros). Never sums `transaction.points` for display.                                                                                                                                                                                                                                                                                                                                                                                                                                    | `DashboardView`, `AwardPointsModal`                                           |

**Atomic batch awards (audit cluster #2, REAL sev 5) — FIXED in `30da564` (#106).** `useBatchAward`'s `awardClass` (`:227`) / `awardSubset` (`:236`) no longer fan out per-student with a silent `.catch(() => null)` filter. They fire ONE atomic multi-row insert via `useAwardPointsBatch` (`useTransactions.ts:262`) and **THROW `BatchAwardError`** (`useBatchAward.ts:27`/`:217`) on any failure — the Postgres insert is all-or-none, so every row commits or none do. At batch call sites you CAN now rely on a clean throw contract; `ClassAwardModal` / `MultiAwardModal` `await awardClass`/`awardSubset` and catch (the prior "do NOT infer a clean throw-on-failure contract" caveat is GONE). Tracked CLOSED in `_bmad-output/anti-pattern-audit.md` (Cluster 2).

On failure, `classifyAndRecover` (`useBatchAward.ts:68`) runs a deterministic recovery re-query bounded by `AbortSignal.timeout(RECOVERY_TIMEOUT_MS = 2000)` (`:61`) that (a) names the offending student(s) via a FRESH server-roster diff (`:102-118`, not a cache-vs-cache diff — the cache still lists a concurrently-deleted student) and (b) disambiguates a lost network ack: if the batch actually committed it returns `{ outcome: 'committed' }` and suppresses as success (CAP-6, `:192-197`). Genuine failures `record()` a session-ephemeral notice in `failedBatchStore` (`:204`), surfaced as a synthetic FAILED activity-feed entry (CAP-3).

**Failure-surfacing infrastructure (three new modules, `30da564` — NOT facade-bridge transitional code):**

| Module                          | LOC | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/failedBatchStore.ts`   | 66  | Module-level singleton keyed by `classroomId` (NOT batchId), append-only, device-local + session-ephemeral (survives a `DashboardView` unmount, gone on reload; durable / cross-device history is out of scope). `getByClassroom` returns a STABLE ref (frozen `EMPTY`, `:37`) and `record()` allocates a new newest-first array per write (`:42-48`) — both required for `useSyncExternalStore`. A notice exists because an atomic failure writes ZERO rows; its `points` is informational only.                                                                                                            |
| `src/hooks/useFailedBatches.ts` | 18  | Thin `useSyncExternalStore` read (`:13-17`); sole consumer is `DashboardView` (`:45`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/utils/activityFeed.ts`     | 40  | `mergeFailedIntoFeed(real, failed, dbRows)` (`:18`) injects synthetic FAILED rows (id `failed-${batchId}`, `failed: true`, prepended) and suppresses any notice whose `batchId` now appears among committed `dbRows.batch_id` (CAP-6 late-confirm, `:23-27`). **Suppression keys on the 3rd `dbRows` arg (raw snake_case `batch_id`), NOT `real`** — `real` carries no `batch_id`. The synthetic-only `failed?` marker lives on the app `PointTransaction` (`src/types/index.ts:36`), never on a real DB row; FAILED entries render in `TodaySummary`. Consumed by `DashboardView`'s transactions `useMemo`. |

## Generic realtime hook (`src/hooks/useRealtimeSubscription.ts`)

Wraps `supabase.channel(...).on('postgres_changes', ...).subscribe(...)`. Key behaviors:

- **Channel naming**: `${table}-changes-${filter || 'all'}-${crypto.randomUUID()}` (`:79`). The per-mount UUID fixes StrictMode dev double-mount: cleanup → remount happens in the same millisecond, so `Date.now()` collided and the second `.on('postgres_changes', ...)` on a rejoining channel threw (`:74-79`). The mechanism is unchanged under React 19.
- **Callbacks via refs** — a `useEffect` updates `*Ref.current` on every callback prop change (`:52-56`) so the channel does not re-subscribe.
- **`onChange` is the single change callback** (`:18`) — optional, receiving the full `RealtimePostgresChangesPayload`. The legacy `onInsert`/`onUpdate`/`onDelete` triple and its DEV-only both-supplied warning were removed (deferred #13); status-only subscriptions (just `onStatusChange`/`onReconnect`) remain legitimate.
- **Status callbacks**: `onStatusChange` fires on every transition (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED). `onReconnect` (`:27`) fires when SUBSCRIBED returns from a failure state — wire it to a refetch so events that arrived while offline aren't silently missed (as `useStudents` does).

## Legacy hand-rolled hooks

### `useLayoutPresets` (`src/hooks/useLayoutPresets.ts`)

155 LOC. Returns `{ presets, loading, error, savePreset, deletePreset, refetch }`. Migrated to TanStack (deferred #11, 2026-06-09): a thin `useQuery` (`queryKeys.layoutPresets.all`) plus two plain mutations behind the unchanged 6-key wrapper. No realtime subscription (non-realtime domain) and no legacy callbacks — the prior `setState`-in-effect fetch is gone. No longer a migration target.

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

**Undo derivation** now lives in `DashboardView` (`src/components/dashboard/DashboardView.tsx`): it reads `activeClassroomId` from `useApp()` (`:40`) and `{ getRecentUndoableAction, forget, transactionsQuery }` from `useUndoableAction(activeClassroomId)` (`:51-55`) — the hook's exposed query is the dashboard's ONLY `useTransactions` mount (deferred #22); the activity feed, failed-batches merge, and loading/error gates all read it. `getRecentUndoableAction` is a `useCallback` over the TanStack-cached transactions/roster, so it updates immediately on cache change. `DashboardView` derives `undoableAction` via `useMemo` keyed on `[getRecentUndoableAction, expiryBump]` (`:89-98`). Wall-clock expiry is event-driven (deferred #6, no `setInterval`): a self-rescheduling one-shot `setTimeout` effect (`:119-137`) keyed on BOTH the action identity key (`` `${batchId ?? transactionId ?? ''}:${timestamp}` ``, `:105-107` — deliberately NOT UndoToast's `batchId ?? timestamp` key) AND the `expiryBump` counter fires at `timestamp + UNDO_WINDOW_MS − now + 25ms ε` (NaN-guarded; upper-clamped to one window so extreme future clock skew cannot overflow `setTimeout` into a busy loop) and bumps the counter; a fire that still derives non-null (boundary-exact fire under the strict comparison; optimistic→real `created_at` swap) re-runs the effect and reschedules against the CURRENT remaining window — never a stuck toast. A `dismissedTxnRef` (`:88`, set at `:212`) hides the toast for one render after an undo (the post-undo bump at `:213` replaces the old tick bump). ACCEPTED trade-off: with the 1Hz interval gone, `TodaySummary` relative-time labels no longer refresh while idle — they update on the next data-driven render.

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

- **Throw-the-original** (`if (error) throw <original>`) — preserves `error.code` (`PGRST116`, `42501`, `23503`, …), `error.details`, `error.hint`. Required when consumers discriminate by code. Current sites: `useTransactions.ts:282` (`throw error` in `useAwardPointsBatch`, so `useBatchAward`'s `classifyAndRecover` sees the SQLSTATE `.code`), `SoundContext.tsx:141` (`throw fetchError`, after `fetchError.code === 'PGRST116'` at `:138`), and `ClassSettingsView.tsx:393` (`throw err`). Preferred for new query/mutation code.
- **Throw-message-only** (`if (error) throw new Error(error.message)`) — currently dominant: exactly **17** sites, all in the four server-state hooks (`useBehaviors.ts`, `useClassrooms.ts`, `useStudents.ts`, `useTransactions.ts`). Drops `error.code`. Audit cluster #1 (REAL) — migration debt toward an `unwrap()` helper or `throw error` (the new `useAwardPointsBatch` at `:282` is the first adopter of `throw error`).

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
