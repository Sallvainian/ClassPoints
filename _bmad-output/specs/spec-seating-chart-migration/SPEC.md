---
id: SPEC-seating-chart-migration
companions: []
sources:
  - ../../planning-artifacts/prd.md
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Split useSeatingChart into Server-State Hooks + a UI-State Layer (Phase 5)

## Why

`useSeatingChart.ts` is the last large hand-rolled hook left in the TanStack migration — ~1,117 lines carrying a `chart`/`loading`/`error` state triple and manual rollback captures, none of which match the proven target pattern. It is the one genuine fork in the migration: verified fully independent (no `useApp()` coupling, no realtime), so it blocks neither Phase 4 nor any non-seating feature, and can be migrated whenever seating work is next touched. The work is high-risk because drag-and-drop is latency- and state-interleaving-sensitive: a wrong split produces visible jank or dropped drags. The goal is to bring this last hook onto the same query/mutation shape as the rest of the app.

## Capabilities

- id: CAP-1
  intent: Seating-chart server state is exposed through dedicated `useQuery` hooks, one per relevant table (seats, seating_groups, room_elements, layout presets).
  success: Each relevant table has its own `useQuery` hook; mutations invalidate the relevant query keys on `onSettled`; the collective hooks contain zero `useState(loading)` and zero `useState(error)`.

- id: CAP-2
  intent: Manual rollback captures for server state are eliminated in favor of mutation lifecycle callbacks.
  success: Zero manual `const previous = ...` rollback captures for server state remain; every such site is replaced by `useMutation.onMutate` / `onError` pairs operating on the TanStack Query cache.

- id: CAP-3
  intent: In-flight UI state is cleanly separated from server state and is greppable.
  success: Drag position, hover targets, selection rectangle, and unsaved position edits live in local component `useState` (with `useRef` for the high-frequency pointer-move values during an active drag) — never in a `useQuery` cache entry and never in a global store; the separation is greppable (no drag state in a query cache entry).

- id: CAP-4
  intent: Seating-chart stays a non-realtime domain.
  success: No realtime subscriptions are added to `seats`, `seating_groups`, `room_elements`, or `seating_charts`; freshness comes from on-demand `invalidateQueries` after mutations.

## Constraints

- Seating-chart is a non-realtime domain — adding any realtime subscription is forbidden. The cross-device drag-sync use case was dropped 2026-05-13 (WONTFIX), and FR18's mid-drag-realtime requirement is obsolete as a result.
- The UI-state layer is local component `useState`, with `useRef` for the high-frequency pointer-move values held during an active drag. **No Zustand store is introduced** — a single drag canvas does not need cross-tree state sharing, and Zustand would be a new dependency the rest of the app does not use. Revisit a seating-scoped store only if drag/hover/selection state later needs reading by components outside the canvas subtree (it does not, for editing one chart on one screen).
- All existing unit and E2E tests pass unchanged.

## Non-goals

- Not handling a mid-drag realtime event — FR18 is obsolete; with no seating realtime there is no mid-drag realtime event to reconcile.
- Not adding cross-device seating sync (explicitly WONTFIX 2026-05-13).
- Not touching non-seating hooks; this split is isolated to the seating feature.

## Success signal

Drag a seat to a new position, cancel an in-flight drag, and save a layout preset mid-rearrangement — all behave without regression — and a grep across `useSeatingChart` and its new sibling hooks returns zero `const previous =` rollback captures and zero `useState(loading)`/`useState(error)` for server state.
