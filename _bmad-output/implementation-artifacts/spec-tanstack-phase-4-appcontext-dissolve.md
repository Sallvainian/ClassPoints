---
title: 'TanStack Query migration — Phase 4 (dissolve the `AppContext` server-data facade)'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '389c62e'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/spec-appcontext-dissolve/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-appcontext-dissolve/appcontext-surface.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `useApp()` still exposes server data (`classrooms`, `students`, `behaviors`, `transactions`, `activeClassroom`, aggregate `loading`/`error`) and ~20 mutation wrappers. While that facade exists, the path of least resistance for any new feature is `const { students, awardPoints } = useApp()` — exactly what `project-context.md` forbids. This is the keystone of the TanStack migration; every other remaining item is an isolated pocket.

**Approach:** Migrate the 9 production consumers to call the already-proven TanStack hooks (`useStudents`/`useClassrooms`/`useTransactions`/`useBehaviors` + their mutations) directly, via thin camelCase wrapper hooks/utils that preserve today's exact app-shaped data (Option C — chosen 2026-06-01). Extract the undo-window machinery to a dedicated `useUndoableAction` hook (D2) and the batch-award fan-out to a `useBatchAward` hook. Then shrink `AppContextValue` to UI/session state only and delete the Phase 1–3 adapter bridge.

## Boundaries & Constraints

**Always:**

- Behavior-preserving. Consumers see the **exact same data shapes** as today (students/classrooms camelCase `AppStudent`/`AppClassroom`; transactions snake_case `DbPointTransaction`). The migration must be invisible to the user.
- The TanStack cache stays snake_case. Do NOT touch `useStudents`/`useClassrooms`/`useTransactions`/`useAwardPoints` query/realtime/optimistic internals.
- `activeClassroomId` + `setActiveClassroom` stay on `useApp()` (the only genuine UI/session state on the surface). Everything else server-data/wrapper/selector leaves.
- Query keys come from `src/lib/queryKeys.ts`; no inline keys. Supabase DB↔app conversion happens at the query/wrapper boundary, never re-implemented per consumer.

**Ask First:**

- If any consumer cannot preserve behavior with a direct hook + camelCase wrapper (e.g. a data shape or timing dependency this spec missed), HALT before improvising.
- If `addBehavior`/`updateBehavior`/`deleteBehavior`/`resetBehaviorsToDefault` turn out to have a live caller after all (grep says zero today), HALT — that consumer needs migrating, not the wrapper deleting.

**Never:**

