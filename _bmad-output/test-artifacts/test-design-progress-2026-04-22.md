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
mode: 'system-level'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - docs/architecture.md
  - _bmad-output/project-context.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - playwright.config.ts
---

# Test Design Progress — System-Level Mode

## Step 1: Mode & Prerequisites

**Mode:** System-Level (user intent: "System level")

**Rationale:** User explicitly selected system-level scope. PRD and architecture docs present.

**Inputs located:**

- PRD: `_bmad-output/planning-artifacts/prd.md` (557 lines)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (1218 lines)
- Supplementary architecture: `docs/architecture.md` (334 lines)
- Project context: `_bmad-output/project-context.md` (447 lines)
- TEA config: `_bmad/tea/config.yaml` (test_stack_type: fullstack, test_framework: playwright, ci_platform: github-actions, risk_threshold: p1)

**No separate ADR directory found.** Architecture documents serve as the decision record.

## Step 2: Context Loaded

**Stack (confirmed):** React 18 + TS + Vite 6 + Tailwind; Supabase (Postgres + Realtime + Auth). Tests: Vitest 4 + jsdom + @testing-library/react; Playwright (Chromium, storageState auth, data-testid selectors, `webServer.reuseExistingServer: false`, fail-closed private-network allow-list).

**PRD essence:** Technical modernization — drop ~2,400 lines of hand-rolled server-state in favor of `@tanstack/react-query`. **No UX, schema, transport changes.** Seven migration phases (0–6): Bootstrap → `useBehaviors` pilot → small/medium hooks → `useStudents` → slim `AppContext` → seating split → docs.

**PRD testing scope is explicitly narrow:**

- Existing Vitest + Playwright test suites must pass **at every phase boundary** (PRD §Testing, §Success Criteria)
- One NEW Vitest test required: NFR6 subscription-cleanup check in `useRealtimeSubscription.test.ts` (added in Phase 1)
- NFR4 production-bundle devtools grep (Phase 0)
- Runtime channel-count assertion (`supabase.getChannels().length === 3`) — Phase 5 or earlier
- **Out of scope for this PRD:** broader test expansion — "a separate test-hardening effort using BMAD TEA workflow (full tier, not enterprise) is planned as its own PRD"

**Architecture essence:** All four PRD-deferred decisions resolved. Doc provides canonical patterns (QueryClient topology, queryKeys single-source-of-truth, useMutation lifecycle, useRealtimeSubscription multi-binding shape, adapter-bridge contract, Phase 5 file plan). Includes 19 greppable acceptance hooks mapped to phases.

**Current test inventory:**

- `src/test/leaderboardCalculations.test.ts`
- `src/test/sounds.test.ts`
- `src/test/TeacherDashboard.test.tsx`
- `src/test/useRotatingCategory.test.ts`
- `src/hooks/__tests__/useRealtimeSubscription.test.ts`
- `src/utils/__tests__/studentParser.test.ts`
- `tests/e2e/auth.setup.ts`, `tests/e2e/example.spec.ts` (new TEA scaffold; legacy E2E preserved)

**Key framing for test design:** This PRD is an _invariant-preservation_ migration, not a feature delivery. The risk model is dominated by regression risk at phase boundaries and by new migration-specific invariants (NFRs 1, 4, 6, 8). Test design must serve BOTH:

1. The narrow in-PRD scope (phase-boundary green suites + the specific NFR tests the PRD names)
2. The explicitly-flagged future TEA initiative — the system-level design here should identify the coverage targets that future initiative will need to address so it can proceed without re-deriving them.

**Knowledge loaded:** `risk-governance.md` (scoring), `test-levels-framework.md` (level selection), `test-quality.md` (DoD), `probability-impact.md` (1-3 × 1-3 matrix), `adr-quality-readiness-checklist.md` (29-criterion NFR framework). All three output templates (architecture, QA, handoff) loaded.

## Step 3: Risk + Testability Assessment

**Scoring method:** probability (1-3) × impact (1-3) = score (1-9). Threshold: 1-3 DOCUMENT, 4-5 MONITOR, 6-8 MITIGATE, 9 BLOCK.

**Source risks:** PRD §Risks & Mitigations 1–5 (authoritative; re-scored, not reinvented), augmented with test-specific risks the architecture exposes.

