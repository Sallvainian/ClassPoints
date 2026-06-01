---
id: SPEC-payload-runtime-validation
companions: []
sources:
  - ../../implementation-artifacts/deferred-work.md
  - ../../planning-artifacts/prd.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Add Runtime Validation at JSONB and Realtime Payload Boundaries

## Why

Realtime payloads and seating/layout JSONB data still rely on casts such as `as T` or `as LayoutPresetData`. A TypeScript type is not a runtime guarantee for a Supabase payload or a JSONB column: an unexpected shape passes the cast silently and surfaces as a failure somewhere downstream, far from its origin. Putting a validator at the trust boundary makes an invalid payload fail safely and locally instead of corrupting cached state.

## Capabilities

- id: CAP-1
  intent: `layout_data` and realtime payloads are validated at the query/subscription boundary.
  success: A Zod schema validates `layout_data` and each realtime payload at the query/subscription boundaries.

- id: CAP-2
  intent: Unguarded casts at the identified trust boundaries are removed, with the TypeScript type derived from the schema.
  success: The previously-unguarded casts (`as T`, `as LayoutPresetData`) at the identified trust boundaries are gone; the static type at each boundary is `z.infer<typeof schema>` from the same Zod definition that performs the runtime check, so type and check cannot drift.

- id: CAP-3
  intent: Invalid payloads fail safely.
  success: Invalid payloads fail safely, with test coverage demonstrating the safe-failure path.

## Constraints

- Validation lives at the boundary — the `useQuery` result mapping and the realtime subscription callback — not scattered through downstream consumers.
- The `snake_case` → `camelCase` transform contract at the hook boundary is unchanged (FR22); validation is added alongside, not in place of, the existing `transform*` functions.
- Use **Zod** as the single source of truth: derive both the runtime check and the TypeScript type (`z.infer`) from one schema definition so they cannot drift; do not hand-roll guards that re-state the shape twice.
- Zod is a new runtime dependency. The PRD's "no new libraries" line was scoped to the migration phases (Phases 1–5); #15 is a separate quality item, so adding Zod here is a conscious, scoped exception — not a precedent for the migration hooks.

## Non-goals

- Not validating data already trusted inside the app past the boundary.
- Not replacing or rewriting the existing `transform*` mapping layer.

## Success signal

An invalid `layout_data` value or realtime payload is rejected at the boundary with a safe failure path under test, and the previously-unguarded `as LayoutPresetData` / `as T` casts at those boundaries are replaced by Zod-validated, `z.infer`-typed values.
