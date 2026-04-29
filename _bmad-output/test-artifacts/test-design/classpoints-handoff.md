---
title: 'TEA Test Design → BMAD Handoff'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-04-28'
projectName: 'ClassPoints'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
  - _bmad-output/test-artifacts/test-design-progress.md
---

# TEA → BMAD Integration Handoff — ClassPoints

## Purpose

Bridges the test design outputs (`test-design-architecture.md` + `test-design-qa.md`) with downstream BMad workflows. ClassPoints is a **brownfield, solo-contributor** project with no formal epic/story decomposition — this handoff is structured as guidance for **direct execution** by `bmad-testarch-atdd` and `bmad-testarch-automate`, plus optional integration with future `create-epics-and-stories` runs if a formal sprint structure emerges.

---

## TEA Artifacts Inventory

| Artifact                          | Path                                                                             | Integration Point                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Architecture-side test design** | `_bmad-output/test-artifacts/test-design-architecture.md`                        | Code-side concerns; risk register; ASRs; cluster #2 + KI-1 + KI-3 acknowledgements |
| **QA-side test design**           | `_bmad-output/test-artifacts/test-design-qa.md`                                  | Per-feature scenario catalog; fixture spec; execution strategy; effort estimates   |
| **Workflow progress**             | `_bmad-output/test-artifacts/test-design-progress.md`                            | Source-loading audit trail; step-by-step decision record                           |
| **Risk Assessment**               | (embedded in `test-design-architecture.md` §Risk Assessment)                     | 20 risks scored, 4 BLOCK + 7 MITIGATE; categories TECH/SEC/PERF/DATA/BUS/OPS       |
| **Coverage Strategy**             | (embedded in `test-design-qa.md` §Test Coverage Plan)                            | 93 scenarios across UNIT (16) / INT (32) / E2E (45)                                |
| **INPUT brief**                   | `_bmad-output/test-artifacts/test-design/INPUT-classpoints-test-design-brief.md` | Pre-workflow source; supersedes `*-2026-04-22.md` archived artifacts               |

---

## Epic-Level Integration Guidance

ClassPoints does not currently have epic-level scaffolding (no `sprint-status.yaml`, no `epics.md`). The 10-feature inventory functions as a de-facto epic decomposition. If a future `bmad-create-epics-and-stories` run produces formal epics, the recommended mapping is:

### Risk References → Epic-Level Quality Gates

| Future Epic Theme                    | Map from features              | Epic-level quality gates                                                                                                     |
| ------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Auth & Session Resilience**        | Feature 1                      | R-08 (stale-JWT loop) MUST have passing test before any auth-touching PR merges                                              |
| **Per-Teacher Data Isolation (RLS)** | Cross-cutting (Feature 10)     | R-01 + R-02 (REST + realtime RLS) MUST be in PR pipeline; impersonation-pair fixture is mandatory                            |
| **Real-time Sync Integrity**         | Feature 7 + parts of 3 + 6 + 8 | R-03 (REPLICA IDENTITY invariant) + R-12 (reconnect) tests run on every realtime change. ADR-005 §6 PR-block on 4th channel. |
| **Points Economy Correctness**       | Features 5 + 6                 | R-04 (totals integrity) + R-05 (rollback null-guard) + R-06/07 (orchestrator partial-failure UX) — release-gate              |
| **Editorial UI Stability**           | Cross-cutting (selectors)      | Selector strategy enforced (`getByRole > getByLabel > getByText({exact: true}) > getByTestId > css`)                         |

### Quality Gates per Epic Theme

For each future epic, the following gates apply (extracted from `test-design-progress.md` step 4):

- **P0 pass rate:** 100% (zero failures)
- **P1 pass rate:** ≥ 95%
- **High-risk mitigation evidence:** Every score ≥ 6 risk MUST map to ≥ 1 passing scenario in CI
- **Behavioral coverage floor:** ≥ 80% of feature inventory has ≥ 1 passing E2E or INT
- **Test execution time:** PR < 15 min; Nightly < 30 min
- **Test code quality:** No `waitForTimeout`, no try/catch flow control, < 300 LOC per test, < 1.5 min per test