| Risk ID | Source     | Title                                                                                                                                                   | Cat  | P   | I   | Score | Action   |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- | --- | ----- | -------- |
| R-01    | PRD Risk 1 | Realtime invalidation correctness (wrong query key)                                                                                                     | TECH | 2   | 3   | **6** | MITIGATE |
| R-02    | PRD Risk 2 | `useSeatingChart` drag-state split regression                                                                                                           | TECH | 2   | 3   | **6** | MITIGATE |
| R-03    | PRD Risk 3 | Adapter-bridge reference instability (Phases 1–3)                                                                                                       | TECH | 2   | 2   | 4     | MONITOR  |
| R-04    | PRD Risk 4 | Devtools leaking into production bundle                                                                                                                 | SEC  | 1   | 3   | 3     | DOCUMENT |
| R-05    | PRD Risk 5 | Pattern drift during long-running migration                                                                                                             | OPS  | 2   | 2   | 4     | MONITOR  |
| R-06    | NEW (test) | Adapter reference-instability regresses silently — existing Playwright/RTL tests assert rendered UI, not render-count/memo identity                     | TECH | 3   | 2   | **6** | MITIGATE |
| R-07    | NEW (test) | No QueryClient test-isolation pattern → cache leaks across tests, flaky results                                                                         | TECH | 3   | 2   | **6** | MITIGATE |
| R-08    | NEW (test) | No Supabase `queryFn` mocking pattern established for unit-level coverage of migrated hooks                                                             | TECH | 2   | 1   | 2     | DOCUMENT |
| R-09    | NEW (test) | Realtime subscription test-harness shape undefined — blocks NFR6 cleanup test AND Phase-5 channel-count assertion (both named in architecture as "TBD") | TECH | 3   | 2   | **6** | MITIGATE |

**Distribution:** 4 MITIGATE (score ≥6), 2 MONITOR, 2 DOCUMENT, 1 DOCUMENT borderline. **Zero BLOCK** (score=9) risks — consistent with PRD's "pinned phased rollout + git-revert rollback" design.

### Testability assessment (ADR Quality Readiness Checklist lens — scoped)

Most of the 29 ADR criteria are not load-bearing for a brownfield technical modernization that makes zero UX / schema / transport changes. Relevant subset:

- **1.1 Isolation** — ⚠️ Gap: No documented pattern for testing a migrated hook's `queryFn` in isolation with a mocked Supabase client (maps to R-08). Architecture defers to "construct a fresh `QueryClient` via a local test helper" without specifying the helper (maps to R-07).
- **1.3 State Control** — ✅ Covered: Local Supabase stack (`npx supabase start`) + `npm run test:seed` provides fast data seeding; `.env.test` allow-list prevents prod leakage.
- **2.3 Teardown** — ✅ Covered: Vitest jsdom suite runs isolated; Playwright uses `storageState` + scoped dev server. Risk R-07 only bites when new hook-level tests are added.
- **5.3 Secrets** — ✅ Covered: `fnox` + age encryption; no secrets in repo.
- **6.3 Metrics** — ⚠️ Gap: NFR1 (realtime propagation ~1s) has no automated measurement — relies on manual two-tab smoke test. Accepted trade-off (matches solo-contributor scope; instrumenting would be disproportionate).
- **7.3 Perceived Performance (QoE)** — ✅ Covered structurally: `onMutate` + `structuralSharing` provide optimistic path per architecture §useMutation lifecycle.

All remaining ADR categories (DR, scalability, deployability, security beyond secrets) are PRD non-goals ("No schema changes... No alternative transport... No deployment changes").

### Testability gaps summary (what architecture must deliver OR QA must define)

Named here so the architecture-audience doc has concrete blockers to list:

- **G-01 (blocker, Phase 0 or Phase 1):** `createTestQueryClient()` helper — resolves R-07. Shape: fresh `QueryClient` per test with same `defaultOptions` as production + `retry: false` override.
- **G-02 (blocker, Phase 1):** Realtime subscription test harness — resolves R-09. Shape: mock `supabase.channel(...)` to return a controllable channel; spy on `removeChannel`; expose helper to emit synthetic `postgres_changes` payloads.
- **G-03 (high priority, Phase 1–3):** Reference-stability assertion helper — resolves R-06. Shape: render a consumer hook twice, capture returned array identity, trigger a refetch that returns deep-equal data, assert identity unchanged.
- **G-04 (nice-to-have, post-Phase-0):** `queryFn` Supabase mocking pattern — resolves R-08. Likely just `vi.mock('../lib/supabase')` returning a chainable builder. If the cost of establishing a pattern exceeds the value (given local Supabase is already fast), fall back to integration tests against local stack.