- No new server-data field or wrapper function added to `AppContext` — the inverse of the goal.
- Not fixing the silent-partial-failure orchestrators (`awardClassPoints`/`awardPointsToStudents` `.catch(() => null)`), the `resetBehaviorsToDefault` race (#1), the 1Hz `DashboardView` poll (#6), or the `batch_kind` column (#7) inside this spec. They ship as their own commits. Extracting `useUndoableAction` is what gives a clean seam for #6/#7 later.
- Not migrating `useSeatingChart` (#12) or `useLayoutPresets` (#11); not converting the snake_case hook caches to camelCase (that is the tracked casing-normalization follow-up). Do not touch the presentational/seating subtree's snake/camel field reads.

## I/O & Edge-Case Matrix

| Scenario            | Input / State                                       | Expected Output / Behavior                                                                                     | Error Handling                                                                                     |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Single award        | `AwardPointsModal`, student + behavior selected     | `useAwardPoints` mutates; optimistic patch + sound fire identically to pre-phase                               | Toast on failure (unchanged)                                                                       |
| Class award         | `ClassAwardModal`, behavior selected                | `useBatchAward.awardClass` mints one `batchId`, fans out over the cached roster, tags kind `'class'`           | Per-student `.catch(()=>null)` filter preserved verbatim (silent-failure fix is a separate commit) |
| Subset award        | `MultiAwardModal`, N students + behavior            | `useBatchAward.awardSubset` tags kind `'subset'`; toast label later reads "N students"                         | Same silent-filter preserved                                                                       |
| Undo within 10s     | Recent award, `< UNDO_WINDOW_MS` since              | `useUndoableAction.getRecentUndoableAction()` returns the action with correct class/subset label               | Returns `null` past the window                                                                     |
| Cross-device undo   | `point_transactions` DELETE arrives on other device | time totals decrement via existing `useStudents` realtime (untouched)                                          | Fallback invalidation unchanged                                                                    |
| No active classroom | `activeClassroomId === null`                        | classroom-scoped queries disabled; `useApp().loading` resolves false (no hang) — matches `AppContext.test.tsx` | N/A                                                                                                |

</frozen-after-approval>

## Code Map

- `src/contexts/AppContext.tsx` (710 LOC) -- the facade. Shrinks to UI/session only: keep `activeClassroomId` (`:675`), `setActiveClassroom` (`:170-177`), localStorage sync. Remove server-data fields (`:668-677`), ~20 wrappers, selectors (`:416-472`), undo machinery (`:474-530`, ref `:85`), `mapped*` bridges (`:584-647`), `activeClassroom` (`:649-662`), and the 4 hook-family imports (`:4-31`).
- `src/contexts/useApp.ts` -- `AppContextValue` type (`:17-85`); shrink to the surviving UI/session fields.
- `src/types/transforms.ts` -- home of `dbToBehavior`; add `dbStudentToApp` / `dbClassroomToApp` (relocate the maps at `AppContext.tsx:589-631`, `:636-647`).
- `src/hooks/useClassrooms.ts` / `useStudents.ts` / `useTransactions.ts` / `useBehaviors.ts` -- the direct hooks consumers call. **Do not modify** (read-only references for signatures).
- 9 production consumers (verified `grep`): `src/App.tsx:42`, `settings/ClassSettingsView.tsx:29-40` (+`:362,:371`), `home/TeacherDashboard.tsx:14`, `layout/Sidebar.tsx:23`, `dashboard/DashboardView.tsx:28-36`, `profile/ProfileView.tsx:28`, `points/MultiAwardModal.tsx:23` (+`:44`), `points/AwardPointsModal.tsx:20`, `points/ClassAwardModal.tsx:27` (+`:47`).
- `src/contexts/AppContext.test.tsx` -- REVIEW CORRECTION: it also `vi.mock`-ed the four hook families and asserted `loading` + the disabled-query calls, so it could NOT pass "unchanged". It was rewired to assert the `activeClassroomId` localStorage init/hydration (the only surviving surface). The "no-hang when no active classroom" behavior moved to `useActiveClassroom` (gates on `studentsQuery.isLoading`; a disabled v5 query is `isPending:true,isLoading:false`) — verified correct, but its dedicated guard is not reconstructed (noted, minor coverage gap).
- `src/test/TeacherDashboard.test.tsx` -- `vi.mock('../contexts/useApp')` (`:29-31`) + 17 cases asserting `classrooms`/`createClassroom`. Must rewire its mock to the direct hooks while preserving assertions.

## Tasks & Acceptance

**Execution (staged — ordered by dependency):**

_Stage A — foundation (new modules, no consumer touched yet):_

- [x] `src/types/transforms.ts` -- add `dbStudentToApp(s: StudentWithPoints): AppStudent` and `dbClassroomToApp(c: ClassroomWithCount, students?): AppClassroom` -- relocate the verbatim maps from `AppContext.tsx:589-631`/`:636-647` so consumer shapes are identical.
- [x] `src/hooks/useAppStudents.ts` -- built as specified, then **DELETED in review**: after the AwardPointsModal fix (finding A) it had zero consumers (`useActiveClassroom` maps via `dbStudentToApp` directly). Removing it avoids new dead code (CAP-5).
- [x] `src/hooks/useAppClassrooms.ts` -- `useAppClassrooms()` wraps `useClassrooms()` + `dbClassroomToApp`; `useActiveClassroom(activeClassroomId)` composes it with `useAppStudents` to reproduce `AppContext.tsx:649-662`.
- [x] `src/utils/pointSelectors.ts` -- pure fns relocated from `AppContext.tsx:416-472`: `studentPoints(student): StudentPoints` (`:433-448`), `classPoints(students, ids?)`, `studentTransactions(txns, studentId, limit?)`, `classroomTransactions(txns, classroomId, limit?)`.
- [x] `src/lib/batchKindStore.ts` -- module-level `Map<string,'class'|'subset'>` with `tag/get/forget/clear` -- **must be module scope**, not hook state, so the award writer and the dashboard reader share it (they are different mounted components).
- [x] `src/hooks/useUndoableAction.ts` -- `useUndoableAction(classroomId)` exposing `getRecentUndoableAction()` (relocate `AppContext.tsx:474-530`, reading `useTransactions`/`useAppStudents` data + `batchKindStore`) and cleanup hooks (`forget`/`clear`) for the undo/clear/reset paths.
- [x] `src/hooks/useBatchAward.ts` -- `useBatchAward(classroomId)` exposing `awardClass(behavior)` and `awardSubset(studentIds, behavior, note?)`: mint one `batchId`+`timestamp`, read roster from cache via `qc.getQueryData(queryKeys.students.byClassroom(classroomId))` (no new subscription), loop `useAwardPoints().mutateAsync`, tag `batchKindStore`. **Preserve the existing `.catch(()=>null)` filter verbatim** (silent-failure fix is a separate later commit).

_Stage B — migrate consumers (one commit per file; verify behavior after each):_

- [x] `src/components/points/AwardPointsModal.tsx:20` -- `behaviors`→`useBehaviors()`, `awardPoints`→`useAwardPoints()`, `getStudentPoints`→`studentPoints(student)` from the `student` prop. REVIEW CORRECTION (finding A): the original "over `useAppStudents`" was changed because mounting a 2nd `useStudents(classroomId)` here opened a duplicate `point_transactions` DELETE channel → double-decrement on cross-device undo. The prop is already a full `AppStudent`; no students subscription needed.
- [x] `src/components/points/ClassAwardModal.tsx:27,:47` -- `behaviors`→`useBehaviors()`, `awardClassPoints`→`useBatchAward(classroomId).awardClass(behavior)`.
- [x] `src/components/points/MultiAwardModal.tsx:23,:44` -- `behaviors`→`useBehaviors()`, `awardPointsToStudents`→`useBatchAward(classroomId).awardSubset(...)`.
- [x] `src/components/dashboard/DashboardView.tsx:28-36` -- `activeClassroom`→`useActiveClassroom`, `getClassroomTransactions`→`classroomTransactions()` over `useTransactions`, undo fns→`useUndoTransaction()`/`useUndoBatchTransaction()` (+`batchKindStore.forget`), `getRecentUndoableAction`→`useUndoableAction`, `loading`/`error` from the queries. Leave the 1Hz interval (#6) in place.
- [x] `src/components/settings/ClassSettingsView.tsx:29-40,:362,:371` -- migrate all 10 fields to direct hooks (`useUpdateClassroom`/`useDeleteClassroom`/`useAddStudent(s)`/`useUpdateStudent`/`useRemoveStudent`/`useAdjustStudentPoints`/`useResetClassroomPoints`); `useAdjustStudentPoints` needs `currentPointTotal` from the student's cached `point_total`; preserve `AdjustNoOpError` handling.
- [x] `src/components/home/TeacherDashboard.tsx:14` -- `classrooms`→`useAppClassrooms()`, `createClassroom`→`useCreateClassroom()`, `loading`/`error` from the query. REVIEW CORRECTION (finding B): the home "Points Today" stat now reads `useActiveClassroom(activeClassroomId).todayTotal` — `useAppClassrooms()` carries no roster so its per-classroom `todayTotal` is `undefined`; summing it gave a constant 0. Reproduces the pre-dissolve behavior (only the active classroom ever carried time totals).
- [x] `src/components/layout/Sidebar.tsx:23` -- `classrooms`→`useAppClassrooms()`, `createClassroom`→`useCreateClassroom()`; `activeClassroomId`/`setActiveClassroom` stay on `useApp()`.
- [x] `src/components/profile/ProfileView.tsx:28` -- `classrooms`→`useAppClassrooms()`, `deleteClassroom`→`useDeleteClassroom()`; keep `activeClassroomId`/`setActiveClassroom`.
- [x] `src/App.tsx:42` -- `classrooms`→`useAppClassrooms()`; keep `setActiveClassroom`. (The 9th consumer the kernel's "8" missed.)

_Stage C — shrink the facade + delete dead code (CAP-2/3/5):_

- [x] `src/contexts/AppContext.tsx` + `useApp.ts` -- remove all migrated server data, wrappers, selectors, undo machinery, `mapped*` bridges, `activeClassroom`, and the `use{Classrooms,Students,Behaviors,Transactions}` imports. Delete the unused `addBehavior`/`updateBehavior`/`deleteBehavior`/`resetBehaviorsToDefault` wrappers (zero callers — verify with a fresh grep first). Result: `AppContext.tsx` under 200 lines, importing zero feature-data hooks.

_Stage D — tests:_

- [x] `src/test/TeacherDashboard.test.tsx` -- rewire `vi.mock` from `../contexts/useApp` to `../hooks/useAppClassrooms` + `../hooks/useClassrooms`; **keep every existing assertion** (change the mock layer, not what is asserted). NOTE: one assertion (`createClassroom` called with `'New Classroom'`) became `mutateAsync({ name: 'New Classroom' })` because the call shape genuinely changed; all others preserved verbatim.
- [x] `src/types/transforms.test.ts` (or co-located) -- unit-test the I/O matrix edge cases for `dbStudentToApp`/`dbClassroomToApp`/`studentPoints`/`classPoints` and `getRecentUndoableAction` window + class/subset labeling (`src/hooks/__tests__/useUndoableAction.test.ts`) + the Class/Subset award fan-out (`src/hooks/__tests__/useBatchAward.test.ts`, added in review).

**Acceptance Criteria:**

- Given the app at any route, when I `grep -rn "useApp()" src` , then no production file destructures `classrooms`/`students`/`behaviors`/`transactions`/`activeClassroom`/`loading`/`error`/any mutation wrapper/any selector from it — only `activeClassroomId`/`setActiveClassroom` remain.
- Given `src/contexts/AppContext.tsx`, when I check its imports, then it imports from zero `src/hooks/use{Classrooms,Students,Behaviors,Transactions,LayoutPresets,SeatingChart}.ts` files, and the file is under 200 lines.
- Given a full walkthrough (login → select classroom → single/class/subset award → undo → open seating → change layout preset → toggle sound → logout), when performed against local Supabase, then behavior is identical to pre-phase (point totals, undo labels/window, sounds, realtime).
- Given `npm run typecheck && npm run lint && npm test -- --run`, when run, then all pass; no commented-out adapter code remains (CAP-5).

## Spec Change Log

### 2026-06-01 — Step-04 review (3 adversarial reviewers: blind / edge-case / acceptance)

All machine-checkable ACs passed and every Always/Never constraint was honored; reviewers confirmed the foundation modules + 9 consumer migrations are faithful, near-verbatim relocations. Five findings, processed as **patches** (not a bad_spec loopback): the implementation was reviewer-verified-correct except for two isolated, unambiguously-fixable regressions, so a full revert+re-derive would have discarded correct work for no gain. The spec text above was amended to stay accurate.

- **Finding A (CRITICAL, fixed):** `AwardPointsModal` mounted `useAppStudents(classroomId)` → a 2nd `useStudents(activeClassroomId)` mount alongside `useActiveClassroom`'s. Each opens its own `point_transactions` DELETE realtime channel, and the decrement (`useStudents.ts:143-155`) is non-idempotent → cross-device undo double-decremented `today_total`/`this_week_total` (durably, since the students-UPDATE handler preserves time totals). Known-bad avoided: a silent data-correctness regression on the live-sync path the whole migration is meant to protect. **Fix:** `AwardPointsModal` reads `studentPoints(student)` from its prop (already a full `AppStudent`); `useAppStudents.ts` deleted as orphaned.
- **Finding B (MEDIUM, fixed):** home "Points Today" became a constant 0 — `useAppClassrooms()` maps with no roster so `todayTotal` is `undefined`. **Fix:** `TeacherDashboard` sources it from `useActiveClassroom(activeClassroomId).todayTotal`, reproducing the pre-dissolve behavior (only the active classroom carried time totals).
- **Finding C (LOW, deferred):** `useTransactions(activeClassroomId)` is mounted twice on the dashboard (`DashboardView` + inside `useUndoableAction`). Benign — the `useTransactions` realtime handler is invalidate-only (idempotent); no correctness impact, only a redundant channel. Logged to `deferred-work.md`.
- **Finding D (LOW, rejected):** deleted `useClearStudentPoints` lost its `batchKindStore.clear()`. Unreachable — `useClearStudentPoints` has zero callers at baseline; label-only if ever wired. No action.
- **Finding E (LOW, doc-corrected):** the Code Map's "AppContext.test.tsx passes unchanged" was wrong (it mocked the 4 hook families + asserted `loading`, which the dissolve removes); the test was necessarily rewired. Code Map corrected above; the "no-hang when no active classroom" guard is a noted minor coverage gap (behavior verified correct in `useActiveClassroom`).

KEEP (must survive any future re-derivation): the module-level `batchKindStore`; `useBatchAward`/`useUndoableAction` reading the roster from `qc.getQueryData` (no extra subscription); the verbatim `.catch(()=>null)` silent filter; the verbatim relocation of `getRecentUndoableAction` and the `dbStudentToApp`/`dbClassroomToApp` maps. Post-fix gates: `typecheck` + `lint` clean, `132` tests pass; `AppContext.tsx` = 33 LOC.

**Post-review hardening (same day):**

- Verified Fix B did not reopen Finding A: `App.tsx:89-107` renders the views as a strict XOR ternary, so `TeacherDashboard` (which Fix B gave a `useActiveClassroom`→`useStudents` mount) and `DashboardView` are never mounted together → still exactly one `useStudents(activeClassroomId)` mount per screen.
- Added `src/hooks/__tests__/useBatchAward.test.ts` (6 cases) covering the Class/Subset award I/O-matrix rows that had no test and had never executed: fan-out under one shared `batchId`, kind tagging, the empty-roster / no-valid-ids guards (silently award nothing — the flagged risk), per-student silent-filter, and the all-fail `forget` (no `batchKindStore` leak). Suite now 138 tests.
- **Runtime verification still outstanding:** the Verification section's local-Supabase walkthrough was NOT run this session, and the cross-device-undo path (Finding A's actual scenario) cannot be exercised single-device or by unit tests. Evidence to date is static (typecheck/lint) + unit + 3 read-only reviewers + the single-mount `grep`. Recommend a runtime smoke before merge.

## Design Notes

**Why wrappers, not snake_case-in-consumers (Option C):** the camelCase `AppStudent`/`AppClassroom` shape is the prop contract for ~13 presentational components incl. the **deferred** seating subtree. Pushing snake_case into consumers would explode scope into #12 and violate `project-context.md`'s "app types camelCase, convert at query boundaries." Converting the hook caches to camelCase instead would force rewriting the proven `useStudents` realtime merge (`useStudents.ts:52-160`) + `useAwardPoints` optimistic writes with no E2E net. Option C relocates the existing map into two thin typed wrappers — strictly better than a god-facade and itself slated for removal by the casing-normalization follow-up.

**batchKindStore must be module-level.** `useBatchAward` (in the award modals) _writes_ the kind; `useUndoableAction` (in `DashboardView`) _reads_ it; cleanup happens in `DashboardView`/`ClassSettingsView`. These are distinct mounts, so a per-hook `useRef` would not share the Map — hence a module singleton. It is device-local ephemeral state (the real cross-device fix is the deferred `batch_kind` column #7), so a module Map is the faithful, minimal relocation.

**Verify-after-each-consumer.** No E2E covers award/undo/classroom flows (only smoke specs exist). Each Stage-B consumer is its own commit; run the relevant slice of the walkthrough after each before moving on, rather than migrating all nine then debugging a regression with no bisect granularity.

## Verification

**Commands:**

- `npm run typecheck` -- expected: pass (consumers compile against direct hooks + camelCase wrappers).
- `npm run lint` -- expected: pass (no unused imports left behind in shrunk `AppContext`).
- `npm test -- --run` -- expected: pass, incl. rewired `TeacherDashboard.test.tsx` (assertions unchanged) and unchanged `AppContext.test.tsx`.
- `grep -c "use{Classrooms,Students,Behaviors,Transactions}" src/contexts/AppContext.tsx` -- expected: 0 feature-data hook imports.
- `wc -l src/contexts/AppContext.tsx` -- expected: < 200.

**Manual checks:**

- Run the full walkthrough above against local Supabase (`npm run dev`); confirm point totals, the 10-second undo window, "Entire Class" vs "N students" labels, award sounds, and cross-device realtime all behave as before.

## Suggested Review Order

**Design intent — the dissolved facade (start here)**

- The whole point: `AppProvider` now holds only the active-classroom selection.
  [`AppContext.tsx:12`](../../src/contexts/AppContext.tsx#L12)
- The shrunk contract — UI/session state only.
  [`useApp.ts:3`](../../src/contexts/useApp.ts#L3)

**Foundation — camelCase wrappers + selectors (Option C)**

- Verbatim snake→camel maps relocated from the old `mapped*` bridges.
  [`transforms.ts:113`](../../src/types/transforms.ts#L113)
- `useActiveClassroom` reproduces the old `activeClassroom` two-step; sole dashboard `useStudents` mount.
  [`useAppClassrooms.ts:32`](../../src/hooks/useAppClassrooms.ts#L32)
- Pure point/transaction selectors, off the context surface.
  [`pointSelectors.ts:41`](../../src/utils/pointSelectors.ts#L41)

**Undo-window + batch-award extraction (CAP-4)**

- Load-bearing: module-level store so award-writer and dashboard-reader share the Map.
  [`batchKindStore.ts:17`](../../src/lib/batchKindStore.ts#L17)
- `getRecentUndoableAction` relocated verbatim; reads cache, opens no extra channel.
  [`useUndoableAction.ts:30`](../../src/hooks/useUndoableAction.ts#L30)
- Fan-out reads roster from cache (no 2nd subscription); silent-filter preserved verbatim.
  [`useBatchAward.ts:36`](../../src/hooks/useBatchAward.ts#L36)

**Consumer migrations (highest-risk first)**

- Most complex consumer: active classroom + undo wiring + activity feed.
  [`DashboardView.tsx:37`](../../src/components/dashboard/DashboardView.tsx#L37)
- Finding-A fix: reads the student prop, NOT a 2nd `useStudents` mount.
  [`AwardPointsModal.tsx:71`](../../src/components/points/AwardPointsModal.tsx#L71)
- Finding-B fix: "Points Today" sourced from the active classroom's live total.
  [`TeacherDashboard.tsx:19`](../../src/components/home/TeacherDashboard.tsx#L19)
- 10 fields → direct mutation hooks; `AdjustNoOpError` + reset/clear preserved.
  [`ClassSettingsView.tsx:43`](../../src/components/settings/ClassSettingsView.tsx#L43)

**Tests (peripherals)**

- Undo window + class/subset/untagged labeling.
  [`useUndoableAction.test.ts:86`](../../src/hooks/__tests__/useUndoableAction.test.ts#L86)
- Mock layer rewired to direct hooks; assertions preserved (+ the finding-B mock).
  [`TeacherDashboard.test.tsx:34`](../../src/test/TeacherDashboard.test.tsx#L34)
