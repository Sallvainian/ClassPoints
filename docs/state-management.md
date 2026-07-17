# State Management

_Generated 2026-07-17 (exhaustive full rescan; HEAD `e34bbf3` on `main`)._

## Summary

ClassPoints has a two-layer state model:

1. **Server state** lives in TanStack Query for ALL six domains — `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`, `useLayoutPresets` (migrated 2026-06-09, #11/PR #112), and `useSeatingChart` (migrated Phase 5, PR #111). **No hand-rolled `useState + useEffect` server-state hooks remain.** The core four are the canonical templates for new code; `useSeatingChart` is TanStack but its 25-value return shape is not a template.
2. **UI / session state** lives in component-local `useState` for transient UI, in `AppContext` for the single cross-cutting selection (active classroom), and in 3 dedicated contexts for orthogonal concerns (auth, theme, sound).

**Phase 4 (commit `d8cde26`) dissolved the AppContext server-data facade.** `AppContext.tsx` dropped from ~710 LOC to **33** — it now holds ONLY `activeClassroomId` + `setActiveClassroom`. The ~20 mutation wrappers, the camelCase adapter bridges, the point/transaction selectors, and the undo-window machinery were relocated to direct TanStack hooks plus four thin transitional modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `pointSelectors`). A fifth, the in-memory batch-kind map, was deleted by deferred #7 — the batch kind now persists as the `point_transactions.batch_kind` column. See "AppContext" and "Phase 4 transitional modules" below.

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

`src/App.tsx` (157 LOC) wraps `<AppContent />`:

```
AuthProvider
  AuthGuard         (branch precedence: loading → passwordRecovery → ResetPasswordForm
    │                → authSuspended → OfflineGate → no user → AuthPage → children)
    ThemeProvider
      SoundProvider
        AppProvider
          AppContent
```

`AppContent` lazy-loads 5 top-level views (`MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`) inside `<Suspense>`; the view union is `type View = 'home' | 'dashboard' | 'settings' | 'migration' | 'profile'` (`App.tsx:38`) persisted via `PERSISTED_VIEWS` (`:41`). Native-shell wiring in `App.tsx`: `hideSplash()` from a mount effect (`:140-142` — the splash covers the WebView until the first render commits) and `registerBackButton({ isHome, goHome })` (`:67-74` — Android back minimizes from home, otherwise goes home); both are no-ops on web.

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
queryKeys.layoutPresets.all; // ['layoutPresets']
queryKeys.seatingChart.all; // ['seatingChart']
queryKeys.seatingChart.metaByClassroom(classroomId); // ['seatingChart', 'meta', classroomId]
queryKeys.seatingChart.groupsByChart(chartId); // ['seatingChart', 'groups', chartId]
queryKeys.seatingChart.roomElementsByChart(chartId); // ['seatingChart', 'roomElements', chartId]
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

Returns `UseQueryResult<StudentWithPoints[], Error>` (202 LOC file). The SINGLE realtime owner of the `students` table (`:45-51`).

`queryFn`:

1. `.select('*')` of `students` filtered by `classroom_id`, ordered by name.
2. The batched `get_student_time_totals_all_for_user` RPC (`:88-94`), rows filtered to this classroom client-side (`:102`). Deliberately NOT `unwrap()`-ed — a non-fatal warn-and-fallback regime: an `rpcError` warns and time totals degrade to 0; lifetime columns are unaffected (`:85`).
3. Map each student row through `dbToStudent` with the timeTotals payload (defaults to `{ today_total: 0, this_week_total: 0 }` for students with no rows).

**Realtime — invalidate-not-merge (refactored in `ea9f406`).** There is no merge-on-update path and no separate `point_transactions` DELETE subscription in `useStudents`.