---

## Story-Level Integration Guidance

For future `bmad-create-story` runs, the following P0/P1 test scenarios MUST appear as acceptance criteria. Each is a behavioral assertion the story is not done without.

### Story-Acceptance-Criteria Templates

**Auth & Session stories:**

- AC: User cannot reach the dashboard with an expired or forged JWT — graceful redirect to login, no spinner loop. → AUTH.01-E2E-05
- AC: Sign-out clears storageState and redirects to login. → AUTH.01-E2E-04

**Classroom CRUD stories:**

- AC: Creating a classroom requires authenticated session and is scoped to the user (RLS). → CLASS.01-E2E-01 + CLASS.01-INT-01..03
- AC: Empty-state displays the "Create your first" CTA without dashboard rendering hanging. → CLASS.01-E2E-02 (works around KI-1)

**Student CRUD stories:**

- AC: Adding a student emits a realtime `students` channel event visible to the same user's other tabs within 2s. → STUD.01-E2E-06
- AC: Removing a student cascades to `point_transactions`; trigger maintains aggregate totals. → STUD.01-E2E-04 + STUD.01-INT-04

**Behavior CRUD stories:**

- AC: Custom behaviors are per-user (User A's custom behavior NOT visible to User B); shared defaults visible to both. → BEH.01-INT-01 + BEH.01-INT-02

**Points awarding stories:**

- AC: Optimistic increment within ~100ms; rollback on failure restores pre-award value (no `undefined` flash). → AWARD.01-E2E-01 + AWARD.01-E2E-08
- AC: Class-award and multi-award orchestrators surface failure count in UI when per-student writes fail (do NOT silently filter to nulls). → AWARD.01-E2E-05 + AWARD.01-E2E-07
- AC: `useAwardPoints.onMutate` is idempotent (StrictMode safe); rollback null-guards `context?.previousX`. → AWARD.01-UNIT-01 + AWARD.01-UNIT-02

**Transaction history & undo stories:**

- AC: `point_transactions` table has `REPLICA IDENTITY FULL`; DELETE events arrive with non-empty `payload.old`. → SCHEMA.01-INT-01 + HIST.01-INT-02
- AC: Undo, clear-student, reset-classroom each restore exact pre-mutation totals via trigger. → HIST.01-INT-03 + HIST.01-INT-04

**Realtime sync stories:**

- AC: Adding a 4th realtime channel without updating ADR-005 §6 is a PR-block. → R-09 (code-review enforcement, no test)
- AC: Subscribing to non-realtime tables (`classrooms`, `behaviors`) emits zero events. → RT.01-INT-02 + RT.01-INT-03

**Seating chart stories:**

- AC: In-device drag-and-drop persists across reload. → SEAT.01-E2E-02
- AC (BLOCKED on PRD Phase 5): Cross-device drag sync within 2s. → SEAT.01-E2E-06 (`test.skip` + TODO)

### Data-TestId Requirements

The redesigned UI uses ARIA-first selectors (per INPUT brief §"Selector strategy normative"). For volatile elements where `getByRole`/`getByLabel`/`getByText` are unstable, **add `data-testid`** during story implementation. Recommended placements (from coverage plan):

| Component / Surface                         | Suggested `data-testid`                                     | Used by scenarios                |
| ------------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| Sidebar `Create classroom` icon-only button | `data-testid="create-classroom-cta"`                        | CLASS.01-E2E-01                  |
| Empty-state `Create your first` CTA         | `data-testid="create-first-cta"`                            | CLASS.01-E2E-02                  |
| AwardPointsModal positive / negative chips  | `data-testid="award-positive-chip"` / `award-negative-chip` | AWARD.01-E2E-01..03              |
| ClassAwardModal submit button               | `data-testid="class-award-submit"`                          | AWARD.01-E2E-04, AWARD.01-E2E-05 |
| MultiAwardModal student-select checkboxes   | `data-testid="multi-award-student-{id}"`                    | AWARD.01-E2E-06, AWARD.01-E2E-07 |
| StudentPointCard total                      | `data-testid="student-point-total-{id}"`                    | AWARD.01-E2E-\* (assertions)     |
| Undo button on transaction row              | `data-testid="undo-transaction-{id}"`                       | HIST.01-E2E-01..04               |
| SeatingChartEditor draggable seat           | `data-testid="seat-{id}"`                                   | SEAT.01-E2E-02                   |
| Sound-effect toggle in settings             | `data-testid="sound-toggle"`                                | SET.01-E2E-01                    |

These additions are non-breaking and improve test stability without affecting accessibility.

---

## Risk-to-Story Mapping

| Risk ID | Category | P×I         | Recommended Story / Epic                               | Test Level    | Test ID(s)                                                          |
| ------- | -------- | ----------- | ------------------------------------------------------ | ------------- | ------------------------------------------------------------------- |
| R-01    | SEC      | 9           | Per-Teacher Data Isolation (cross-cutting)             | INT           | RLS.01-INT-00, CLASS/STUD/BEH/AWARD/SEAT/SET INT scenarios          |
| R-02    | SEC      | 9           | Real-time Sync Integrity                               | INT           | RT.01-INT-05                                                        |
| R-03    | DATA     | 9           | Real-time Sync Integrity (DELETE invariant)            | INT           | SCHEMA.01-INT-01, HIST.01-INT-01, HIST.01-INT-02                    |
| R-04    | DATA     | 6           | Points Economy Correctness                             | INT           | STUD.01-INT-04, STUD.01-INT-05, HIST.01-INT-03..04, AWARD.01-INT-02 |
| R-05    | TECH     | 9           | Points Economy Correctness (rollback regression guard) | UNIT + E2E    | AWARD.01-UNIT-02, AWARD.01-E2E-08                                   |
| R-06    | BUS      | 6           | Points Economy Correctness (orchestrator UX)           | E2E + INT     | AWARD.01-E2E-05, AWARD.01-INT-01                                    |
| R-07    | BUS      | 6           | Points Economy Correctness (multi-award UX)            | E2E           | AWARD.01-E2E-07                                                     |
| R-08    | TECH     | 6           | Auth & Session Resilience                              | E2E           | AUTH.01-E2E-05                                                      |
| R-09    | TECH     | 3           | Real-time Sync Integrity (4th-channel rule)            | code-review   | (no test)                                                           |
| R-10    | DATA     | 6 (blocked) | Cross-Device Seating Sync (PRD Phase 5)                | E2E (blocked) | SEAT.01-E2E-06 (`test.skip`)                                        |
| R-11    | DATA     | 2           | Points Economy Correctness (deterministic temp ID)     | UNIT          | AWARD.01-UNIT-03                                                    |
| R-12    | TECH     | 4           | Real-time Sync Integrity (reconnect)                   | INT           | HIST.01-INT-05                                                      |
| R-13    | BUS      | 6           | Empty-State UX (KI-1)                                  | E2E           | CLASS.01-E2E-02 (workaround)                                        |
| R-14    | DATA     | 3           | Migration Wizard (out of scope)                        | manual        | —                                                                   |
| R-15    | OPS      | 3           | E2E Local-Only Allow-List                              | UNIT          | AUTH.01-INT-01                                                      |
| R-16    | PERF     | 4           | Points Economy Correctness (rapid-tap)                 | E2E           | AWARD.01-E2E-09                                                     |
| R-17    | TECH     | 6           | (Structurally satisfied — no test needed)              | doc-only      | `tests/README.md`                                                   |
| R-18    | TECH     | 4           | Editorial UI Stability (transform regression)          | UNIT + INT    | CLASS/STUD/BEH UNIT transforms + CLASS.01-INT-04                    |
| R-19    | DATA     | 2           | Settings & Profile (provider hierarchy)                | UNIT          | SET.01-UNIT-01                                                      |
| R-20    | BUS      | 6           | Behavior CRUD (per-user RLS regression)                | INT           | BEH.01-INT-01, BEH.01-INT-02                                        |

---

## Recommended BMAD → TEA Workflow Sequence

The following sequence is **what works for ClassPoints' solo + AI-assist context**. Skip steps that don't apply to a one-person codebase.

1. **TEA Test Design** ← **DONE** (this run, 2026-04-28). Produces this handoff document.
2. **(Optional) BMad Create Epics & Stories** — If a formal sprint structure is desired, run `bmad-create-epics-and-stories` consuming this handoff. Otherwise, treat the 10-feature inventory as the de-facto epic structure.
3. **TEA ATDD** (`bmad-testarch-atdd`) — Generate **red-phase** acceptance tests for the 4 score-9 BLOCK risks first (R-01/R-02/R-03/R-05) so the gate becomes visible immediately. Then iterate through the score 6-8 mitigations.
4. **Code Implementation** (Sallvain + AI agents) — Make the failing acceptance tests pass. The **cluster #2 fix** and **KI-1 empty-state fix** are parallel code-side work that drag-along test transitions red → green.
5. **TEA Automate** (`bmad-testarch-automate`) — Expand to P1, P2, P3 from the QA doc's coverage plan once P0 is green.
6. **TEA Trace** (`bmad-testarch-trace`) — Generate traceability matrix and gate decision once authoring is complete. Validates all risks have test evidence.
7. **TEA Test Review** (`bmad-testarch-test-review`) — Quality validation pass before declaring the test suite "done."

---

## Phase Transition Quality Gates

| From Phase             | To Phase             | Gate Criteria                                                                                                                                |
| ---------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Test Design (this run) | ATDD (next workflow) | All P0 risks have at least an authored scenario stub (even if `test.skip`); impersonation-pair fixture authored                              |
| ATDD                   | Implementation       | Failing acceptance tests exist in PR pipeline for all P0 + P1 scenarios; test-design-qa.md scenarios are tagged                              |
| Implementation         | Test Automation      | All P0 acceptance tests pass on local + CI; cluster #2 + KI-1 fixes either landed or scheduled                                               |
| Test Automation        | Trace / Test Review  | All P0 + P1 scenarios green; ≥ 80% behavioral coverage floor; ≤ 30 min nightly runtime                                                       |
| Trace / Test Review    | Release              | Trace matrix shows ≥ 80% coverage of P0 + P1 requirements; no score ≥ 6 risks lacking test evidence; quality DoD met for every authored test |

---

## Open Items / Known Constraints

These do not block the handoff but should be visible to the next workflow consumer:

1. **R-10 / SEAT.01-E2E-06 is permanently blocked-on-migration.** Author the scenario today with `test.skip` + TODO. Un-skip when `useSeatingChart` migrates to TanStack with realtime per ADR-005 §6 / PRD Phase 5.

2. **Cluster #2 code fix is a separate track from this test design.** Tests for R-06 + R-07 are authored against expected post-fix UI behavior — they will fail until UI surfacing of partial failures lands. This is intentional drag-along for the cluster #2 fix.

3. **KI-1 empty-state Suspense never resolves** — bug-fix on Sallvain's queue. Test workaround in `auth.setup.ts` (don't wait for dashboard load). Remove workaround when fix lands.

4. **`test-design-architecture.md` is longer than the 150-200 line target** documented in the workflow checklist. The longer length is justified by the depth of code-side concerns (cluster #2 lying comments, KI-1, KI-3, three `as T` casts, hand-rolled hooks dual-baseline). A condensed version can be produced if reviewers prefer brevity.

5. **No formal sprint structure exists** — solo-contributor scope. The story-level guidance above is forward-looking for if/when sprint structure emerges; today, treat it as direct authoring guidance.

---

**End of Handoff**

**Next action recommended for Sallvain:**

1. Author the impersonation-pair fixture (~30-45 min) — it unblocks 16+ RLS scenarios.
2. Run `bmad-testarch-atdd` against the 4 score-9 BLOCK risks (R-01/R-02/R-03/R-05) for red-phase scenarios.
3. Schedule the cluster #2 code fix and KI-1 fix in parallel with test authoring.
4. After P0 + P1 coverage is green, run `bmad-testarch-trace` for the gate decision.
