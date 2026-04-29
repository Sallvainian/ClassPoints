# Deferred Work

Surfaced but deliberately deferred from its originating spec. Each entry records why it was not fixed in-scope, and what the intended follow-up is.

## From spec-tanstack-phase-0-1 (Phase 0 + Phase 1 pilot)

### 1. `resetBehaviorsToDefault` delete-then-insert race, exposed by realtime removal

- **Source:** Phase 1 review (edge case hunter, blind hunter).
- **Scenario:** `AppContext.resetBehaviorsToDefault` does `supabase.from('behaviors').delete(...)` followed by `supabase.from('behaviors').insert(DEFAULT_BEHAVIORS)`. Between the two awaits, the TanStack cache is stale (insert hasn't invalidated yet). If the insert throws, the final `refetchBehaviors()` never runs; cache stays at 0 behaviors until a separate refetch trigger (focus/window event) fires.
- **Pre-existing:** yes. The legacy code had the same race; realtime on the behaviors table used to fill the hole. Phase 1 removed that realtime per PRD FR5 (three-domain rule), so the race is now visible in the absence of a cache invalidation on error.
- **Why deferred:** The user-facing path still surfaces an error toast (`throw new Error('Failed to reset behaviors...')`); the stale cache auto-recovers on next focus. Fixing requires converting `resetBehaviorsToDefault` into a proper `useResetBehaviors` mutation with `onError` cache-restore semantics — larger than Phase 1's pilot scope.
- **Follow-up:** In a dedicated commit (can land in Phase 4 or a small standalone PR), rewrite as `useResetBehaviors` `useMutation` with `onMutate` snapshot + `onError` rollback + `onSettled` invalidate against `queryKeys.behaviors.all`.

### 2. Per-mutation `networkMode` override for non-optimistic mutations (offline behavior)

- **Source:** Phase 1 review (edge case hunter).
- **Scenario:** `QueryClient` defaults set `mutations.networkMode: 'online'` per architecture §QueryClient topology. With non-optimistic mutations (Phase 1 `useAddBehavior` / `useUpdateBehavior` / `useDeleteBehavior`), an offline click pauses the mutation indefinitely — the `mutateAsync` call never resolves, the adapter's `try/catch` never fires, and the caller sees a hang.
- **Why deferred:** Arch-level decision; `networkMode: 'online'` is chosen on the assumption that Phase 2+ optimistic mutations paper over the pause (cache-patch fires immediately; network call pauses). Phase 1's non-optimistic mutations don't have that cover, but behaviors UI is rare-click (settings-level, not hot-path). Arch doc explicitly says "defer to empirical signal, not speculation" for per-hook overrides.
- **Follow-up:** If empirical reports show offline behavior-settings-editing confusion, override to `networkMode: 'always'` on the three behavior mutations. Otherwise let the Phase 4 adapter dissolution and direct hook consumption expose mutation `isPaused` state to callers, who can surface it in UI.

## From user-observed bug (logged during spec-tanstack-phase-2 scoping, 2026-04-24)

### 3. Seating chart realtime updates broken — requires manual refresh

- **Source:** User report (2026-04-24) while scoping Phase 2. "Seating charts don't update real time. I need to refresh."
- **Scenario:** Seating chart is one of the three approved realtime domains per ADR-005 §6 + PRD FR5. Subscription exists in `useSeatingChart.ts`, but cross-device seat moves are not propagating; the second device sees stale layout until a manual refresh.
- **Why deferred:** Out of Phase 2 scope — Phase 2 only touches `useClassrooms` and `useTransactions`. `useSeatingChart` is untouched per the spec's Boundaries constraints. Fixing the subscription likely requires inspecting channel filter, enabled flag, or `onChange` routing specific to the seating-chart hook — a separate focused investigation.
- **Follow-up:** Dedicated bug-fix PR. Start by verifying: (a) the Supabase `seating_charts` table has `REPLICA IDENTITY FULL` or the columns needed for the filter, (b) the `useRealtimeSubscription` filter in `useSeatingChart.ts` matches the row(s) the other device is updating, (c) the channel actually reaches `SUBSCRIBED` status (check dev console for CHANNEL_ERROR), (d) `onChange` / legacy-callback routing isn't swallowing events. Likely a single-file fix in `useSeatingChart.ts` once the root cause is found.

## From spec-tanstack-phase-2 (Phase 2 — classrooms + transactions migration)

### 4. Cross-hook invalidation for `useClassrooms` aggregates when Phase 3 migrates `useStudents`

- **Source:** Phase 2 implementation (2026-04-24). Explicit deferred-work call-out in `spec-tanstack-phase-2.md` Design Notes.
- **Scenario:** Phase 2 keeps a `students`-table realtime subscription inside `useClassrooms` that invalidates `queryKeys.classrooms.all` on any student row change. The subscription is the cross-aggregate refresh trigger: when device A awards points, the DB trigger bumps `students.point_total` → realtime UPDATE event arrives on device B → classroom roll-ups invalidate and refetch. This works, but it means two hooks (`useClassrooms` and, post-Phase-3, `useStudents`) will subscribe to the same `students` table, creating two channels for the same events.
- **Why deferred:** Removing the subscription from `useClassrooms` now would leave cross-device classroom aggregates stuck until a window-focus refetch — regression. Phase 3 migrates `useStudents` and is the natural home for the owning subscription. Phase 2's spec explicitly calls this out as an Ask-First question for Phase 3.
- **Follow-up:** During Phase 3 planning, decide between (a) keeping the `useClassrooms` students-table subscription and accepting the double-subscription cost, or (b) moving the classroom-aggregate refresh trigger into `useStudents`' `onChange` (e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.classrooms.all })` alongside the students invalidation), removing the `useClassrooms` subscription entirely. (b) is cleaner and aligns with ADR-005 §Runtime Channel Count (exactly 3 channels at steady state).
- **RESOLVED in `ac22afd`** — Phase 3 chose option (b). `useStudents` is now the single owner of the `students`-table realtime subscription; its `onChange` invalidates both `students.byClassroom(classroomId)` (via merge-patch) and `classrooms.all`. The `useClassrooms` subscription block was deleted; refresh comes from the upstream invalidation.

### 5. `networkMode: 'online'` paused-mutation UI indicator (now visible with optimistic writes)

- **Source:** Phase 2 implementation (2026-04-24). Evolution of Phase 1's deferred item #2, now more user-visible.
- **Scenario:** `QueryClient` defaults `mutations.networkMode: 'online'` per ADR-005 / arch §QueryClient topology. Phase 2's `useAwardPoints` is optimistic: `onMutate` patches the transactions + classroom caches synchronously, so the UI updates even when offline. But the network call pauses — `mutateAsync` never resolves, `onSettled` never fires, and on tab close the optimistic patch is lost from the cache on next load. The teacher sees a point award that silently disappears.
- **Why deferred:** Fixing needs a UI affordance (per-mutation `isPaused` indicator or a top-level "pending sync" banner) plus a policy decision between `networkMode: 'always'` (queue and succeed-or-error when online) and fail-fast with toast. Neither is a code-only change — it touches UX.
- **Follow-up:** Dedicated PR that wires `awardPointsMutation.isPaused` into `AppContext.error` or a dedicated pending-sync surface, and either (a) keeps `networkMode: 'online'` + shows a visible "awaiting connection" indicator, or (b) overrides to `networkMode: 'always'` and relies on the existing `refetchOnReconnect` infra for consistency checks. Decision needs design input — treat as UX work, not a pure refactor.

## From spec-tanstack-phase-3 scoping (2026-04-25)

### 6. DashboardView polls `getRecentUndoableAction()` on a 1-second interval

- **Source:** Phase 2.5 edge-case-hunter v2 (finding F18). Captured during Phase 3 spec planning.
- **Scenario:** `src/components/dashboard/DashboardView.tsx:43, 57-63` calls `getRecentUndoableAction()` every 1000ms via a `setInterval`, AND on every mutation completion handler (lines 116, 124, 134). Both flows produce a NEW object reference on each call even when the underlying transaction hasn't changed. Phase 2.5 fixed the user-visible symptom (the `UndoToast` timer kept resetting) by deriving a stable `actionKey` (`batchId ?? timestamp`) and using it as the effect dep. Root cause — the polling itself — is untouched. Net effect: a useless 1Hz spin that produces a fresh object even when no transaction was added/removed; benign today but wasteful, and any future `UndoableAction`-derived state needs to know about the polling churn.
- **Why deferred:** Fix lives in `src/components/dashboard/DashboardView.tsx` — a component file. Same scope-creep boundary as Phase 2.5's UndoToast carve-out (Phase 3 strictly does not touch components). The polling is symptomatic, not load-bearing.
- **Follow-up:** Standalone PR. Replace the `setInterval` (`DashboardView.tsx:57-63`) with a memoized derivation from `getRecentUndoableAction` itself — e.g. `useMemo(() => getRecentUndoableAction(), [getRecentUndoableAction])` — so recomputation tracks the selector's real inputs rather than only `useTransactions().data`. If the implementation instead memoizes from raw data, include every dependency that feeds `getRecentUndoableAction` (currently both transactions and students), not just `transactions`. Also remove the per-mutation `setUndoableAction(getRecentUndoableAction())` calls (lines 116, 124, 134) since the memo will handle it. Verifies via React DevTools (no more 1Hz state churn) and the existing `UndoToast` smoke tests.

### 7. `batch_kind` DB column for cross-device subset/class undo labeling

- **Source:** Phase 2.5 edge-case-hunter v2 (finding F11). Captured during Phase 3 spec planning.
- **Scenario:** Phase 2.5 added `batchKindRef = useRef<Map<string, 'class' | 'subset'>>` to `src/contexts/AppContext.tsx` so `getRecentUndoableAction` can label undo toasts as "Entire Class" vs "3 students" depending on which award entry point was used. The Map lives in-memory on the originating device only. Cross-device scenario: teacher awards to a multi-select subset on phone → realtime fires the batch transactions to laptop within the 10-second undo window → laptop's `batchKindRef` is empty → `getRecentUndoableAction` falls back to the `'Entire Class'` label, indistinguishable from a real class-wide award. Same root cause for page-reload-mid-window on the originating device.
- **Why deferred:** Real fix requires persisting the kind: add a `batch_kind` text column to the `point_transactions` table (or to a new `point_batches` summary table), populate it at insert time in both award wrappers, and read it in `getRecentUndoableAction` instead of the in-memory Map. Schema migration touches RLS, requires a Supabase migration file, and runs cross-environment validation — wrong shape for a hook-refactor PR like Phase 3.
- **Follow-up:** Dedicated PR with migration `006_batch_kind.sql` (add column, backfill `NULL` → handled at read), update `awardClassPoints` / `awardPointsToStudents` to set the column, replace `batchKindRef` reads in `getRecentUndoableAction` with `recent.batch_kind`. Keep `batchKindRef` as a cache for during-mutation UX (so the originating device gets the right label before the server INSERT round-trips), but treat the DB column as the source of truth for cross-device readers.

### 8. Batch the `get_student_time_totals` RPC fan-out in `useClassrooms.queryFn`

- **Source:** Phase 2 efficiency review (#2). Re-surfaced during Phase 3 planning because Phase 3's invalidation pattern can amplify the fan-out cost.
- **Scenario:** `src/hooks/useClassrooms.ts:50-58` calls `supabase.rpc('get_student_time_totals', { p_classroom_id: ... })` once per classroom every time the `classrooms.all` query runs. A teacher with 8 classrooms pays 8 round-trips. Phase 3 keeps the `students`-table realtime subscription as a single owner (in `useStudents`), but its `onChange` invalidates `classrooms.all` — so any cross-device student row update (DB trigger from a point award on another device) re-runs the entire 8-RPC fan-out. Pre-existing inefficiency, amplified by Phase 3's pattern.
- **Why deferred:** Real fix is a new DB RPC `get_student_time_totals_all_for_user(p_start_of_today, p_start_of_week)` that returns time totals for every student across every classroom the calling user owns, in a single round-trip. RLS-bounded server-side. Schema/RPC change; out of Phase 3's hook-refactor scope.
- **Follow-up:** Migration adds the new RPC; `useClassrooms.queryFn` (and `useStudents.queryFn` in Phase 3) call the single RPC instead of fanning out. Verifies via network panel (1 RPC call instead of N) and a direct latency benchmark on a teacher with 5+ classrooms.

### 9. Mark deferred entry #4 RESOLVED at Phase 3 ship

- **Source:** Phase 3 planning self-reference.
- **Scenario:** Entry #4 ("cross-hook invalidation handoff for `useClassrooms` aggregates when Phase 3 migrates `useStudents`") tracks the Phase 2 carry-over: a `students`-table realtime subscription lives in `useClassrooms.ts` (lines 25-30) instead of `useStudents.ts`. Phase 3 relocates the subscription to `useStudents` and has its `onChange` invalidate BOTH `students.byClassroom` AND `classrooms.all` — exactly the design entry #4 asked for.
- **Why this is its own entry:** Tracking-only. When Phase 3 lands, the same commit that deletes the `useClassrooms.ts` subscription block should also append "RESOLVED in `<phase-3-commit-sha>`" to entry #4, so future readers don't think it's still pending.
- **Follow-up:** No code action separate from Phase 3. Just the docs maintenance.

---

Append-only. Do not edit entries; add new ones below.

## From project-context refresh / quick-dev backlog (2026-04-29)

These are spec seeds for future `bmad-quick-dev` or story/spec generation. They came from the repo-grounded project-context refresh and the voice-mode discussion that the current architecture is transitional, not a target end state.

### 10. Finish AppContext adapter dissolution for migrated server data

- **Source:** Project-context refresh, transitional architecture review.
- **Scenario:** `AppContext` still exposes migrated server data and mutation wrappers for legacy consumers. This keeps the app working during the TanStack migration, but it makes the architecture look messier than the intended end state and invites agents to add new wrappers.
- **Why deferred:** Requires component-by-component consumption cleanup, not a docs-only refresh.
- **Quick-dev spec seed:** Inventory `useApp()` consumers of `classrooms`, `students`, `transactions`, `behaviors`, and mutation wrappers. Convert one coherent feature slice at a time to direct hooks (`useStudents`, `useAwardPoints`, etc.), then shrink `AppContextValue`.
- **Acceptance:** No new server-data fields in `AppContext`; converted components call direct hooks; existing behavior covered by focused unit/E2E smoke checks; `npm run typecheck` passes.

### 11. Migrate `useLayoutPresets` to TanStack Query and remove legacy realtime

- **Source:** Project-context refresh; `useLayoutPresets` remains hand-rolled.
- **Scenario:** `useLayoutPresets` still uses `useState`/`useEffect`, a legacy `presets/loading/error/refetch` return shape, and a realtime subscription even though layout presets are a non-realtime domain.
- **Why deferred:** Needs hook implementation, consumer adaptation, and regression tests.
- **Quick-dev spec seed:** Replace the hook with `useQuery` + split mutations keyed by `queryKeys.layoutPresets.all`; invalidate on mutation settle; remove layout-presets realtime.
- **Acceptance:** No realtime subscription for `layout_presets`; no `useState` loading/error/data state in the hook; consumers compile; tests cover list/load and mutation invalidation.

### 12. Reshape `useSeatingChart` into TanStack-backed server-state hooks

- **Source:** Project-context refresh; existing Phase 5 target.
- **Scenario:** `useSeatingChart` is still a large hand-rolled hook with a 23-value return shape. Seating chart is an approved realtime domain, but the current hook shape is not the target pattern.
- **Why deferred:** Broad feature-slice refactor with realtime and DnD risk.
- **Quick-dev spec seed:** Split server-state concerns into query/mutation hooks for chart meta, groups, seats, room elements, and layout presets while keeping drag/UI state in components or a later seating-scoped store.
- **Acceptance:** Components do not manipulate query cache directly; realtime routes through `useRealtimeSubscription`; hook API is grouped by concern; existing seating-chart flows still pass smoke tests.

### 13. Collapse `useRealtimeSubscription` legacy callback API

- **Source:** Project-context refresh; legacy callbacks still supported.
- **Scenario:** `useRealtimeSubscription` supports both preferred `onChange` and legacy `onInsert`/`onUpdate`/`onDelete` callbacks. This keeps old callers working but leaves two mental models.
- **Why deferred:** Must wait until legacy callers are migrated.
- **Quick-dev spec seed:** Convert remaining legacy callback callers to `onChange`, then remove the legacy props and dev warning.
- **Acceptance:** `rg "onInsert|onUpdate|onDelete" src/hooks src/components` has no production callers; realtime tests cover INSERT/UPDATE/DELETE routing through `onChange`; type signature no longer exposes legacy props.

### 14. Normalize Supabase error handling behind an `unwrap` helper

- **Source:** Project-context refresh; inconsistent `throw error` vs `new Error(error.message)`.
- **Scenario:** Some hooks preserve Supabase/PostgREST metadata by throwing the original error, while many existing sites lose `code`, `details`, and `hint` by throwing `new Error(error.message)`.
- **Why deferred:** Mechanical but broad; needs careful tests around code-discrimination call sites.
- **Quick-dev spec seed:** Add `unwrap<T>()` in `src/lib/supabase.ts`, migrate hooks incrementally, and preserve original error metadata.
- **Acceptance:** New helper is covered by unit tests; migrated hooks no longer hand-roll `if (error)` branches; `SoundContext`-style code discrimination still works.

### 15. Add runtime validation for JSONB and realtime payload boundaries

- **Source:** Project-context refresh; current casts at trust boundaries.
- **Scenario:** Realtime payloads and seating/layout JSONB data still rely on casts such as `as T` or `as LayoutPresetData`. The TypeScript type is not a runtime guarantee for Supabase payloads or JSONB.
- **Why deferred:** Requires schema choice and careful boundary placement.
- **Quick-dev spec seed:** Add lightweight runtime guards or a schema library for `layout_data` and realtime payload validation at query/subscription boundaries.
- **Acceptance:** Unguarded casts at identified trust boundaries are removed or isolated behind validators; invalid payloads fail safely with test coverage.

### 16. Convert `SoundSettingsModal` to shared `Dialog`

- **Source:** Project-context refresh; modal chrome holdout.
- **Scenario:** Most redesigned modal surfaces use `Modal` or `Dialog`, but `SoundSettingsModal` still re-implements chrome.
- **Why deferred:** UI refactor outside docs refresh.
- **Quick-dev spec seed:** Replace hand-rolled overlay/chrome with `Dialog`, preserving current sound settings behavior and accessibility semantics.
- **Acceptance:** Escape/scroll-lock/ARIA behavior comes from `Dialog`; visual layout remains equivalent; relevant component smoke test or manual Playwright check passes.

### 17. Decide and wire `tdd-guard-vitest`, or remove it from project context as latent tooling

- **Source:** Project-context refresh; package installed but inactive.
- **Scenario:** `tdd-guard-vitest` is installed but not configured in `vitest.config.ts`, so agents should not assume it is enforcing anything.
- **Why deferred:** Tooling policy decision, not a docs-only fact.
- **Quick-dev spec seed:** Decide whether this should be a local-only workflow guard, pre-commit gate, or CI gate; then wire reporters according to the package README, or remove the dependency if not wanted.
- **Acceptance:** Config and docs agree; `npm test -- --run` still works; CI/pre-commit behavior is explicit.
