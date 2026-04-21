---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain-skipped
  - step-06-innovation-skipped
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
status: complete
completedDate: 2026-04-21
releaseMode: phased
rolloutMode: pinned
classification:
  projectType: web-app
  domain: edtech-classroom-management
  complexity: medium
  projectContext: brownfield
initiativeType: technical-modernization
inputDocuments:
  - docs/modernization-plan.md
  - docs/legacy/legacy-components.md
  - docs/legacy/legacy-contexts.md
  - docs/legacy/legacy-hooks.md
  - docs/legacy/legacy-migrations.md
  - docs/legacy/legacy-state-management.md
  - docs/legacy/legacy-supabase.md
  - docs/legacy/legacy-testing.md
  - docs/legacy/legacy-utils.md
  - _bmad-output/project-context.md
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 10
workflowType: 'prd'
---

# Product Requirements Document - ClassPoints

**Author:** Sallvain
**Date:** 2026-04-21

## How to Read This PRD

This is a **brownfield technical modernization** PRD. No user-facing features ship under it; no UX, schema, or transport changes. Because user-facing behavior is unchanged by design, this document deliberately diverges from a standard product PRD in two places:

- **Functional and non-functional requirements describe developer-experience and codebase-structural capabilities**, not end-user features. "Contributor" is the actor; greppable structural invariants (line counts, import rules, realtime-subscription counts) are the capabilities. This is intentional — the initiative's value is entirely downstream of these capabilities.
- **Several standard sections are explicitly omitted with a short justification in place** (Domain-Specific Requirements, Innovation & Novel Patterns). The justifications are load-bearing: a reader should know the sections were considered and rejected, not skipped by oversight.

Read top-down for intent (Executive Summary → Scope → Contributor Journey), then jump to Phased Rollout for the execution plan, FRs/NFRs for the capability contract, and Risks/Decisions for what to watch or resolve before Phase 1 begins.

## Executive Summary

ClassPoints is a React + Supabase classroom-management SPA. The application works; this PRD is not about adding features. It is a brownfield technical modernization initiative targeting the frontend state-management seam.

The current codebase reimplements, by hand, what `@tanstack/react-query` provides natively: ~2,400 lines of feature hooks each maintaining parallel `useState(data) / useState(loading) / useState(error)` buckets, an 849-line `AppContext` god-facade that re-exposes every hook's surface through a single `useApp()` object, a manually-applied 5-step optimistic-update contract repeated across every mutation site, and realtime subscriptions on every domain — including data nobody watches live. This pattern was codified as "architecture" in the original `CLAUDE.md`, turning an ad-hoc implementation choice into a trap every subsequent feature fell into.

The initiative replaces that seam in place: server-state hooks become thin `useQuery` / `useMutation` wrappers; realtime scope contracts to three live-sync domains (students + point totals, point transactions, seating chart); `AppContext` slims to UI/session state only; the database layer (RLS, `REPLICA IDENTITY FULL`, triggers, RPCs) and Supabase Realtime transport are unchanged. Components continue to consume data via `useApp()` during migration — 45 component files need zero mechanical edits — and convert to direct hook calls as part of phase-scoped work.

### Why Now

Solo-contributor codebase. The goal is to keep developing and improving ClassPoints; the current patterns are a direct drag on that, not abstract tech debt. Concrete frictions they create:

- Duplicate network requests when two components mount hooks for the same data (no dedup)
- Cross-component optimistic-update drift — each hook instance has its own `useState`, so rollback in one place doesn't propagate to another consuming the same resource via a different hook instance
- Subscription lifecycle bugs (historically the top leak source in this repo)
- Out-of-proportion merge conflicts — every new feature touches `AppContext.tsx`, regardless of the feature's actual scope
- Self-reonboarding and AI-agent onboarding cost — a bespoke pattern with no external documentation, when the TanStack Query docs teach the industry-standard equivalent directly

### What Makes This Initiative Different from "Cleanup"

Every target has a measurable symptom tied to a specific line-count or structural goal, not a stylistic preference:

- Hand-rolled hooks → each migrated file contains zero `useState(loading) / useState(error)` and zero manual `const previous = ...` rollback captures
- `AppContext.tsx` → from 849 lines to under 200, with zero imports from feature data hooks
- Realtime → subscriptions exist only on three domains; everywhere else relies on TanStack Query's `refetchOnWindowFocus` + on-demand invalidation
- Optimistic updates → manual 5-step contract collapses into `useMutation.onMutate` + `onError` — single source of truth in the cache

The scope is deliberately narrow. No UX changes, no schema changes, no replacement of Supabase Realtime, no new libraries beyond `@tanstack/react-query` and its devtools. Zustand for UI-side client state (including the `useSeatingChart` drag-state split) remains an open architectural question, surfaced but not resolved in this PRD.

## Project Classification

- **Project Type:** Web application (React 18 SPA, TypeScript strict, Vite, Tailwind v4)
- **Domain:** EdTech — classroom behavior-point management with a teacher workstation UI and student-facing smartboard live display
- **Complexity:** Medium — non-trivial realtime sync and drag-and-drop canvas work; bounded by solo-contributor scope, no regulatory burden, single-tenant-per-teacher data model
- **Project Context:** Brownfield
- **Initiative Type:** Technical modernization (no user-facing features; no UX, schema, or transport changes)

## Success Criteria

### End-State Signals

The initiative is done when the following conditions hold simultaneously. These are outcomes, not phase gates — per-phase acceptance criteria appear later under Phased Rollout.

### Contributor Success

