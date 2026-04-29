---
title: 'TEA Test Design → BMAD Handoff — ClassPoints TanStack Modernization'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-04-22'
projectName: 'ClassPoints'
---

# TEA → BMAD Integration Handoff — ClassPoints

## Purpose

This document bridges the TEA system-level test design with BMAD's epic/story decomposition. For ClassPoints, the PRD already decomposes the work into **seven phases (0–6)** that function as epics — each phase has its own PRD acceptance list + greppable architectural acceptance hooks. This handoff therefore maps the test design's _test deltas_ onto those existing phase-epics rather than inventing parallel stories.

**Template-mismatch note:** The generic BMAD handoff template assumes test design hands off to a _subsequent_ `create-epics-and-stories` workflow. For this initiative, the epics already exist (PRD phases); the handoff instead feeds two downstream consumers:

1. **Each phase PR** — test deltas mapped to its acceptance list
2. **The explicitly-deferred future TEA initiative** (PRD §Testing: "a separate test-hardening effort using BMAD TEA workflow... is planned as its own PRD") — collects deferred items and seed hooks so that future initiative can start with context

## TEA Artifacts Inventory

| Artifact                   | Path                                                      | BMAD / PR Integration Point                                                                                                          |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Test Design (Architecture) | `_bmad-output/test-artifacts/test-design-architecture.md` | Per-phase PR reads relevant Risk Mitigation Plan + Testability Gap entries to confirm scope                                          |
| Test Design (QA)           | `_bmad-output/test-artifacts/test-design-qa.md`           | Per-phase PR copies the phase's row(s) from the Implementation Planning Handoff table into its description as a test-delta checklist |
| Risk Register              | (embedded in architecture doc §Risk Assessment)           | Phase PR references risk IDs (R-01..R-09) when linking acceptance criteria to risk mitigation                                        |
| Coverage Plan / Priorities | (embedded in QA doc §Test Coverage Plan)                  | Phase PR verifies P0 + P1 deltas landed; P2 manual smoke documented                                                                  |
| Future-TEA Seed List       | (this doc §Deferred Items)                                | Input for the future TEA initiative's own PRD + test design when that PRD is authored                                                |

## Epic-Level Integration Guidance

### Phase-epics risk mapping

| Phase-Epic                                  | Primary Risks Addressed                                  | Quality Gate = PRD Acceptance + Architecture Hooks + Test Deltas                                      |
| ------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Phase 0 — Bootstrap**                     | R-04 (devtools leak)                                     | T-01 (grep) + T-02 (smoke) + Architecture Hooks #1/#2                                                 |
| **Phase 1 — Pilot `useBehaviors`**          | R-01, R-06, R-07, R-09 (most mitigation work lands here) | T-03 + T-04 template + T-05 + T-06 (infra) + T-07 + T-17 wiring + Architecture Hooks #3/#4/#5/#6/#7   |
| **Phase 2 — Small/medium hooks**            | R-01, R-06                                               | T-04 (×2) + T-08 + T-09 + Architecture Hooks #3–#7                                                    |
| **Phase 3 — `useStudents`**                 | R-01 (hot-path), R-06                                    | T-04 + T-11 + T-10 (two-tab) + Architecture Hooks #3–#7 + Decision 3 semantic delta documented        |
| **Phase 4 — Slim AppContext + cut adapter** | R-06 retires (adapter gone)                              | T-12 (static + `wc`) + T-13 (full-app smoke) + delete T-04 tests + Architecture Hooks #11/#12/#13/#14 |
| **Phase 5 — Seating split**                 | R-02                                                     | T-14 + T-15 + T-16 + Architecture Hooks #15/#16/#17/#18/#19                                           |
| **Phase 6 — Docs**                          | R-05 (pattern clarity)                                   | T-18 doc check + legacy retirement verified                                                           |

### Quality Gates (per phase)

Each phase's PR MUST satisfy (details in QA doc §Entry/Exit Criteria):

1. Existing Vitest suite green (`npm test`)
2. Existing Playwright local-Supabase suite green (`npm run test:e2e:local`)
3. Phase's P0 test deltas landed + passing
4. Phase's P1 test deltas landed + passing (or written-rationale skip)
5. Phase's architecture §Validation hooks returning expected results
6. Phase's manual smoke executed and documented in PR description
7. Risk IDs addressed by phase referenced in PR description

**Gate decision thresholds** (per `risk-governance.md` + `probability-impact.md`):

- **PASS**: All 7 criteria met, no unresolved score≥6 risks active for this phase
- **CONCERNS**: Score≥6 risks active but mitigation landing in same PR (rare; only during phase transitions)
- **FAIL**: Any score=9 risk active (not expected — no score=9 risks in register) OR existing suite fails without an accepted explanation

## Story-Level Integration Guidance

**Phases ARE the epics — there is no sub-story decomposition in this initiative.** The PRD's per-phase acceptance lists serve the same function as story-level acceptance criteria. Mapping the test deltas to acceptance criteria:

### P0 Test Scenarios → Phase Acceptance Criteria

| Test ID | Phase | PRD Acceptance Criterion Anchored                                                                                                                    |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01    | 0     | "`@tanstack/react-query-devtools` is a dev-only dependency, confirmed tree-shaken from the production bundle" (PRD §Phase 0)                         |
| T-03    | 1     | "No realtime subscription outlives the component tree... Verification is a Vitest test — added as part of Phase 1's pilot work" (PRD NFR6)           |
| T-06    | 1     | Prerequisite for T-03/T-04/T-08/T-11/T-14 — not a PRD acceptance line per se; an architecture-exposed delivery                                       |
| T-12    | 4     | "`src/contexts/AppContext.tsx` is **under 200 lines**" + "Zero component files import `students`..." (PRD §Phase 4)                                  |
| T-14    | 5     | FR5 "realtime live-sync on exactly three table sets" at the runtime channel level (Architecture §Multi-binding acceptance hook)                      |
| T-16    | 5     | "`src/hooks/useSeatingChart.ts` collectively contain zero `useState(loading)`, zero `useState(error)`, zero manual rollback captures" (PRD §Phase 5) |

### P1 Test Scenarios → Phase Acceptance Criteria (architecture-exposed, not PRD-explicit)

| Test ID | Phase | Architectural Invariant Protected                                                                                             |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| T-04    | 1–3   | Architecture §Adapter bridge: adapter output reference-stability during adapter co-existence                                  |
| T-05    | 1     | Architecture Decision 3: `useRealtimeSubscription` legacy-bridge routing correctness during Phase 1–3 transitional signature  |
| T-08    | 2     | Architecture §`useMutation` lifecycle: canonical 5-callback template produces correct optimistic-then-rollback cache sequence |
| T-11    | 3     | Architecture §Query key conventions: shared-prefix hierarchy produces the expected broad-match invalidation behavior          |
| T-17    | all   | Architecture §Validation 19-hook inventory: continuous enforcement to prevent R-05 legacy-shape drift in new code             |

### Data-TestId / Selector Requirements

**None introduced by this initiative.** PRD zero-UX-change scope means all existing `data-testid` attributes are unchanged; no new ones needed for the test deltas (the deltas are unit-level and build-time, not E2E). The future TEA initiative may add `data-testid` hardening — out of scope here.

## Risk-to-Story (Risk-to-Phase) Mapping

