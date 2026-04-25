---
title: 'TanStack Query migration — Phase 3 (`useStudents` + dissolve `refetchStudents` bridge + single-owner students realtime)'
type: 'refactor'
created: '2026-04-25'
status: 'draft'
baseline_commit: '9ecf4ad'
context:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture-trim-V1.md
  - _bmad-output/implementation-artifacts/spec-tanstack-phase-0-1.md
  - _bmad-output/implementation-artifacts/spec-tanstack-phase-2.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - docs/adr/ADR-005-queryclient-defaults.md
  - docs/point-counter-inventory.md
  - scripts/seed-counter-data.ts
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four concrete debts close in this PR.

1. `src/hooks/useStudents.ts` is the last hand-rolled `useState` + `useRealtimeSubscription` hook. Phase 0+1 migrated `useBehaviors`; Phase 2 migrated `useClassrooms` + `useTransactions`; this finishes the migration.
2. `src/contexts/AppContext.tsx` carries `void refetchStudents().catch(...)` at 5 sites (`undoTransaction`, `undoBatchTransaction`, `clearStudentPoints`, `adjustStudentPoints`, `resetClassroomPoints`). Phase 2.5 introduced this as an explicit "Phase 3 bridge" — TanStack invalidation will replace it.
3. `src/hooks/useClassrooms.ts` carries a `students`-table realtime subscription (lines 25-30) added in Phase 2 as a placeholder. With Phase 3 introducing `useStudents`'s own students-table subscription, the same realtime channel would have two owners — wasted bandwidth and ambiguous responsibility. Phase 3 makes `useStudents` the single owner.
4. `updateStudentPointsOptimistically` is a synchronous helper exposed by `useStudents` and called by AppContext at 6 sites (3 forward in award wrappers + 3 in catch-block rollbacks). Classroom-level optimism already lives cleanly inside `useAwardPoints.onMutate`. The student-level optimism should mirror that, removing the helper and 9 call/rollback sites.

**Approach:** Rewrite `useStudents` against TanStack Query. `useStudents(classroomId)` returns `UseQueryResult<StudentWithPoints[], Error>` keyed on `queryKeys.students.byClassroom(classroomId)`. Mutations exported as `useAddStudent` / `useAddStudents` / `useUpdateStudent` / `useRemoveStudent`. The `students`-table realtime subscription moves into `useStudents`'s `onChange`, which **merge-patches** `students.byClassroom` (preserving `today_total`/`this_week_total` per the load-bearing pattern at `useStudents.ts:188-189`) AND invalidates `classrooms.all`. The `point_transactions` DELETE-only subscription stays for cross-device undo time-totals propagation. The visibility-change handler stays for day-boundary refresh. `useAwardPoints.onMutate` extends to a 3rd cache patch (`students.byClassroom`) with idempotency guard, null-guarded rollback, and `onSettled` invalidation. `useClassrooms` deletes its subscription block. `AppContext` adapter shrinks: 6 helper calls + 3 catch rollbacks + 5 refetch bridges all delete; public `AppContextValue` surface is unchanged.

## Boundaries & Constraints

**Always:**