- A new contributor (human or AI agent) can read the `@tanstack/react-query` public documentation and the ClassPoints `docs/architecture.md` together and understand the server-state layer in under an hour, without reading any file under `docs/legacy/`
- Adding a new server-backed feature requires zero edits to `src/contexts/AppContext.tsx`. The "every feature PR touches AppContext" friction is eliminated
- The self-reonboarding cost — returning to a hook file after weeks away — is bounded by TanStack Query's external docs, not by re-deriving a bespoke pattern from call sites

### Initiative Success

- Zero user-facing behavior changes across the migration. Smartboard live display, point award/undo, seating-chart live sync, and the teacher UI operate indistinguishably from pre-migration
- Existing unit and E2E test suites pass at every phase boundary. No test is rewritten to match changed internals unless the test was asserting on internal hook state (a violation of testing guidance) in the first place
- The E2E Supabase local-only allow-list in `playwright.config.ts` survives unchanged — this is a security boundary, not a refactor target

### Technical Success

Each of the following is a concrete, greppable end-state condition:

- `src/hooks/useBehaviors.ts`, `useClassrooms.ts`, `useLayoutPresets.ts`, `useStudents.ts`, `useTransactions.ts`, and the server-state portion of `useSeatingChart.ts` each contain **zero** `useState(loading)`, **zero** `useState(error)`, and **zero** manual `const previous = ...` rollback captures
- `src/contexts/AppContext.tsx` is **under 200 lines** and imports from **zero** files matching `src/hooks/use{Classrooms,Students,Behaviors,Transactions,LayoutPresets,SeatingChart}.ts`
- Every data hook added after Phase 1 is a `useQuery` or `useMutation` wrapper. The hand-rolled `{ data, loading, error, refetch }` shape is not cloned into any new file
- Realtime subscriptions exist on **exactly three** domains: students + point totals, point transactions, and seating-chart tables (seats, seating_groups, room_elements). `useClassrooms`, `useBehaviors`, `useLayoutPresets`, and user-settings hooks hold zero realtime subscriptions
- Surviving realtime callbacks invoke **only** `queryClient.invalidateQueries` or `queryClient.setQueryData`. No manual `onInsert` / `onUpdate` / `onDelete` state-merging logic remains
- The database layer (RLS policies, `REPLICA IDENTITY FULL`, trigger-maintained denormalized totals, RPC functions) is unchanged. No `supabase/migrations/*.sql` file is added or altered as part of this initiative

### Measurable Outcomes

- ~2,400 lines of hand-rolled server-state hook code reduced to thin wrapper equivalents; exact final line count is a Phase-6 measurement, not a target
- `AppContext.tsx` delta: 849 → <200 lines
- Manual optimistic-rollback capture sites: the 4 present in `useSeatingChart.ts` plus equivalents elsewhere → 0
- Duplicate subscription-lifecycle sites: every `useRealtimeSubscription` call whose callbacks merge server state into local `useState` → 0
- Docs: `docs/legacy/` directory either removed, or retained only as an explicit history reference; `docs/architecture.md` rewritten to describe the post-migration shape; the "React Context over Redux/Zustand" decision replaced with "TanStack Query for server state"

## Scope

### In Scope

- Introducing `@tanstack/react-query` + devtools at the application root
- Rewriting each feature data hook as a `useQuery` / `useMutation` wrapper
- Slimming `AppContext` to UI/session state only
- Reducing realtime subscription surface to three domains
- Rewriting `useRealtimeSubscription` callers to invalidate cache, not merge state
- Splitting `useSeatingChart` server state from drag / in-flight UI state
- Migrating 45 component files that consume data via `useApp()` — in-place, mechanical edits as part of phase-scoped work
- Documentation cleanup: rename or remove `docs/legacy/*` files as they become obsolete; rewrite `docs/architecture.md`

### Explicit Non-Goals

- **No UX or visual changes.** If a user notices anything, it is a bug
- **No database schema changes.** No new migrations, no altered tables, no new RPCs
- **No new user-facing features** shipped under this initiative
- **No Redux, SWR, or Jotai.** TanStack Query is the chosen server-state layer
- **No Zustand decision here.** Zustand adoption for client UI state — including the `useSeatingChart` drag-state split — is an open architectural question flagged for resolution before Phase 1, not decided in this PRD
- **No replacement of Supabase Realtime.** The transport is correct; ClassDojo's equivalent (PubNub) validates Supabase Realtime as category-appropriate
- **No change** to the E2E Supabase local-only allow-list in `playwright.config.ts`. This is a security boundary
- **No time estimates.** AI-assisted refactoring velocity is not meaningfully predictable; estimates create false precision
- **No resource/staffing plan.** Solo contributor
- **No rollback plan beyond "git revert the phase's PR(s)."** Phases are independent enough that this is sufficient

## Contributor Journey

This PRD explicitly does not change end-user journeys — teachers and students on the smartboard experience zero behavioral difference. The journey that _does_ change is the contributor's: the solo developer (Sallvain, plus AI coding agents collaborating in-session) working on the codebase day-to-day. That journey is the load-bearing one behind this initiative.

### The Contributor

**Sallvain** — solo developer and sole user of the development experience. Works on ClassPoints in bursts, often returns to a file after weeks away, and collaborates frequently with AI agents (Claude Code) that need to onboard to a pattern from scratch every session. Goals: keep adding value to ClassPoints over time; reduce the cost of every marginal change; stop losing hours to re-deriving what the code is doing.

### Before — "Adding a new server-backed feature, today"

**Scene:** A new feature needs a new data domain — say, "lesson plans" attached to a classroom. This is a CRUD feature with realtime: the teacher edits a plan, another tab reflects it within a second.

