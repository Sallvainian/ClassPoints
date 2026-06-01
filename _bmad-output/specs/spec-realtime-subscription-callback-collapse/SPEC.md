---
id: SPEC-realtime-subscription-callback-collapse
companions: []
sources:
  - ../../implementation-artifacts/deferred-work.md
  - ../../planning-artifacts/prd.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Collapse the useRealtimeSubscription Legacy Callback API

## Why

`useRealtimeSubscription` supports both the preferred `onChange` callback and the legacy `onInsert`/`onUpdate`/`onDelete` callbacks, leaving two mental models for the same concern. FR8 requires the codebase contain no hand-rolled `onInsert`/`onUpdate`/`onDelete` callbacks that merge server-state changes into local component state. Once the last legacy callers are converted, the dual API is pure surface area to retire — keeping it invites new code down the deprecated path.

## Capabilities

- id: CAP-1
  intent: The remaining legacy-callback callers are converted to `onChange`.
  success: `rg "onInsert|onUpdate|onDelete" src/hooks src/components` returns no production callers.

- id: CAP-2
  intent: The legacy props and dev warning are removed from `useRealtimeSubscription`.
  success: The hook's type signature no longer exposes `onInsert`/`onUpdate`/`onDelete`, and the legacy-callback dev warning is gone.

- id: CAP-3
  intent: Realtime routing through `onChange` is covered by tests.
  success: Realtime tests cover INSERT / UPDATE / DELETE routing through `onChange`.

## Constraints

- Sequencing: this work is unblocked only **after** deferred item #11 (`layout-presets-migration`) lands. The only two legacy-callback callers today are `useLayoutPresets` and the `useStudents` `point_transactions` DELETE branch; both must convert to `onChange` before the legacy props can be removed.
- Do not remove the legacy props while any caller still uses them — caller migration strictly precedes API removal.

## Non-goals

- Not changing the `onChange` semantics or the realtime transport (Supabase Realtime stays — FR20).
- Not migrating `useLayoutPresets` itself; that is a prerequisite owned by deferred item #11.

## Success signal

The legacy callback props no longer exist on the `useRealtimeSubscription` type, `rg` finds no `onInsert`/`onUpdate`/`onDelete` production callers, and INSERT/UPDATE/DELETE realtime tests all pass through the single `onChange` path.
