---
title: 'R-03 realtime DELETE payload contract'
type: 'bugfix'
created: '2026-04-29'
status: 'done'
baseline_commit: '1cca167e164aae25e9eedcf95d0dd6a0ddb16158'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/test-artifacts/automation-summary.md'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** `tests/integration/realtime/point-transaction-delete.test.ts` fails because Supabase Realtime DELETE delivers `payload.old.id` but omits `student_id`, `classroom_id`, `points`, and `created_at` for `point_transactions` under the active RLS-protected local stack. Direct catalog verification shows the active DB already has `REPLICA IDENTITY FULL` applied, so this is not a stale migration problem.

**Approach:** Align the test contract with the documented runtime behavior: `REPLICA IDENTITY FULL` must make DELETE payloads non-empty, but RLS may still reduce `payload.old` to primary-key-only fields. Keep the external integration test focused on the non-empty DELETE event contract, and add hook-level coverage that proves `useStudents` falls back to invalidating the students query when row fields are missing.

## Boundaries & Constraints

**Always:** Preserve the local-only Supabase safety boundary. Keep the fix scoped to R-03 / `HIST.01-INT-02`, the directly related `useStudents` fallback coverage, and the automation summary if validation results need correction. Verify the active DB state before interpreting the realtime result; `pg_class.relreplident = 'f'` means `REPLICA IDENTITY FULL`.

**Ask First:** Ask before resetting the local Supabase database, changing migrations, adding SQL helper RPCs, adding new npm dependencies, or changing the production realtime subscription implementation beyond comments or a defect fix proven necessary by tests.

**Never:** Do not weaken RLS, bypass the private-host test guard, run E2E/integration tests against hosted Supabase, hardcode secrets, or remove the `useStudents` fallback invalidation path. Do not make the integration test require full deleted-row fields when RLS can legitimately filter them to primary-key-only.

## I/O & Edge-Case Matrix

| Scenario                                  | Input / State                                                                        | Expected Output / Behavior                                                                    | Error Handling                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Active DB replica identity check          | Local Supabase DB has `point_transactions` with `relreplident = 'f'`                 | Treat migration `005_replica_identity_full.sql` as applied and avoid reset/migration repair   | If query cannot connect, rerun with approved local DB network permission; if value is not `f`, halt before changing DB state |
| Realtime DELETE with RLS-filtered old row | DELETE event arrives with `payload.old = { id }` only                                | Integration test passes because the event is non-empty and identifies the deleted transaction | The product hook must use fallback invalidation for missing row fields                                                       |
| Realtime DELETE with full old row         | DELETE event arrives with `id`, `student_id`, `classroom_id`, `points`, `created_at` | Integration test passes and may assert field values when present                              | No fallback required; cache decrement path remains valid                                                                     |
| Realtime DELETE timeout/error             | Subscription never reaches delete payload or channel errors                          | Test fails with the existing bounded timeout/channel error message                            | Keep timeout-based failure explicit; no hard waits                                                                           |

</frozen-after-approval>

## Code Map

- `tests/integration/realtime/point-transaction-delete.test.ts` -- failing `HIST.01-INT-02` integration test; currently asserts full deleted row fields that RLS may filter out.
- `src/hooks/useStudents.ts` -- production fallback logic for `point_transactions` DELETE events with insufficient `payload.old` data; requires `student_id`, `points`, and `created_at` before local decrement.
- `src/hooks/__tests__/useRealtimeSubscription.test.ts` -- existing mock pattern for manually firing realtime payloads.
- `src/hooks/__tests__/useAwardPoints.test.ts` -- existing QueryClientProvider/renderHook pattern for hook behavior tests.
- `tests/support/helpers/unique.ts` -- shared test-data slug helper used by integration factories.
- `supabase/migrations/005_replica_identity_full.sql` -- migration that sets `REPLICA IDENTITY FULL` for `point_transactions` and `students`.
- `_bmad-output/project-context.md` -- documents that RLS can still filter DELETE payloads to PK-only and that code must fall back to invalidation.

## Tasks & Acceptance

**Execution:**

