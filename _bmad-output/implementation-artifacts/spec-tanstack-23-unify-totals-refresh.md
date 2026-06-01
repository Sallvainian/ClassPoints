---
title: 'Unify cross-device totals refresh (invalidate-not-merge)'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'd8cde26'
context:
  - '{project-root}/docs/adr/ADR-005-queryclient-defaults.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Awarding points (single / class / multi-select) updates the **today** and **this-week** counters on the awarding screen but NOT on a second screen until reload — while **all-time** totals already cross devices fine. Root cause: `useStudents` receives the `students`-table realtime UPDATE event (the DB trigger `trigger_update_student_totals` fires `AFTER INSERT OR DELETE ON point_transactions` → `UPDATE students`, `011:45-47`), copies the all-time columns from it, but **deliberately preserves** today/this-week (`useStudents.ts:83-86`). So the one realtime event that already refreshes all-time cross-device is intentionally skipping the time totals. The refresh logic is also fragmented across three mechanisms: the students-table column-copy merge, a separate `point_transactions` DELETE local-delta, and the preserve hack.

**Approach:** Adopt ONE rule for the live-sync realtime domains — **callbacks only `invalidateQueries`; never hand-merge a payload.** Collapse `useStudents`' students-table `onChange` body to `invalidate(students.byClassroom)` (keeping the existing `invalidate(classrooms.all)`), and delete the separate `point_transactions` DELETE local-delta subscription. The refetch re-reads the authoritative all-time columns AND re-runs `get_student_time_totals`, so every counter (all-time, today, week, roster) refreshes the same way. Keep `useAwardPoints.onMutate` optimistic patch for instant own-device feedback.

## Boundaries & Constraints

**Always:**

- Realtime callbacks in the live-sync domains use ONLY `qc.invalidateQueries(...)` — no `setQueryData` hand-merges.
- Totals stay denormalized-read: refetch reads `students.point_total` columns + the `get_student_time_totals` RPC; never compute totals by summing `point_transactions` client-side.
- Leave `useAwardPoints` (`onMutate`/`onError`/`onSettled`), `queryClient.ts` defaults (esp. `refetchOnWindowFocus: false`), the `visibilitychange` handler, and migration `005` unchanged.

**Ask First:**

- If the runtime two-screen test shows unacceptable `get_student_time_totals` traffic on watching screens under a rapid-award burst, HALT before merging and pair with deferred **#8** (batched RPC) in the same effort.
- If any totals consumer is found computing today/week/all-time from `point_transactions` client-side, HALT and report (contradicts denormalized-read).

**Never:**

- Do NOT add/remove a realtime domain — the count stays exactly 2 (`students` + `point_transactions`); ADR-005 §6 / PRD FR5 are untouched.
- Do NOT add a `students.byClassroom` invalidation to `useTransactions.onChange` — redundant with the trigger-driven students UPDATE (Option X); it only risks an extra refetch.
- Do NOT modify any `supabase/migrations/**` file.

## I/O & Edge-Case Matrix

| Scenario                                 | Input / State                                                                                          | Expected Output / Behavior                                                                                          | Error Handling                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Cross-device award (single/class/subset) | Device A awards → `point_transactions` INSERT → trigger → `students` UPDATE realtime event on device B | B's student-card Today, class-card Today + Week, and top-of-view Points Today all refetch and update with NO reload | RPC error → time totals fall back to 0 (existing queryFn behavior); all-time columns unaffected |
| Cross-device undo                        | Device A deletes a transaction → trigger → `students` UPDATE on B                                      | B's all-time, today, week all decrement with no reload                                                              | same fallback                                                                                   |
| Own-device award                         | A's `useAwardPoints.onMutate` optimistic patch                                                         | instant counter bump; later refetch(es) confirm authoritative value; NO flicker (refetch reads post-commit state)   | `onError` rolls back all 3 caches                                                               |
| Roster change                            | Add / rename / remove student on A → `students` INSERT/UPDATE/DELETE on B                              | B's roster refetches (previously hand-merged)                                                                       | N/A                                                                                             |
| Day boundary while tab open              | midnight / Sunday rollover, no awards                                                                  | `visibilitychange` invalidate recomputes today/week on refocus                                                      | N/A                                                                                             |

</frozen-after-approval>

## Code Map