- A single `students`-table subscription with `onChange` AND `onReconnect` both wired to one `refresh` function (`:45-51`).
- `refresh` (`:40-44`) calls ONLY `qc.invalidateQueries` for `students.byClassroom(classroomId)` and `classrooms.all` — never `setQueryData`. The refetch re-reads the authoritative all-time columns AND re-runs the batched `get_student_time_totals_all_for_user` RPC, so every counter (all-time, today, week, roster) refreshes identically.
- The DB trigger emits a `students` UPDATE on every `point_transactions` INSERT/DELETE (migration `011:45-47`), so this one channel covers cross-device **awards AND undos** plus roster changes. Per-tap refetch cost is ~1 batched RPC per invalidated queryFn, O(1) in classroom count (ADR-005 §7; deferred #8 pulled 2026-06-11).
- `onReconnect` runs the same `refresh` so events missed during a realtime drop (CHANNEL_ERROR / TIMED_OUT / CLOSED → SUBSCRIBED) get a catch-up refetch — this channel is the sole cross-device refresh path for student totals.

Visibility-change effect (`:56-68`): on `visibilitychange → visible`, invalidate the byClassroom key — covers cross-midnight and cross-Sunday transitions that produce no realtime event (`:54-55`).

Mutations: `useAddStudent`, `useAddStudents`, `useUpdateStudent`, `useRemoveStudent`. All invalidate `students.byClassroom` (or `students.all`) AND `classrooms.all`.

### `useTransactions` (`src/hooks/useTransactions.ts`)

Returns `UseQueryResult<DbPointTransaction[], Error>` (hook at `:66`; 538 LOC file) — the only migrated hook that intentionally returns the DB shape. Owns the `point_transactions` realtime subscription (any event, classroom-filtered, `:82-88`); `refresh` (`:76-81`) invalidates `transactions.list(classroomId)` AND `classrooms.all` (invalidate-not-merge), wired to both `onChange` and `onReconnect`.

Mutations:

- **`useAwardPoints`** (`:120`) — THE canonical single-student Phase 2 optimistic mutation. ADR-005 §4 (a)–(e) compliance comments inline (`:108-118`). Patches THREE caches in `onMutate` (`:139`): `transactions.list`, `classrooms.all`, AND `students.byClassroom` (the 3rd cache patch, `:212-227`, absorbs student-level optimism that previously lived in `AppContext`). Deterministic optimistic id `optimistic-${studentId}-${behaviorId}-${timestamp}` (`:152`) + `alreadyPatched` dedup guard (`:158`) for duplicate/StrictMode-double mutation invocations. The optimistic row stamps `batch_kind: null` (`:173` — "singles aren't batches"). Null-guarded `onError` rollback (`:236-252`). `onSettled` invalidates all three keys (`:253-257`). Errors surface via the caller's mutation state (`mutation.error` / `isError`) — e.g. in the award modals — not through `AppContext`.
- **`useAwardPointsBatch`** (`:272`) — the all-or-nothing batch counterpart to `useAwardPoints` (cluster #2 fix, `30da564`). ONE multi-row `insert(rows).select()` (`:294` — bare `.select()`, NOT `.single()`: N rows are expected) so Postgres commits every row or none; the `011` totals trigger fires per row in the SAME transaction. Every row carries `batch_kind: input.batchKind` (`:285`), and the optimistic rows stamp the same kind (`:336` — they ARE the in-flight label source for `useUndoableAction`, deferred #7). **Throws via `unwrap()`** (#14 — metadata-preserving, so `.code` SQLSTATE survives for `useBatchAward`'s failure classification) — do NOT wrap in `new Error(error.message)`. Optimistic lifecycle as ONE batch-level unit (ADR-005 §4): per-cache snapshot (`:305-307`), one N-row prepend + one aggregate patch (`aggregateDelta = points * studentIds.length`, `:322`), idempotency guard keyed on the FIRST row id (`:315-318`), deterministic ids `optimistic-${batchId}-${studentId}` (`:325`), one null-guarded whole-batch rollback (`:391-407`). Call ONLY via `useBatchAward`, never directly from modals.
- `useUndoTransaction` (`:416`) — DELETE by transaction id. `onSettled` invalidates `transactions.all`, `classrooms.all`, `students.all`.
- `useUndoBatchTransaction` (`:448`) — DELETE by `batch_id` for class-wide / multi-select undo. Throws explicitly if `batchId` is empty — otherwise `.eq('batch_id', '')` would silently no-op or `.eq('batch_id', null)` would mass-delete every single-student transaction.
- `useClearStudentPoints` (`:430`) — DELETE all transactions for a student (settings flow).
- `useResetClassroomPoints` (`:474`) — DELETE all transactions in a classroom.
- `useAdjustStudentPoints` (`:506`) — INSERT a delta transaction to reach a target total. Throws `AdjustNoOpError` (custom class, `:23`) when delta = 0 — wrappers discriminate via `instanceof AdjustNoOpError`, NOT a string match. Caller passes `currentPointTotal` from React closure (NOT read from cache, which may be mid-invalidate from an unrelated mutation).

Three **curated-copy error sites** live here deliberately (`useUndoBatchTransaction`/`useResetClassroomPoints`/`useAdjustStudentPoints`) — fixed user-facing messages that REPLACE the PostgREST message, each annotated "Deliberate curated copy … out of unwrap()'s scope" (`:457-459`, `:482-483`, `:528-529`). Do not migrate them to `unwrap()`.

### `useBehaviors` (`src/hooks/useBehaviors.ts`)

Returns `UseQueryResult<Behavior[], Error>`. Sorted by category ascending then points descending. NO realtime — refreshes only on mutation. Canonical templates: thin query (`:17-30`), plain mutation `useAddBehavior` (`:32-42`).

Mutations: `useAddBehavior`, `useUpdateBehavior`, `useDeleteBehavior`. All invalidate `behaviors.all`.

## Phase 4 transitional modules (do NOT clone as new patterns)

These four modules exist solely to bridge the callers of the dissolved AppContext facade. They are explicitly transitional — copy the canonical TanStack hooks above for new code, not these.

| Module                           | LOC | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Consumers                                                                     |
| -------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/hooks/useBatchAward.ts`     | 253 | Atomic batch-award orchestrator — `awardClass` (`:228`) / `awardSubset` (`:237`). Reads the roster from the `useStudents` cache via `qc.getQueryData` (no 2nd realtime channel), mints one shared `batchId` + timestamp, threads the kind into the batch input (persisted as the DB `batch_kind` column on every row, deferred #7), and fires ONE atomic insert via `useAwardPointsBatch` (`:185`). THROWS `BatchAwardError` (`:27`/`:218`) on any failure — the prior per-student `Promise.all` + silent `.catch(() => null)` filter is GONE (cluster #2 fixed in `30da564`). On failure runs a bounded recovery re-query (`classifyAndRecover`, `:77`; `AbortSignal.timeout(2000)`, `:61`) to name the offending student(s) and disambiguate a lost ack, then records a `failedBatchStore` notice (`:205`). | `ClassAwardModal`, `MultiAwardModal`                                          |
| `src/hooks/useUndoableAction.ts` | 94  | The 10-second undo window (exported `UNDO_WINDOW_MS`, `:12`; `getRecentUndoableAction`, `:33`), relocated from AppContext. Mounts the ONE dashboard `useTransactions` query and exposes it as `transactionsQuery` so `DashboardView` needs no second mount (deferred #22); roster read from cache; batch-aware aggregation when `batch_id` is set, with the label kind read off the rows' `batch_kind` column (deferred #7 — NULL falls back to the class-wide label).                                                                                                                                                                                                                                                                                                                                        | `DashboardView`                                                               |
| `src/hooks/useAppClassrooms.ts`  | 60  | Thin camelCase wrappers `useAppClassrooms` (`:12`) / `useActiveClassroom` (`:32`) over `useClassrooms`/`useStudents`, using `dbClassroomToApp`/`dbStudentToApp`. Removed by the casing-normalization follow-up (deferred #21).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | App, Sidebar, TeacherDashboard, ProfileView, ClassSettingsView, DashboardView |
| `src/utils/pointSelectors.ts`    | 74  | Read-only point/transaction derivations relocated from AppContext: `studentTransactions` (`:19`), `classroomTransactions` (`:29`), `studentPoints` (`:41`, READS stored totals), `classPoints` (`:55`, SUMS stored totals across a subset; no-subset → zeros). Never sums `transaction.points` for display.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `DashboardView`, `AwardPointsModal`                                           |

**Atomic batch awards (audit cluster #2, REAL sev 5) — FIXED in `30da564` (#106).** `useBatchAward`'s `awardClass` (`:228`) / `awardSubset` (`:237`) no longer fan out per-student with a silent `.catch(() => null)` filter. They fire ONE atomic multi-row insert via `useAwardPointsBatch` (`useTransactions.ts:267`) and **THROW `BatchAwardError`** (`useBatchAward.ts:27`/`:218`) on any failure — the Postgres insert is all-or-none, so every row commits or none do. At batch call sites you CAN now rely on a clean throw contract; `ClassAwardModal` / `MultiAwardModal` `await awardClass`/`awardSubset` and catch (the prior "do NOT infer a clean throw-on-failure contract" caveat is GONE). Tracked CLOSED in `_bmad-output/anti-pattern-audit.md` (Cluster 2).

On failure, `classifyAndRecover` (`useBatchAward.ts:77`) runs a deterministic recovery re-query bounded by `AbortSignal.timeout(RECOVERY_TIMEOUT_MS = 2000)` (`:61`) that (a) names the offending student(s) via a FRESH server-roster diff (`:104-126`, not a cache-vs-cache diff — the cache still lists a concurrently-deleted student) and (b) disambiguates a lost network ack: if the batch actually committed it returns `{ outcome: 'committed' }` and suppresses as success (CAP-6, `:197-202`). Genuine failures `record()` a session-ephemeral notice in `failedBatchStore` (`:205`), surfaced as a synthetic FAILED activity-feed entry (CAP-3).

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

## Formerly-legacy hooks — now TanStack (migration COMPLETE)

### `useLayoutPresets` (`src/hooks/useLayoutPresets.ts`, 196 LOC)

Migrated to TanStack (deferred #11, PR #112, 2026-06-09): one `useQuery` on `queryKeys.layoutPresets.all` (`:118`) plus two mutations (`useSaveLayoutPreset` `:32`, `useDeleteLayoutPreset` `:106`) behind a wrapper that preserves the legacy null/boolean contract (`savePreset → LayoutPreset | null`, `deletePreset → boolean`, `:22-24`). No realtime subscription (non-realtime domain). Zod guards the `layout_data` JSONB boundary in BOTH directions (#15): pre-insert `layoutPresetDataSchema.safeParse(layoutData)` throws `LayoutPresetValidationError` on bad input and persists the VALIDATED object (`:66-70`, `:87`); the read-side queryFn filters invalid rows per-row with a `console.warn` instead of failing the whole query (`:128-146` — valid presets still render).

### `useSeatingChart` (`src/hooks/useSeatingChart.ts`, 1340 LOC)

Migrated to TanStack (Phase 5, PR #111). Server state lives in **3 per-table caches** — `seatingChart.metaByClassroom(classroomId)` (`:110`), `seatingChart.groupsByChart(chartId)` (`:133`), `seatingChart.roomElementsByChart(chartId)` (`:164`) — reassembled into the chart blob via `useMemo` (`:187`). **17 `useMutation`s**, all optimistic with `onMutate` snapshot / `onError` rollback / `onSettled` invalidate. The four multi-statement seat operations go through the atomic RPCs (deferred #27) wrapped in `unwrap()`: `seating_assign_student` (`:578`), `seating_swap_students` (`:703` — server reads both occupants under `FOR UPDATE`; the client sends only seat ids), `seating_randomize` (`:775`), `seating_apply_preset` (`:1210`). `unassignStudent` stays a plain single-row update (`:647`). `actionError` is derived from mutation state — `allMutations.find((m) => m.error !== null)?.error ?? null` (`:1267`), never `useState`. NO realtime subscription: "Seating is a non-realtime domain (ADR-005 §6, CAP-4): freshness comes from onSettled invalidation only" (`:104-105`).

**The 25-value return shape (`:1313-1339`) is NOT a template** — new domains should return the plain `UseQueryResult` + separate mutation hooks like `useBehaviors`/`useClassrooms`.

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
| `getRecentUndoableAction` + 10s undo window + `batchKindRef`                                            | `useUndoableAction` (kind read off the rows' `batch_kind` DB column since deferred #7)                     |
| `mappedClassrooms` / `mappedStudents` / `activeClassroom` bridges                                       | `useAppClassrooms` / `useActiveClassroom` + `dbClassroomToApp`/`dbStudentToApp` (`transforms.ts:113,:134`) |
| `getStudentTransactions` / `getClassroomTransactions` / `getStudentPointsStored` / `getClassPoints`     | `pointSelectors.ts`                                                                                        |
| `createClassroom` / `addStudent` / `updateStudent` / … / `adjustStudentPoints` / `resetClassroomPoints` | direct TanStack mutation hooks (`useClassrooms`/`useStudents`/`useTransactions`/`useBehaviors`)            |

**New components MUST call the mutation hooks (or `useBatchAward`) directly and MUST NOT re-add server-data fields, wrappers, or selectors to `AppContext`.** The old "server data via `useApp()`" hazard is structurally eliminated — keep it that way.

**Undo derivation** now lives in `DashboardView` (`src/components/dashboard/DashboardView.tsx`): it reads `activeClassroomId` from `useApp()` (`:40`) and `{ getRecentUndoableAction, transactionsQuery }` from `useUndoableAction(activeClassroomId)` (`:51`) — the hook's exposed query is the dashboard's ONLY `useTransactions` mount (deferred #22); the activity feed, failed-batches merge, and loading/error gates all read it. `getRecentUndoableAction` is a `useCallback` over the TanStack-cached transactions/roster, so it updates immediately on cache change. `DashboardView` derives `undoableAction` via `useMemo` keyed on `[getRecentUndoableAction, expiryBump]` (`:102-111`). Wall-clock expiry is event-driven (deferred #6, no `setInterval`): a self-rescheduling one-shot `setTimeout` effect (`:124-150`) keyed on BOTH the action identity key (`` `${batchId ?? transactionId ?? ''}:${timestamp}` ``, `:118-119` — deliberately NOT UndoToast's `batchId ?? timestamp` key, `:113`) AND the `expiryBump` counter (`:100`) fires when the window ends and bumps the counter (`setExpiryBump((n) => (n + 1) % 1_000_000)`, `:146-148`); a fire that still derives non-null (boundary-exact fire under the strict comparison; optimistic→real `created_at` swap) re-runs the effect and reschedules against the CURRENT remaining window — never a stuck toast. A `dismissedTxnRef` (`:101`, read in the memo at `:105-109`) hides the toast for one render after an undo. ACCEPTED trade-off: with the 1Hz interval gone, `TodaySummary` relative-time labels no longer refresh while idle — they update on the next data-driven render (`:94-97`). The batch label kind is read off the cached rows' `batch_kind` column (`useUndoableAction.ts:56-60` — NULL/legacy rows fall back to the class-wide label; `isClassWide: kind !== 'subset'`, `:71`).

### `AuthContext` (`src/contexts/AuthContext.tsx`, 497 LOC; type + `useAuth` hook in `src/contexts/useAuth.ts`, 52 LOC)

**Heavily reworked by PR #134 (auth resilience) + PR #136 (native Preferences storage).** The governing principle (`:73-74`): _"network-class failure (offline, timeout, 5xx/429) → the session is not proven invalid; keep it"_. Genuine rejection still purges; transient failure never does.

1. **Two-stage bounded boot** (`init()`, `:76`): Stage 1 — `getSession()` raced against an **8s** timeout (`:85-91`; 8s vs getUser's 5s "leaves room for one slow refresh round-trip", `:82-84`). Stage 2 — `getUser()` validation raced against a **5s** timeout (`:176`, `:185`). Both timeouts throw the named `AuthValidationTimeoutError` (`src/lib/supabase.ts:136`).
2. **Network-class discrimination** via `isNetworkClassAuthError` (`src/lib/supabase.ts:157` — WHITELIST semantics: `AuthValidationTimeoutError`, `TypeError`, `AuthRetryableFetchError`, `AuthApiError` status ≥500 or 429, `AuthUnknownError`; anything unclassified = genuine rejection). Genuine rejection → `purgeAndSignOut()` (`:198-203`). Network-class → **keep the cached session** and set `revalidatePending` (`:207-216`); a no-session network failure sets `authSuspended` (`:160`) which `AuthGuard` renders as `OfflineGate`.
3. **Reconnect kick**: `networkStatus.subscribe` (`:273-290`) fires a one-shot revalidation (`revalidate()`, `:257`) when connectivity returns; GoTrue's auto-refresh ticker plus this kick restore the session without user action.
4. **Password recovery**: the implicit-flow reset link SIGNS THE USER IN; `passwordRecovery` is seeded at construction from the boot URL hash (`useState(bootRequestedPasswordRecovery)`, `:23`; captured at module-eval by `src/lib/appUrl.ts` before anything can consume the hash) and also set by the `PASSWORD_RECOVERY` auth event (`:303-306`). `AuthGuard` renders `ResetPasswordForm` while the flag is up.
5. **Storage**: `purgeAuthStorage()` / `storageHasAuthToken()` live in `src/lib/authStorage.ts` — they sweep/probe `sb-*` keys in `localStorage` always, AND Capacitor Preferences on native (`authStorage.ts:86-89`, `:98-102`), because on native the session lives in Preferences (WKWebView localStorage is evictable under storage pressure, `authStorage.ts:9-11`). The Preferences adapter is handed to `createClient` ONLY on native (`supabase.ts:31`).
6. **queryClient.clear() gating**: only a genuine user-id transition clears (`:300-301` — `prev !== undefined && prev !== null && prev !== nextUserId`); INITIAL_SESSION never does (`:24-28`). Explicit `signOut()` also clears (`:407`) — defense-in-depth.
7. **New context surface** (`useAuth.ts:4-42`): `authSuspended`, `passwordRecovery` + `clearPasswordRecovery`, `updatePassword`, and `updateEmail` (success means "requested", not "changed" — confirmation links land on the app root; `resetPassword`/`updateEmail` both use `getAuthEmailRedirectUrl()`, which sends native `capacitor://` builds to the production web URL since non-http(s) protocols can't be email-redirect targets, `appUrl.ts:45-55`).

### `SoundContext` (`src/contexts/SoundContext.tsx`; type + `useSoundContext` hook in `src/contexts/useSoundContext.ts`)

- Owns `AudioContext` + preloaded sound buffers. Synthesizes all `SOUND_DEFINITIONS` on first user interaction (autoplay-policy compliant); throws `'AudioContext not supported'` (`:63`) when the API is unavailable.
- Loads `user_sound_settings` from Supabase on user change. Handles `PGRST116` (no rows) by falling back to `DEFAULT_SETTINGS` (`:138`) and rethrows the original error otherwise (`throw fetchError`, `:141`) — the load-bearing example of code-discriminating Supabase error handling: it needs `.code`, so the `throw <original>` form is required, NOT `throw new Error(error.message)`.
- `updateSettings()` upserts to Supabase with optimistic local update + revert on failure.
- `SoundProvider` sits BELOW auth in the tree because it reads `useAuth()`.

### `ThemeContext` (`src/contexts/ThemeContext.tsx`; type + `useTheme` hook in `src/contexts/useTheme.ts`)

`theme: 'light' | 'dark'`, persisted to `localStorage:theme`. Initial value comes from localStorage, falling back to `prefers-color-scheme: dark`. Adds/removes `.dark` class on `<html>`. The theme-apply effect also calls `syncStatusBar(theme)` (`ThemeContext.tsx:28`, from `src/lib/native.ts`) — keeps the native status-bar text readable against the theme; no-op on web (`:26-27`).

## Per-device UI prefs (`useDisplaySettings`)

`localStorage:classpoints-display-settings` JSON: `{ cardSize, showPointTotals, viewMode }`. Defaults `'medium' / false / 'alphabetical'`. Validates types on read; falls back to defaults on bad JSON.

## Adapter contracts (ADR-005 §2) — normalized behind `unwrap()` (#14, PR #116)

- **`unwrap()` is THE pattern** (`src/lib/supabase.ts:61`): `const data = unwrap(await supabase.from('xs').select('*'))`. It throws on error — Error instances rethrown BY IDENTITY (`:76`); the plain-object literals postgrest-js actually returns are hydrated into a real `new PostgrestError({...})` (`:86-91`) so `code`/`details`/`hint` survive AND `instanceof Error` holds. Missing `code` hydrates to `''` — load-bearing for `useBatchAward`'s network-vs-server classification (`code !== ''`, CAP-6; `supabase.ts:73-75`). **0 hand-rolled `if (error) throw` sites remain in `src/hooks`.** Never flatten to `new Error(error.message)`.
- **Typed discrimination** uses `isPostgrestError(err)` (`supabase.ts:117` — `instanceof` fast-path + structural fallback), not casts.
- **Deliberate exceptions**: the 3 curated-copy sites in `useTransactions.ts` (`:457-459`, `:482-483`, `:528-529` — fixed user-facing messages that REPLACE the PostgREST message; annotated inline, do not migrate) and `SoundContext.tsx` (`throw fetchError` after the `PGRST116` no-rows check — code-discriminating, needs the original).
- **Non-PostgREST surfaces don't use `unwrap()`**: `useDeleteAccount` invokes an Edge Function (`supabase.functions.invoke`) and throws the `FunctionsError` directly; the `useStudents`/`useClassrooms` time-totals RPC deliberately warn-and-degrades to 0 instead of throwing.

## State migration / persistence helpers

- `usePersistedState` — debounced (300ms) localStorage save under key `classroom-points-data`. Used by the migration wizard for the legacy `AppState` shape; `migrateState` in `src/utils/migrations.ts` upgrades old payloads.
- `migrateToSupabase` (`src/utils/migrateToSupabase.ts`) — `hasLocalStorageData()` decides whether to surface the migration wizard view in `App.tsx` (`App.tsx:47`).

## What NOT to do

- Don't add fields, wrapper functions, selectors, or server data to `AppContext`. It is UI/session state only; new components call hooks (or `useBatchAward`) directly.
- Don't clone the Phase 4 transitional modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `pointSelectors`) as new patterns — they exist to bridge dissolved-facade callers.
- Don't construct query keys inline. Always use `queryKeys.X.builder(...)`.
- Don't override `queryClient` defaults per-hook (staleTime, gcTime, refetchOnWindowFocus, structuralSharing).
- Don't hand-merge realtime payloads into the cache for the live-sync domains. Invalidate-and-refetch (`useStudents` / `useTransactions`).
- Don't read previous cache state from a component closure inside `onMutate`. Use `qc.getQueryData(key)`.
- Don't use `Date.now()` for realtime channel names. Use `crypto.randomUUID()`.
- Don't subscribe `useClassrooms` to `students` realtime — `useStudents` is the single owner. Use cross-hook invalidation instead.
- Don't clone `useSeatingChart`'s 25-value return shape for new domains — return `UseQueryResult` + separate mutation hooks (`useBehaviors`/`useClassrooms` style).
- Don't add a 3rd realtime subscription without updating ADR-005 §6 and this doc in the same commit — the "exactly 2" count is load-bearing.