- [x] `tests/integration/realtime/point-transaction-delete.test.ts` -- update `HIST.01-INT-02` assertions and description so the integration contract is "DELETE event arrives with non-empty `payload.old.id`; full row fields are asserted only when present" -- reflects Supabase Realtime + RLS behavior while still catching empty DELETE payload regressions.
- [x] `src/hooks/useStudents.ts` -- require `created_at` before the local decrement path -- avoids updating lifetime totals while leaving time-window totals stale when Realtime sends a partial old row.
- [x] `src/hooks/__tests__/useStudents.test.ts` or equivalent nearby hook test file -- add coverage for the `point_transactions` DELETE fallback path by firing a PK-only old payload and asserting `queryKeys.students.byClassroom(classroomId)` is invalidated -- protects the runtime behavior that makes PK-only payloads safe.
- [x] `tests/support/helpers/unique.ts` -- add a per-process salt to test data slugs -- stabilizes the targeted integration set when multiple workers create auth users in the same millisecond.
- [x] `_bmad-output/test-artifacts/automation-summary.md` -- update only if validation results or R-03 interpretation need correction after the fix -- keeps BMAD artifacts accurate.

**Acceptance Criteria:**

- Given the active local DB has `point_transactions.relreplident = 'f'`, when `HIST.01-INT-02` observes a realtime DELETE containing at least `payload.old.id`, then the focused realtime integration test passes.
- Given `useStudents` receives a `point_transactions` DELETE payload without `student_id` or `points`, when the handler runs, then it invalidates the classroom students query instead of attempting a local decrement.
- Given the targeted RLS, student-total, and realtime integration files run together, when validation completes, then all targeted integration tests pass.
- Given the generated/modified test files are checked, when Prettier, TypeScript, and ESLint run on the touched files, then they pass.

## Spec Change Log

## Design Notes

The key distinction is database identity versus broadcast visibility. `REPLICA IDENTITY FULL` prevents an empty old row at the PostgreSQL replication layer, but Supabase Realtime applies authorization filtering before client delivery. For RLS-protected tables, the browser may receive only the primary key. The product contract is therefore two-part: the integration layer must prove DELETE payloads are not empty, and the hook layer must prove missing row fields trigger refetch.

## Verification

**Commands:**

- `PGPASSWORD=postgres psql -h 100.123.144.59 -p 54322 -U postgres -d postgres -tAc "select relname, relreplident from pg_class where relname in ('point_transactions','students') order by relname;"` -- expected: `point_transactions|f` and `students|f`
- `npx prettier --check <touched files>` -- expected: all touched files use Prettier style
- `npx tsc -p tests/tsconfig.json --noEmit` -- expected: exit 0
- `npx eslint <touched files>` -- expected: exit 0
- `npm test -- --run src/hooks/__tests__/useStudents.test.ts` -- expected: fallback and local-decrement unit tests pass
- `npm run test:integration -- tests/integration/realtime/point-transaction-delete.test.ts --reporter=verbose` -- expected: focused realtime integration test passes
- `npm run test:integration -- tests/integration/rls/classrooms.test.ts tests/integration/schema/student-totals.test.ts tests/integration/realtime/point-transaction-delete.test.ts --reporter=verbose` -- expected: targeted integration set passes

## Suggested Review Order

**Runtime Contract**

- Require all fields needed for accurate local decrement, otherwise refetch.
  [`useStudents.ts:123`](../../src/hooks/useStudents.ts#L123)

- Preserve the existing full-row fast path for valid DELETE payloads.
  [`useStudents.ts:135`](../../src/hooks/useStudents.ts#L135)

**Realtime Boundary**

- Scope the DELETE observer to the transaction under test.
  [`point-transaction-delete.test.ts:16`](../../tests/integration/realtime/point-transaction-delete.test.ts#L16)

- Assert the stable RLS-safe contract while validating optional full fields.
  [`point-transaction-delete.test.ts:133`](../../tests/integration/realtime/point-transaction-delete.test.ts#L133)

**Coverage**

- Verify the hook subscribes specifically to `point_transactions` DELETE.
  [`useStudents.test.ts:91`](../../src/hooks/__tests__/useStudents.test.ts#L91)

- Pin fallback invalidation for primary-key-only DELETE payloads.
  [`useStudents.test.ts:101`](../../src/hooks/__tests__/useStudents.test.ts#L101)

- Pin fallback invalidation for partial payloads missing `created_at`.
  [`useStudents.test.ts:117`](../../src/hooks/__tests__/useStudents.test.ts#L117)

- Pin local decrement behavior when all required fields are present.
  [`useStudents.test.ts:143`](../../src/hooks/__tests__/useStudents.test.ts#L143)

**Test Stability**

- Prevent parallel worker collisions in generated auth emails and row names.
  [`unique.ts:5`](../../tests/support/helpers/unique.ts#L5)

- Record the updated R-03 contract and verified passing target set.
  [`automation-summary.md:328`](../test-artifacts/automation-summary.md#L328)