- `src/hooks/useStudents.ts` -- THE change. Students-table `onChange` (`:44-101`) collapses to invalidate; `point_transactions` DELETE subscription (`:105-166`) deleted; dead `sortByName` (`:22-24`) deleted; header comment (`:31-42`) rewritten. Keep queryFn (`:185-221`), `visibilitychange` (`:171-183`), `TimeTotalsRow` (`:16-20`), roster mutations.
- `src/hooks/__tests__/useStudents.test.ts` -- breaking unit file #1. Its 3 tests target the deleted `point_transactions` DELETE subscription (mock harness keys handlers by table → handler becomes undefined → `waitFor` times out).
- `src/test/dashboard-students-mount.regression.test.tsx` -- breaking unit file #2 (missed in planning). Guards the single-`useStudents`-mount invariant (Phase 4 Finding A) by counting `point_transactions` DELETE subs as the mount signature — which #23 deletes. Re-point the counter at the `students`-table subscription (the new unique mount signature); drop its obsolete double-decrement test.
- `src/hooks/useTransactions.ts` -- UNCHANGED (read-only reference). `onChange` (`:56-66`) already invalidates `transactions.list` + `classrooms.all`; `useAwardPoints` optimistic patch (`:118-232`) stays.
- `supabase/migrations/011_add_student_point_totals.sql:45-47` -- the trigger that makes Option X work (read-only).
- `supabase/migrations/005_replica_identity_full.sql` -- UNCHANGED; still required for filtered-DELETE event delivery.
- `_bmad-output/project-context.md`, `docs/architecture.md`, `docs/adr/ADR-005-queryclient-defaults.md` -- doc amendments (reverse the documented preserve/merge decision).
- `tests/e2e/realtime-cross-device-totals.spec.ts` -- NEW automated two-device realtime E2E (the mandatory runtime test): seeds a throwaway classroom/student/behavior, two contexts as one teacher, award on A → B's counters update with NO reload, undo → decrement. Verifies AC1 against real Supabase realtime.

## Tasks & Acceptance

**Execution:**

- [x] `src/hooks/useStudents.ts` -- Collapse the students-table `onChange` body (`:52-101`) to `qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(classroomId) })` followed by the existing `qc.invalidateQueries({ queryKey: queryKeys.classrooms.all })`. Delete the entire `point_transactions` DELETE `useRealtimeSubscription` block (`:105-166`). Delete the now-unused `sortByName` helper (`:22-24`). Rewrite the `:31-42` header comment to describe invalidate-not-merge. Keep `TimeTotalsRow`, the queryFn, the `visibilitychange` effect, and all mutations untouched.
- [x] `src/hooks/__tests__/useStudents.test.ts` -- Delete the 3 obsolete `point_transactions` DELETE tests. Add a unit test asserting the collapsed students-table `onChange` calls `invalidateQueries(students.byClassroom)` (and `classrooms.all`) for each of INSERT / UPDATE / DELETE, and that it does NOT call `setQueryData`.
- [x] `_bmad-output/project-context.md` -- Amend the "Time-totals nuance" section (`:264-271`), the "Realtime subscription rules" hot-path-merge blessing + DELETE-decrement line (`:258-261`), and the cross-cutting DELETE rule's client-uses-`payload.old` framing (`:94`) to describe invalidate-not-merge. Leave the DB-level REPLICA-IDENTITY rule itself intact.
- [x] `docs/architecture.md` -- Amend the HEAD-drift / realtime-ownership / cross-cutting-DELETE lines (`:90-92`) so they reflect invalidate-not-merge as the implemented state (now aligned with the migration target).
- [x] `docs/adr/ADR-005-queryclient-defaults.md` -- Add a new **§7 "Realtime callback strategy: invalidate-not-merge for live-sync domains."** Record the decision, the cost/benefit (accept ~1 `get_student_time_totals` refetch per cross-device event on watching screens in exchange for deleting all hand-merge drift; aligns with `modernization-plan.md:61` / `prd.md:123`), and the explicit dependency on deferred #8 if runtime RPC load is painful. Do NOT touch §1 or §6.
- [x] `src/test/dashboard-students-mount.regression.test.tsx` -- Re-point the subscription counter from `point_transactions`/`event:'DELETE'` to `students`-table subscriptions (the new unique `useStudents`-mount signature). Keep the three mount-invariant tests (single mount, modal-adds-no-mount, control-detects-double-mount), updating expected counts. Delete the double-decrement test (`:222-247`) — the local-delta path it asserts is removed by design. Update the header comment to the new signature.

**Acceptance Criteria:**

