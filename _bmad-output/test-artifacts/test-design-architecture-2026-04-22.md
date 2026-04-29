---
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output',
  ]
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-22'
workflowType: 'testarch-test-design'
mode: 'system-level'
audience: 'architecture'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
  - _bmad/tea/testarch/knowledge/adr-quality-readiness-checklist.md
---

# Test Design for Architecture: ClassPoints TanStack Query Modernization

**Purpose:** Architectural concerns, testability gaps, and NFR verification requirements for the PRD-defined state-management modernization. This document is the contract between the test design and the phase-by-phase migration PRs: what the architecture must deliver (or explicitly defer) so per-phase testing can land on a stable foundation.

**Date:** 2026-04-22
**Author:** Sallvain (solo contributor; Master Test Architect role)
**Status:** Architecture Review Pending
**Project:** ClassPoints
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md` (four resolved decisions + infrastructure contracts)

**Adaptation note:** ClassPoints is a solo-contributor codebase — Sallvain holds all roles (Architecture, Dev, QA, PM). The "owner" columns below therefore all resolve to Sallvain; they are retained for template parity and to clarify _which hat_ the action is taken in.

---

## Executive Summary

**Scope:** Replace ~2,400 lines of hand-rolled server-state management in a React + Supabase SPA with `@tanstack/react-query`. Zero UX, schema, or transport changes. Seven pinned phases (0–6). The PRD explicitly scopes this as _invariant-preservation refactoring_, not feature delivery.

**Business Context** (from PRD):

- **Revenue/Impact:** N/A — internal developer-experience modernization. Drives downstream feature velocity (cheaper feature PRs, fewer subscription-lifecycle bugs).
- **Problem:** Bespoke `{ data, loading, error }` hooks + 849-line `AppContext` facade + manual 5-step optimistic-update contract repeated across every mutation → duplicate requests, cross-component state drift, AppContext churn in every feature PR, costly re-onboarding.
- **GA Launch:** Phased rollout (pinned 0 → 6). No calendar dates — "AI-assisted refactoring velocity is not meaningfully predictable" (PRD §Non-Goals).

**Architecture** (from resolved decisions in `architecture.md`):

- **Decision 1 — Zustand scope:** None adopted under this initiative. `SeatingChartEditor.tsx` intra-component `useState` remains; `@dnd-kit` continues to own drag-transport.
- **Decision 2 — `activeClassroomId` ownership:** Status-quo `useState` in slimmed `AppContext`, `localStorage`-backed for reload persistence. No router adoption.
- **Decision 3 — `useRealtimeSubscription` refactor timing:** Alongside variant. New `onChange`/multi-binding API ships in Phase 1; legacy `onInsert/onUpdate/onDelete` fields retained as deprecation bridge; legacy deleted at end of Phase 3.
- **Decision 4 — Devtools bundling:** Env-branched static import (`import.meta.env.DEV && <ReactQueryDevtools />`) as primary; async `mountApp()` dynamic import as contingency. Authoritative acceptance is `dist/` grep.

**Expected Scale:** Single-tenant-per-teacher. No load/scale concerns introduced by this refactor. Realtime surface contracts (current subscription count reduced to three domains / three Supabase channels at steady state). Bundle size budget: +~13 kB min+gzip for TanStack Query runtime; devtools MUST be zero bytes in production.

**Risk Summary:**

- **Total risks identified:** 9 (5 from PRD §Risks & Mitigations + 4 test-specific risks exposed by the chosen architecture)
- **High-priority (score ≥6):** 4 risks requiring mitigation before or during their associated migration phase
- **BLOCKING (score=9):** 0 — consistent with PRD's per-phase `git revert` rollback design
- **Test effort:** ~15 test-delta items across all 6 phases. Small deltas per phase (1–3 tests / 1 manual smoke). Dominated by infrastructure setup (Phase 0–1) and greppable guardrails (CI-enforced throughout).

---

## Quick Guide

### 🚨 BLOCKERS — Team Must Decide (Can't Proceed Without)

**Pre-Implementation Critical Path** — these MUST be completed before migrated-hook tests can be written:

1. **G-01: `createTestQueryClient()` helper** — Architecture must specify the exact shape of the test QueryClient builder: fresh `QueryClient` per test, same `defaultOptions` as production, override `retries: false` to surface errors deterministically per `test-quality.md`. Cheap to write (~10 lines). Blocks T-04, T-08, T-11. (owner: Architecture hat / land in Phase 1 pilot PR)
2. **G-02: Realtime subscription test harness** — Architecture flagged this as "TBD by Phase 1 pattern note" in the `useRealtimeSubscription` block. Need: a Vitest-friendly way to (a) mock `supabase.channel(...)` and return a controllable channel instance, (b) spy on `removeChannel`, (c) emit synthetic `postgres_changes` payloads from test code to the hook's subscribers. Blocks T-03 (NFR6 Vitest test, explicitly called out in PRD) and T-14 (runtime channel count). (owner: Architecture hat, land in Phase 1)
3. **G-04 (soft blocker; acceptable deferral):** Supabase client mocking pattern for `queryFn` isolation tests — PRD FR2 says query functions should be "testable in isolation with a mocked Supabase client," but no pattern exists today. Options: (a) establish `vi.mock('../lib/supabase')` with chainable-builder stub, (b) skip unit-level `queryFn` tests and rely on integration tests against local Supabase. The PRD's test-scope discipline (narrow, phase-boundary green) supports option (b) as an accepted trade-off for this initiative; defer the pattern establishment to the future TEA initiative unless R-08 actually bites. (owner: QA hat decision, Phase 1)

**What we need from team:** Resolve G-01 and G-02 in the Phase 1 PR scope. Defer G-04 by default; re-open only if per-hook unit coverage is needed mid-migration.

---

### ⚠️ HIGH PRIORITY — Team Should Validate (Recommendation + Approval)

1. **R-03 + R-06: Adapter-bridge reference stability** (Phases 1–3) — **Recommendation:** Add one Vitest test per migrated domain that asserts reference-stability of the adapter output under a deep-equal refetch (uses the `createTestQueryClient()` helper). Per architecture §Adapter bridge: "any `useMemo`-based adapter that re-shapes the query result into the legacy `useApp()` shape can rely on input reference stability → its output is reference-stable." This contract is silent in existing tests (Testing-Library assertions are on rendered UI, not memo identity) and is the single most silent regression path. Without this test, a future `structuralSharing: false` override or a new `dbToX` transform that returns fresh objects per refetch would cause memoization thrash undetectable by the current suite. (phase: 1–3)
2. **R-01: Realtime invalidation correctness** — **Recommendation:** Adopt the architecture's `queryKeys` single-source-of-truth strictly (Hook #3, #4 in architecture §Validation) and add T-05 as a Phase 1 unit test exercising the `onChange` legacy-bridge routing. Manual two-tab smoke test T-10 at Phase 3 covers the end-to-end path. (phase: 1)
3. **R-09: Realtime harness naming** — **Recommendation:** Commit to harness shape in Phase 1 pattern note rather than "TBD" — ties to G-02. (phase: 1)

**What we need from team:** Approve the three recommendations as scope additions to Phase 1's PR; they are not in the PRD explicitly but are load-bearing for the PRD's named NFRs (NFR1, NFR6) and Risk 3.

---

### 📋 INFO ONLY — Solutions Provided (Review, No Decisions Needed)

1. **Test strategy:** Unit-heavy (Vitest) for hook-level invariants; zero new E2E additions beyond PRD-named manual smokes; CI-grade `ripgrep` guardrails for the architecture's 19 acceptance hooks. Matches `test-levels-framework.md` — favor unit when logic can be isolated; favor E2E only for user-critical paths (the smartboard two-tab case is the only one exercised).
2. **Tooling:** Vitest 4 + jsdom + `@testing-library/react` + `tdd-guard-vitest` (already in place). Playwright Chromium against LOCAL Supabase with `.env.test` allow-list (already in place; explicitly unchanged — PRD §Testing: "No change to the E2E Supabase local-only allow-list in `playwright.config.ts`. This is a security boundary").
3. **Tiered CI/CD:** No tiering needed. PR runs: Vitest suite + lint + typecheck (existing). Manual smoke per-phase from PRD acceptance. No nightly/weekly tiers — PRD scope explicitly defers broad test expansion to a future TEA initiative.
4. **Coverage:** ~15 test-delta items; P0/P1/P2 in the companion QA doc — priorities are risk-based over migration risks R-01–R-09, NOT feature coverage across all 25 FRs.
5. **Quality gates:** Per-phase acceptance = PRD Phase-N acceptance list ∪ relevant greppable hooks from `architecture.md` §Validation ∪ manual smoke for the phase.

**What we need from team:** Acknowledge the scope discipline (solution provided; aligned with PRD §Testing and §Non-Goals).

---

## For Architects and Devs — Open Topics 👷

### Risk Assessment

**Total risks identified:** 9 (4 high-priority score ≥6, 2 medium score 4-5, 3 low score 1-3)

#### High-Priority Risks (Score ≥6) — IMMEDIATE ATTENTION

| Risk ID  | Category | Description                                                                                            | Probability | Impact | Score | Mitigation                                                                                                                                          | Owner                    | Timeline        |
| -------- | -------- | ------------------------------------------------------------------------------------------------------ | ----------- | ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------- |
| **R-01** | **TECH** | Realtime invalidation correctness — wrong query key in `onChange` callback leaves smartboard stale     | 2           | 3      | **6** | Strict `queryKeys` single-source (`src/lib/queryKeys.ts` — architecture §Query key conventions); CI grep Hook #3/#4; T-05 unit test; T-10 two-tab   | Sallvain (Dev + QA hats) | Phase 1 onward  |
| **R-02** | **TECH** | `useSeatingChart` drag-state split regression (jank, drag drops, mid-drag realtime collisions)         | 2           | 3      | **6** | Facade-over-split architecture (§Phase 5 file plan); T-14 runtime channel count; T-15 manual smoke (mid-drag + realtime); T-16 static grep          | Sallvain (Dev + QA hats) | Phase 5         |
| **R-06** | **TECH** | Adapter reference-instability silently regresses — existing UI-asserting tests don't catch memo thrash | 3           | 2      | **6** | T-04 Vitest reference-stability test per migrated domain (Phase 1 pilot first; copy-paste to 2–3); architecture §Adapter bridge §Load-bearing point | Sallvain (QA hat)        | Phase 1–3       |
| **R-07** | **TECH** | No QueryClient test-isolation pattern → cache leaks between tests, flaky results                       | 3           | 2      | **6** | Establish `createTestQueryClient()` helper (G-01) in Phase 1 pilot PR; reuse across all subsequent hook tests                                       | Sallvain (Dev hat)       | Phase 1 blocker |
| **R-09** | **TECH** | Realtime subscription test-harness shape undefined — blocks NFR6 cleanup test AND channel-count test   | 3           | 2      | **6** | Commit harness shape in Phase 1 pattern note (G-02); mock `supabase.channel`, spy on `removeChannel`, synthetic payload emitter                     | Sallvain (Dev hat)       | Phase 1 blocker |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description                                                         | Probability | Impact | Score | Mitigation                                                                                                                                                                                     | Owner    |
| ------- | -------- | ------------------------------------------------------------------- | ----------- | ------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R-03    | TECH     | Adapter-bridge co-existence produces reference-unstable outputs     | 2           | 2      | 4     | Architecture §Adapter bridge + `structuralSharing: true` + T-04 tests (see R-06). Monitor only — R-06 is the _catch_ for this risk; mitigation is structural, monitoring is via T-04           | Sallvain |
| R-05    | OPS      | Pattern drift — new features written in legacy shape during rollout | 2           | 2      | 4     | CI-grade static grep T-17 enforcing architecture Hooks #3/#4/#5/#6 continuously; `CLAUDE.md` / `project-context.md` pattern note land at Phase 1; PR-review self-rule from PRD §Phased Rollout | Sallvain |

#### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description                                                        | Probability | Impact | Score | Action                                                                                                                                                          |
| ------- | -------- | ------------------------------------------------------------------ | ----------- | ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-04    | SEC      | Devtools leaking into production bundle                            | 1           | 3      | 3     | DOCUMENT — defense in depth already strong (devDependency install + env-branched static import + `dist/` grep Hooks #1/#2). Phase 0 acceptance catches any leak |
| R-08    | TECH     | No Supabase `queryFn` mocking pattern for unit-level hook coverage | 2           | 1      | 2     | DOCUMENT — accepted trade-off. If unit-level `queryFn` coverage becomes needed, establish `vi.mock` pattern; otherwise rely on integration tests                |

#### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **OPS**: Operations (process discipline, drift, workflow)

(PERF, DATA, BUS categories not instantiated — PRD scope is invariant-preserving, so performance / data-integrity / business-logic risks are all captured upstream by "existing tests must pass at every phase boundary.")

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS — Architecture Team Must Address**

The chosen architecture is broadly testable — most of the heavy lifting (structural sharing, query-key centralization, canonical mutation lifecycle) makes the happy paths trivially verifiable. The concerns below are the _specific gaps_ that the current architecture document names as "TBD" or leaves implicit, and that block specific tests the PRD or the architecture's own acceptance hooks require.

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern                                              | Impact                                                                              | What Architecture Must Provide                                                                                                   | Owner               | Timeline           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------ |
| **`createTestQueryClient()` helper (G-01)**          | No per-test QueryClient isolation → cache leaks → flaky / order-dependent tests     | Specify helper shape + placement (`src/test/createTestQueryClient.ts`); `retries: false` + same production defaults              | Sallvain (Arch hat) | Phase 1 pilot PR   |
| **Realtime test harness (G-02)**                     | NFR6 subscription-cleanup test (PRD-named, Phase 1 deliverable) cannot be written   | Specify: mock `supabase.channel(...)` returning a controllable channel; expose synthetic-payload emitter; spy on `removeChannel` | Sallvain (Arch hat) | Phase 1 pilot PR   |
| **Runtime channel-count assertion shape (Hook #18)** | Architecture §Multi-binding says "exact Supabase test harness shape TBD by Phase 1" | Specify: Vitest component-tree render → `supabase.getChannels()` ≡ 3; fallback is manual DevTools WS-frame smoke                 | Sallvain (Arch hat) | Phase 1 or Phase 5 |

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

No architectural improvements are required beyond the three blockers above. The architecture document's 19 greppable acceptance hooks + the canonical patterns (QueryClient topology, queryKeys, useMutation lifecycle, useRealtimeSubscription signature, adapter bridge) are sufficient to make every phase's invariants mechanically verifiable.

---

### Testability Assessment Summary

**📊 CURRENT STATE — FYI**

#### What Works Well

- ✅ **API-first data layer** — PRD FR2 makes `queryFn` a pure async function; no DOM dependency for business-logic testing. Trivially unit-testable once G-04 is addressed (or testable via local Supabase integration otherwise).
- ✅ **Local Supabase stack** already in place (`npx supabase start`, `.env.test.example`, `npm run test:seed`) — fast, reproducible, isolation-safe. Playwright config enforces private-network allow-list as fail-closed security boundary.
- ✅ **Structural sharing guarantee** — `structuralSharing: true` (QueryClient default, made explicit in `queryClient.ts`) is load-bearing for adapter reference stability. Written down; enforced via not-overriding-per-hook policy.
- ✅ **Query-key centralization** — `src/lib/queryKeys.ts` + CI grep Hooks #3/#4 eliminate the R-01 failure mode by construction (no inline literals).
- ✅ **Pattern drift guardrails** — 19 greppable acceptance hooks across phases provide CI-lightweight drift prevention without requiring bespoke tooling.
- ✅ **Structured optimism** — `useMutation` canonical template (§useMutation lifecycle) collapses the 4 manual rollback sites in `useSeatingChart.ts` + equivalents elsewhere into a single `onMutate`/`onError`/`onSettled` triad; the cache IS the single source of truth.

#### Accepted Trade-offs (No Action Required)

For the ClassPoints TanStack modernization, the following trade-offs are acceptable:

- **No automated measurement of NFR1 realtime latency (~1s)** — relies on manual two-tab smoke test T-10. Instrumenting would be disproportionate for solo-contributor scope, and the semantic delta introduced at Phase 3 (Decision 3 §Phase 3 semantic delta) is well-documented so misreading a regression as "latency changed" is unlikely.
- **No unit-level `queryFn` mocking pattern (G-04 deferred)** — PRD FR2 is structurally met (pure async functions are isolatable); whether to actually isolate them in unit tests vs. integration-test against local Supabase is a testing-volume decision, not a testability one. Default: defer.
- **No E2E expansion beyond PRD-named manual smokes** — the future TEA test-hardening initiative (PRD §Testing: "separate BMAD TEA initiative explicitly scoped as its own PRD") is the right place for coverage-expansion work. This migration leaves the codebase in a state where that future initiative can proceed cleanly.

These trade-offs are **this-initiative scope**; the companion handoff doc (`test-design/classpoints-handoff.md`) captures them as follow-up seeds for the future TEA workstream.

---

### ADR Quality Readiness Checklist — Scoped Summary

Applying the 8-category ADR readiness checklist to this brownfield refactor; most categories are PRD non-goals and are marked so explicitly.

| Category                          | Status      | Criteria Met | Evidence                                                                                                                         | Next Action                                 |
| --------------------------------- | ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1. Testability & Automation       | ⚠️ CONCERNS | 3/4          | Strong API-first + state-control (local Supabase seed). Gap: isolation pattern for `queryFn` (R-08) — accepted deferral          | Track G-04 as deferred                      |
| 2. Test Data Strategy             | ✅ PASS     | 3/3          | Faker-free but `npm run test:seed` + `.env.test` segregation + RLS-per-user isolation already in place                           | None                                        |
| 3. Scalability & Availability     | N/A         | —            | PRD non-goal (single-tenant-per-teacher; no load-scale changes under this refactor)                                              | N/A                                         |
| 4. Disaster Recovery              | N/A         | —            | PRD non-goal (no deployment/infra changes; existing Supabase DR unchanged)                                                       | N/A                                         |
| 5. Security                       | ✅ PASS     | 3/4          | Secrets via `fnox`/age; E2E private-network allow-list; RLS unchanged. 5.4 input validation unchanged (no new inputs introduced) | None                                        |
| 6. Monitorability & Debuggability | ⚠️ ACCEPT   | 1/4          | TanStack Query devtools adds dev-time query-key visibility. No metrics endpoint (PRD non-goal)                                   | None (dev-only devtools is sufficient)      |
| 7. QoS & QoE                      | ⚠️ CONCERNS | 2/4          | Optimistic mutations + structural sharing meet NFR2/NFR3 by construction. NFR1 latency via manual smoke (accepted)               | Track NFR1 measurement as future-initiative |
| 8. Deployability                  | N/A         | —            | PRD non-goal (no deployment changes; `git revert` per phase is the rollback)                                                     | N/A                                         |

**Overall:** 12/29 applicable criteria met, 4 N/A by PRD scope, 5 accepted gaps → **CONCERNS** gate level. None of the concerns are blocking — each resolves to an accepted trade-off or a named Phase 1 deliverable (G-01, G-02).

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

**Purpose:** Detailed mitigation strategies for the 5 high-priority risks. Each MUST be addressed before or during its named phase.

#### R-01: Realtime invalidation correctness (Score: 6) — HIGH

**Mitigation Strategy:**

1. Enforce `src/lib/queryKeys.ts` as single source of truth. Every `queryKey:` reference and every `invalidateQueries` call uses a `queryKeys.*` builder.
2. Wire CI grep (T-17) enforcing Hooks #3 and #4 from `architecture.md` §Validation: `rg "queryKey:\s*\[" src/` returns 0 matches outside `queryKeys.ts`; `rg "invalidateQueries\(\{\s*queryKey:\s*\[" src/` returns 0 matches.
3. Phase 1 adds T-05 Vitest test for the legacy-bridge routing inside `useRealtimeSubscription` (`onChange` supplied → exclusive use; legacy fields alone → preserved behavior; both supplied → dev warning).
4. Phase 3 manual smoke T-10 explicitly exercises two-tab realtime propagation with the post-Phase-3 refetch-timing semantic delta documented.

**Owner:** Sallvain (Dev + QA hats)
**Timeline:** Phase 1 (CI grep + T-05); Phase 3 (T-10)
**Status:** Planned
**Verification:** CI grep green continuously from Phase 1 onward; T-05 in Phase 1 PR; T-10 attached to Phase 3 PR description.

---

#### R-02: `useSeatingChart` drag-state split regression (Score: 6) — HIGH

**Mitigation Strategy:**

1. Decision 1 structurally separates drag state (intra-component `useState` in `SeatingChartEditor.tsx`) from server state (Phase 5 `useSeatingChartMeta` / `useSeatingGroups` / `useRoomElements`). The separation is greppable (Hook #15/#19).
2. Phase 5 facade (`useSeatingChart.ts`) composes the three split hooks + owns the single `seating-chart` Supabase channel with four bindings — preserves `SeatingChartView.tsx`'s integration surface unchanged.
3. T-14 Vitest runtime assertion `supabase.getChannels().length === 3` validates the multi-binding consolidation.
4. T-15 manual smoke explicitly covers the "realtime event during active drag" edge case.
5. T-16 static greps enforce no `useState(loading)` / `useState(error)` / `const previous =` survive in seating hooks.

**Owner:** Sallvain (Dev + QA hats)
**Timeline:** Phase 5
**Status:** Planned
**Verification:** Phase 5 PR includes T-14 + T-15 + T-16; `wc -l src/hooks/useSeatingChart.ts < 200` (facade only).

---

#### R-06: Adapter reference-instability silent regression (Score: 6) — HIGH

**Mitigation Strategy:**

1. Architecture §Adapter bridge specifies `structuralSharing: true` as load-bearing (never override per-hook). `queryClient.ts` comment references Risk 3.
2. Phase 1 pilot introduces T-04 Vitest test: render consumer of adapter, capture returned array identity, trigger deep-equal refetch, assert identity unchanged.
3. Pattern note from Phase 1 shows the test template; Phase 2 and Phase 3 copy-paste per migrated domain.
4. Phase 4 eliminates the adapter layer entirely, so T-04 tests are deleted alongside (positive-reduction signal).

**Owner:** Sallvain (QA hat)
**Timeline:** Phase 1 (pilot test + template); Phase 2 (transactions + classrooms); Phase 3 (students)
**Status:** Planned
**Verification:** Each migration phase PR adds one T-04 instance per domain migrated in that phase; all green.

---

#### R-07: No QueryClient test-isolation pattern (Score: 6) — HIGH

**Mitigation Strategy:**

1. Phase 1 pilot PR introduces `src/test/createTestQueryClient.ts` — returns fresh `QueryClient` with production `defaultOptions` + `retry: false` override.
2. Every subsequent hook test uses the helper. Document usage in Phase 1 pattern note (the same note that establishes the migrated-hook reference shape).
3. Defer more elaborate patterns (providers-wrapper, query cache spies) to the future TEA initiative; the bare helper is sufficient for R-07 mitigation.

**Owner:** Sallvain (Dev hat)
**Timeline:** Phase 1 pilot PR
**Status:** Planned
**Verification:** Helper exists; T-04 and T-05 consume it; pattern note references it.

---

#### R-09: Realtime subscription test-harness undefined (Score: 6) — HIGH

**Mitigation Strategy:**

1. Phase 1 pattern note commits harness shape. Minimum viable shape:

   ```ts
   // src/test/realtimeHarness.ts (illustrative)
   // Mocks supabase.channel() to return a controllable stub.
   // Exposes: emitPostgresChange(table, payload), getChannels(), spies on removeChannel.
   ```

2. T-03 (PRD-named NFR6 cleanup test) consumes harness: mount → unmount → assert `removeChannel` called once with the channel returned from `supabase.channel`.
3. T-14 (channel-count assertion) also consumes harness — validates Phase 5 `supabase.getChannels().length === 3`.
4. Fallback if harness proves fragile: manual browser DevTools WebSocket-frame count at phase-boundary smoke time (architecture §Multi-binding provides this fallback explicitly).

**Owner:** Sallvain (Dev hat)
**Timeline:** Phase 1 pilot PR
**Status:** Planned
**Verification:** `src/test/realtimeHarness.ts` exists; T-03 consumes it and passes; pattern note documents API.

---

### Assumptions and Dependencies

#### Assumptions

1. **Solo-contributor reality.** Sallvain is all four roles (Architecture, Dev, QA, PM). "Owner" columns in this doc all resolve to Sallvain; timelines are self-negotiated per phase PR.
2. **Pinned-phase rollout holds.** PRD §Phased Rollout is authoritative; phases land in 0 → 6 order; phases ship as their own PR (or tight group) and are independently `git-revert`-able. This assumption underpins the per-phase test-delta structure.
3. **`@tanstack/react-query` and devtools install as dev- and runtime-deps per Decision 4.** If `sideEffects: false` flips upstream, the contingency dynamic-import branch activates; grep Hooks #1/#2 catch either way.
4. **Local Supabase stack remains the only E2E target.** `playwright.config.ts` private-network allow-list is not modified under this initiative (PRD §Non-Goals).
5. **TanStack Query test harness practices** (rendering with `QueryClientProvider`, `queryClient.waitForQueries`, etc.) are adopted ad-hoc per-test as needed — no large test-infra abstraction built up under this initiative. Deeper abstractions are deferred to the future TEA initiative.

#### Dependencies

1. **Supabase Realtime behavior unchanged.** Architecture §Multi-binding relies on `channel.on('postgres_changes', ...)` multiplexing. If Supabase changes this API, R-02 mitigation re-opens.
2. **`@dnd-kit` remains the drag-transport layer** for seating chart (Decision 1). No replacement under this initiative.
3. **Vitest `vi.mock` + jsdom** handle the realtime harness mocking (G-02). Already in the stack.
4. **Existing Vitest + Playwright suites pass pre-Phase-0.** If they don't, that's a prior-state bug to fix before Phase 0 begins; this test design presumes a green baseline.

#### Risks to Plan

- **Risk:** Harness shape (G-02) proves hard to stabilize — `supabase.channel(...)` mocking may surface timing complexities not visible from the doc.
  - **Impact:** T-03 (PRD-named NFR6 test) slips into a manual verification instead of Vitest. NFR6 invariant still holds at runtime; verification just shifts.
  - **Contingency:** Fall back to the already-named manual DevTools WS-frame smoke (architecture provides this fallback). Document the shift in the Phase 1 pattern note; log as a future-TEA follow-up.
- **Risk:** CI grep pattern (T-17) produces false positives on legitimate inline keys in test files.
  - **Impact:** Noisy CI; engineer ignores the signal.
  - **Contingency:** Scope grep to `src/` excluding `src/test/**` and `src/**/__tests__/**`; architecture's Hook #3/#4 already implies this scoping.

---

**End of Architecture Document**

**Next Steps for Architecture Review:**

1. Review Quick Guide (🚨/⚠️/📋). Confirm the three blockers (G-01, G-02, optional G-04) land in Phase 1 PR scope.
2. Approve the three HIGH-PRIORITY recommendations (R-03+R-06 adapter reference-stability tests; R-01 CI greps; R-09 harness shape commitment).
3. Acknowledge the accepted trade-offs (no automated NFR1 latency measurement; no `queryFn` mocking pattern; no E2E expansion under this initiative).
4. Confirm the separate future TEA initiative (PRD §Testing) is the correct home for the deferred items captured in the handoff doc.

**Next Steps for Test Implementation:**

1. Refer to companion QA doc (`test-design-qa.md`) for test-delta execution recipe per phase.
2. Phase 1 pilot PR is the infrastructure-heavy one — G-01, G-02, T-04 template, T-05, T-03 (NFR6). Subsequent phases reuse.
3. Architecture's 19 greppable hooks (§Validation) ARE the CI quality gate. This document does not duplicate them — it adds scoped guardrails that complement them.