**What Sallvain does:**

1. Creates `src/hooks/useLessonPlans.ts`. Writes `useState(plans)`, `useState(loading)`, `useState(error)`. Writes `fetchPlans` in `useCallback`. Writes a `visibilitychange` listener for window-focus refetch.
2. Adds a `useRealtimeSubscription` call, handwrites `onInsert` / `onUpdate` / `onDelete` callbacks that splice incoming rows into the local `plans` state. Adds the "did we already apply this optimistically?" edge case.
3. Writes `addPlan` / `updatePlan` / `removePlan` mutations. For each: captures `const previous = plans`, `setPlans(new)`, awaits Supabase, `setPlans(previous)` + `setError(...)` on rollback. This is the 5-step contract, transcribed by hand, with four places the rollback can silently drop.
4. Opens `src/contexts/AppContext.tsx` (849 lines). Adds `useLessonPlans()` to the top-of-provider hook calls. Extends `AppContextValue` interface with the new fields. Adds the new fields to the provider's returned `value` object. Increments `AppContext.tsx` toward 900 lines.
5. Every component already using `useApp()` now re-renders when `plans` changes, even components that don't care about plans, because `value` is a new object reference.
6. If a second component mounts `useLessonPlans()` directly rather than going through `useApp()`, the two instances each hold their own `useState(plans)`. Optimistic updates in one don't propagate to the other. Sallvain discovers this only when two components render inconsistently in E2E.
7. Returning to the file three weeks later: re-reads `docs/legacy/legacy-hooks.md` and `docs/legacy/legacy-supabase.md` to reconstruct the 5-step contract. An AI agent working on the same file reads the same documents plus the similar-shaped hook files for pattern-matching, because the convention is internal to this repo and has no external documentation.

**Friction points at each stage:**

- Stage 1: three parallel state buckets must stay mutually consistent; nothing enforces it
- Stage 2: merge-logic edge cases are reinvented per hook; memory leak if cleanup is missed
- Stage 3: four rollback sites, each a silent-desync trap if forgotten
- Stage 4: `AppContext.tsx` grows unboundedly; every feature PR touches this file, creating out-of-proportion merge conflict surface
- Stage 5: implicit global re-render cost paid by 40+ unrelated fields
- Stage 6: no cache sharing across components; state drifts between call sites
- Stage 7: re-onboarding cost (for self and agents) is bespoke-pattern internalization, not public documentation lookup

### After — "Adding a new server-backed feature, post-migration"

**Scene:** Same feature — "lesson plans" — under the target architecture.

**What Sallvain does:**

1. Creates `src/hooks/useLessonPlans.ts`. Writes one `useQuery` and three `useMutation` wrappers. The file is well under 100 lines. The query function is an async function that calls Supabase and returns transformed data — testable in isolation, nothing more.
2. For realtime (if this domain needs it), adds a single `useRealtimeSubscription({ table: 'lesson_plans', onChange: () => queryClient.invalidateQueries(['lessonPlans', classroomId]) })`. One line of callback logic. TanStack Query handles the refetch, cache update, and re-render fan-out.
3. Mutations use `onMutate` for optimistic updates and `onError` for automatic rollback. No hand-captured `previous`. The cache is the single source of truth — every component reading the same query key sees the optimistic change, and every component sees the rollback.
4. Opens `src/contexts/AppContext.tsx` (<200 lines). Makes **zero edits** — lesson plans are server state; they don't belong on the UI/session context. Components that need them call `useLessonPlans()` directly.
5. Two components mounting `useLessonPlans()` dedupe automatically — one fetch, one cache entry, both render from the same source.
6. Returning to the file three weeks later: reads the TanStack Query docs if rusty. An AI agent working on the same file already knows TanStack Query from its training data; the pattern is external and documented, not internal and tribal.

**Friction eliminated at each stage:**

- Stage 1: one hook, no parallel state
- Stage 2: one-line realtime callback; cache invalidation is the only merge semantics needed
- Stage 3: optimistic rollback is a framework feature, not a manual checklist
- Stage 4: `AppContext.tsx` doesn't grow when new server-state features land
- Stage 5: components re-render only for the query keys they actually subscribe to
- Stage 6: cache dedup and cross-component consistency are free
- Stage 7: re-onboarding is TanStack Query doc lookup, same as any React developer anywhere

### Journey Requirements Summary

This journey reveals that the PRD's capability surface is not user-facing features but **developer-experience capabilities** that the codebase must deliver post-migration:

- Thin server-state hooks with zero parallel state, testable as pure functions plus standard query-client integration
- Realtime as cache-invalidation trigger, not state-merge mechanism
- Automatic optimistic-update rollback with cache consistency across components
- `AppContext` that does not grow with new server-backed features
- Pattern knowledge accessible via external documentation, not tribal internal docs

## Domain-Specific Requirements

_Intentionally omitted._ This initiative makes zero changes to data handling, database schema, RLS policies, or authentication flow. Compliance-relevant posture (FERPA, student-data privacy) is enforced at the Postgres RLS layer and is out of scope — a section here would not inform any technical decision executed under this PRD. If ClassPoints is ever deployed into a regulated school context, that deployment posture is a separate future PRD.

## Innovation & Novel Patterns

_Intentionally omitted._ The thesis of this initiative is the opposite of innovation: replace ~2,400 lines of hand-rolled, internally-documented state management with an industry-standard library (`@tanstack/react-query`) that has years of production use across the React ecosystem. There is no novel approach whose validity needs de-risking — the validation is that thousands of applications already run on the target library. Writing an innovation section here would undermine the case for the change.

