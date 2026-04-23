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
audience: 'qa'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad/tea/config.yaml
  - _bmad/tea/testarch/knowledge/risk-governance.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/probability-impact.md
---

# Test Design for QA: ClassPoints TanStack Query Modernization

**Purpose:** Test execution recipe for the phased state-management modernization. Defines what to test at each phase boundary, how to test it, and what the phase PR must deliver so testing can proceed.

**Date:** 2026-04-22
**Author:** Sallvain (solo contributor; QA hat)
**Status:** Draft
**Project:** ClassPoints

**Related:** Architecture doc `test-design-architecture.md` (testability concerns, architectural blockers G-01/G-02/G-04, full risk register).

**Solo-contributor adaptation:** This doc uses template language ("QA team", "backend team", etc.) but in practice all roles are Sallvain. What the template frames as _hand-offs_ are better read as _self-contract discipline_: when wearing the Dev hat, land the blockers listed under Dependencies; when wearing the QA hat, the Entry Criteria below are what signals "OK to verify this phase."

---

## Executive Summary

**Scope:** Verify that the 7-phase TanStack Query migration (Phase 0 through Phase 6) preserves behavior, catches the named architectural risks, and leaves the codebase in a state where the future TEA test-hardening initiative can proceed cleanly. Zero UX changes, zero schema changes, zero transport changes — invariant preservation with targeted new tests for the new invariants the architecture introduces.

**Risk Summary** (detail in Architecture doc):

- Total Risks: 9 (4 high-priority score ≥6, 2 medium, 3 low). Zero BLOCK-tier.
- Critical Categories: **TECH** — realtime invalidation correctness (R-01), seating split regression (R-02), adapter reference instability (R-06), test-infra gaps (R-07, R-09)

**Coverage Summary:**

- **P0 tests (blocks migration phase):** 6 items — T-01, T-03, T-06, T-12, T-14, T-16
- **P1 tests (high value, arch-exposed guardrails):** 5 items — T-04, T-05, T-08, T-11, T-17
- **P2 tests (regression confirmation / manual smokes):** 7 items — T-02, T-07, T-09, T-10, T-13, T-15, T-18
- **P3 tests:** 0 — all "nice-to-have" coverage defer to the future TEA initiative by PRD design
- **Total:** ~18 test-delta items across 6 phases. Small per phase (1–3 new tests + 1 manual smoke). No E2E additions beyond PRD-named manual smokes.

**Priority-to-risk mapping (explicit):** P0/P1/P2 below = priority over _migration risks R-01..R-09_ + PRD-named NFRs, **NOT** comprehensive feature coverage across all 25 FRs. Scope discipline is deliberate and aligned with PRD §Testing.

---

## Not in Scope

**Components or systems explicitly excluded from this test plan:**

| Item                                                 | Reasoning                                                                                                                    | Mitigation                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Database layer (RLS, triggers, RPCs, migrations)** | PRD §Non-Goals: "No schema changes... No `supabase/migrations/*.sql` file is added or altered."                              | Existing DB tests (if any) remain in place; validated through the migrated hooks' integration with the real local Supabase stack |
| **Auth flow / AuthContext internals**                | PRD non-goal. Only adjacency: one call to `queryClient.clear()` on logout (Phase 1 or 4 per architecture cross-cutting note) | Existing auth E2E (`tests/e2e/auth.setup.ts`) covers the login path; post-logout cache-clear verified by manual smoke T-13       |
| **Comprehensive E2E coverage of all feature flows**  | PRD §Testing: "Existing unit and E2E test suites pass at every phase boundary. No test is rewritten..."                      | Existing Playwright suite acts as regression signal; this plan adds zero E2E specs, only per-phase manual smokes                 |
| **Performance benchmarks of realtime propagation**   | PRD has NFR1 (~1s perceivable equivalence) but no measurement mechanism; accepted as manual smoke                            | Two-tab manual smoke T-10 at Phase 3; future TEA initiative may add instrumentation                                              |
| **Contract / API-schema tests**                      | No microservice seams — single Supabase backend                                                                              | N/A                                                                                                                              |
| **Visual regression / component snapshots**          | PRD zero-UX-change scope means existing visual equivalence is structurally guaranteed                                        | Manual smoke per-phase is adequate                                                                                               |
| **Broader hook unit-test coverage (beyond deltas)**  | PRD explicitly defers: "a separate test-hardening effort using BMAD TEA workflow... planned as its own PRD"                  | Future TEA initiative — captured in companion handoff doc                                                                        |
| **Load / stress / k6 / chaos / DR tests**            | PRD non-goals (single-tenant, no deployment changes, no new scale concerns)                                                  | N/A                                                                                                                              |