## Step 4: Coverage Plan (delta only)

**Scope discipline:** The PRD explicitly scopes OUT broad test expansion ("out of scope / future initiative... a separate test-hardening effort using BMAD TEA workflow... is planned as its own PRD"). This coverage plan does NOT re-plan coverage of all 25 FRs. It plans ONLY the test deltas this migration requires — both the ones the PRD explicitly names AND the ones the architecture implicitly requires to de-risk the scored migration risks above.

**Test level mapping per `test-levels-framework.md`:**

| Test ID | Phase | Level                      | Scope                                                                                                                                                                                       | Covers risk                 | PRD explicit?                              |
| ------- | ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------ |
| T-01    | 0     | Build-time grep            | `npm run build && rg 'tanstack/react-query-devtools\|ReactQueryDevtools' dist/` returns 0 matches                                                                                           | R-04, NFR4, Arch Hook #1/#2 | ✅ PRD NFR4 + Phase 0 smoke                |
| T-02    | 0     | Manual smoke               | Teacher login → award point on smartboard → two-tab verify live update; open seating chart → drag seat → verify persistence                                                                 | regression baseline         | ✅ PRD Phase 0                             |
| T-03    | 1     | Unit (Vitest)              | `useRealtimeSubscription` subscription cleanup: mount consumer → unmount → assert `supabase.removeChannel` called with same channel                                                         | R-09, NFR6                  | ✅ PRD NFR6                                |
| T-04    | 1     | Unit (Vitest)              | Reference-stability of pilot adapter (`useBehaviors` → legacy `AppBehavior[]`): mount, trigger refetch with deep-equal data, assert `useApp().behaviors` identity unchanged                 | R-03, R-06                  | ⚠️ arch-exposed                            |
| T-05    | 1     | Unit (Vitest)              | `onChange` legacy-bridge routing: supplying `onChange` uses it exclusively; supplying legacy fields still works; supplying both logs dev warning                                            | R-01                        | ⚠️ arch-exposed                            |
| T-06    | 1–5   | Test infra                 | `createTestQueryClient()` helper + realtime harness helper documented and reused                                                                                                            | R-07, R-09                  | ⚠️ arch-exposed (G-01, G-02)               |
| T-07    | 1     | Manual smoke               | Create/edit/delete a behavior; window-focus refetch works; no visible regression                                                                                                            | regression baseline         | ✅ PRD Phase 1                             |
| T-08    | 2     | Unit (Vitest)              | `useTransactions` optimistic award with forced-error path: `onMutate` patches cache, thrown error from `mutationFn` triggers cache rollback via `onError`, final state = pre-patch snapshot | R-01                        | ⚠️ arch-exposed (mutation lifecycle)       |
| T-09    | 2     | Manual smoke               | Create/delete classrooms; save/load layout preset; two-tab award+undo                                                                                                                       | regression baseline         | ✅ PRD Phase 2                             |
| T-10    | 3     | Manual smoke (two-tab)     | Teacher awards in tab A → smartboard tab B reflects within ~1s; undo → reverts within ~1s (NFR1 accommodation for refetch roundtrip)                                                        | R-01, NFR1                  | ✅ PRD Phase 3 + Decision 3 semantic delta |
| T-11    | 3     | Unit (Vitest)              | Time-totals split: `queryKeys.students.timeTotalsByClassroom` is a distinct cache entry; broad `invalidateQueries(byClassroom)` invalidates both table + time-totals                        | R-01                        | ⚠️ arch-exposed                            |
| T-12    | 4     | Static grep                | Post-Phase-4 acceptance Hook #11/#12/#13/#14 (see architecture §Validation hook inventory)                                                                                                  | NFR8                        | ✅ PRD Phase 4 acceptance                  |
| T-13    | 4     | Manual smoke               | Full app walkthrough: login → classroom → award → undo → seating chart → layout preset → sound toggle → logout                                                                              | regression baseline         | ✅ PRD Phase 4                             |
| T-14    | 5     | Runtime assertion          | `supabase.getChannels()` length === 3 with topics including `students`, `point_transactions`, `seating-chart`                                                                               | R-02, FR5, NFR6             | ⚠️ arch-exposed (architecture Hook #18)    |
| T-15    | 5     | Manual smoke               | Drag seat; drag during realtime event mid-drag; cancel mid-drag; save preset mid-rearrangement                                                                                              | R-02                        | ✅ PRD Phase 5                             |
| T-16    | 5     | Static grep                | Architecture Hooks #15/#16/#17/#19 (zero useState/previous/raw channel/setQueryData-in-components in seating hooks)                                                                         | R-02                        | ⚠️ arch-exposed                            |
| T-17    | all   | CI guardrail (static grep) | Hooks #3/#4/#5/#6/#7/#10 continuously enforced (queryKeys centralization, no manual `const previous`, transforms only via `src/types/transforms`)                                           | R-05                        | ⚠️ arch-exposed (prevents drift)           |
| T-18    | 6     | Static check               | `docs/architecture.md` rewritten; `docs/legacy/` retired or marked; `project-context.md` provider tree updated                                                                              | acceptance criteria         | ✅ PRD Phase 6                             |

**Priority distribution (risk-based, PRD-scoped — NOT P0/P1/P2/P3 across all FRs):**

- **P0 (blocks migration phase):** T-01, T-03, T-06, T-12, T-14, T-16 — directly tied to MITIGATE-scored risks or NFR-gate greps
- **P1 (high value, arch-exposed):** T-04, T-05, T-08, T-11, T-17 — guardrails for Risks R-03/R-06 and long-tail drift
- **P2 (regression confirmation):** T-02, T-07, T-09, T-10, T-13, T-15, T-18 — PRD-named manual smokes

**Execution strategy (solo-contributor adaptation):**

- Per-phase PR includes: that phase's P0 tests + its manual smoke checklist
- T-17 static greps wired as a lightweight pre-commit / CI grep step (reuses existing ripgrep) — cost: low; prevents R-05 drift
- No k6, no nightly load suite, no chaos tier. PRD scope does not support that investment; the separate future TEA initiative is the right place for it.

**What's explicitly OUT of this coverage plan** (to be flagged in Not-In-Scope):

- Broader E2E expansion beyond the PRD's named manual smokes
- Performance benchmarking of realtime propagation (NFR1 accepted as manual measurement)
- Contract tests (no microservice seams in scope)
- Component-level visual regression (PRD zero-UX-change means existing tests are adequate regression signal)
- Anything on tables the PRD marks unchanged (DB layer, auth flow, RLS)

## Step 5: Generate Outputs

**Mode resolved:** `sequential` (single worker — no agent-team or subagent spawning).

**Outputs written:**

- `_bmad-output/test-artifacts/test-design-architecture.md` (architecture/dev audience)
- `_bmad-output/test-artifacts/test-design-qa.md` (QA audience)
- `_bmad-output/test-artifacts/test-design/classpoints-handoff.md` (TEA → phase-PR + future TEA initiative)

**Checklist self-validation summary:**

- ✅ Risk IDs unique (R-01..R-09)
- ✅ Probability/impact 1-3; scores calculated correctly
- ✅ Mitigations specific and actionable
- ✅ Cross-doc risk IDs, priorities, dates consistent
- ✅ Architecture doc follows actionable-first principle (Quick Guide top, FYI bottom)
- ✅ QA doc has "priority ≠ execution timing" note at top of Coverage Plan
- ✅ No test scripts in architecture doc (only illustrative shapes in QA Appendix A)
- ✅ Handoff doc has phase-adapted sequence (phases ARE epics) and deferred-items seed for future TEA initiative
- ⚠️ Architecture doc exceeds 200-line "target" — justified by PRD complexity (5 PRD risks + 4 test-specific risks + 3 architectural blockers); all content is actionable, no bloat
- ⚠️ Risk IDs use R-01 not R-001 format — acceptable minor deviation

**Completion report:**

- Mode: System-level, sequential
- Primary risks flagged: R-01 (realtime invalidation), R-02 (seating split), R-06 (adapter instability), R-07 (QueryClient isolation), R-09 (realtime harness) — all score 6, MITIGATE
- Key blockers for Phase 1: G-01 (`createTestQueryClient()` helper), G-02 (realtime harness)
- Gate thresholds: per-phase PASS requires (a) existing suites green (b) phase's P0 + P1 deltas landed (c) phase's architecture-validation greps green (d) manual smoke documented
- Open assumptions documented in architecture doc §Assumptions and Dependencies