## Target Architecture

This section describes the **end-state shape** of the codebase. Sequencing and phase-by-phase migration are in the next section; architectural decisions about "how" (library configuration, state topology, API shapes, build config) are handed to the subsequent architecture phase and are deliberately not resolved here.

### Server State — `@tanstack/react-query`

- One `QueryClient` instantiated at application root; `QueryClientProvider` wraps the provider tree inside `main.tsx`
- Feature data hooks (`useStudents`, `useClassrooms`, `useBehaviors`, `useTransactions`, `useLayoutPresets`, and the server-state portion of seating chart) become thin `useQuery` / `useMutation` wrappers
- Query functions are pure async functions that call Supabase, check `error` before `data`, transform `snake_case` DB rows to `camelCase` app types at the boundary, and return typed results
- Mutations use `onMutate` for optimistic cache updates and `onError` for automatic rollback via `setQueryData` — replacing the manual 5-step contract
- Window-focus refetch, stale-time semantics, and background refetch are delegated to TanStack Query defaults with per-hook overrides only where justified

### Realtime — Cache-Invalidation Trigger

- Realtime subscriptions exist on exactly three table sets: `students` (for totals), `point_transactions`, and `seats` / `seating_groups` / `room_elements` (for seating-chart live sync)
- `useRealtimeSubscription` callbacks invoke only `queryClient.invalidateQueries` or `queryClient.setQueryData` — never manual state merges
- Hot-path mutations that benefit from targeted cache patching (e.g., point award on smartboard) may call `setQueryData` deliberately; invalidation is the default
- Reconnect handling is `invalidateQueries` (TanStack Query refetches automatically), replacing the hand-rolled `onReconnect` → `fetchX` pattern

### Non-Realtime Domains

- `useClassrooms`, `useBehaviors`, `useLayoutPresets`, and user-settings hooks have zero realtime subscriptions
- These rely on TanStack Query's `refetchOnWindowFocus` plus explicit `invalidateQueries` after mutations for cross-tab freshness
- The bandwidth and subscription-lifecycle cost of live-sync on data nobody watches is eliminated

### `AppContext` — UI/Session Only

- Post-migration `AppContext` holds: active classroom id (or equivalent routing-derived selection), modal/open-state flags, selection-mode toggles, and the sound-enabled preference
- No server-of-truth data (`students`, `classrooms`, `transactions`, `behaviors`, seating chart) is re-exposed through `useApp()`
- `useApp()` survives as a facade for UI state; components consume server data directly via the relevant `useQuery` hook
- `AppProvider` imports zero feature data hooks

### Components

- Components call `useQuery` wrappers directly: `const { data: students } = useStudents(classroomId);`
- Conversion from `useApp()` to direct hook calls is mechanical — 45 files, no redesign
- Existing component rules from `docs/legacy/legacy-components.md` that remain correct: named exports, PascalCase filenames, hooks-before-early-returns, props interface above component, Tailwind over inline styles — all survive
- The rule that dies: "always use `useApp()`, never read contexts directly" — the facade it protected no longer exists in the shape it was protecting

### `useSeatingChart` — Split

- Server-state concerns (seat rows, groups, room elements, layout presets) become separate `useQuery` hooks, each with a realtime subscription wired to `invalidateQueries`
- In-flight UI state (active drag position, hover targets, selection rectangle, unsaved seat-position edits) stays in local `useState` within the canvas component, or moves to a small client store if Zustand is adopted — the Zustand decision is open and handed to the architecture phase
- The four manual `previous`-position captures for drag rollback collapse into `useMutation.onMutate` / `onError`

### Type Mapping — Unchanged

- `Db{Entity}` types in `src/types/database.ts` continue to describe `snake_case` Postgres rows
- `{Entity}` types in `src/types/index.ts` continue to describe `camelCase` application shapes
- Transformation functions (`transformStudent`, etc.) continue to exist and are called inside `queryFn` rather than at the top of hand-rolled hooks
- `createClient<Database>(...)` typing survives; new query keys reference the same types

### Database & Migrations — Unchanged

- RLS policies on all tables survive unchanged
- `REPLICA IDENTITY FULL` on tables that emit realtime DELETE events survives unchanged
- Trigger-maintained denormalized totals (`students.point_total` and time-window totals) survive unchanged
- RPC functions for aggregate queries (e.g., `get_student_time_totals`) survive unchanged
- No `supabase/migrations/*.sql` file is added, altered, or removed under this initiative

### Testing — Infrastructure Unchanged in This PRD

- Vitest 4 + jsdom, `@testing-library/react`, `tdd-guard-vitest`, Playwright (Chromium, `storageState` auth, `data-testid` selectors) are **all unchanged** under this initiative
- `playwright.config.ts` (including the local-Supabase allow-list security boundary), `vitest.config.ts`, and test file locations (`src/test/**/*.test.{ts,tsx}`, `e2e/**/*.spec.ts`) are **not modified** by any phase of this migration
- Test _shape_ simplifies as a mechanical side effect — a `useQuery` wrapper's query function is a plain async function tested in isolation, and hook-integration tests use TanStack Query's `QueryClient` test harness. Assertions continue to be on rendered UI rather than internal hook state (this was already the correct pattern; it becomes the _only_ pattern post-migration)
- **Out of scope / future initiative:** a separate test-hardening effort using the BMAD TEA workflow (full tier, not enterprise) is planned as its own PRD and workstream. This migration must leave the codebase in a state where that future effort can proceed cleanly, but does not itself deliver expanded test coverage or new test infrastructure

## Phased Rollout

