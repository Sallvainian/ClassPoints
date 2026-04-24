---
title: 'TanStack Query migration — Phase 2 (`useClassrooms` + `useTransactions` + first optimistic mutation)'
type: 'refactor'
created: '2026-04-24'
status: 'ready'
baseline_commit: 'f9d535e'
context:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture-trim-V1.md
  - _bmad-output/implementation-artifacts/spec-tanstack-phase-0-1.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - docs/adr/ADR-005-queryclient-defaults.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two hot-path hooks still use the hand-rolled `useState/useEffect/useRealtimeSubscription` pattern: `useClassrooms` (drives home screen + dashboard + seating-chart) and `useTransactions` (drives point awards, undo, Today summary). Both survived Phase 1 because Phase 1 scoped to `useBehaviors` only. Today's point-award tap feels sluggish — the UI waits for Supabase round-trip before updating — and `useClassrooms` subscribes to the `classrooms` table even though ADR-005 §6 categorizes `classrooms` as **non-realtime**.

**Approach:** Rewrite both hooks against TanStack Query. `useTransactions` becomes the canonical demonstration of the ADR-005 §4 optimistic-mutation pattern — `useAwardPoints` uses `onMutate` to patch both the transactions cache AND the classrooms-aggregate cache instantly, then reconciles on server response. `useClassrooms` becomes `useQuery` over the existing classroom + student + RPC aggregation, drops its own `classrooms`-table realtime subscription (§6 alignment), and keeps its `students`-table subscription as the refresh trigger for cross-student aggregates until Phase 3 migrates `useStudents`. `AppContext` adapter updates shrink — the manual `updateClassroomPointsOptimistically` + try/catch rollback layer dissolves because `useAwardPoints.onMutate` + `onError` now own that lifecycle. Zero component edits.

## Boundaries & Constraints

**Always:**

- Follow the Phase 0+1 template verbatim. Query keys come from `queryKeys.*` builders only — never inline tuples. DB→App transforms live in `src/types/transforms.ts`, called inside `queryFn` only.
- Every new `useMutation` that introduces `onMutate` MUST pass the ADR-005 §4 (a)–(e) checklist:
  - (a) null-guard `context.previous` in `onError` rollback — `undefined` cancels a rollback silently, leaving the optimistic write in place
  - (b) `onMutate` must be pure and idempotent (React StrictMode double-invokes it in dev)
  - (c) if any optimistic row needs a temp ID, derive it deterministically (content-hash) — never `crypto.randomUUID()`
  - (d) wire `throwOnError: true` OR explicit `onError` + user-visible error surface — never neither
  - (e) read current cache state via `queryClient.getQueryData`, not component closure — closures go stale across re-renders
