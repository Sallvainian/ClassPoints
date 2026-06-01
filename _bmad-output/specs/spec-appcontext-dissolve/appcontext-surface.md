# AppContext Surface → Disposition

The current `useApp()` server-data surface, and where each piece goes when the facade dissolves. Companion to `SPEC.md` (CAP-1 through CAP-5). Line/file references are non-binding implementation hints; the contract is the disposition, not the line number.

## Consumers to migrate (8)

Each calls the appropriate `useQuery`-backed hook directly instead of reading server data from `useApp()`. The fields below are the verbatim `useApp()` destructuring at each call site (verified against `src/` at HEAD); `S` marks server-data fields/wrappers that move to direct hooks, `U` marks UI/session selection state that **stays** per `SPEC.md` CAP-2.

| Component (`path:line`)                                      | `useApp()` destructuring                                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClassSettingsView` (`settings/ClassSettingsView.tsx:29-40`) | `activeClassroom`(S) `updateClassroom`(S) `deleteClassroom`(S) `addStudent`(S) `addStudents`(S) `removeStudent`(S) `updateStudent`(S) `setActiveClassroom`(U) `adjustStudentPoints`(S) `resetClassroomPoints`(S) |
| `TeacherDashboard` (`home/TeacherDashboard.tsx:14`)          | `classrooms`(S) `createClassroom`(S) `loading`(S) `error`(S)                                                                                                                                                     |
| `Sidebar` (`layout/Sidebar.tsx:23`)                          | `classrooms`(S) `activeClassroomId`(U) `setActiveClassroom`(U) `createClassroom`(S)                                                                                                                              |
| `DashboardView` (`dashboard/DashboardView.tsx:28-36`)        | `activeClassroom`(S) `getClassroomTransactions`(S) `getRecentUndoableAction`(U) `undoTransaction`(S) `undoBatchTransaction`(S) `loading`(S) `error`(S)                                                           |
| `MultiAwardModal` (`points/MultiAwardModal.tsx:23`)          | `behaviors`(S) `awardPointsToStudents`(S)                                                                                                                                                                        |
| `AwardPointsModal` (`points/AwardPointsModal.tsx:20`)        | `behaviors`(S) `awardPoints`(S) `getStudentPoints`(S)                                                                                                                                                            |
| `ProfileView` (`profile/ProfileView.tsx:28`)                 | `classrooms`(S) `deleteClassroom`(S) `activeClassroomId`(U) `setActiveClassroom`(U)                                                                                                                              |
| `ClassAwardModal` (`points/ClassAwardModal.tsx:27`)          | `behaviors`(S) `awardClassPoints`(S)                                                                                                                                                                             |

The `transforms.ts:72` match is a comment, not a consumer; the remaining `useApp()` matches are `AppContext`/test infrastructure, not UI consumers.

**Reading of the surface:** the only UI/session fields these eight pull are `activeClassroomId` / `activeClassroom` and `setActiveClassroom` — the active-classroom selection that CAP-2 keeps. Note `activeClassroom` (the resolved object) is server-derived and must become a cache read; only the selected **id** + setter are genuine session state. Everything else marked `S` is a server-data field or mutation wrapper that moves to a direct hook. `getRecentUndoableAction` is the undo-window machinery (CAP-4) and extracts to `useUndoableAction`.

## Mechanical removals

- **Drop 6 data fields:** `classrooms`, `behaviors`, `transactions`, `students`, `activeClassroom`, and the aggregate `loading` + `error`.
- **Drop ~20 thin mutation wrappers.** Consumers swap to direct hooks (`useStudents()`, `useAwardPoints()`, …).

## Non-mechanical residual (where Phase 4 can balloon — budget for it)

- **Selectors** `getStudentPoints` / `getClassPoints` / `getStudentTransactions` / `getClassroomTransactions` are derivations over cached data → move to `src/utils/` or inline as cache reads.
- **Undo-window machinery** `getRecentUndoableAction` + `batchKindRef` (consumed by `DashboardView.tsx:30-34`) is genuinely UI/session state — the undo window. It **moves to a dedicated `useUndoableAction` hook** (not retained in `AppContext`), refactored to read transactions from the TanStack cache instead of a context field. The extracted hook is the clean seam for landing deferred #6 (1Hz poll, `DashboardView.tsx:61-63`) and #7 (`batch_kind` column) later without touching the context. The "~150-line target" is not literal — this is the irreducible core.

## Sequencing of entangled behavior fixes

Keep Phase 4 behavior-preserving. Migrate `ClassAwardModal`/`MultiAwardModal` onto direct/new hooks first, then fix the silent-partial-failure orchestrators (`awardClassPoints`/`awardPointsToStudents`, `AppContext.tsx:347,393`) and the `resetBehaviorsToDefault` race (#1) as **separate, visible commits**. Folding a behavior change into a "mechanical migration" diff would hide it.