**Note:** Items listed here are explicitly accepted as out-of-scope. Anyone reopening them mid-migration should first justify the scope change.

---

## Dependencies & Test Blockers

**CRITICAL:** Per-phase testing cannot proceed without these items (detail in Architecture doc §Quick Guide).

### Architecture Dependencies (Pre-Implementation of Phase 1)

**Source:** See Architecture doc "Quick Guide" BLOCKERS section for detailed mitigation plans.

1. **G-01: `createTestQueryClient()` helper** — Phase 1 pilot PR
   - **What QA needs:** `src/test/createTestQueryClient.ts` exporting a fresh-per-test QueryClient factory with production defaults + `retry: false`
   - **Why it blocks:** Every subsequent Vitest test that mounts a migrated hook depends on per-test isolation; without it, tests leak cache state and become order-dependent (fails `test-quality.md` DoD: "Parallel-Safe").

2. **G-02: Realtime subscription test harness** — Phase 1 pilot PR
   - **What QA needs:** `src/test/realtimeHarness.ts` exporting: mocked `supabase.channel(...)` returning a controllable stub, synthetic-payload emitter (`emitPostgresChange(table, payload)`), and a `removeChannel` spy
   - **Why it blocks:** PRD-named NFR6 test (T-03) and the architecture's runtime channel-count assertion (T-14) both require it. Without harness, T-03 falls back to manual verification only.

3. **G-04 (accepted deferral — DO NOT unblock unless scope changes): Supabase `queryFn` mocking pattern** — If any unit test needs to isolate a `queryFn` from the database, establish `vi.mock('../lib/supabase')` pattern. Default: **skip**. Integration-test against local Supabase instead.

### QA Infrastructure Setup (Pre-Implementation)

Current infra is already sufficient for this migration's test deltas — no greenfield setup required. Inventory:

- **Vitest 4** + jsdom + `@testing-library/react` + `tdd-guard-vitest` (`vitest.config.ts`, `src/test/setup.ts`). Runs via `npm test`.
- **Playwright Chromium** with `storageState` auth + fail-closed private-network allow-list for Supabase (`playwright.config.ts`). Runs via `npm run test:e2e` / `npm run test:e2e:local`.
- **Local Supabase stack**: `npx supabase start` + `.env.test` + `npm run test:seed`. PRD security boundary — do not alter.
- **`ripgrep` (`rg`)** available for static grep hooks (already assumed by architecture's 19 validation hooks).

**New additions under this initiative** (both in Phase 1):

1. `src/test/createTestQueryClient.ts`
2. `src/test/realtimeHarness.ts`

---

## Risk Assessment

**Note:** Full risk register and mitigation plans in Architecture doc §Risk Assessment. Below: QA-planning-relevant summary — each risk has an identified test-delta that verifies its mitigation.

### High-Priority Risks (Score ≥6)

| Risk ID  | Category | Description                                         | Score | QA Test Coverage                                                                                               |
| -------- | -------- | --------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| **R-01** | TECH     | Realtime invalidation correctness (wrong query key) | **6** | T-05 Vitest (`onChange` routing); T-10 two-tab manual smoke; T-17 CI grep Hooks #3/#4 for query-key centrality |
| **R-02** | TECH     | `useSeatingChart` drag-state split regression       | **6** | T-14 runtime `supabase.getChannels().length === 3`; T-15 manual smoke (mid-drag + realtime); T-16 grep         |
| **R-06** | TECH     | Adapter reference-instability silent regression     | **6** | T-04 Vitest reference-stability test per migrated domain (Phases 1–3)                                          |
| **R-07** | TECH     | No QueryClient test-isolation pattern               | **6** | T-06 — `createTestQueryClient()` helper in Phase 1 pilot PR; reuse in every subsequent hook test               |
| **R-09** | TECH     | Realtime subscription test-harness undefined        | **6** | T-06 — `src/test/realtimeHarness.ts` in Phase 1 pilot PR; T-03 NFR6 + T-14 channel count both consume it       |

### Medium/Low-Priority Risks

| Risk ID | Category | Description                                                   | Score | QA Test Coverage                                                                                                                        |
| ------- | -------- | ------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R-03    | TECH     | Adapter reference instability (Phases 1–3 co-existence risk)  | 4     | Same as R-06 — T-04 is the _catch_ that converts passive monitoring into active verification                                            |
| R-05    | OPS      | Pattern drift — new features in legacy shape during migration | 4     | T-17 CI-grade static greps (Hooks #3/#4/#5/#6/#7/#10); continuous enforcement from Phase 0 onward                                       |
| R-04    | SEC      | Devtools leak into production bundle                          | 3     | T-01 build-time grep (Hooks #1/#2): `rg 'tanstack/react-query-devtools\|ReactQueryDevtools' dist/` → 0 matches, Phase 0 acceptance gate |
| R-08    | TECH     | No `queryFn` Supabase mocking pattern                         | 2     | DOCUMENT only — accepted trade-off; revisit if unit-level `queryFn` coverage proves valuable mid-migration                              |

---

## Entry Criteria

**Per-phase testing cannot begin until ALL of the following are met for that phase:**

- [ ] Phase's source changes complete on branch
- [ ] Existing Vitest suite passes (`npm test`) against the branch's source
- [ ] Existing Playwright suite passes (`npm run test:e2e:local`) against the branch's source — **this is the regression baseline for every phase**
- [ ] Phase 1+: `createTestQueryClient()` (G-01) and realtime harness (G-02) land in `src/test/` — only required before Phase 1's own P0 tests
- [ ] Architecture's phase-N greppable acceptance hooks from `architecture.md` §Validation all green for the phase
- [ ] Phase PR description lists the specific test deltas landed in this PR (see "Test Coverage Plan" below for the phase)

## Exit Criteria

**A phase is considered verified and ready to merge when ALL of the following are met:**

- [ ] All Entry Criteria met
- [ ] All phase-specific P0 test deltas from this doc passing
- [ ] All phase-specific P1 test deltas from this doc passing (or a skip with written rationale in PR)
- [ ] All phase-specific architecture greppable hooks from `architecture.md` §Validation returning expected results
- [ ] The phase's manual smoke test (from PRD acceptance criteria) executed and documented in PR description
- [ ] No P0 regressions in the existing Vitest + Playwright suites
- [ ] `git revert` path is clean — single PR (or tight group) with well-labeled commits

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2 = **priority within this migration's test deltas** (what to focus on if time-constrained), **NOT** comprehensive feature coverage. Priorities are risk-based over R-01..R-09 and PRD-named NFRs.

### P0 (Critical — blocks the associated phase)

**Criteria:** Blocks phase PR merge + addresses MITIGATE-scored risk (≥6) OR verifies a PRD-explicit NFR gate.

| Test ID  | Phase | Requirement                                                                                                                                                                                  | Test Level         | Risk Link              | Notes                                                                                                                                   |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **T-01** | 0     | NFR4 devtools not in prod bundle: `npm run build && rg 'tanstack/react-query-devtools\|ReactQueryDevtools' dist/` returns 0 matches                                                          | Build-time grep    | R-04 / NFR4            | Architecture Hooks #1/#2. Run in Phase 0 acceptance + as CI hook on every future production build                                       |
| **T-03** | 1     | NFR6 subscription-cleanup: mount a `useRealtimeSubscription` consumer → unmount → assert `supabase.removeChannel` called with the channel returned from `supabase.channel`                   | Unit (Vitest)      | R-09 / NFR6            | PRD-named. Consumes realtime harness (G-02). Add to existing `src/hooks/__tests__/useRealtimeSubscription.test.ts` as a new `it()` case |
| **T-06** | 1     | Test infrastructure: `createTestQueryClient` + realtime harness land, usable by all subsequent hook tests                                                                                    | Test infra         | R-07, R-09             | G-01 + G-02. Not a "test" proper — it's the delivery that unblocks T-03, T-04, T-05, T-08, T-11, T-14                                   |
| **T-12** | 4     | Phase 4 acceptance: `AppContext.tsx < 200 lines`; zero feature-hook imports; zero `useApp().students\|classrooms\|behaviors\|transactions\|seatingChart\|layoutPresets` in `src/components/` | Static grep + `wc` | NFR8 / FR4 / FR13–FR15 | Architecture Hooks #11/#12/#13/#14. Run at Phase 4 acceptance — these are _the_ Phase-4 PRD acceptance criteria                         |
| **T-14** | 5     | Runtime `supabase.getChannels().length === 3` with topics `['students', 'point_transactions', 'seating-chart']`                                                                              | Vitest (or manual) | R-02 / FR5 / NFR6      | Architecture Hook #18. Consumes realtime harness. Fallback is manual DevTools WS-frame smoke if harness can't produce reliably          |
| **T-16** | 5     | Seating hooks greps: zero `useState(loading\|error)`, zero `const previous =`, `useSeatingChart.ts < 200 lines` (facade), exactly 1 `supabase.channel(` in `src/hooks/`                      | Static grep + `wc` | R-02                   | Architecture Hooks #15/#16/#17/#19                                                                                                      |

**Total P0:** 6 items

---

### P1 (High — arch-exposed guardrails; strongly recommended per phase)

**Criteria:** Catches MITIGATE-scored risk via a test the PRD doesn't explicitly name but the architecture implicitly requires.

| Test ID  | Phase | Requirement                                                                                                                                               | Test Level    | Risk Link  | Notes                                                                                                                                                                                                                        |
| -------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T-04** | 1–3   | Adapter reference-stability: mount consumer of adapter, capture returned array identity, trigger deep-equal refetch, assert identity unchanged            | Unit (Vitest) | R-03, R-06 | One instance per migrated domain in that phase. Phase 1 lands pilot test + template; Phases 2 + 3 copy-paste. Deleted at Phase 4 (adapter gone)                                                                              |
| **T-05** | 1     | `useRealtimeSubscription` legacy-bridge routing: `onChange` only → used exclusively; legacy `onInsert/Update/Delete` only → preserved; both → dev warning | Unit (Vitest) | R-01       | Add to `src/hooks/__tests__/useRealtimeSubscription.test.ts`. Exercises the Phase-1 transitional signature documented in architecture Decision 3                                                                             |
| **T-08** | 2     | `useTransactions` optimistic award with forced mutationFn error: `onMutate` patches cache → `onError` rolls back → final cache === pre-patch snapshot     | Unit (Vitest) | R-01       | Validates the canonical `useMutation` template. Template for future mutation tests                                                                                                                                           |
| **T-11** | 3     | Time-totals split: `queryKeys.students.timeTotalsByClassroom(id)` is a distinct cache entry; broad `invalidateQueries(byClassroom(id))` invalidates both  | Unit (Vitest) | R-01       | Validates the query-key hierarchy convention documented in architecture §Query key conventions                                                                                                                               |
| **T-17** | all   | CI static-grep guardrails: architecture Hooks #3/#4/#5/#6/#7/#10 returning expected results continuously (pre-commit or CI step)                          | CI grep       | R-05       | Prefer extending existing `.github/workflows/test.yml` with a grep step (repo already runs CI there). Pre-commit (`lint-staged` is configured) is acceptable fallback. Cheap to add; prevents legacy-shape-in-new-code drift |

**Total P1:** 5 items

---

### P2 (Medium — regression confirmation; PRD-named manual smokes)

**Criteria:** PRD-named manual smoke tests from the Phase acceptance lists. These are the primary regression signal for "behavior unchanged" per PRD §Success Criteria.

| Test ID  | Phase | Requirement                                                                                                                                                                        | Test Level   | Risk Link | Notes                                                                                                |
| -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| **T-02** | 0     | Phase 0 smoke: teacher login → award point on smartboard → two-tab verify live update; open seating chart → drag a seat → verify persistence                                       | Manual       | baseline  | PRD §Phase 0 acceptance                                                                              |
| **T-07** | 1     | Phase 1 smoke: create / edit / delete a behavior; refresh window; no visible regression                                                                                            | Manual       | baseline  | PRD §Phase 1 acceptance                                                                              |
| **T-09** | 2     | Phase 2 smoke: create / delete classrooms; save / load layout preset; award and undo a point on live smartboard tab while watching teacher tab                                     | Manual       | baseline  | PRD §Phase 2 acceptance; exercises the first realtime + optimistic-mutation pairing in new shape     |
| **T-10** | 3     | Phase 3 two-tab smoke: teacher awards in tab A → smartboard tab B reflects within ~1s; undo in tab A → tab B reverts within ~1s                                                    | Manual       | R-01/NFR1 | PRD §Phase 3 acceptance. Validates the Decision-3 §Phase 3 semantic delta (refetch-roundtrip timing) |
| **T-13** | 4     | Phase 4 full-app walkthrough: login → classroom → award → undo → seating chart → layout preset → sound toggle → logout — every flow behaves identically to pre-phase               | Manual       | baseline  | PRD §Phase 4 acceptance — exercises the 45-file component migration                                  |
| **T-15** | 5     | Phase 5 seating smokes: drag a seat; drag during realtime event mid-drag; cancel an in-flight drag; save layout preset mid-rearrangement                                           | Manual       | R-02/FR18 | PRD §Phase 5 acceptance                                                                              |
| **T-18** | 6     | Phase 6 doc acceptance: `docs/architecture.md` rewritten; `docs/legacy/` retired-or-marked; `project-context.md` provider-tree updated; `CLAUDE.md` state-management lines current | Static check | baseline  | PRD §Phase 6 acceptance                                                                              |

**Total P2:** 7 items

---

### P3 (Low — Exploratory / Benchmarks)

**Explicitly zero.** The PRD defers broader test expansion to a future TEA initiative. Adding P3 items here would violate scope discipline. Any P3 candidate (bundle-size trend over time, realtime latency instrumentation, deeper `queryFn` unit coverage) is a seed for the handoff doc, not a deliverable for this migration.

**Total P3:** 0 items

---

## Execution Strategy

**Philosophy:** Solo-contributor, phase-scoped, fast-feedback. Every test delta runs in the phase PR that introduces it.

**Organized by PHASE, not by tool type** (because the scope is tight enough that per-phase is the natural boundary):

### Every Phase PR: Vitest + Playwright baseline (~2–5 min)

- Full existing Vitest suite — MUST be green (regression baseline; T-17 CI grep is effectively part of this)
- Full existing Playwright local-Supabase suite — MUST be green (regression baseline)
- Phase's new P0 + P1 test deltas
- Static greps for phase's architecture acceptance hooks

### Per-Phase: Manual smoke (~5–15 min)

- One manual smoke run per PRD phase acceptance (T-02, T-07, T-09, T-10, T-13, T-15, T-18 mapped to phases 0–6)
- Document in PR description with screenshots / short note

### Continuous (not per-phase): CI-grade static greps (T-17)

- Wire to pre-commit or lightweight CI workflow
- Enforces architecture Hooks #3/#4/#5/#6/#7/#10 on every commit post-Phase-1

### Explicitly NO nightly / weekly / chaos tiers

No k6, no soak tests, no fault-injection. PRD scope doesn't support that investment. Any future expansion belongs in the separate future TEA initiative.

---

## QA Effort Estimate

**Solo-contributor adaptation:** Rather than QA-hours, the frame below is _per-phase test-delta work_ bundled into each phase's PR. No calendar estimate (PRD §Non-Goals: "No time estimates. AI-assisted refactoring velocity is not meaningfully predictable").

| Phase | Test deltas in that PR                        | Effort rough-order          | Notes                                                                                           |
| ----- | --------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| 0     | T-01 (build grep), T-02 (manual smoke)        | ~30 min                     | Grep is trivial; smoke is ~10 min                                                               |
| 1     | T-03, T-04 template, T-05, T-06 (infra), T-07 | ~1–2 days                   | **Infrastructure-heavy phase**: G-01 + G-02 helpers + pattern note consume the bulk of the time |
| 2     | T-04 (×2 domains), T-08, T-09                 | ~half-day                   | T-04 is copy-paste of the Phase 1 template                                                      |
| 3     | T-04 (students), T-11, T-10                   | ~half-day                   | Semantic delta documentation is the subtle part                                                 |
| 4     | T-12 (static checks), T-13 (full-app smoke)   | ~1 hour grep + 20 min smoke | Delete T-04 adapter tests here as adapter code disappears                                       |
| 5     | T-14, T-15, T-16                              | ~half-day                   | T-14 harness integration is the tricky bit; T-15 is manual                                      |
| 6     | T-18 (doc check)                              | ~15 min                     | Review-only                                                                                     |

**Total:** ~4–6 days of dedicated test-delta work, spread across 6 phase PRs. Dominated by Phase 1 infrastructure.

**Assumptions:**

- Includes test delta authoring + local verification
- Excludes migration-code authoring (that's "dev" work in the same PRs)
- Excludes ongoing test maintenance post-migration (expected: ~0 — deltas are small and anchored in stable architecture contracts)

---

## Implementation Planning Handoff

**Use this table as a per-phase checklist inside the phase's PR description.**

| Work Item                                                                                           | Owner    | Target Phase | Dependencies / Notes                                                                                                    |
| --------------------------------------------------------------------------------------------------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| T-01: Production build + `rg 'tanstack/react-query-devtools\|ReactQueryDevtools' dist/` → 0 matches | Sallvain | Phase 0      | Architecture Hooks #1/#2                                                                                                |
| T-02: Phase 0 manual smoke (login, award, seating drag)                                             | Sallvain | Phase 0      | PRD §Phase 0                                                                                                            |
| T-06: Create `src/test/createTestQueryClient.ts` (G-01)                                             | Sallvain | Phase 1      | Blocks T-04 / T-05 / T-08 / T-11                                                                                        |
| T-06: Create `src/test/realtimeHarness.ts` (G-02)                                                   | Sallvain | Phase 1      | Blocks T-03 / T-14                                                                                                      |
| T-03: Add NFR6 subscription-cleanup test to `useRealtimeSubscription.test.ts`                       | Sallvain | Phase 1      | PRD NFR6 + Architecture §useRealtimeSubscription                                                                        |
| T-04 template: Adapter reference-stability test for `useBehaviors` pilot                            | Sallvain | Phase 1      | Template for Phases 2 + 3                                                                                               |
| T-05: `onChange` legacy-bridge routing test                                                         | Sallvain | Phase 1      | R-01 mitigation                                                                                                         |
| T-07: Phase 1 manual smoke                                                                          | Sallvain | Phase 1      | PRD §Phase 1                                                                                                            |
| T-17: Wire CI-grade static grep for architecture Hooks #3/#4/#5/#6/#7/#10                           | Sallvain | Phase 1      | Pre-commit or lightweight CI. Can slip to Phase 2 if Phase 1 gets too heavy                                             |
| T-04 (×2): Reference-stability tests for `useClassrooms`, `useTransactions`                         | Sallvain | Phase 2      | Copy from Phase 1 template                                                                                              |
| T-08: Forced-error optimistic rollback test on `useTransactions`                                    | Sallvain | Phase 2      | `useMutation` lifecycle canonical verification                                                                          |
| T-09: Phase 2 manual smoke                                                                          | Sallvain | Phase 2      | PRD §Phase 2                                                                                                            |
| T-04: Reference-stability test for `useStudents` adapter                                            | Sallvain | Phase 3      | Copy from Phase 1 template                                                                                              |
| T-11: Time-totals split test                                                                        | Sallvain | Phase 3      | Validates query-key hierarchy convention                                                                                |
| T-10: Phase 3 two-tab smoke with documented semantic delta                                          | Sallvain | Phase 3      | Decision 3 semantic delta applies here                                                                                  |
| T-12: Phase 4 static greps (Hooks #11/#12/#13/#14) + `wc -l src/contexts/AppContext.tsx`            | Sallvain | Phase 4      | Architecture acceptance + NFR8                                                                                          |
| T-04 cleanup: delete adapter reference-stability tests                                              | Sallvain | Phase 4      | Positive-reduction signal — the tests lived only to catch a transient risk that no longer applies after adapter removal |
| T-13: Phase 4 full-app manual smoke                                                                 | Sallvain | Phase 4      | PRD §Phase 4                                                                                                            |
| T-14: Runtime channel-count Vitest test (or manual WS-frame fallback)                               | Sallvain | Phase 5      | Architecture Hook #18                                                                                                   |
| T-15: Phase 5 seating-chart smokes (including mid-drag realtime)                                    | Sallvain | Phase 5      | PRD §Phase 5                                                                                                            |
| T-16: Phase 5 static greps (Hooks #15/#16/#17/#19) + `wc -l src/hooks/useSeatingChart.ts`           | Sallvain | Phase 5      | Architecture acceptance                                                                                                 |
| T-18: Phase 6 doc-update check                                                                      | Sallvain | Phase 6      | PRD §Phase 6                                                                                                            |

---

## Tooling & Access

All required tooling is already in place. No new access / external tool requests for this initiative.

| Tool or Service                  | Purpose                                                                 | Access Required      | Status    |
| -------------------------------- | ----------------------------------------------------------------------- | -------------------- | --------- |
| Vitest 4 + jsdom                 | Unit + component tests                                                  | N/A (local)          | **Ready** |
| `@testing-library/react`         | Component render + query                                                | N/A (local)          | **Ready** |
| `tdd-guard-vitest`               | TDD enforcement                                                         | N/A (local)          | **Ready** |
| Playwright Chromium              | E2E                                                                     | Local                | **Ready** |
| Local Supabase stack             | E2E backend                                                             | `npx supabase start` | **Ready** |
| `fnox`/age                       | Secret decryption for local dev                                         | Local (private key)  | **Ready** |
| `ripgrep`                        | Static greps (architecture Hooks + T-17)                                | Local / CI           | **Ready** |
| `@tanstack/react-query-devtools` | Dev-only query-key inspection (NOT a test tool — runtime observability) | Installs at Phase 0  | Phase 0   |

**New additions (both Phase 1):**

- [ ] `src/test/createTestQueryClient.ts`
- [ ] `src/test/realtimeHarness.ts`

---

## Interworking & Regression

**Services and components impacted by this feature** — since the PRD's whole thesis is "no behavior change," the interworking surface IS the regression surface. Below lists what must stay green at each phase boundary.

| Service / Component          | Impact                                                            | Regression Scope                                     | Validation Steps                                                        |
| ---------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| **Teacher Dashboard UI**     | Component migration to direct hook calls (Phase 4)                | Existing TeacherDashboard.test.tsx must pass         | Vitest + T-13 manual smoke at Phase 4                                   |
| **Smartboard live display**  | Realtime subscription rewrite (Phases 1–3)                        | Two-tab propagation within ~1s (NFR1)                | T-10 manual two-tab smoke at Phase 3; T-05 `onChange` routing test      |
| **Seating chart editor**     | Hook split (Phase 5)                                              | Drag latency + realtime interleaving (FR18)          | T-14 channel count + T-15 manual drag+realtime smoke                    |
| **Leaderboard calculations** | Transforms move to `dbToX` location                               | Existing `leaderboardCalculations.test.ts` must pass | Vitest at every phase boundary                                          |
| **Student parser**           | Unchanged by PRD                                                  | `studentParser.test.ts` passes unchanged             | Vitest at every phase boundary                                          |
| **Sounds**                   | Unchanged (UI state already in AppContext)                        | `sounds.test.ts` passes unchanged                    | Vitest at every phase boundary                                          |
| **Rotating category hook**   | Unchanged by PRD                                                  | `useRotatingCategory.test.ts` passes unchanged       | Vitest at every phase boundary                                          |
| **Auth flow**                | Only `queryClient.clear()` on logout                              | Existing `tests/e2e/auth.setup.ts` passes            | Playwright at every phase boundary; manual verify cache clear T-13      |
| **Data hooks** (all domains) | Internal rewrite, external shape preserved via adapter Phases 1–3 | All component-level tests pass unchanged             | Vitest at every phase boundary; T-04 reference-stability adds guardrail |

**Regression test strategy:**

- `npm test` + `npm run test:e2e:local` MUST exit 0 at every phase boundary — this is the PRD's load-bearing regression signal
- Any test failure at a phase boundary is a phase-PR blocker; do not paper over by updating assertions unless the assertion was genuinely wrong upstream
- No new cross-team coordination needed (solo contributor)

---

## Appendix A: Code Examples

**Example — T-06: `createTestQueryClient()` helper (illustrative shape):**

```ts
// src/test/createTestQueryClient.ts
import { QueryClient } from '@tanstack/react-query';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Surface errors deterministically per test-quality.md
        gcTime: Infinity, // Prevent async GC from interfering with test timing
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    // No logger override — default console errors are fine for tests
  });
}
```

**Example — T-04: Adapter reference-stability test (illustrative shape):**

```ts
// src/contexts/__tests__/AppContext.behaviors-adapter.test.tsx (Phase 1 pilot)
import { renderHook, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/createTestQueryClient';
// ... set up AppProvider wrapper + mock useBehaviors to return refetch-able data ...

test('useApp().behaviors retains reference when refetched data is deep-equal', async () => {
  const qc = createTestQueryClient();
  // Seed cache with a behavior list
  qc.setQueryData(queryKeys.behaviors.all, [{ id: '1', name: 'Helpful', points: 1 }]);
  // Render AppProvider-wrapped consumer
  const { result } = renderHook(() => useApp().behaviors, { wrapper: makeWrapper(qc) });
  const firstRef = result.current;

  // Trigger a refetch that returns the same data shape (structural sharing guarantee)
  await act(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.behaviors.all });
    // ...mock responder returns deep-equal array...
  });

  expect(result.current).toBe(firstRef); // Same JS reference — structural sharing + useMemo held identity
});
```

**Example — T-03: NFR6 subscription cleanup (add to existing test file):**

```ts
// src/hooks/__tests__/useRealtimeSubscription.test.ts — new case
import { renderHook, cleanup } from '@testing-library/react';
import { installRealtimeHarness } from '../../test/realtimeHarness';

test('NFR6: subscription does not outlive component tree — removeChannel called on unmount', () => {
  const harness = installRealtimeHarness(); // mocks supabase.channel; exposes removeChannelSpy
  const { unmount } = renderHook(() =>
    useRealtimeSubscription({
      channel: 'students',
      bindings: [{ table: 'students', onChange: () => {} }],
    })
  );

  expect(harness.removeChannelSpy).not.toHaveBeenCalled();
  unmount();
  expect(harness.removeChannelSpy).toHaveBeenCalledTimes(1);
  expect(harness.removeChannelSpy).toHaveBeenCalledWith(harness.lastCreatedChannel);
});
```

**Running specific tests:**

```bash
# Full Vitest suite (watch mode — default for dev)
npm test

# Run a specific test file once
npm test -- src/hooks/__tests__/useRealtimeSubscription.test.ts --run

# Production build + devtools leak check (T-01)
npm run build && rg 'tanstack/react-query-devtools|ReactQueryDevtools' dist/   # expect 0 matches

# Full Playwright E2E against local Supabase (regression baseline)
npm run test:e2e:local

# Architecture static-hook greps (spot-check — not all hooks, example Hook #3)
rg "queryKey:\s*\[" src/ | grep -v 'src/lib/queryKeys.ts'   # expect 0 output
```

---

## Appendix B: Knowledge Base References

- **Risk Governance** — `_bmad/tea/testarch/knowledge/risk-governance.md` — Risk scoring methodology, gate decision rules
- **Probability & Impact** — `_bmad/tea/testarch/knowledge/probability-impact.md` — 1-3 × 1-3 matrix, action thresholds
- **Test Levels Framework** — `_bmad/tea/testarch/knowledge/test-levels-framework.md` — Unit/integration/E2E selection rules (informs the "delta-only, unit-heavy" strategy here)
- **Test Quality DoD** — `_bmad/tea/testarch/knowledge/test-quality.md` — No hard waits, <300 lines, <1.5 min, self-cleaning
- **PRD** — `_bmad-output/planning-artifacts/prd.md` — Scope, phases, FRs/NFRs, risks, testing scope discipline
- **Architecture** — `_bmad-output/planning-artifacts/architecture.md` — Decisions, canonical patterns, 19 greppable acceptance hooks (Appendix: Architecture §Validation)
- **Architecture Test-Design companion** — `_bmad-output/test-artifacts/test-design-architecture.md` — Testability concerns, blocker list, ADR readiness summary

---

**Generated by:** Manual TEA workflow (system-level mode, sequential execution)
**Workflow:** `.claude/skills/bmad-testarch-test-design`
**Version:** Adapted for solo-contributor brownfield technical modernization