**Rollout mode:** Pinned order. Phases run strictly 0 → 6. Hook migrations are not opportunistically bundled into unrelated feature PRs — each phase is its own PR (or small tight group of PRs scoped to the phase).

**Rollback:** Each phase is independently git-revertable. If a phase lands and a regression surfaces within a reasonable verification window, revert the phase's PR(s); the prior phase's shape remains intact. No complex rollback strategy beyond `git revert`.

**During migration:** New features written after Phase 0 lands MUST use the target pattern (`useQuery` / `useMutation`) even if they sit next to legacy-shape hooks. A mixed codebase is expected mid-migration; writing new features in the legacy style "to match existing code" perpetuates the problem and is a PR-review block.

### Phase 0 — Bootstrap

**Scope:** Introduce `@tanstack/react-query` and its devtools without migrating any existing hook. Establish the infrastructure on which every subsequent phase depends.

**Risk:** Low.

**Acceptance criteria:**

- `@tanstack/react-query` is a runtime dependency in `package.json`
- `@tanstack/react-query-devtools` is a dev-only dependency, confirmed tree-shaken from the production bundle (dev-only import path or conditional import — exact mechanism is an architecture-phase decision)
- `src/main.tsx` instantiates a single `QueryClient` and wraps the provider tree in `QueryClientProvider` at the correct layer (outside `AuthProvider` or at an equivalent agreed position)
- In development, `<ReactQueryDevtools />` is mounted and reachable
- Every existing unit test (Vitest) and E2E test (Playwright against local Supabase) passes unchanged
- Manual smoke: teacher login → award a point on the smartboard → verify live update; open seating chart → drag a seat → verify persistence. Nothing should behave differently

### Phase 1 — Pilot (`useBehaviors`)

**Scope:** Migrate `useBehaviors.ts` (~144 lines) to a `useQuery` / `useMutation` implementation as the reference pattern. Produce a short internal pattern note captured in this PRD or a sibling doc once the migration lands, so Phase 2 and beyond have a concrete template.

**Risk:** Low. Smallest hook; mutation path is simple; no realtime.

**Acceptance criteria:**

- `src/hooks/useBehaviors.ts` contains **zero** `useState(` calls for data, loading, or error
- `src/hooks/useBehaviors.ts` contains **zero** manual `const previous = ...` rollback captures
- `useBehaviors` exposes a `useQuery`-backed read and `useMutation`-backed write API; callers receive the TanStack Query result shape (`data`, `isLoading`, `error`) directly, or a stable adapter shape documented in the pattern note
- The `useApp()` facade continues to expose behaviors to components in the same shape those components consume today (adapter bridge layer; no component edits)
- Behavior-templates domain has **zero** realtime subscription (aligns with scope-down decision — Phase 1 also lands the realtime-subscription removal for this domain)
- All existing unit and E2E tests pass unchanged
- Manual smoke: create a behavior, edit it, delete it; refresh window; no visible regressions

### Phase 2 — Small/Medium Hooks (`useLayoutPresets`, `useTransactions`, `useClassrooms`)

**Scope:** Migrate the three medium hooks. `useLayoutPresets` (~166) and `useClassrooms` (~436) have no realtime subscription post-migration; `useTransactions` (~212) keeps its realtime subscription (point transactions is in the three-domain live-sync set) and exercises the optimistic-mutation + cache-invalidation path.

**Risk:** Medium. `useClassrooms` touches the multi-component primary selector; `useTransactions` is the first realtime + optimistic-mutation pairing in the new shape.

**Acceptance criteria:**

- `src/hooks/useLayoutPresets.ts`, `src/hooks/useClassrooms.ts`, and `src/hooks/useTransactions.ts` each contain **zero** `useState(loading)`, **zero** `useState(error)`, and **zero** manual rollback captures
- `useLayoutPresets` and `useClassrooms` hold **zero** realtime subscriptions; they rely on `refetchOnWindowFocus` + on-demand `invalidateQueries` after mutations
- `useTransactions` retains one realtime subscription whose `onChange` callback invokes only `invalidateQueries` and/or `setQueryData`
- Optimistic point-award is visible in the UI within one render of user interaction; a server-side error triggers automatic cache rollback (drive this test with a forced-error mutation harness during verification)
- `useApp()` continues to expose these three domains to components in the legacy shape via adapter — zero component edits in this phase
- All existing unit and E2E tests pass unchanged
- Manual smoke: create/delete classrooms; save/load a layout preset; award and undo a point on a live smartboard tab while watching the teacher tab

### Phase 3 — `useStudents`

**Scope:** Migrate `useStudents.ts` (~411 lines). This hook exercises the hardest single-hook combination: RPC for time-window totals, `visibilitychange` / window-focus refetch semantics, and multiple realtime subscriptions (students + point transactions) both invalidating into the same cache region.

**Risk:** Medium. Students is on the hot path for the smartboard live display; regressions here are immediately visible.

**Acceptance criteria:**

- `src/hooks/useStudents.ts` contains **zero** `useState(loading)`, **zero** `useState(error)`, and **zero** manual rollback captures
- Time-window totals continue to be served by the existing `get_student_time_totals` RPC, now called inside a `useQuery`'s `queryFn`; no client-side aggregation of `point_transactions` replaces the RPC
- The bespoke `visibilitychange` listener is removed; refetch-on-window-focus is delegated to TanStack Query
- Realtime subscriptions for `students` and `point_transactions` remain and both call only `invalidateQueries` / `setQueryData`
- Point-total denormalization (`students.point_total` trigger-maintained) continues to be read directly from the query result; client-side aggregation from transactions remains explicitly forbidden
- `useApp()` continues to expose students to components in the legacy shape via adapter — zero component edits
- All existing unit and E2E tests pass unchanged
- Manual smoke: two-tab test — teacher awards point in tab A, student smartboard tab B reflects new total within ~1 second; undo in tab A, tab B reverts within ~1 second