- Every `.update(...)` call must pass a typed object (`UpdateClassroom`, `UpdateSeatingChart`, etc.) — supabase-js 2.104 enforces `RejectExcessProperties`. The `cd67ada` fix in `src/hooks/useSeatingChart.ts` is the reference pattern.
- `useClassrooms` post-migration: zero `useState(classrooms|loading|error)`, zero direct `supabase.from('classrooms').channel(...)`. The `students`-table realtime subscription stays (it's the cross-hook trigger for classroom aggregates).
- `useTransactions` post-migration: zero `useState(transactions|loading|error)`. The `point_transactions`-table realtime subscription stays (§6 confirms realtime).
- `AppContext`'s public interface (`classrooms`, `loading`, `awardPoints`, `awardPointsToStudents`, `undoTransaction`, `createClassroom`, `updateClassroom`, `deleteClassroom`, `transactions`, `getStudentPoints`, `getStudentTransactions`, `clearStudentPoints`, `refetch*`) keeps the same call signatures and return contracts — consumers are not touched.
- `updateClassroomPointsOptimistically` is deleted from both `useClassrooms` return type and `AppContext` surface. Its logic moves inside `useAwardPoints.onMutate` as a `queryClient.setQueryData(queryKeys.classrooms.all, ...)` patch.
- Pre-commit hook (lint-staged + typecheck) must not be bypassed. The existing `--ignore-scripts` flag for `npm ci` in CI stays.

**Ask First:**

- Any observed runtime behavior change in the ~15 consumer components beyond "identical or faster" during manual smoke.
- If the `students`-table subscription on `useClassrooms` causes a double-render storm with Phase 3's planned `useStudents` realtime subscription — if so, flag and decide between leaving it here vs. moving the classroom-aggregate refresh trigger into the Phase 3 scope.
- If any RPC signature (`get_student_time_totals`) changes during the migration. This hook currently fans out one RPC call per classroom — keep the fan-out, don't attempt a batched RPC redesign in this spec.

**Never:**

- No Phase 3/4/5/6 work. Do not touch `useStudents`, `useLayoutPresets`, `useSeatingChart`, or the 45+ components that read data via `useApp()`.
- No schema / migration / RLS changes.
- No `queryClient.clear()` additions beyond the existing sign-out clear landed in Phase 0+1.
- No `crypto.randomUUID()` for temp IDs — content-hash or skip temp IDs entirely (award-points doesn't need one; the cache patch can target the existing student row).
- No removing the `point_transactions` realtime subscription. ADR-005 §6 requires it (it's one of the three realtime channels that matches PRD FR5).
- No removing the `students`-table subscription from `useClassrooms` without cross-hook invalidation in place. If the subscription goes, cross-device point awards stop updating classroom aggregates until the next window-focus refetch.
- No `--no-verify`, no `--amend` on pushed commits, no weakening the Playwright local-Supabase allow-list.

## I/O & Edge-Case Matrix

| Scenario                                     | Input / State                                                 | Expected Output / Behavior                                                                                                                                                                                                                                                                                                        | Error Handling                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh load, home screen                      | Teacher logs in, lands on home                                | `useClassrooms` `useQuery` runs: classrooms + students + per-classroom RPC aggregate. UI renders classroom cards with counts + totals.                                                                                                                                                                                            | Supabase error → `queryFn` throws → `useApp().error` surfaces; UI shows error state as today                                            |
| Award points — happy path                    | Teacher taps "+1 Respectful" on a student                     | `useAwardPoints.onMutate` fires synchronously: writes optimistic transaction row to `queryKeys.transactions.list(classroomId)`, bumps student + classroom aggregates in `queryKeys.classrooms.all`. UI updates instantly (no spinner). Server `mutationFn` resolves → `onSettled` invalidates both caches, true values reconcile. | `mutationFn` throws → `onError` restores `context.previous` (null-guarded per ADR-005 §4a), toast surfaces error via `AppContext.error` |
| Award points — strict-mode dev double-invoke | React StrictMode mounts `onMutate` twice                      | Cache patches are idempotent: second `onMutate` reads the already-patched state and produces the same result. No double-write.                                                                                                                                                                                                    | N/A — by design                                                                                                                         |
| Award points — network offline               | Teacher taps "+1" with no connection                          | `onMutate` patches cache optimistically. `mutationFn` pauses per `networkMode: 'online'` default. When connectivity returns, mutation resumes and reconciles. If teacher closes tab before, cache reverts on next load.                                                                                                           | Mutation may hang while offline; `isPaused` surface available on mutation state. Deferred: UI indicator for paused state.               |
| Undo — happy path                            | Teacher taps UndoToast                                        | `useUndoTransaction.onMutate` removes transaction from `queryKeys.transactions.list(...)` and decrements classroom aggregate. Server delete resolves → `onSettled` invalidates.                                                                                                                                                   | `onError` null-guards `context.previous`, restores both caches                                                                          |
| Cross-device award                           | Device A awards on a student; Device B viewing same classroom | Device A: optimistic update + server confirm. Device B: `point_transactions` realtime INSERT → cache invalidation → refetch. UI updates within ~1s.                                                                                                                                                                               | Realtime CHANNEL_ERROR → `onStatusChange` hook reconnects → `onReconnect` triggers refetch (Phase 0+1 infra)                            |
| Cross-device classroom edit                  | Device A renames a classroom                                  | Device B shows old name until next window-focus refetch. §6 policy — classrooms is non-realtime.                                                                                                                                                                                                                                  | N/A (accepted)                                                                                                                          |
| Create classroom (non-optimistic)            | Teacher adds "Period 4"                                       | `mutationFn` awaits insert; `onSettled` invalidates `queryKeys.classrooms.all`. Card appears after round-trip. (Consistent with Phase 1 — create operations are infrequent settings actions.)                                                                                                                                     | Mutation throws → adapter `catch` returns `null` (legacy contract)                                                                      |
| Delete classroom                             | Teacher deletes a classroom                                   | Non-optimistic delete; `onSettled` invalidates                                                                                                                                                                                                                                                                                    | Mutation throws → adapter returns `false` (legacy contract)                                                                             |
| `getStudentPoints(studentId)`                | Any consumer calls the helper                                 | Returns same shape as today: `{ total, positiveTotal, negativeTotal, today, thisWeek }`. Derived from `transactionsQuery.data` via `useMemo`.                                                                                                                                                                                     | N/A (pure derivation)                                                                                                                   |
| Hook unmount (NFR6)                          | Classroom-switching removes the mounted subscribers           | Both realtime subscriptions (`students`, `point_transactions`) unmount cleanly; `supabase.removeChannel` called for each                                                                                                                                                                                                          | N/A                                                                                                                                     |
| Two tabs, classroom rename                   | Tab A renames classroom                                       | Tab B shows new name after window-focus refetch (no realtime for classrooms per §6)                                                                                                                                                                                                                                               | N/A                                                                                                                                     |
| Two tabs, point award                        | Tab A awards +1                                               | Tab B: `point_transactions` realtime INSERT → cache invalidation → Tab B's `useTransactions` refetches → classroom aggregate refreshes via `students` realtime fan-out                                                                                                                                                            | N/A                                                                                                                                     |

</frozen-after-approval>

## Code Map

- `src/lib/queryKeys.ts` -- extend with `classrooms.all`, `classrooms.detail(id)`, `transactions.list(classroomId)`, `transactions.student(studentId)` builders. Phase 0+1 already seeded the domain structure; this phase fills in usage.
- `src/types/transforms.ts` -- add `dbToClassroom(row)`, `dbToPointTransaction(row)`. Today's hooks return DB shape directly — this formalizes the boundary per FR22 / invariant #7.
- `src/hooks/useClassrooms.ts` -- rewrite: `useClassrooms()` is `useQuery` over classrooms + students + per-classroom RPC aggregation. Export `useCreateClassroom`, `useUpdateClassroom`, `useDeleteClassroom` as three split `useMutation` hooks (non-optimistic; `onSettled: invalidate(queryKeys.classrooms.all)`). **Drop** the classroom-table realtime subscription. **Keep** the students-table realtime subscription, routed via `useRealtimeSubscription`'s `onChange` — `onChange` does `queryClient.invalidateQueries({ queryKey: queryKeys.classrooms.all })` instead of in-place state mutation.
- `src/hooks/useTransactions.ts` -- rewrite: `useTransactions(classroomId)` is `useQuery` keyed on `queryKeys.transactions.list(classroomId)` with `enabled: !!classroomId`. Export `useAwardPoints`, `useUndoTransaction`, `useClearStudentPoints` as `useMutation` hooks. **`useAwardPoints` is fully optimistic** per ADR-005 §4 — this is the canonical phase-2 demonstration site. Keep the `point_transactions` realtime subscription, routed via `onChange` → `queryClient.invalidateQueries({ queryKey: queryKeys.transactions.list(classroomId) })` plus `queryKeys.classrooms.all`.
- `src/contexts/AppContext.tsx` -- replace current `useClassrooms()`/`useTransactions()` destructures with adapter blocks:
  - `classrooms = useMemo(() => classroomsQuery.data ?? [], [classroomsQuery.data])`
  - `transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data])`
  - `awardPoints = useCallback((studentId, classroomId, behavior, note) => awardPointsMutation.mutateAsync(...).catch(() => null))` — same legacy contract as Phase 1 did for behaviors
  - `awardPointsToStudents = useCallback(...)` — uses the same `awardPointsMutation` in a loop or via `Promise.all`, **no** per-call manual optimistic rollback (the mutation hook owns that lifecycle)
  - `undoTransaction = useCallback((id) => undoMutation.mutateAsync(id))`
  - **Delete** `updateClassroomPointsOptimistically` from the context value and from every caller (all within `AppContext.tsx` itself per the earlier grep)
  - Preserve `AppContextValue` type-surface exactly except for removing `updateClassroomPointsOptimistically`
- `src/hooks/useRealtimeSubscription.ts` -- **No changes.** Phase 1 already added the `onChange` transitional signature; Phase 2 consumes it.

## Tasks & Acceptance

**Execution (follow exactly in order; commit per task):**

- [ ] `src/lib/queryKeys.ts` -- add `classrooms` + `transactions` builders matching arch §Query key conventions. Ensure `transactions.list` takes `classroomId` as the sole scope key.
- [ ] `src/types/transforms.ts` -- add `dbToClassroom(row)` + `dbToPointTransaction(row)`. `dbToClassroom` output should be the extended `ClassroomWithCount` shape (receive the aggregated student payload as a second arg, not reach into DB).
- [ ] `src/hooks/useClassrooms.ts` -- rewrite. Keep the two-step fetch (classrooms + students + RPC fan-out) inside a single `queryFn`. Return type: `UseQueryResult<ClassroomWithCount[]>`. Export three mutations. `useRealtimeSubscription` stays for the students-table only, using `onChange` → invalidate `queryKeys.classrooms.all`.
- [ ] `src/hooks/useTransactions.ts` -- rewrite. `useTransactions(classroomId)` is the query; three mutations exported: `useAwardPoints`, `useUndoTransaction`, `useClearStudentPoints`. **`useAwardPoints`** is the optimistic showcase — follow the ADR-005 §4 checklist literally and paste comments referencing each letter (a-e). `onMutate` patches both `queryKeys.transactions.list(classroomId)` AND `queryKeys.classrooms.all`; `onError` restores both via null-guarded `context.previous*`.
- [ ] `src/contexts/AppContext.tsx` -- adapter bridge: call the new hooks, wire adapter callbacks, delete `updateClassroomPointsOptimistically` and every call site within the file. Preserve every other public signature in `AppContextValue`.
- [ ] Manual smoke (see Verification § Manual checks) against a locally-seeded Supabase stack.

**Acceptance Criteria:**

- Given `src/hooks/useClassrooms.ts` post-migration, when `rg "useState.*loading|useState.*error\b|useState\([^)]*classrooms" <file>` runs, then 0 matches.
- Given `src/hooks/useClassrooms.ts`, when `rg "supabase\.channel\(" <file>` runs, then 0 matches (realtime routed through `useRealtimeSubscription` only).
- Given `src/hooks/useClassrooms.ts`, when `rg "table: 'classrooms'" <file>` runs, then 0 matches (§6 alignment — classrooms is non-realtime).
- Given `src/hooks/useClassrooms.ts`, when `rg "table: 'students'" <file>` runs, then exactly 1 match (cross-aggregate trigger stays until Phase 3).
- Given `src/hooks/useTransactions.ts`, when `rg "useState.*loading|useState.*error\b|useState\([^)]*transactions" <file>` runs, then 0 matches.
- Given `src/hooks/useTransactions.ts`, when `rg "table: 'point_transactions'" <file>` runs, then exactly 1 match (§6 requires this channel).
- Given `src/hooks/useTransactions.ts`, when `rg "onMutate" <file>` runs, then at least 1 match (the award-points optimistic path). When `rg "context\.previous" <file>` runs, all references must be null-guarded (no unconditional dereferences).
- Given `src/contexts/AppContext.tsx`, when `rg "updateClassroomPointsOptimistically" <file>` runs, then 0 matches.
- Given `src/contexts/AppContext.tsx`, when `rg "updateClassroomPointsOptimistically" src/` runs repo-wide, then 0 matches (confirms no external callers resurrect the API).
- Given `src/`, when `rg "queryKey:\s*\[" src/ --glob '!src/lib/queryKeys.ts'` runs, then 0 matches (invariant #3 from Phase 0+1 holds).
- Given `src/`, when `rg "invalidateQueries\(\{\s*queryKey:\s*\[" src/` runs, then 0 matches (invariant #4 holds).
- Given `src/hooks/useClassrooms.ts` and `src/hooks/useTransactions.ts`, when `rg "from '\.\./types/transforms'" <each-file>` runs, then exactly 1 match each.
- Given every `.update(...)` call in the two migrated hooks, when read, then each argument is typed (`UpdateClassroom`, `UpdatePointTransaction`, or a `Partial` of a generated Supabase type) — never `Record<string, unknown>`.
- Given `npm run lint && npm run typecheck && npm test -- --run`, when executed, then all pass.
- Given `npm run build`, when it completes, then the existing `npm run check:bundle` DCE assertion still holds (no devtools leak).
- Given the logged-in app in two browser tabs, when Tab A awards "+1" on a student, then Tab B's UI shows the updated totals within ~1 second (realtime path) without a manual refresh.
- Given the logged-in app on a throttled network (DevTools Slow 3G), when a teacher taps "+1", then the student's point total updates on screen in under 50ms — before the server response.
- Given a forced server error during awardPoints (mutate Supabase locally to reject the insert), when the teacher taps "+1", then the optimistic UI update is reverted within ~1s, and an error surface (existing `AppContext.error` + toast) reports the failure.

## Design Notes

**Optimistic award-points cache patches — the ADR-005 §4 walkthrough:**

```ts
export function useAwardPoints(classroomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AwardPointsInput): Promise<PointTransaction> => {
      // ... Supabase insert, throw on error, return dbToPointTransaction(data)
    },
    // (b) pure + idempotent: read current state from cache, not closure
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.transactions.list(classroomId) });
      await qc.cancelQueries({ queryKey: queryKeys.classrooms.all });

      // (e) read state from cache, not closure
      const previousTransactions = qc.getQueryData<PointTransaction[]>(queryKeys.transactions.list(classroomId));
      const previousClassrooms = qc.getQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all);

      // (c) no temp IDs needed — we're appending a derived row, not reconciling server-generated IDs
      const optimisticTx: PointTransaction = {
        id: `optimistic-${input.studentId}-${input.behavior.id}-${input.timestamp}`,
        // ... rest from input
      };

      qc.setQueryData<PointTransaction[]>(queryKeys.transactions.list(classroomId),
        (prev) => [optimisticTx, ...(prev ?? [])]);
      qc.setQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all,
        (prev) => prev?.map((c) => /* patch student + classroom aggregates */) ?? prev);

      return { previousTransactions, previousClassrooms };
    },
    // (a) null-guard context.previous — undefined after cancellation would wipe the cache
    onError: (_err, _input, context) => {
      if (context?.previousTransactions !== undefined) {
        qc.setQueryData(queryKeys.transactions.list(classroomId), context.previousTransactions);
      }
      if (context?.previousClassrooms !== undefined) {
        qc.setQueryData(queryKeys.classrooms.all, context.previousClassrooms);
      }
    },
    // (d) explicit onError present (above) + toast via AppContext.error surface — never silent
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.list(classroomId) });
      qc.invalidateQueries({ queryKey: queryKeys.classrooms.all });
    },
  });
}
```

**Why `useClassrooms` keeps the `students`-table realtime subscription.** Cross-device classroom aggregates need to update when another device's award lands on the server. The `point_transactions` realtime subscription alone isn't enough — classroom aggregates are computed from the `students.point_total` column, which a DB trigger updates. Listening on `students` updates covers that fan-out. Phase 3 can move this trigger into `useStudents` and have `useClassrooms` listen via `queryClient` event subscription instead — out of scope here.

**Why `awardPointsToStudents` (batch version) stops manually iterating `updateClassroomPointsOptimistically`.** Post-migration, the mutation hook owns optimism. The batch wrapper becomes:

```ts
const awardPointsToStudents = useCallback(
  async (classroomId, studentIds, behavior, note) => {
    await Promise.all(
      studentIds.map((sid) =>
        awardPointsMutation
          .mutateAsync({ studentId: sid, classroomId, behavior, note })
          .catch(() => null)
      )
    );
  },
  [awardPointsMutation]
);
```

Each individual `mutateAsync` call's `onMutate` patches the cache; `onError` rolls back. The batch wrapper no longer needs to know about rollback at all. If some succeed and some fail, the cache ends in a consistent state per mutation — not a torn "all rolled back" or "all kept" state, but that matches current behavior (each transaction is independent).

**`updateClassroomPointsOptimistically` deletion.** Grep confirms the function is only called from within `AppContext.tsx` itself (6 call sites). Deleting the implementation + the six callers is a single-file change. If any consumer outside `AppContext.tsx` appears during the migration (future dev adding a new caller), treat as a regression and ask.

**Query-key additions to `queryKeys.ts`:**

```ts
classrooms: {
  all: ['classrooms'] as const,
  detail: (id: string) => ['classrooms', 'detail', id] as const,
},
transactions: {
  all: ['transactions'] as const,
  list: (classroomId: string) => ['transactions', 'list', classroomId] as const,
  student: (studentId: string) => ['transactions', 'student', studentId] as const,
},
```

`list(classroomId)` is the working query — one per classroom, scoped so classroom switches produce cache hits for previously-visited classrooms within `gcTime` (10 min per Phase 0+1 default).

**Deferred-work entries to add** (append to `_bmad-output/implementation-artifacts/deferred-work.md`):

- Cross-hook invalidation for `useClassrooms` aggregates when Phase 3 migrates `useStudents` — decide whether to keep the current students-table subscription in `useClassrooms` or replace with `queryClient` event subscription.
- `networkMode: 'online'` paused mutation indicator — same gotcha as Phase 1's deferred item, now more visible given optimistic writes. When a teacher taps "+1" offline, the optimistic patch sticks but the mutation pauses. Need UI affordance for "pending sync" or fail-fast + toast.

## Verification

**Commands:**

- `npm run typecheck` — expected: pass (the supabase-js 2.104 `RejectExcessProperties` path is the main gate)
- `npm run lint` — expected: pass
- `npm test -- --run` — expected: all existing tests pass
- `npm run build && npm run check:bundle` — expected: no devtools leak
- `rg "updateClassroomPointsOptimistically" src/` — expected: 0
- `rg "queryKey:\s*\[" src/ --glob '!src/lib/queryKeys.ts'` — expected: 0
- `rg "table: 'classrooms'" src/hooks/useClassrooms.ts` — expected: 0
- `rg "table: 'point_transactions'" src/hooks/useTransactions.ts` — expected: exactly 1
- `rg "onMutate" src/hooks/useTransactions.ts` — expected: ≥ 1
- `npx supabase start && npm run test:seed && npm run test:e2e` — expected: pass

**Manual checks (throttled to Slow 3G in DevTools):**

- Home screen: classroom cards render with correct counts + totals on fresh login.
- Tap a student → AwardPointsModal → select "+1 Respectful" → student total increments **before** the DevTools network panel shows the POST responding. Verify the number then stays (server confirms) rather than flickering back.
- Tap UndoToast → transaction disappears instantly; server DELETE resolves in background.
- Force a server failure (e.g., `docker exec` into the local Postgres and `REVOKE INSERT ON point_transactions`) then tap "+1": UI updates optimistically, then reverts within ~1s when insert fails, error toast surfaces.
- Open two tabs; tap "+1" in Tab A; Tab B's student point total updates within ~1s without manual refresh.
- Rename a classroom in Settings; re-open another tab → still shows old name until window-focus refetch (expected — §6 classrooms is non-realtime).
- React Query Devtools (dev only): both `['classrooms']` and `['transactions','list', '<id>']` queries appear and transition through `fresh → stale → fetching → fresh` correctly on focus refetches.

## Suggested Review Order

**Query keys + transforms (low-risk)**

- New `classrooms` + `transactions` builders.
  `src/lib/queryKeys.ts`

- Transforms for classrooms + point-transactions shapes.
  `src/types/transforms.ts`

**Classroom hook rewrite**

- `useClassrooms` as `useQuery` over the aggregate fetch.
  `src/hooks/useClassrooms.ts`

- Three non-optimistic classroom mutations.
  `src/hooks/useClassrooms.ts`

- Dropped classroom-table realtime subscription (§6); retained students-table subscription routed through `onChange` → invalidate.
  `src/hooks/useClassrooms.ts`

**Transactions hook — the optimistic showcase**

- `useTransactions(classroomId)` query.
  `src/hooks/useTransactions.ts`

- `useAwardPoints` with full ADR-005 §4 (a)–(e) checklist inline.
  `src/hooks/useTransactions.ts`

- `useUndoTransaction` and `useClearStudentPoints` (simpler mutations).
  `src/hooks/useTransactions.ts`

- `point_transactions` realtime subscription via `onChange` → invalidate.
  `src/hooks/useTransactions.ts`

**Adapter bridge (PRD Risk 3)**

- Classrooms adapter + `useMemo` over `classroomsQuery.data`.
  `src/contexts/AppContext.tsx`

- Transactions adapter + `getStudentPoints` derivation via `useMemo`.
  `src/contexts/AppContext.tsx`

- `awardPoints` / `awardPointsToStudents` / `undoTransaction` thin wrappers over mutation hooks.
  `src/contexts/AppContext.tsx`

- Deletion of `updateClassroomPointsOptimistically` — context surface change (breaking, caught at typecheck if any external caller).
  `src/contexts/AppContext.tsx`

**Deferred follow-ups**

- New deferred-work entries (two).
  `_bmad-output/implementation-artifacts/deferred-work.md`