- Given two screens on one classroom, when device A awards points (single/class/subset), then device B's Today and This-Week counters update without reload (matching the all-time behavior that already works).
- Given the collapsed `onChange`, when any students-table realtime event fires, then the handler invokes only `invalidateQueries` and performs no `setQueryData` merge.
- Given `npm test -- --run`, when the suite runs, then it passes with the obsolete DELETE-subscription tests removed and the new collapsed-onChange test green.

## Spec Change Log

- **2026-06-01 (step-03 discovery — Code Map correction, frozen intent unchanged):** Planning's Code Map claimed `useStudents.test.ts` was the only breaking unit file. Implementation found `src/test/dashboard-students-mount.regression.test.tsx` also breaks — it counts `point_transactions` DELETE subscriptions as the `useStudents`-mount signature, and #23 deletes that subscription. **Amendment:** added the file to the Code Map + Tasks; rewrite it to guard the same single-mount invariant via the `students`-table subscription count, and delete its now-impossible double-decrement test. **Avoids:** silently dropping the P0 Phase 4 Finding-A guard (the duplicate-channel double-decrement is structurally eliminated by invalidate-and-refetch, but the single-`useStudents`-mount invariant it protects still holds — a 2nd mount would now waste a redundant `students` channel + RPC). **KEEP:** tests 1/2/4 (mount-count invariant) survive with only their detection signature changed.

- **2026-06-01 (step-04 review — 3 adversarial reviewers; all findings patch/defer/reject, NO loopback):** Blind hunter, edge-case hunter, and acceptance auditor reviewed the diff. **Verified non-issues (reject):** trigger `011:46` fires `AFTER INSERT OR DELETE` so cross-device undo emits a students UPDATE (no regression); `getDateBoundaries` still used by queryFn (no orphan import); migration 005 still required for filtered-DELETE delivery. **Patches applied:** (A) guard `classrooms.all` invalidate behind the `classroomId` check; (B) wire `onReconnect` → same invalidate (this channel is now the sole cross-device path); (C) amend the extra stale `project-context.md` passages the task under-named (:45/:80/:84/:161/:177/:198/:483 — esp. the :198 canonical-pattern row that would have told future agents to re-introduce the deleted merge); (D) restore ADR §7's truncated `prd.md:123` quote ("or `setQueryData`"); (E) honest ADR §7 bulk-op cost wording; (F) fix stale `queryKeys.ts:13-15` comment. **Deferred:** bulk-op O(class size) refetch amplification → #8 (+ optional debounce) [deferred-work #24]; concurrent-award flicker `qc.isMutating` guard, contingent on the runtime test [deferred-work #25]. **Outstanding (user):** the mandatory two-screen runtime test + watching-screen RPC-count measurement (AC1 + the Ask-First gate). **Doc-scope miss:** the original project-context.md task under-named its sections; classified **patch** not bad_spec (code was correct — re-deriving it would be waste).

- **2026-06-01 (AC1 verified — automated runtime test, clears the only outstanding gate):** Added `tests/e2e/realtime-cross-device-totals.spec.ts` — two browser contexts as one teacher against a real local Supabase stack. Award on device A → device B's student-card "today" badge AND class-total card update with NO reload; undo → decrement. **PASSED** (8.0s). This satisfies AC1 and the Ask-First runtime gate that was previously the only open item. Also verified `onReconnect` (patch B) fires only on genuine reconnects (`useRealtimeSubscription.ts:153-159` — initial mount has `prev===null`), so it adds no per-mount over-fetch. Watcher `get_student_time_totals` count over the cycle = 10, dominated by fresh-boot websocket reconnect catch-ups (`onReconnect` working as intended), NOT the steady-state ~1/award cost (ADR §7); the bulk-op O(class size) cost (#24) is untouched by this single-award test.

## Design Notes

**Why Option X (touch only `useStudents`):** The DB trigger fires `AFTER INSERT OR DELETE ON point_transactions` and `UPDATE students` (`011:45-47`), so every award AND every undo emits a `students`-table UPDATE event. The user has confirmed all-time totals already refresh cross-device — proof that this exact event is reliably delivered to watching screens today. Flipping its handler from copy-and-preserve to invalidate-and-refetch therefore rides a **proven, already-firing** event; it is not a bet on an unverified realtime route. This single trigger also covers cross-device undo (the job the deleted `point_transactions` DELETE block did) and roster changes, and removing the second `point_transactions` subscription eliminates the duplicate-channel double-decrement hazard noted in `AwardPointsModal.tsx:70-73`.

