---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
status: 'complete'
completedAt: '2026-04-23'
lastStep: 8
workflowDeviation:
  mode: 'brownfield-refactor'
  rationale: >
    Brownfield technical refactor against an existing React/Vite/Supabase
    codebase. Step 3 is effectively a no-op (no starter applicable);
    Steps 4–6 address only the decisions, patterns, and structure that
    the refactor introduces — unchanged surface is acknowledged, not
    re-documented.
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - docs/modernization-plan.md
  - _bmad-output/project-context.md
  - docs/legacy/legacy-components.md
  - docs/legacy/legacy-contexts.md
  - docs/legacy/legacy-hooks.md
  - docs/legacy/legacy-migrations.md
  - docs/legacy/legacy-state-management.md
  - docs/legacy/legacy-supabase.md
  - docs/legacy/legacy-testing.md
  - docs/legacy/legacy-utils.md
workflowType: 'architecture'
project_name: 'ClassPoints'
user_name: 'Sallvain'
date: '2026-04-23'
initiativeType: 'technical-modernization-brownfield'
---

# Architecture — ClassPoints State-Management Modernization

_Authoritative upstream inputs: `_bmad-output/planning-artifacts/prd.md` (supersedes), `docs/modernization-plan.md` (background). `docs/legacy/*` describes the as-is being refactored away from._

_Implementation detail (reference code, full interface bodies, per-phase acceptance hooks) lives in `_bmad-output/implementation-artifacts/implementation-guide.md` and per-phase specs. This document records only decisions and standards that cross epic boundaries._

## Project Context Analysis

**Functional scope:** 25 FRs driving migration of hand-rolled data hooks (`useState`+`useEffect`+Supabase) to `@tanstack/react-query` with `useQuery`/`useMutation`. Six migration phases (0 — bootstrap; 1 — behaviors pilot; 2 — classrooms + transactions; 3 — students; 4 — AppContext slim; 5 — seating chart split; 6 — doc cleanup). Rollback is per-phase `git revert`.

**Non-functional scope:** 9 NFRs. Load-bearing: NFR1 (realtime latency parity), NFR4 (devtools zero prod refs), NFR6 (subscription lifecycle), NFR8 (`AppContext.tsx` < 200 lines post-migration), NFR9 (each migrated hook < pre-migration line count).

**Scale:** Single-tenant solo-contributor. 45 component consumer files. 1 Supabase tenant. Realtime limited to three logical table sets: students, point_transactions, seating-chart multi-entity.

