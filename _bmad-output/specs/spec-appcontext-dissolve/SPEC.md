---
id: SPEC-appcontext-dissolve
companions:
  - appcontext-surface.md
sources:
  - ../../planning-artifacts/prd.md
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Dissolve the AppContext Server-Data Facade (Phase 4)

## Why

This is a pain to remove and the keystone of the TanStack migration. The single thing structurally trapping new code into the legacy pattern is the `useApp()` **server-data facade**: while `classrooms`/`students`/`awardPoints`/… hang off `useApp()`, the path of least resistance for any new feature is `const { students, awardPoints } = useApp()` — exactly what the project forbids. Dissolving the server-data surface removes the trap; every remaining migration item is an isolated pocket or quality debt. The target hook pattern is already proven 4× (`useBehaviors`, `useClassrooms`, `useTransactions`, `useStudents` all show `useState=0`), so no warm-up remains. Completing this phase is the definition of "done enough" that new feature work no longer falls into the legacy pattern.

## Capabilities

- id: CAP-1
  intent: A contributor can access any server domain in a component by calling the relevant `useQuery`-backed hook directly, without routing through `useApp()`.
  success: Zero component files import `students`, `classrooms`, `behaviors`, `transactions`, `layoutPresets`, or seating data from `useApp()`; each consuming component calls the appropriate `useQuery`-backed hook directly.

- id: CAP-2
  intent: `useApp()` exposes only UI/session state.
  success: `useApp()` returns only UI/session fields — active classroom selection (or routing-derived equivalent), modal state, selection-mode toggles, sound-enabled preference, plus authentically-UI fields the architecture phase identifies — and `src/contexts/AppContext.tsx` is under 200 lines.

- id: CAP-3
  intent: `AppContext.tsx` no longer depends on feature data hooks.
  success: `src/contexts/AppContext.tsx` imports from zero files matching `src/hooks/use{Classrooms,Students,Behaviors,Transactions,LayoutPresets,SeatingChart}.ts`.

- id: CAP-4
  intent: The undo-window machinery survives the dissolution, extracted to a dedicated hook rather than left in `AppContext`.
  success: `getRecentUndoableAction` + `batchKindRef` (consumed by `DashboardView`) move to a dedicated `useUndoableAction` hook — not retained in `AppContext` — refactored to read transactions from the TanStack Query cache instead of a context data field; undo-toast labeling and the 10-second undo window behave identically to pre-phase.

- id: CAP-5
  intent: The Phase 1–3 adapter code is removed.
  success: Unused adapter code from Phases 1–3 is deleted, not commented out.

## Constraints

- The migration is behavior-preserving. `ClassAwardModal` and `MultiAwardModal` move onto direct/new hooks **without** changing behavior.
- Behavior changes ship as separate, visible commits — never folded into the mechanical migration diff. Specifically, the silent-partial-failure orchestrators `awardClassPoints` / `awardPointsToStudents` (`AppContext.tsx:347,393`) and the `resetBehaviorsToDefault` race (deferred item #1) are fixed as their own commits, not inside this migration.
- Actual `useApp()` UI consumers = **8** (`ClassSettingsView`, `TeacherDashboard`, `Sidebar`, `DashboardView`, `MultiAwardModal`, `AwardPointsModal`, `ProfileView`, `ClassAwardModal`). This supersedes the PRD's "~45 files" estimate, which is stale and must not set the scope.
- Selectors `getStudentPoints` / `getClassPoints` / `getStudentTransactions` / `getClassroomTransactions` are derivations over cached data → they move to `src/utils/` or become inline cache reads, not context methods.
- No new server-data field or wrapper function is added to `AppContext` — that is the inverse of the goal.
- All existing unit and E2E tests pass unchanged.

## Non-goals

- Not fixing the `resetBehaviorsToDefault` race (#1), the 1Hz `DashboardView` poll (#6), or the `batch_kind` column (#7) inside this spec. They are entangled with the undo-window machinery but ship as their own commits/specs. Extracting the machinery to `useUndoableAction` (CAP-4) is what gives a clean seam to land #6 and #7 later without touching `AppContext`.
- Not migrating `useSeatingChart` (Phase 5) or `useLayoutPresets` (#11). This spec only cuts their data off `useApp()` at the consumption boundary; their internal reshape is owned elsewhere.
- Not introducing any new server-data fields or wrapper functions to `AppContext`.

## Success signal

A contributor adds a new server-backed feature touching students/points without editing `AppContext.tsx` — and without a `useApp()` server-data field existing to tempt them. A full app walkthrough — login, select classroom, award points, undo, open seating chart, change layout preset, toggle sound, log out — behaves identically to pre-phase.

## Assumptions

- The 8-consumer count reflects HEAD as of the 2026-05-31 roadmap synthesis; if components were added since, re-grep `useApp()` consumers before declaring "done."