**Cost (state honestly in the ADR):** `useAwardPoints.onSettled` already invalidates `students.byClassroom` (`useTransactions.ts:231`), so the awarding device already pays ~1 RPC per award today; #23 adds at most one extra (deduped) refetch there when the realtime echo lands after that refetch. The real new cost is on **watching** screens: ~1 `get_student_time_totals` refetch per remote award (0 → 1). Bounded and deduped, but during a rapid-award burst it is 1-per-award per watcher — this is the cost the preserve-hack existed to avoid, and the lever to pull if it bites is #8.

**Awarder flicker — bounded and self-correcting:** the single-award path is clean — the `onSettled` and the post-commit realtime refetch both read committed state, and `refetchOnWindowFocus: false` is kept, so the ADR-005 §1 focus-refetch scenario does not apply; the watching screen has no optimistic patch, so its refetch simply writes truth. Under CONCURRENT / batch awards (e.g. a whole-class award), a _sibling_ transaction's students-table event can fire a refetch that briefly reads a state missing this student's not-yet-committed optimistic award, momentarily dropping then restoring its tile until `onSettled` reconciles. This transient is cosmetic and self-correcting (step-04 edge-case finding). If the mandatory two-screen runtime test shows it as visible flicker, guard the realtime invalidation with a `qc.isMutating()` check for in-flight awards — deferred, not done here.

## Verification

**Commands:**

- `npm run typecheck` -- expected: no errors.
- `npm run lint` -- expected: clean (confirms no dead/unused symbols after deletions).
- `npm test -- --run` -- expected: all pass; `useStudents.test.ts` updated.
- `npm run test:e2e -- realtime-cross-device-totals` -- automated two-device realtime check (boots local Supabase). **PASSED 2026-06-01** (8.0s). Watcher `get_student_time_totals` over load+award+undo = 10, dominated by fresh-boot websocket reconnect catch-ups (`onReconnect`), not the steady-state ~1/award cost.

**Manual checks (now AUTOMATED by `tests/e2e/realtime-cross-device-totals.spec.ts`, passing; the items below remain an optional manual spot-check for multi-select + visible flicker, which the spec does not assert):**

- Two browser sessions on the same classroom. Award single / whole-class / multi-select on session A; confirm session B's student-card Today, class-card Today + Week, and top-of-view Points Today all update with NO reload. Then undo on A; confirm B's today/week decrement with no reload. Confirm no counter flicker on A.
- With the network panel open, do a rapid-award burst and count `get_student_time_totals` calls on the watching screen (~1 per award). Confirm tolerable; if not, pair with #8 before merging.

## Suggested Review Order

**The unification rule (start here)**

- The whole change in one place: one `refresh` helper, wired to both `onChange` and `onReconnect` — invalidate only, never merge.
  [`useStudents.ts:40`](../../src/hooks/useStudents.ts#L40)
- The single students subscription that now drives all cross-device refresh (the `point_transactions` DELETE sub + merge body were deleted here).
  [`useStudents.ts:45`](../../src/hooks/useStudents.ts#L45)
- The refetch target the rule relies on: queryFn re-reads authoritative columns + re-runs the time-totals RPC.
  [`useStudents.ts:73`](../../src/hooks/useStudents.ts#L73)

**The architectural decision + docs**

- New §7 records invalidate-not-merge for live-sync callbacks, the honest bulk-op cost, and #8 as the lever (reverses an informal decision; §1/§6 untouched).
  [`ADR-005:110`](../../docs/adr/ADR-005-queryclient-defaults.md#L110)
- Cache-lifecycle comment now says "refreshed wholesale by invalidate-and-refetch," not "preserved via merge-on-update."
  [`queryKeys.ts:15`](../../src/lib/queryKeys.ts#L15)
- The "copy these" canonical-pattern row no longer instructs future agents to re-introduce the deleted merge.
  [`project-context.md:198`](../project-context.md#L198)
- Realtime-ownership / callback-strategy lines now describe single-subscription invalidate-not-merge.
  [`architecture.md:90`](../../docs/architecture.md#L90)

**Tests**

- New parametrized test: the collapsed `onChange` invalidates `students.byClassroom` + `classrooms.all` and never calls `setQueryData`, for INSERT/UPDATE/DELETE.
  [`useStudents.test.ts:90`](../../src/hooks/__tests__/useStudents.test.ts#L90)
- Mount-invariant guard re-pointed from the deleted `point_transactions` DELETE sub to the `students`-table subscription as the mount signature.
  [`dashboard-students-mount.regression.test.tsx:42`](../../src/test/dashboard-students-mount.regression.test.tsx#L42)