- Phase 0+1 invariants hold. `queryKey`s come from `queryKeys.*` builders only — never inline tuples. DB→App transforms live in `src/types/transforms.ts`, called inside `queryFn` only (FR22, invariant #7).
- Phase 2 invariants hold. The ADR-005 §4 (a)–(e) optimistic-mutation checklist applies to the extended `useAwardPoints`:
  - (a) null-guard `context.previousStudents` in `onError` rollback (`undefined` would write `undefined` into the cache, worse than no rollback)
  - (b) `onMutate` is pure and idempotent — extend the existing `alreadyPatched` guard to cover the 3rd cache patch
  - (c) no temp IDs needed for the student cache (the optimistic patch updates an existing student row, doesn't create one)
  - (d) explicit `onError` + AppContext.error toast — never silent
  - (e) read student state via `qc.getQueryData(queryKeys.students.byClassroom(input.classroomId))`, NOT component closure
- Every `.update(...)` call passes a typed object (supabase-js 2.104 `RejectExcessProperties`). Reference: `src/hooks/useSeatingChart.ts` at commit `cd67ada`.
- `useStudents` post-migration: zero `useState(students|loading|error)`. The `students`-table realtime subscription is owned here (and only here) per ADR-005 §6.
- The `point_transactions` DELETE-only subscription stays inside `useStudents` for cross-device undo — when device A undoes, device B's time totals decrement via this path. ADR-005 §6 confirms the channel.
- The visibility-change handler stays. Day-boundary transitions (cross-midnight, cross-Sunday) require an explicit time-totals refresh that no realtime event will provide.
- **Time-totals merge-on-update.** The `students` realtime `onChange` for an UPDATE event merges the changed row into the cache via `setQueryData`, **preserving the prior `today_total` and `this_week_total` fields**. Do NOT blanket invalidate — that would re-fire `get_student_time_totals` on every point award (DB trigger bumps `students.point_total` → realtime UPDATE → invalidation cascade). Carry the comment from `useStudents.ts:188-189` ("Time totals are preserved from optimistic updates above. They refresh on tab visibility change or full page reload") forward verbatim into the new code.
- **Single-owner realtime.** `useStudents.onChange` invalidates BOTH `queryKeys.students.byClassroom(classroomId)` (its own cache, via merge or explicit invalidate depending on event) AND `queryKeys.classrooms.all` (so `useClassrooms` aggregates refresh). `useClassrooms` no longer subscribes — it consumes invalidations.
- AppContext's public `AppContextValue` interface (`students`, `loading`, `addStudent`, `addStudents`, `updateStudent`, `removeStudent`, `awardPoints`, `awardClassPoints`, `awardPointsToStudents`, `undoTransaction`, `undoBatchTransaction`, `clearStudentPoints`, `adjustStudentPoints`, `resetClassroomPoints`, `getStudentPoints`, etc.) keeps the same call signatures and return contracts. Consumers are not touched.
- Pre-commit hook (lint-staged + typecheck) must not be bypassed.

**Ask First:**

- If a new column is added to the `students` table after Phase 3 ships, audit the merge-on-update pattern in `useStudents`'s `onChange` — the spread-assign needs to know which fields to preserve and which to overwrite.
- If switching classrooms with many students causes a visible stutter on the visibility-change handler (one RPC fan-out per re-mount). Currently the RPC is single-classroom-scoped; deferred entry #8 tracks the broader fan-out problem.
- If `useStudents`'s `onChange` invalidating `classrooms.all` causes a measurable double-fetch storm in tandem with the `point_transactions` realtime subscription that already invalidates `transactions.list(classroomId)` — flag and decide between debouncing or accepting.

**Never:**

- No schema / migration / RLS changes. The `batch_kind` DB column for cross-device subset/class undo labeling stays deferred (entry #7).
- No `DashboardView.tsx` or other component-file edits. The 1Hz `getRecentUndoableAction` polling stays deferred (entry #6).
- No touching `src/hooks/useSeatingChart.ts`, `src/hooks/useLayoutPresets.ts`, `src/hooks/useBehaviors.ts`, or any consumer of `useApp()` other than AppContext itself.
- No removing the `point_transactions` DELETE-only subscription from `useStudents` — it's the cross-device undo time-totals propagation path. ADR-005 §6 requires it.
- No removing the visibility-change handler — it's the only path for day-boundary time-totals refresh.
- No `queryClient.clear()` additions beyond the existing sign-out clear.
- No `crypto.randomUUID()` for temp IDs.
- No `--no-verify`, no `--amend` on pushed commits.

## I/O & Edge-Case Matrix

| Scenario                                                              | Input / State                                  | Expected Output / Behavior                                                                                                                                                                                                                                                                                                                           | Error Handling                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Fresh load — open classroom                                           | Teacher selects a classroom                    | `useStudents(classroomId)` `useQuery` runs: students-table query + `get_student_time_totals` RPC merged in `queryFn`; cache populated with `StudentWithPoints[]` (lifetime totals from columns + time totals from RPC).                                                                                                                              | Supabase error in `queryFn` → throws → `useApp().error` surfaces; UI shows error state                   |
| Award single student (happy path)                                     | Teacher taps "+1" on a student                 | `useAwardPoints.onMutate` patches THREE caches synchronously: `transactions.list(classroomId)` (prepend optimistic tx), `classrooms.all` (bump aggregates), `students.byClassroom(classroomId)` (bump that student's 5 totals). UI updates instantly. Server insert resolves → `onSettled` invalidates all 3 caches → server truth reconciles.       | `mutationFn` throws → `onError` restores all 3 `previous*` snapshots (each null-guarded per ADR-005 §4a) |
| Award single student (StrictMode dev double-invoke)                   | React Strict Mode re-runs `onMutate`           | The existing `alreadyPatched` idempotency guard is extended to skip the 3rd cache patch as well. Single increment, no double-write.                                                                                                                                                                                                                  | N/A — by design                                                                                          |
| Cross-device award (Device A awards, Device B viewing same classroom) | Device A: tap +1                               | Device B: `point_transactions` realtime INSERT → invalidate `transactions.list` + `classrooms.all`; `students` realtime UPDATE (DB trigger fires on `students.point_total` bump) → `useStudents.onChange` **merge-patches** the student row in `students.byClassroom` (preserving `today_total`/`this_week_total`) AND invalidates `classrooms.all`. | Realtime CHANNEL_ERROR → reconnect via Phase 0+1 infra → refetch on reconnect                            |
| Undo single transaction                                               | Teacher taps UndoToast on a single award       | `useUndoTransaction.onSettled` invalidates `transactions.all` + `classrooms.all` + `students.all`. Server DELETE commits → `point_transactions` realtime DELETE → `useStudents`'s DELETE handler decrements time totals via `setQueryData`. **No `void refetchStudents()` bridge runs — it's deleted.**                                              | Mutation error → AppContext.error toast surfaces                                                         |
| Undo batch transaction (class award or subset award)                  | Teacher taps UndoToast on a class/subset award | `useUndoBatchTransaction.onSettled` invalidates same 3 caches. N realtime DELETE events fire; each updates time totals.                                                                                                                                                                                                                              | Same                                                                                                     |
| Clear student points                                                  | Settings → Clear student points                | `useClearStudentPoints.onSettled` invalidates same 3 caches. **No `refetchStudents` bridge.**                                                                                                                                                                                                                                                        | Same                                                                                                     |
| Adjust student points to target                                       | Settings → Adjust to N                         | `useAdjustStudentPoints.onSettled` invalidates same 3 caches. `AdjustNoOpError` still null-returns at the AppContext adapter (no-op delta=0 unchanged).                                                                                                                                                                                              | `AdjustNoOpError` → wrapper returns null; other errors → AppContext.error                                |
| Reset classroom points                                                | Settings → Reset                               | `useResetClassroomPoints.onSettled` invalidates same 3 caches plus clears `batchKindRef.current.clear()` (Phase 2.5 behavior preserved).                                                                                                                                                                                                             | Same                                                                                                     |
| Add student                                                           | New-student form submitted                     | `useAddStudent.onSettled` invalidates `students.byClassroom(classroomId)` + `classrooms.all`. `students` realtime INSERT fires; `useStudents.onChange` is dedup'd by id (already in cache from optimistic insert / direct mutation result).                                                                                                          | Mutation throws → adapter `catch` returns `null` (legacy contract)                                       |
| Remove student                                                        | Settings → Delete student                      | `useRemoveStudent.onSettled` invalidates same. `students` realtime DELETE fires; `useStudents.onChange` removes from cache.                                                                                                                                                                                                                          | Mutation throws → adapter returns `false`                                                                |
| Tab visibility transition (cross-midnight)                            | User leaves tab open past midnight, returns    | `document.visibilitychange` listener fires → `useStudents` triggers a focused time-totals refresh (RPC re-fetched, merged into cache). Today_total resets to 0 for new day, this_week_total may shift (Sunday→Monday).                                                                                                                               | Non-fatal RPC error → silent fallback to existing cached values                                          |
| Two consecutive undos (F19 race, auto-resolved)                       | User clicks UndoToast twice rapidly within 1s  | TanStack Query per-query-key dedup: only one in-flight refetch per key. Later request reuses the in-flight promise. No "B undone, A still present" stale-state window.                                                                                                                                                                               | N/A                                                                                                      |
| Network disconnect during award                                       | User taps +1 with no connection                | `onMutate` patches all 3 caches optimistically. `mutationFn` pauses per `networkMode: 'online'`. When connectivity returns, mutation resumes. `onSettled` reconciles. (Same paused-mutation gotcha as Phase 2 — deferred entry #5 tracks the missing UI indicator.)                                                                                  | If user closes tab while paused, optimistic patch is lost on next load. Same behavior as Phase 2.        |

</frozen-after-approval>

## Code Map

- `src/lib/queryKeys.ts` — `queryKeys.students.byClassroom(classroomId)` is finally used (Phase 0+1 reserved). Drop the unused `queryKeys.students.timeTotalsByClassroom` (decision: time totals merged into `byClassroom` payload — see Design Notes).
- `src/types/transforms.ts` — add `dbToStudent(row, timeTotals)` mirroring `dbToClassroom`'s aggregate-as-second-arg signature. Returns `StudentWithPoints` (existing type from `useStudents.ts:9-15`).
- `src/hooks/useStudents.ts` — full rewrite:
  - `useStudents(classroomId)` returns `UseQueryResult<StudentWithPoints[], Error>`. `queryFn` runs students-table query + `get_student_time_totals` RPC (one classroom-scoped call), merges via `dbToStudent`, returns sorted array.
  - Export `useAddStudent`, `useAddStudents`, `useUpdateStudent`, `useRemoveStudent` as `useMutation` hooks. `onSettled` invalidates `queryKeys.students.byClassroom(classroomId)` + `queryKeys.classrooms.all`.
  - `useRealtimeSubscription` on `students` table (single owner): `onChange` routes by event type. INSERT → dedup-by-id append via `setQueryData`. UPDATE → merge-patch the matching row, **preserving `today_total`/`this_week_total`** from prior cache value. DELETE → filter out by id. All three events also trigger `qc.invalidateQueries({ queryKey: queryKeys.classrooms.all })` so `useClassrooms` aggregates refresh.
  - `useRealtimeSubscription` on `point_transactions` (DELETE-only) — preserved from current code. When a transaction is deleted server-side (cross-device undo), if the row data carries `student_id`/`points`/`created_at` (REPLICA IDENTITY FULL per migration `005_replica_identity_full.sql`), decrement the affected student's time totals via `setQueryData`. Falls back to invalidation if row data is missing.
  - Visibility-change handler — preserved from current code. On `document.visibilitychange` (visible), explicitly invalidate `queryKeys.students.byClassroom(classroomId)` to force a fresh RPC fetch (day-boundary safety).
- `src/hooks/useClassrooms.ts` — DELETE the `students` subscription block (lines 25-30). Replace with a one-line comment: `// Students-table realtime is owned by useStudents (Phase 3, deferred entry #4 RESOLVED). useClassrooms refreshes via cross-hook invalidation triggered there.`
- `src/hooks/useTransactions.ts`:
  - `useAwardPoints`:
    - Extend `AwardPointsContext` with `previousStudents: StudentWithPoints[] | undefined`.
    - In `onMutate`: add `await qc.cancelQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) })`. Capture `const previousStudents = qc.getQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(input.classroomId))`. Add a 3rd `qc.setQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(input.classroomId), (prev) => prev?.map(s => s.id === input.studentId ? { ...s, point_total: s.point_total + points, positive_total: points > 0 ? s.positive_total + points : s.positive_total, negative_total: points < 0 ? s.negative_total + points : s.negative_total, today_total: s.today_total + points, this_week_total: s.this_week_total + points } : s) ?? prev)`. The arithmetic mirrors what `updateStudentPointsOptimistically` did.
    - Extend the `alreadyPatched` idempotency guard to also short-circuit the 3rd patch.
    - In `onError`: 3rd null-guarded restore (`if (context?.previousStudents !== undefined) qc.setQueryData(queryKeys.students.byClassroom(input.classroomId), context.previousStudents);`).
    - In `onSettled`: 3rd `qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) })`.
  - `useUndoTransaction`, `useUndoBatchTransaction`, `useClearStudentPoints`, `useResetClassroomPoints`, `useAdjustStudentPoints`: add `qc.invalidateQueries({ queryKey: queryKeys.students.all })` to each `onSettled`. Use `students.all` (broader) because the first three mutations don't carry `classroomId` in their input — surgical invalidation isn't worth changing call signatures across AppContext for non-hot-path mutations. `useResetClassroomPoints` and `useAdjustStudentPoints` could be surgical but use `.all` for symmetry.
- `src/contexts/AppContext.tsx`:
  - Replace the `useStudents` destructure with `const studentsQuery = useStudents(activeClassroomId)` plus 4 mutation hook destructures (`useAddStudent`, `useAddStudents`, `useUpdateStudent`, `useRemoveStudent`).
  - `students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])` (use stable EMPTY_ARRAY const to avoid pending-window identity churn — same pattern as classrooms in Phase 2).
  - `studentsLoading = studentsQuery.isPending`, `studentsError = studentsQuery.error`.
  - **Delete `updateStudentPointsOptimistically(...)` calls at all 6 sites:** 3 forward in `awardPoints` (line ~350), `awardClassPoints` (line ~389), `awardPointsToStudents` (line ~444); 3 in catch-block rollbacks (lines ~363, ~407, ~459). All become unnecessary because `useAwardPoints.onMutate` now owns the third cache patch and `onError` rolls it back.
  - **Delete `void refetchStudents().catch(...)` at all 5 sites:** `undoTransaction` (~line 481), `undoBatchTransaction` (~490), `clearStudentPoints` (~619), `adjustStudentPoints` (~646), `resetClassroomPoints` (~663). All become unnecessary because the corresponding mutation hooks' `onSettled` now invalidates `students.all`.
  - Wrap `addStudent` / `addStudents` / `updateStudent` / `removeStudent` as thin `mutateAsync` adapters preserving legacy return contracts (`Promise<DbStudent | null>`, `Promise<DbStudent[]>`, `Promise<void>`, `Promise<void>`).
  - Public `AppContextValue` surface unchanged.
- `_bmad-output/implementation-artifacts/deferred-work.md` — entries #6, #7, #8, #9 already appended pre-spec. Same commit that lands Phase 3 should append "**RESOLVED in `<commit-sha>`**" to entry #4 per entry #9.

## Tasks & Acceptance

**Execution (commit per task, in order):**

- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` — append entries #6-#9 (already done pre-spec; no-op for the worker, but verify the entries are present before starting code).
- [ ] `src/lib/queryKeys.ts` — drop `students.timeTotalsByClassroom` (decision: time totals merged into `byClassroom` query). Annotate `students.byClassroom` if helpful.
- [ ] `src/types/transforms.ts` — add `dbToStudent(row: StudentRow, timeTotals: { today_total: number; this_week_total: number }): StudentWithPoints`. Mirror `dbToClassroom`'s shape.
- [ ] `src/hooks/useStudents.ts` — full rewrite per Code Map. Include the carried-forward time-totals-preservation comment.
- [ ] `src/hooks/useClassrooms.ts` — delete `students` subscription block (lines 25-30); add the redirect comment.
- [ ] `src/hooks/useTransactions.ts` — extend `useAwardPoints` for the 3rd cache; add `students.all` invalidation to the 5 other transaction mutation hooks' `onSettled`.
- [ ] `src/contexts/AppContext.tsx` — adapter cleanup (6 helper calls + 3 catch rollbacks + 5 refetch bridges deleted; thin mutateAsync wrappers preserved).
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` — append "**RESOLVED in `<commit-sha>`**" to entry #4 in the same commit that lands the subscription relocation.
- [ ] `docs/point-counter-inventory.md` — update the **Data sources** table and **Write paths** section to reflect Phase 3:
  - Data sources: the `Student today delta (today_total)` and `Student week delta (this_week_total)` rows change `Client read path` from "`useStudents.fetchStudents` calls the RPC" to "`useStudents.queryFn` calls the RPC inside TanStack Query".
  - Data sources: the `Student lifetime net (point_total)` / `positive_total` / `negative_total` rows change from "`useStudents.queryFn` → `students[i].point_total`" wording to reflect the merged query (RPC + columns in one queryFn).
  - Write paths #2 (Optimistic client writes): replace the `updateStudentPointsOptimistically` line with "`useAwardPoints.onMutate` patches THREE caches: `transactions.list(classroomId)`, `classrooms.all`, AND `students.byClassroom(classroomId)` (Phase 3 absorbed the helper)."
  - Write paths #3 (Optimistic rollback): mention the 3rd null-guarded `previousStudents` restore.
  - Write paths #4 (Realtime-driven writes): the `students` UPDATE subscription line moves from `useStudents.ts:176-201` to its new line in the rewritten file; same for the `point_transactions` DELETE handler. The `useClassrooms.ts:25-30` `students` subscription line is removed (no longer exists).
  - Write paths #5 (Explicit refetch): mark the entire bullet as **REMOVED in Phase 3** — `void refetchStudents()` no longer exists at any AppContext call site.
- [ ] Manual smoke matrix.

**Acceptance Criteria (greppable invariants):**

- Given `src/hooks/useStudents.ts` post-migration, when `rg "useState" <file>` runs, then 0 matches.
- Given `src/contexts/AppContext.tsx`, when `rg "updateStudentPointsOptimistically" src/` runs repo-wide, then 0 matches (helper deleted everywhere).
- Given `src/contexts/AppContext.tsx`, when `rg "refetchStudents" <file>` runs, then 0 matches (5 bridges dissolved).
- Given `src/hooks/useClassrooms.ts`, when `rg "table: 'students'" <file>` runs, then 0 matches (was 1 in Phase 2).
- Given `src/hooks/useStudents.ts`, when `rg "table: 'students'" <file>` runs, then exactly 1 match (subscription relocated here).
- Given `src/hooks/useStudents.ts`, when `rg "table: 'point_transactions'" <file>` runs, then exactly 1 match (DELETE-only, ADR-005 §6).
- Given `src/hooks/useTransactions.ts`, when `rg "previousStudents" <file>` runs, then ≥ 2 matches (snapshot + null-guarded rollback in `useAwardPoints`).
- Given `src/hooks/useTransactions.ts`, when `rg "students\.byClassroom" <file>` runs, then ≥ 4 matches (`useAwardPoints` cancel + getQueryData + setQueryData + onSettled invalidate).
- Given `src/hooks/useTransactions.ts`, when `rg "students\.all" <file>` runs, then ≥ 5 matches (one per non-AwardPoints mutation hook's `onSettled`).
- Given `src/hooks/useStudents.ts`, when `rg "from '\.\./types/transforms'" <file>` runs, then exactly 1 match (transform boundary present, invariant #7).
- Given `src/`, when `rg "queryKey:\s*\[" src/ --glob '!src/lib/queryKeys.ts'` runs, then 0 matches (Phase 0+1 invariant #3 holds).
- Given `src/`, when `rg "invalidateQueries\(\{\s*queryKey:\s*\[" src/` runs, then 0 matches (invariant #4 holds).
- Given `npm run lint && npm run typecheck && npm test -- --run`, when executed, then all pass (104 unit tests baseline; 4 pre-existing `e2e.legacy/` collection failures unchanged).
- Given `npm run build && npm run check:bundle`, when executed, then no devtools leak in prod bundle.
- Given two browser tabs, when Tab A awards "+1" on a student, then Tab B's UI shows the updated student-card today_total + class banner today within ~1 second WITHOUT the RPC re-firing on every realtime UPDATE event (verify via DevTools network panel — only the initial fetch + invalidation refetches should appear).
- Given a forced server error during awardPoints (revoke INSERT permission locally), when teacher taps "+1", then ALL THREE caches (transactions, classrooms, students) revert within ~1s; AppContext.error toast surfaces.
- Given Settings → Clear student points, when executed, then student totals zero out without a manual refresh (proves no `refetchStudents` bridge — it doesn't exist anymore — and the mutation's `onSettled` invalidation is sufficient).

## Design Notes

**Why `useAwardPoints` owns student-level optimism (decision 1):** Phase 2 already gave `useAwardPoints` ownership of the classroom-aggregate cache. The arithmetic in `updateStudentPointsOptimistically` (`useStudents.ts:383-398`) is identical to the per-student arithmetic inside the existing classroom-cache patch (`useTransactions.ts:146-156`). Splitting the same arithmetic across two files indefinitely is the wrong factoring. Folding it consolidates ownership and removes the AppContext bridge entirely. Symmetric with how Phase 2 handled `updateClassroomPointsOptimistically` (also deleted, also folded into `useAwardPoints.onMutate`).

```ts
// Extended AwardPointsContext (in useTransactions.ts):
interface AwardPointsContext {
  previousTransactions: DbPointTransaction[] | undefined;
  previousClassrooms: ClassroomWithCount[] | undefined;
  previousStudents: StudentWithPoints[] | undefined;  // NEW
  optimisticId: string;
  alreadyPatched: boolean;
}

// Extended onMutate (3rd cache patch added):
onMutate: async (input) => {
  await qc.cancelQueries({ queryKey: queryKeys.transactions.list(input.classroomId) });
  await qc.cancelQueries({ queryKey: queryKeys.classrooms.all });
  await qc.cancelQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) });  // NEW

  const previousTransactions = qc.getQueryData<DbPointTransaction[]>(queryKeys.transactions.list(input.classroomId));
  const previousClassrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);
  const previousStudents = qc.getQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(input.classroomId));  // NEW

  // ... existing alreadyPatched check, transactions patch, classrooms patch ...

  if (!alreadyPatched) {
    const points = input.behavior.points;
    qc.setQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(input.classroomId), (prev) =>
      prev?.map((s) =>
        s.id === input.studentId
          ? {
              ...s,
              point_total: s.point_total + points,
              positive_total: points > 0 ? s.positive_total + points : s.positive_total,
              negative_total: points < 0 ? s.negative_total + points : s.negative_total,
              today_total: s.today_total + points,
              this_week_total: s.this_week_total + points,
            }
          : s
      ) ?? prev
    );
  }

  return { previousTransactions, previousClassrooms, previousStudents, optimisticId, alreadyPatched };
},
onError: (_err, input, context) => {
  if (context?.previousTransactions !== undefined) qc.setQueryData(queryKeys.transactions.list(input.classroomId), context.previousTransactions);
  if (context?.previousClassrooms !== undefined) qc.setQueryData(queryKeys.classrooms.all, context.previousClassrooms);
  if (context?.previousStudents !== undefined) qc.setQueryData(queryKeys.students.byClassroom(input.classroomId), context.previousStudents);  // NEW
},
onSettled: (_data, _err, input) => {
  qc.invalidateQueries({ queryKey: queryKeys.transactions.list(input.classroomId) });
  qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
  qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(input.classroomId) });  // NEW
},
```

**Why the time-totals merge-on-update is load-bearing (decision 3):** The `students` realtime UPDATE event fires on every DB-trigger-initiated change to `students.point_total` / `positive_total` / `negative_total` (which fires on every `point_transactions` INSERT/DELETE). If `useStudents.onChange` handled UPDATE by blanket-invalidating `students.byClassroom`, every point award would trigger the `get_student_time_totals` RPC again — even though the time totals didn't change in a way realtime can carry. The current code at `useStudents.ts:188-189` explicitly preserves time totals across UPDATE for this reason. The new code does the same via `setQueryData` merge:

```ts
// In useStudents's students-table onChange:
if (payload.eventType === 'UPDATE') {
  qc.setQueryData<StudentWithPoints[]>(
    queryKeys.students.byClassroom(classroomId),
    (prev) =>
      prev?.map((s) =>
        s.id === payload.new.id
          ? {
              ...s,
              // Lifetime totals from server (DB trigger updated them)
              point_total: payload.new.point_total ?? s.point_total,
              positive_total: payload.new.positive_total ?? s.positive_total,
              negative_total: payload.new.negative_total ?? s.negative_total,
              // Other fields from server
              name: payload.new.name ?? s.name,
              avatar_color: payload.new.avatar_color ?? s.avatar_color,
              // Time totals: preserve from cache. They refresh via:
              //   1. point_transactions DELETE realtime (decrements on undo)
              //   2. visibility-change handler (day-boundary)
              //   3. mutation onSettled invalidations (undo/clear/adjust/reset)
              today_total: s.today_total,
              this_week_total: s.this_week_total,
            }
          : s
      ) ?? prev
  );
  // Cross-hook: aggregates in classrooms.all need to refresh
  qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
}
```

**Why the 3 mutations without `classroomId` invalidate `students.all` (decision 9):** `useUndoTransaction`, `useUndoBatchTransaction`, `useClearStudentPoints` take inputs that don't include `classroomId`. Adding it would touch all AppContext call sites unnecessarily for non-hot-path settings-level mutations. Broader invalidation is acceptable: only one classroom is active at a time, only `students.byClassroom(activeClassroomId)` is being subscribed to via `useQuery`, and the broader key matches it. The cost is a single extra cache key check.

**F19 closes for free.** Phase 2.5 hunter v2's F19 finding (two consecutive undos producing concurrent in-flight `fetchStudents` with later-response-wins race) is auto-resolved by TanStack Query: per-query-key dedup ensures only one in-flight refetch per cache key. The second click's invalidation reuses the in-flight promise rather than starting a new request.

**Three deferred items consciously not in scope.** Cross-references: F18 → entry #6 (`DashboardView` polling), F11 → entry #7 (`batch_kind` DB column), entry #8 (batched time-totals RPC). These are all documented in `deferred-work.md` and surface as follow-up PRs.

**Adapter shrink in AppContext.tsx is large but mechanical.** 6 helper calls + 3 catch rollbacks + 5 refetch bridges = 14 small deletions. None of them change the public `AppContextValue` shape. The 4 student mutations (add/addBatch/update/remove) become thin `mutateAsync` wrappers preserving the legacy `Promise<X | null>` / `Promise<void>` contracts — same pattern as the Phase 2 / 2.5 mutation wrappers.

## Verification

**Commands:**

- `npm run typecheck` — expected: pass.
- `npm run lint` — expected: pass with 0 new warnings.
- `npm test -- --run` — expected: 104 unit tests pass; 4 pre-existing `e2e.legacy/` collection failures unchanged.
- `npm run build && npm run check:bundle` — expected: no devtools leak.
- All 13 greppable invariants from Acceptance Criteria.
- `npx supabase start && npm run test:seed && npm run test:e2e` — expected: pass.

**Manual smoke setup:** Local Supabase (`npx supabase start`) + test user (`npm run test:seed`) + seeded counter data (`npx tsx scripts/seed-counter-data.ts` — 3 classrooms, 45 students, ~600 transactions across today/this-week/lifetime windows). DevTools throttled to Slow 3G. Login as `test@classpoints.local`. Reference screenshots of every counter type are at `docs/screenshots/counters/` — visually compare each post-migration to confirm zero UX regression.

**Manual smoke matrix:**

1. **Fresh login on home** — three classrooms render with correct totals; switching into a classroom loads students with today_total reflecting recent transactions (RPC ran).
2. **Award single point — happy path** — tap "+1 Respectful" on a student. Student card lifetime, today, and class banner totals update under 50ms (before network panel shows POST response). After server confirms, no flicker.
3. **Award single point — forced server error** — locally `REVOKE INSERT ON point_transactions` from the test user, then tap "+1". UI updates optimistically, then ALL THREE counters revert within ~1s when insert fails. AppContext.error toast surfaces.
4. **Class-wide award + undo via toast** — tap class banner, award "+1 Respectful" to all students. UndoToast reads "Entire Class (N students)". Click Undo. All students' today + lifetime + class banner totals decrement back. **Verify in DevTools network panel: NO `void refetchStudents` request fires** — the bridge is gone.
5. **Multi-select subset award + undo** — select 3 students from selection mode, award "+1". UndoToast reads "3 students" (NOT "Entire Class"). Click Undo. Only those 3 decrement.
6. **Adjust student points** — Settings → Adjust a student to a new total. Manual transaction inserted; today + lifetime reflect immediately on close. **Verify no `void refetchStudents` ran.**
7. **Reset classroom points** — Settings → Reset. All student lifetimes go to 0; activity log clears. **Verify no `void refetchStudents` ran.**
8. **Two-tab cross-device test** — Tab A awards "+1" on a student. Tab B (same classroom open): student card today + class banner today update within ~1 second. **Critical verify**: in Tab B's network panel, no `get_student_time_totals` RPC fires on the realtime UPDATE event. The merge-on-update pattern is working — only the initial query and the mutation's `onSettled` invalidation should produce RPC traffic.
9. **Cross-device add/delete student** — Tab A adds a new student via Settings. Tab B reflects the new student card within ~1s without manual refresh. Tab A removes a student. Tab B reflects removal within ~1s.
10. **Tab visibility transition (day-boundary, hard test)** — open the app at 11:55 PM. Wait until 12:05 AM with the tab in background. Bring tab to foreground. Today_total should reset to 0 (or to today's awards if any happened cross-midnight via realtime DELETE handler) — visibility handler invalidated `students.byClassroom`.
11. **F19 race auto-resolution** — open DevTools network. Tap UndoToast on a single transaction, then immediately tap Undo on the next-most-recent (within ~500ms). Network panel: only ONE `get_student_time_totals` RPC fires, not two (TanStack per-key dedup).
12. **React Query Devtools** (dev only) — confirm `['students', '<classroomId>']`, `['transactions', 'list', '<classroomId>']`, `['classrooms']` queries cycle correctly through fresh → stale → fetching → fresh on focus refetches.

## Suggested Review Order

**Pre-spec groundwork**

- Deferred-work.md entries #6-#9 (already appended; reference targets in the spec).
  [`deferred-work.md:48`](../implementation-artifacts/deferred-work.md#L48)

**Query keys + transforms (low-risk)**

- `students.timeTotalsByClassroom` removed; `students.byClassroom` annotated.
  `src/lib/queryKeys.ts`

- `dbToStudent` mirroring `dbToClassroom`.
  `src/types/transforms.ts`

**`useStudents` rewrite (the bulk)**

- `useStudents(classroomId)` as `useQuery` over students + RPC merged.
  `src/hooks/useStudents.ts`

- 4 split mutation hooks (add/addBatch/update/remove) with `students.byClassroom` + `classrooms.all` invalidation.
  `src/hooks/useStudents.ts`

- `students` realtime subscription with merge-on-update (load-bearing time-totals preservation).
  `src/hooks/useStudents.ts`

- `point_transactions` DELETE-only subscription preserved.
  `src/hooks/useStudents.ts`

- Visibility-change handler preserved (day-boundary).
  `src/hooks/useStudents.ts`

**Cross-hook subscription relocation**

- `useClassrooms.ts` deletes its `students` subscription block; adds the redirect comment.
  `src/hooks/useClassrooms.ts`

- Deferred entry #4 marked **RESOLVED** with the same commit's SHA.
  `_bmad-output/implementation-artifacts/deferred-work.md`

**`useAwardPoints` 3rd-cache extension**

- `AwardPointsContext` extended; `onMutate` cancel/get/setQueryData/idempotency for 3rd cache.
  `src/hooks/useTransactions.ts`

- `onError` 3rd null-guarded rollback.
  `src/hooks/useTransactions.ts`

- `onSettled` 3rd `invalidateQueries`.
  `src/hooks/useTransactions.ts`

**Other transaction mutations get `students.all` invalidation**

- `useUndoTransaction`, `useUndoBatchTransaction`, `useClearStudentPoints`, `useResetClassroomPoints`, `useAdjustStudentPoints` — `onSettled` adds `students.all` invalidate.
  `src/hooks/useTransactions.ts`

**AppContext adapter cleanup (PRD Risk 3 — preserve consumer surface)**

- `useStudents` destructure replaced with `studentsQuery` + 4 mutation hooks.
  `src/contexts/AppContext.tsx`

- 6 `updateStudentPointsOptimistically(...)` call sites deleted.
  `src/contexts/AppContext.tsx`

- 5 `void refetchStudents().catch(...)` sites deleted.
  `src/contexts/AppContext.tsx`

- 4 student mutation thin `mutateAsync` wrappers preserve legacy contracts.
  `src/contexts/AppContext.tsx`
