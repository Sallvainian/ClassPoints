---
id: SPEC-supabase-error-unwrap
companions: []
sources:
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Normalize Supabase Error Handling Behind an unwrap() Helper

## Why

Supabase/PostgREST error handling is inconsistent across hooks. Some hooks preserve metadata by throwing the original error; many sites lose `code`, `details`, and `hint` by throwing `new Error(error.message)`. Call sites that discriminate on error `code` (e.g. `SoundContext`-style checks) silently degrade when the metadata is flattened away. A single `unwrap` helper centralizes the "result-or-throw" pattern and preserves the original error object, so the metadata survives everywhere.

## Capabilities

- id: CAP-1
  intent: A single `unwrap<T>()` helper centralizes the Supabase result-or-throw pattern.
  success: `unwrap<T>()` exists in `src/lib/supabase.ts` and is covered by unit tests.

- id: CAP-2
  intent: Migrated hooks stop hand-rolling `if (error)` branches.
  success: Migrated hooks no longer hand-roll `if (error)` branches; they call `unwrap()`.

- id: CAP-3
  intent: Original Supabase error metadata is preserved through `unwrap()`.
  success: `code`, `details`, and `hint` survive `unwrap()`; `SoundContext`-style code discrimination still works.

## Constraints

- Migration is incremental, not big-bang — hooks move to `unwrap()` one at a time, with careful tests around the code-discrimination call sites before they change.
- `unwrap()` must preserve the original error metadata (`code`, `details`, `hint`) — it must not flatten to `error.message`.

## Non-goals

- Not changing the thrown-error contract that callers depend on for `code` discrimination — that behavior must keep working.
- Not a single sweeping rewrite of every hook at once.

## Success signal

The new `unwrap()` helper has passing unit tests; a hook migrated to it still lets `SoundContext`-style code discrimination read `error.code`; and no migrated call site flattens Supabase error metadata to `error.message`.