### Phase 4 — Slim `AppContext` and Cut the Adapter Bridge

**Scope:** Remove the adapter layer that kept `useApp()` returning legacy-shape data during Phases 1–3. Migrate the 45 component files that consume data via `useApp()` to call the relevant `useQuery` hooks directly. Delete the pass-through fields from `AppContext`. `AppContext` retains only UI/session state.

**Risk:** Medium. Mechanical per-file edit count is high (~45 files), but each edit is small and greppable; the risk is volume of change, not per-file complexity.

**Acceptance criteria:**

- `src/contexts/AppContext.tsx` is **under 200 lines**
- `src/contexts/AppContext.tsx` imports from **zero** files matching `src/hooks/use{Classrooms,Students,Behaviors,Transactions,LayoutPresets,SeatingChart}.ts`
- `useApp()` returns only UI/session fields — active classroom id (or equivalent routing-derived selection), modal state, selection-mode toggles, sound-enabled preference, plus anything authentically UI-side that the architecture phase identifies
- Zero component files import `students`, `classrooms`, `behaviors`, `transactions`, `layoutPresets`, or seating data from `useApp()`; each consuming component calls the appropriate `useQuery`-backed hook directly
- Unused adapter code from Phases 1–3 is deleted, not commented out
- All existing unit and E2E tests pass unchanged
- Manual smoke: full app walkthrough — login, select classroom, award points, undo, open seating chart, change layout preset, toggle sound, log out — every flow behaves identically to pre-phase

### Phase 5 — `useSeatingChart` Split

**Scope:** Split `useSeatingChart.ts` (~1,117 lines) into server-state `useQuery` hooks (one per relevant table: seats, seating_groups, room_elements, layout presets) and an in-flight UI-state layer for drag/hover/selection. The UI-state-layer choice (local `useState` within the canvas component vs. a small Zustand store scoped to the seating feature) remains open and is decided in the architecture phase based on Zustand Open Question #1.

**Risk:** High. Hardest single piece of work in the initiative. Drag-and-drop is latency-sensitive and state-interleaving-sensitive; getting the split wrong produces visible jank or dropped drags.

**Acceptance criteria:**

- `src/hooks/useSeatingChart.ts` and its siblings collectively contain **zero** `useState(loading)`, **zero** `useState(error)`, and **zero** manual `const previous = ...` rollback captures for server state
- The four rollback-capture sites present in the legacy `useSeatingChart` are replaced by `useMutation.onMutate` / `onError` pairs operating on the TanStack Query cache
- Realtime subscriptions for `seats`, `seating_groups`, and `room_elements` remain; each callback invokes only `invalidateQueries` / `setQueryData`
- Drag state (active drag position, hover targets, selection rectangle, unsaved position edits) is cleanly separated from server state — either in local component `useState` or in a dedicated client store; the separation is greppable (no drag state lives in a `useQuery` cache entry)
- All existing unit and E2E tests pass unchanged
- Manual smoke: drag a seat to a new position; drag a seat that a realtime event arrives for mid-drag; cancel an in-flight drag; save a layout preset mid-rearrangement — all behave without regression

### Phase 6 — Documentation Cleanup

**Scope:** Retire legacy docs that are now contradicted by the code, rewrite `docs/architecture.md` to describe the post-migration shape, and update `CLAUDE.md` / `project-context.md` to reflect the new state-management direction.

**Risk:** Low. No runtime code change.

**Acceptance criteria:**

- `docs/architecture.md` is rewritten to describe the post-migration architecture (server state in TanStack Query, three-domain realtime, slim `AppContext`, component-direct hook consumption)
- The "React Context over Redux/Zustand" decision recorded in the current `docs/architecture.md` is replaced with "TanStack Query for server state; `AppContext` for UI/session state; Zustand decision deferred/resolved per architecture phase"
- `docs/legacy/` is either removed or explicitly retained as a history reference with a `README` clarifying its status; files that describe patterns no longer in the code are not retained as authoritative guidance
- `CLAUDE.md` remains lean (commands + env only; current state is acceptable)
- `_bmad-output/project-context.md` state-management section is updated to reflect completed migration; legacy warnings (e.g., "Treat these as legacy — migrate to TanStack Query when you're already touching them") are removed as obsolete
- Any `.claude/rules/*` files whose content is now wrong are updated or removed

## Functional Requirements

All FRs below are testable capabilities of the **post-migration codebase**. "Contributor" covers the solo developer (Sallvain) and any AI agent collaborating in a coding session. "Codebase" requirements are structural invariants verifiable by inspection or simple tooling (grep, line count, import analysis).

### Server-State Hook Authoring

- **FR1:** Contributor can create a new server-backed data hook by writing a `useQuery` wrapper and (if mutating) one or more `useMutation` wrappers, without introducing `useState` for data, loading, or error.
- **FR2:** Contributor can write a hook's query function as a plain async function that calls Supabase and returns transformed application types — testable in isolation with a mocked Supabase client.
- **FR3:** Contributor can provide per-hook overrides for stale time, cache time, window-focus refetch, and retry policy without reimplementing any of those behaviors.
- **FR4:** Contributor can add a new server-backed feature without editing `src/contexts/AppContext.tsx`.

### Realtime Sync Surface