**Technical constraints (locked — not in scope):** Supabase Postgres + Realtime transport; RLS-as-authorization; React 18 + Vite 6 + TS 5.9 + Tailwind 4; `@dnd-kit` drag transport; snake_case DB ↔ camelCase app boundary; denormalized totals maintained by DB triggers (read, don't compute); no new routing library; Vitest + Playwright.

**Cross-cutting concerns:** Query-key consistency (PRD Risk 1), realtime-to-cache invalidation pattern, adapter bridge for the migration window (PRD Risk 3), devtools bundle exclusion (NFR4), seating-chart mid-drag stability (FR17/FR18).

## Starter Template Evaluation

Not applicable — brownfield refactor of an existing React/Vite/Supabase codebase. Language, styling, build tooling, testing framework, and file structure are pre-existing and preserved. The only new runtime dependency this initiative introduces is `@tanstack/react-query` plus its devtools as a devDependency.

## Architectural Decisions

### ADR-1 — Zustand scope

- **Context:** Legacy `useSeatingChart` splits in Phase 5. One option is adopting Zustand for seating-editor UI state now.
- **Options:** (a) no Zustand; (b) Zustand broadly for UI state; (c) Zustand scoped to seating.
- **Decision:** (a) — no Zustand under this initiative. `AppContext` (slimmed) remains the home for UI/session state.
- **Rationale:** No cross-component drag store exists today; drag state is intra-component `useState` and stays that way. Adopting Zustand without splitting `SeatingChartEditor.tsx` solves nothing.
- **Consequences:** If a future initiative splits the editor, seating-scoped Zustand is the recommended target. Out of scope here.

### ADR-2 — `activeClassroomId` ownership

- **Context:** `activeClassroomId` is read by 5 components and written by 2. Could live in Context, URL/router, or a small store.
- **Options:** (i) Context (status quo); (ii) URL param; (iii) dedicated store.
- **Decision:** (i) — keep in slimmed `AppContext`, backed by `localStorage` for reload persistence.
- **Rationale:** No router exists; (ii) requires adopting one (PRD non-goal). (iii) contradicts ADR-1. `localStorage` already delivers reload-survival.
- **Consequences:** Derived `activeClassroom` composite dissolves when `AppContext` stops owning students; classroom-switch race guard evaporates naturally (per-key cache isolation).

### ADR-3 — `useRealtimeSubscription` refactor timing

- **Context:** `onChange` invalidates a TanStack query key that only exists after the hook is migrated.
- **Options:** (a) alongside variant (ship `onChange` as additive; delete legacy at end of Phase 3); (b) in-place Phase-1 rewrite.
- **Decision:** (a).
- **Rationale:** (b) forces either Phase 1 scope expansion (breaking the Low risk rating) or double-rewrite of every subscription.
- **Consequences:** Legacy `onInsert`/`onUpdate`/`onDelete` retained as transitional bridge across Phases 1–3; removed end of Phase 3. Behavior delta on remote-observer refetch path during Phase 3 (documented in spec-phase-3).

### ADR-4 — Devtools bundling mechanism

- **Context:** NFR4 requires zero `react-query-devtools` references in `dist/`.
- **Options:** (a) env-branched static import + DCE; (b) async `mountApp()` with dynamic import in dead branch; (c) runtime toggle via TanStack's production-devtools subpath.
- **Decision:** (a) primary, (b) contingency. Authoritative acceptance is a `dist/` grep, not the chosen mechanism.
- **Rationale:** Vite replaces `import.meta.env.DEV` with a literal at build time; Rollup DCE removes the dead JSX and its static import. (c) contradicts NFR4.
- **Consequences:** Install devtools as devDependency (defense-in-depth against DCE regressions). `import.meta.env.DEV` establishes the first `.DEV` pattern in `src/`.

## Standards & Conventions

Rules agents must follow. Reference code and full interface bodies live in the implementation guide.

### Query Keys — `src/lib/queryKeys.ts`

- Single source of truth; call sites import builders, never construct keys inline
- Domain-first tuple: `['students', classroomId]`, not `[classroomId, 'students']`
- `as const` throughout; readonly-tuple types
- Sub-resources append a string tag and share the domain prefix so broad-match invalidation hits all children (e.g. `['students', id, 'timeTotals']` dirtied by `['students', id]`)
- Same builder used on read and invalidation paths — no drift

### Mutation Lifecycle

- Every write uses `useMutation` with: `mutationFn` (Supabase call; throw on error) → `onMutate` (cancel in-flight, snapshot, optimistic `setQueryData`, return rollback context) → `onError` (restore snapshot via `setQueryData`; never `setX()`) → `onSettled` (invalidate)
- Inputs are typed object literals, not positional args
- `retry: 0` default; per-mutation override only for proven idempotency
- Batch mutations apply per-row optimistic patches inside a single `setQueryData` call

### Realtime Subscriptions — `useRealtimeSubscription`

- Unified `{ channel, bindings[] }` shape; single-binding callers pass a 1-element array
- Per-binding `onChange: (payload) => invalidateQueries(...)`; callers compose multiple invalidations inside one `onChange` when needed
- Channel-level `onReconnect` fires once per recovery; callers invalidate every query key touched by any binding on that channel
- Hook owns cleanup; `supabase.removeChannel` fires on unmount (NFR6)
- Callback identity is ref-stored — does not trigger re-subscription

### Runtime Channel Count

- Exactly **3** Supabase channels at steady state: `students`, `point_transactions`, `seating-chart`
- Seating channel is multi-binding: four `postgres_changes` bindings on one channel (seating_charts, seating_groups, seating_seats, room_elements)
- Owner of the seating channel is the `useSeatingChart` facade, not the three underlying query hooks
- Enforcement: `supabase.getChannels().length === 3` at steady state

### Adapter Bridge (Phases 1–3)

- During phased migration, `AppContext` re-exposes TanStack-Query-backed results through existing `useApp()` consumer contract
- Cache-to-context adapter is `useMemo`-based; relies on `structuralSharing: true` (QueryClient default — never override)
- Mutation adapter wraps `mutateAsync` in `useCallback`; preserves legacy `Promise<T | null>` shape where callers expect it
- Deleted entirely at Phase 4; 45 components migrate to direct hook calls

### Type Boundary

- `Db{Entity}` types in `src/types/database.ts` describe snake_case Postgres rows
- `{Entity}` types in `src/types/index.ts` describe camelCase application shapes
- Forward transforms (`dbToBehavior`, `dbToStudent`, `dbToClassroom`, `dbToPointTransaction`) live in `src/types/transforms.ts` and are called inside `queryFn`
- Seating transforms remain co-located in `src/types/seatingChart.ts` (`dbToSeatingChart`, `dbToSeatingGroup`, `dbToRoomElement`)
- Naming convention: `dbToX` (not `transformX`)

### QueryClient Topology

- Singleton at `src/lib/queryClient.ts`; instantiated at module scope
- `QueryClientProvider` wraps `<App />` in `main.tsx` **above** `AuthProvider` so cache operates independently of auth state
- Defaults superseded by [ADR-005](../../docs/adr/ADR-005-queryclient-defaults.md) (PR #63 review): `refetchOnWindowFocus: false` and `gcTime: 10 * 60_000` in place of the earlier `true` / `5 * 60_000`; `staleTime: 30_000`, `refetchOnReconnect: true`, `retry: 1`, `networkMode: 'online'`, `structuralSharing: true`, `mutations.retry: 0` retained
- Per-hook override allowed only with empirical signal; defer to defaults at baseline

## Project Structure

**Existing tree preserved.** Configuration, build tooling, test infrastructure, DB layer, auth, and 45 consumer components are unchanged in scope. Incremental additions only.

**New files introduced by this initiative:**

| File                               | Role                                              |
| ---------------------------------- | ------------------------------------------------- |
| `src/lib/queryClient.ts`           | `QueryClient` singleton + default options         |
| `src/lib/queryKeys.ts`             | Typed query-key builders (single source of truth) |
| `src/types/transforms.ts`          | Forward DB→App transforms for non-seating domains |
| `src/hooks/useSeatingChartMeta.ts` | Seating chart row query + chart-level mutations   |
| `src/hooks/useSeatingGroups.ts`    | Groups + embedded seats + group/seat mutations    |
| `src/hooks/useRoomElements.ts`     | Room elements query + mutations                   |

**Files modified in place (not new):** `src/main.tsx` (adds `QueryClientProvider` + devtools), every migrated hook file, `src/contexts/AppContext.tsx` (progressively slimmed; ends < 200 lines per NFR8), `src/hooks/useSeatingChart.ts` (refactored to composition facade).

**Integration points:** `QueryClient` mounts in `main.tsx`. Realtime invalidation fires from each migrated hook's `useRealtimeSubscription` `onChange` to the hook's own query key. Adapter bridge lives inside `AppProvider` during Phases 1–3; removed at Phase 4.

## FR/NFR Architectural Coverage

Each requirement mapped to the section that addresses it. Mechanism detail lives in the referenced standard.

| Req            | Addressed by                                  | Mechanism                                                                |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| FR1–FR3        | Mutation Lifecycle, QueryClient Topology      | Canonical hook shape + per-hook override policy                          |
| FR4, FR13–FR15 | Adapter Bridge                                | Phase 4 adapter teardown; direct hook calls from components              |
| FR5, FR6       | Runtime Channel Count, Realtime Subscriptions | 3 channels / seating multi-binding                                       |
| FR7, FR10–FR12 | Mutation Lifecycle                            | Optimistic `setQueryData` in `onMutate`; cache as single source of truth |
| FR8            | ADR-3, Realtime Subscriptions                 | `onChange` only; legacy callbacks removed Phase 3                        |
| FR9            | QueryClient Topology                          | `refetchOnWindowFocus: true` default                                     |
| FR16           | Structure (seating split)                     | 3 hooks + facade                                                         |
| FR17, FR18     | ADR-1                                         | Drag state intra-component; never touches cache                          |
| FR19–FR21      | Locked (PRD non-goals)                        | Not touched                                                              |
| FR22           | Type Boundary                                 | `dbToX` in `queryFn`                                                     |
| FR23–FR25      | Entire document                               | Greppable invariants as external signal                                  |
| NFR1           | Realtime Subscriptions, Mutation Lifecycle    | Optimistic cache patch + invalidation refetch                            |
| NFR2           | Mutation Lifecycle                            | `onMutate` synchronous `setQueryData`                                    |
| NFR3           | QueryClient Topology                          | Singleton client; shared cache by key                                    |
| NFR4           | ADR-4                                         | Env-branch + `dist/` grep                                                |
| NFR5           | ADR-1, ADR-4                                  | No new runtime libraries beyond `@tanstack/react-query`                  |
| NFR6           | Realtime Subscriptions                        | Hook-managed cleanup                                                     |
| NFR7           | QueryClient Topology                          | TanStack default cancellation                                            |
| NFR8           | Adapter Bridge teardown                       | Phase 4 slim                                                             |
| NFR9           | Mutation Lifecycle, Structure                 | Thin wrapper shape; seating facade < 200 lines                           |

## Gap Analysis

- **Non-seating `dbToX` transforms must be created.** `src/types/seatingChart.ts` has them; `src/types/database.ts` does not. Inline `useMemo` conversion in `AppContext.tsx:690–767` is what exists today. Each phase creates its domain's transform when migrating.
- **DB type naming inconsistency.** `src/types/database.ts` exports `Behavior`/`Student`/`Classroom`/`PointTransaction` without a `Db` prefix, colliding with the app-side names in `src/types/index.ts`. Current workaround: aliased imports (`import type { Classroom as DbClassroom }`). Normalization to `Db*` prefix is future polish, out of scope.
- **`project-context.md` provider hierarchy listing is stale.** Missing `ThemeProvider` between `AuthGuard` and `SoundProvider`. Doc-cleanup item for Phase 6.

## Enforcement Invariants

Cross-phase static-inspection invariants. Per-phase subsets and the full greppable list with rationale live in the implementation guide and phase specs.

- `rg 'tanstack/react-query-devtools' dist/` and `rg 'ReactQueryDevtools' dist/` → 0 matches after `npm run build` (NFR4)
- `rg "queryKey:\s*\[" src/` outside `src/lib/queryKeys.ts` → 0 matches
- `rg "supabase\.channel\(" src/hooks/` → exactly 1 match, inside `useRealtimeSubscription.ts`
- `supabase.getChannels().length === 3` at steady state with an active classroom and seating chart open
- `wc -l src/contexts/AppContext.tsx` → < 200 post-Phase-4 (NFR8)
- `wc -l src/hooks/useSeatingChart.ts` → < 200 post-Phase-5 (facade only)
- `rg "useApp\(\)\.(students|classrooms|behaviors|transactions|seatingChart|layoutPresets)" src/components/` → 0 matches post-Phase-4
- `rg "const previous\s*=" src/hooks/{migrated}` → 0 matches (legacy manual-rollback contract removed)

## Handoff

Architecture complete. Implementation entry point: Phase 0 per `implementation-guide.md`. All per-phase execution detail (transitional interfaces, reference code, per-phase acceptance hooks, scheduled tasks) lives in the implementation guide and phase specs; this document is the decision and standards source that all phases read from.

**Out of scope by design** (PRD non-goals): UX, DB schema/migrations, deployment, test-framework expansion (separate BMad TEA initiative), time estimates, staffing.

**Future polish logged here, not executed:** `Db*` prefix normalization on `src/types/database.ts`; `SeatingChartEditor.tsx` sub-component split (enables seating-scoped Zustand per ADR-1 deferred direction); URL-shareable classroom selection (requires router adoption — reconsider ADR-2).
