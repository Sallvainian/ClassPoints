---
id: SPEC-layout-presets-migration
companions: []
sources:
  - ../../implementation-artifacts/deferred-work.md
  - ../../planning-artifacts/prd.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Migrate useLayoutPresets to TanStack Query

## Why

`useLayoutPresets` is the one Phase-2 hook that never got migrated. It still uses `useState`/`useEffect`, carries a legacy `presets`/`loading`/`error`/`refetch` return shape, and holds a realtime subscription even though layout presets are a non-realtime domain. It is clean and self-contained (~166 LOC), and because the target hook pattern is already proven four times over it is no longer a warm-up — it can slot in anywhere. Finishing it removes a stray legacy realtime channel and one of the last hand-rolled server-state hooks.

## Capabilities

- id: CAP-1
  intent: Layout presets are served by a `useQuery` hook with split `useMutation` wrappers.
  success: The hook holds zero `useState` for data, loading, or error; reads go through `useQuery` and writes through split mutations keyed by `queryKeys.layoutPresets.all`, invalidating on settle.

- id: CAP-2
  intent: Layout presets stop subscribing to Supabase Realtime.
  success: No realtime subscription exists for `layout_presets`; cross-tab freshness relies on `refetchOnWindowFocus` + on-demand `invalidateQueries` after mutations.

- id: CAP-3
  intent: Consumers work against the new hook shape.
  success: Consumers compile; tests cover list/load and mutation invalidation.

## Constraints

- Layout presets are a non-realtime domain — the existing `layout_presets` realtime subscription is **deleted**, not preserved or migrated.
- `npm run typecheck` passes; no `useState` loading/error/data state remains in the hook.

## Non-goals

- Not collapsing the `useRealtimeSubscription` legacy callback API — that is deferred item #13, which this migration unblocks but does not perform.
- Not migrating any other hook.

## Success signal

A grep for a realtime subscription on `layout_presets` returns nothing; the hook's return shape is `useQuery`-backed with split mutations; saving and loading a layout preset still works and a second tab reflects the change on window focus.