- **FR5:** Codebase exposes realtime live-sync subscriptions on exactly three table sets: students (+ point totals), point transactions, and seating-chart tables (seats, seating_groups, room_elements).
- **FR6:** Contributor can wire a realtime subscription for a sync-bearing domain with a single-line callback that invalidates the relevant query key, using the existing `useRealtimeSubscription` helper.
- **FR7:** Contributor can opt a hot-path mutation into targeted cache patching via `queryClient.setQueryData` when realtime invalidation would produce visible flicker; invalidation remains the default.
- **FR8:** Codebase contains no hand-rolled `onInsert` / `onUpdate` / `onDelete` callbacks that merge server-state changes into local component state.

### Non-Realtime Sync

- **FR9:** Non-realtime domain hooks (classrooms, behavior templates, layout presets, user sound settings) rely on TanStack Query's `refetchOnWindowFocus` and on-demand `invalidateQueries` after mutations for cross-tab freshness, without subscribing to Supabase Realtime.

### Optimistic Updates & Rollback

- **FR10:** Contributor can implement an optimistic mutation using `useMutation`'s `onMutate` and `onError` callbacks, without hand-capturing previous state for rollback.
- **FR11:** Optimistic updates applied through the cache are visible to every component subscribed to the same query key, eliminating cross-component state drift.
- **FR12:** A server-side mutation error automatically restores the previous cache snapshot; no additional developer code is required per mutation site.

### UI / Session State Separation

- **FR13:** `useApp()` exposes only UI/session state — active selection, modal state, selection-mode toggles, sound-enabled preference, and equivalents identified by the architecture phase.
- **FR14:** `AppContext.tsx` contains zero imports from feature data hook files (`useStudents`, `useClassrooms`, `useBehaviors`, `useTransactions`, `useLayoutPresets`, `useSeatingChart`).
- **FR15:** Contributor can access server data in any component by calling the relevant `useQuery`-backed hook directly, without routing through `useApp()`.

### Seating Chart State Split

- **FR16:** Seating-chart server state (seats, groups, room elements, layout presets) is exposed through dedicated `useQuery` hooks, each with its realtime subscription wired to cache invalidation.
- **FR17:** Seating-chart in-flight UI state (drag position, hover targets, selection rectangle, unsaved edits) is separated from server state and is greppable — drag state does not live in a `useQuery` cache entry.
- **FR18:** A mid-drag realtime event updates the server-state cache without interrupting the active drag interaction.

### Architectural Preservation

- **FR19:** Database layer (RLS policies, `REPLICA IDENTITY FULL`, trigger-maintained denormalized totals, RPC functions) operates identically pre- and post-migration.
- **FR20:** Supabase Realtime remains the sync transport; no alternative pub/sub or WebSocket transport is introduced.
- **FR21:** E2E test infrastructure (Playwright local-Supabase allow-list, `storageState` auth, `data-testid` selectors, `webServer.reuseExistingServer: false`) operates unchanged.
- **FR22:** Type mapping between `snake_case` DB rows and `camelCase` application types continues to occur at the hook boundary via existing `transform*` functions.

### Pattern Discoverability

- **FR23:** Contributor can identify the canonical pattern for a new server-backed hook by reading `@tanstack/react-query`'s public documentation and `docs/architecture.md` — no reliance on files under `docs/legacy/`.
- **FR24:** Codebase contains no documentation-authoritative claim that contradicts the post-migration architecture; legacy pattern files, if retained, are marked as historical reference with a `README` clarifying their status.
- **FR25:** An AI agent reading a single post-migration hook file can determine the pattern's shape without additional context from sibling hook files or repo-specific convention docs.

## Non-Functional Requirements

Documented only where the migration introduces a quality constraint that differs from current-state code. Security, accessibility, and integration categories are omitted because this PRD makes no changes that touch them (auth flow, DOM output, external integrations all unchanged).

### Behavioral Equivalence (Correctness)

- **NFR1:** Post-migration realtime propagation latency for the three live-sync domains (students + totals, point transactions, seating chart) is equivalent to pre-migration — the smartboard reflects an awarded point within the same ~1-second user-perceived window it does today. Cache invalidation + refetch must not add a perceptible tier of delay over the legacy merge-in-place pattern.
- **NFR2:** Optimistic mutations are visible in the initiating UI within a single render after user interaction. A server-side error triggers cache rollback within one additional render, without intermediate inconsistent states visible to the user.
- **NFR3:** Two components reading the same server-state query key render identical data at all times; cache dedup is verifiable via TanStack Query devtools during development.

### Performance (Bundle Size)

- **NFR4:** `@tanstack/react-query-devtools` does not ship in the production bundle. Verification is greppable — a production build output (`dist/assets/*.js`) contains zero references to devtools module identifiers. Exact bundler mechanism (conditional import, Vite `import.meta.env.DEV` branch, or equivalent) is an architecture-phase decision, but the outcome constraint is fixed.
- **NFR5:** The baseline JavaScript bundle size does not increase beyond the `@tanstack/react-query` runtime contribution (a known quantity, approximately 13 kB min+gzip at current versions). Any additional bundle weight introduced by the migration must be justified in the PR that adds it.

### Reliability (Subscription Lifecycle)

- **NFR6:** No realtime subscription outlives the component tree that owns it. Mount → `subscribe`, unmount → `removeChannel`. Verification is a Vitest test — added as part of Phase 1's pilot work — that mounts and unmounts a consumer and asserts `supabase.removeChannel` was called with the same channel instance.
- **NFR7:** Query cancellation on unmount behaves correctly — an in-flight query for an unmounted component does not apply its result to the cache for a stale query key. TanStack Query's default behavior satisfies this; the architecture phase must confirm no `QueryClient` configuration overrides it.