| Risk ID | Category | P×I   | Score | Recommended Phase(s) | Test Level              | Mitigation Test(s)                          |
| ------- | -------- | ----- | ----- | -------------------- | ----------------------- | ------------------------------------------- |
| R-01    | TECH     | 2 × 3 | 6     | Phase 1 + Phase 3    | Unit + Manual + CI grep | T-05, T-10, T-17 (Hooks #3/#4)              |
| R-02    | TECH     | 2 × 3 | 6     | Phase 5              | Unit + Manual + grep    | T-14, T-15, T-16                            |
| R-03    | TECH     | 2 × 2 | 4     | Phase 1–3 (monitor)  | Unit                    | T-04 (shared w/ R-06)                       |
| R-04    | SEC      | 1 × 3 | 3     | Phase 0              | Build-time grep         | T-01                                        |
| R-05    | OPS      | 2 × 2 | 4     | All phases           | CI grep                 | T-17                                        |
| R-06    | TECH     | 3 × 2 | 6     | Phase 1, 2, 3        | Unit                    | T-04 (per domain)                           |
| R-07    | TECH     | 3 × 2 | 6     | Phase 1              | Test infra              | T-06 (`createTestQueryClient`)              |
| R-08    | TECH     | 2 × 1 | 2     | Deferred (G-04)      | —                       | Document; revisit only if needed            |
| R-09    | TECH     | 3 × 2 | 6     | Phase 1              | Test infra              | T-06 (realtime harness) enables T-03 + T-14 |

## Recommended BMAD → TEA Workflow Sequence (adapted)

The standard sequence (TD → Create Epics → ATDD → Impl → Automate → Trace) assumes a new-feature delivery flow. ClassPoints' adapted sequence:

1. **This test design (TD)** — produces these three artifacts; identifies blockers G-01, G-02; names test deltas T-01..T-18
2. **Phase-by-phase PR implementation** — each phase PR bundles migration code + test deltas + manual smoke documentation. No ATDD-first; the tests here are mostly _architectural invariant tests_, not acceptance tests for new user stories
3. **Phase 1 pilot establishes pattern notes** — canonical test shapes documented in-repo; subsequent phases copy-paste
4. **Continuous CI-grade greps (T-17)** — architectural invariants enforced on every commit post-Phase-1
5. **Phase 6 doc cleanup** — signals migration complete; `project-context.md` updated to post-migration state
6. **Future TEA initiative (separate PRD)** — consumes this handoff's §Deferred Items and performs the deeper test-hardening work the PRD explicitly scopes out

## Phase Transition Quality Gates

| From Phase | To Phase | Gate Criteria                                                                                                                                                |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 0    | Phase 1  | T-01 green; T-02 smoke documented; existing suites green. No uncommitted migration code                                                                      |
| Phase 1    | Phase 2  | All Phase 1 P0 + P1 deltas green; harness helpers (G-01, G-02) exist and are consumed; T-17 CI wiring in place; pattern note committed for Phase 2 reference |
| Phase 2    | Phase 3  | All Phase 2 P0 + P1 deltas green; two migrated domains' adapter tests (T-04) demonstrate pattern viability                                                   |
| Phase 3    | Phase 4  | All Phase 3 P0 + P1 deltas green; T-10 two-tab smoke passes with documented Decision 3 semantic delta timing                                                 |
| Phase 4    | Phase 5  | All Phase 4 static-check acceptance met (NFR8 line count + zero feature-hook imports in `AppContext.tsx`); T-04 tests deleted (adapter gone)                 |
| Phase 5    | Phase 6  | Runtime channel-count assertion T-14 passing (or documented manual WS-frame fallback); all seating hook greps green                                          |
| Phase 6    | Complete | Legacy docs retired or marked; `project-context.md` provider tree updated; all architecture §Validation hooks #1–#19 green on `main`                         |

## Deferred Items (Seeds for the Future TEA Initiative)

The PRD explicitly defers broader test hardening to a separate TEA initiative. Seeds collected during this system-level design:

### Coverage-expansion seeds

1. **Per-hook `queryFn` unit coverage with Supabase mocks** (G-04, R-08 deferred) — establish `vi.mock('../lib/supabase')` pattern; add unit tests for each migrated hook's `queryFn` covering: happy path, Supabase error path, empty-response path, type transformation correctness
2. **Expanded adapter / cache-state E2E coverage** — Playwright scenarios exercising cross-tab cache consistency under packet loss (Supabase realtime reconnect), not just two-tab steady state
3. **Component-level tests for the 45 Phase-4 migrated components** — currently zero dedicated component tests for most of them; existing regression relies on Playwright E2E coverage
4. **`useSeatingChart` facade composition tests** — beyond the channel-count assertion, test that mutations on one split hook correctly invalidate cross-hook invariants (e.g., delete group → seats associated with it visually disappear)

### Observability / NFR instrumentation seeds

5. **NFR1 realtime latency instrumentation** — currently manual smoke; future initiative should add either a Playwright-based timed cross-tab measurement or a runtime devtools-instrumented measurement
6. **Bundle-size trend tracking over time** — `dist/` size regression check (NFR5 extension)
7. **Subscription lifecycle stress test** — rapidly mount/unmount a hook N times and assert channel-count returns to steady state, not accumulated leaks
8. **RPC error-path coverage** (`get_student_time_totals`) — currently untested; migration preserves the RPC call but doesn't add failure-path coverage

### Test-infrastructure seeds

9. **Reusable `QueryClientProvider` test wrapper with configured mocks** — consolidate the per-test boilerplate that emerges across T-04 / T-05 / T-08 / T-11
10. **Realtime harness API hardening** — whatever shape G-02 takes in Phase 1 is a minimal viable harness; future initiative can elevate it to a shared testing utility
11. **Pre-commit CI pipeline hardening** — T-17's 6 greps could grow to cover all 19 architecture hooks, with readable failure messages

### Process / doc seeds

12. **Architecture Decision Record format for ongoing decisions** — the current `architecture.md` captures the four decisions resolved pre-Phase-1, but future state-management decisions (e.g., if Zustand enters on the deferred `SeatingChartEditor` split) should have an ADR convention established
13. **`docs/testing.md`** — once the future TEA initiative lands, capture the pattern canon that Phase 1's pattern note starts: how to write a hook test, how to use `createTestQueryClient`, how to emit a synthetic realtime event in a test. Currently lives only in this test design + Phase 1 pattern note

---

## Closing Note for Future TEA Initiative

The ClassPoints TanStack Query modernization is intentionally a **narrow-scope, invariant-preserving migration**. This test design matches that scope: test deltas address the specific architectural risks the migration introduces, not feature coverage breadth. When the future TEA initiative is authored, its PRD and test design should:

- Read this handoff's §Deferred Items as a starting-point backlog (not exhaustive — the author may find more)
- Preserve the 19 greppable acceptance hooks established by `architecture.md` as structural invariants
- Treat the `createTestQueryClient` + realtime harness helpers from Phase 1 as foundation to build on, not to replace
- Budget for the realistically-bigger test volume (likely 50–150 new tests rather than ~15 deltas) and consider tiered execution (nightly load test suite, weekly soak, etc.) — none of which this initiative needs

The whole post-this-migration codebase should be demonstrably easier to test than the pre-migration codebase: thin hooks with pure `queryFn` async functions, cache as single source of truth, and greppable structural invariants. That's the baseline the future TEA initiative inherits.