### Maintainability (Line Count Targets as NFR)

- **NFR8:** `src/contexts/AppContext.tsx` stays under 200 lines post-Phase-4. This is a measurable NFR, not a stylistic preference — breaching 200 lines indicates server-state concerns re-entered the context.
- **NFR9:** Each migrated hook file contains fewer total lines than its pre-migration counterpart. Any migrated hook larger than its predecessor is a red flag — the wrappers should be thinner than the reimplementation they replace.

## Risks & Mitigations

### Risk 1: Realtime Invalidation Correctness

**What could go wrong:** Callers rewrite `useRealtimeSubscription` handlers from `onInsert/onUpdate/onDelete` state merges to a single `invalidateQueries` call, but invalidate the wrong query key — for example, invalidating `['students']` when the active query is `['students', classroomId]`. Symptom: smartboard stops reflecting new point totals because the invalidation never reaches the active query.

**Mitigation:**

- Pattern note from Phase 1 (`useBehaviors` pilot) must document the query-key construction convention and include an example of a filtered invalidation
- Per-phase manual smoke test explicitly exercises cross-tab realtime propagation (teacher tab awards, smartboard tab reflects)
- TanStack Query devtools during development shows active query keys — a missing invalidation is visible as "the query stays stale while data changes server-side"

### Risk 2: `useSeatingChart` Drag-State Split Regression

**What could go wrong:** The split between server state (in the query cache) and in-flight drag state (in local or Zustand state) is drawn in the wrong place. Drag state leaks into cache entries, causing visible jank on realtime events; or server state leaks into drag state, causing drops to sync inconsistently.

**Mitigation:**

- Phase 5 is explicitly flagged as high risk and sequenced last, after the pattern has been proven on five simpler hooks
- Acceptance criterion FR17 is greppable: drag state must not live in a `useQuery` cache entry, verifiable by inspection
- Manual smoke test explicitly covers the "realtime event during active drag" scenario

### Risk 3: Component-Facade Co-existence During Transition

**What could go wrong:** Phases 1–3 keep `useApp()` returning legacy-shape data via an adapter bridge so components don't churn. If the adapter is half-broken — e.g., returns reference-unstable objects where the legacy hook returned stable ones — components re-render unnecessarily, or worse, `useMemo`-keyed-off-adapter-output stops memoizing.

**Mitigation:**

- Adapter functions must return reference-stable output for unchanged underlying data (`useMemo` or equivalent)
- Phase 1 acceptance explicitly includes "all existing unit and E2E tests pass unchanged" — any re-render regression surfaces via a test that was previously passing
- Phase 4 deletes the adapter; co-existence is explicitly time-bounded, not indefinite

### Risk 4: Devtools Leaking Into Production

**What could go wrong:** `@tanstack/react-query-devtools` imports via a non-tree-shakable path and ends up in the production bundle. Impact: leaks query-key and data information in devtools to any user with browser devtools, and adds unnecessary bundle weight.

**Mitigation:**

- NFR4 is the acceptance criterion — production bundle grep for devtools module identifiers must return zero hits
- Phase 0 manual verification step includes building the production bundle and confirming the grep result
- Architecture phase decides the exact mechanism (conditional import, environment branch, dynamic import) — the constraint is the outcome, not the mechanism

### Risk 5: Pattern Drift During Long-Running Migration

**What could go wrong:** Between phases, new features get written against `useApp()` legacy shape because "that's what the existing code does." The migration falls behind as the surface area grows under it.

**Mitigation:**

- Explicit rule in the Phased Rollout section: post-Phase-0, new features use the target pattern, and legacy-shape new hooks are PR-review blockers
- Phase 1 lands the pattern note; every subsequent hook migration references it
- `CLAUDE.md` / `project-context.md` updated at or before Phase 1 to reflect the pattern expectation for new code

## Decisions Required Before Phase 1

These are architectural decisions this PRD flags but deliberately does not resolve — they belong to the subsequent architecture phase. Phase 0 and Phase 1 can proceed in parallel with resolution, but Phase 4 (AppContext slimming) and Phase 5 (seating chart split) materially depend on outcomes.

1. **Zustand adoption for client-side UI state.** Options: (a) keep expanded `AppContext` usage for all UI state, (b) introduce Zustand for UI state broadly, (c) introduce Zustand scoped only to the seating-chart drag-state split. Modernization plan (`docs/modernization-plan.md` §Open questions #1) leans toward (a) given current UI-state volume. Resolution affects Phase 4 design and is blocking for Phase 5 acceptance criterion FR17.
2. **`activeClassroomId` ownership.** Options: Context state (status quo), URL/router param, or a dedicated lightweight store. Modernization plan (§Open questions #2) notes URL is more shareable and reload-resilient. Small behavioral change; affects Phase 4 design.
3. **`useRealtimeSubscription` refactor timing.** Options: (a) ship a new `onChange` variant alongside the existing multi-callback API in Phase 1 and deprecate the old API over time, or (b) rewrite in place at Phase 1 and force each subsequent migration to update its callers to the new shape. Modernization plan (§Open questions #4) flags (a) as safer, (b) as cleaner. Affects Phase 1 scope; must be resolved before Phase 1 begins.
4. **Devtools bundling mechanism.** Conditional import, env-branched import, dynamic import with code split, or a different approach. The _outcome_ is fixed by NFR4 (zero references in production bundle); the _mechanism_ is an architecture-phase pick.

The pinned-vs-opportunistic rollout question (modernization plan §Open questions #3) has been resolved in this PRD as pinned; it is not in the above list.
