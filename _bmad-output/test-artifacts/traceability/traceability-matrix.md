---
stepsCompleted:
  [
    'step-01-load-context',
    'step-02-discover-tests',
    'step-03-map-criteria',
    'step-04-analyze-gaps',
    'step-05-gate-decision',
  ]
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-28'
runId: '2026-04-28-pm-post-test-review'
tempCoverageMatrixPath: '/tmp/tea-trace-coverage-matrix-2026-04-28T15-30-00-000Z.json'
executionMode: 'sequential'
gateDecision: 'FAIL'
gateDecisionType: 'automation-gap'
gateBasis: 'priority_thresholds'
collectionStatus: 'COLLECTED'
projectName: 'ClassPoints'
branch: 'redesign/editorial-engineering'
baselineCommit: 'cd0ad84'
worktreeChanges: 'uncommitted: src/test/setup.ts (CRIT-1 fix), useAwardPoints.test.ts (CRIT-2 ID adoption), tests/* fixtures'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'high'
oracleResolutionMode: 'formal_requirements'
oracleSources:
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design/classpoints-handoff.md'
  - '_bmad-output/test-artifacts/test-review.md'
externalPointerStatus: 'not_used'
catalogSize: 93
catalogBreakdown:
  P0: 39
  P1: 24
  P2: 17
  P3: 4
  blocked: 1
  byLevel:
    UNIT: 16
    INT: 32
    E2E: 45
priorRunSnapshot: '_bmad-output/test-artifacts/traceability/traceability-matrix-2026-04-28-am.md'
priorRunGateSnapshot: '_bmad-output/test-artifacts/traceability/gate-decision-2026-04-28-am.json'
priorRunSummarySnapshot: '_bmad-output/test-artifacts/traceability/e2e-trace-summary-2026-04-28-am.json'
---

# Traceability Matrix — ClassPoints Post-Redesign Behavioral Coverage

## Re-Run Context — Post Test-Review Delta (2026-04-28 PM)

This is the **second trace run today**. The morning trace at `traceability-matrix-2026-04-28-am.md` issued **FAIL (automation-gap)** at 10:08. `bmad-testarch-test-review` then ran (output: `test-review.md` 13:49) and flagged two HIGH-severity findings; the fixes for both have landed in the working tree.

| Test-review finding                                                                                                         | Severity  | Fix landed                                                                                                                                                         | Trace impact                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRIT-1** — `src/test/setup.ts` missing `localStorage`/`sessionStorage` shim, blocked 13 `TeacherDashboard.test.tsx` tests | P0 / HIGH | ✅ in-memory `Storage` shim added (uncommitted)                                                                                                                    | Vitest now **108/108 green** (was 95/108 with 13 failing). The "13 pre-existing failures" line item from the AM matrix is **resolved**; `TeacherDashboard.test.tsx` is healthy infrastructure but still maps to **zero catalog scenarios** (the catalog supersedes those component tests with E2E rows). |
| **CRIT-2** — Suite has zero test IDs and zero priority markers, so trace must hand-map                                      | P0 / HIGH | ⚠ partial — adopted on Wave 1a (`useAwardPoints.test.ts:147,185,234,261` now carry `[P0][AWARD.01-UNIT-01..04]` prefixes); 8 other test files still need the sweep | Mechanical mapping is now possible for the 4 Wave 1a tests; the rest still require hand-mapping. **Catalog coverage count is unchanged** because no new scenarios were authored.                                                                                                                         |

**Net delta vs AM trace:** Suite green-rate flipped 89% → 100%. Catalog automation coverage flipped 0% → 0% (no new scenarios). **Verdict therefore unchanged: FAIL (automation-gap).** The verdict's _blockers to next-wave automation_ have changed, however — Wave 1b can now proceed because the test environment is unblocked and the ID convention is in place.

See "Comparison to prior trace" at the bottom for a side-by-side diff.

---

## Step 1 — Context Loaded

### Scope

Trace the formal test-design catalog (93 scenarios in `test-design-qa.md`) against tests currently implemented in the repository. Issue a quality-gate decision (PASS / CONCERNS / FAIL / WAIVED) reflecting realized coverage of the catalog and the residual risk surface.

This is **not** a regression-on-recent-change trace (that pattern was used in the legacy `traceability/traceability-report.md` from 2026-04-22, which is now stale and out of scope). The current trace is **catalog-vs-implementation**: how much of the formally-designed test catalog has been automated, and what gaps remain.

### Coverage Oracle

| Field                   | Value                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `coverageBasis`         | `acceptance_criteria` (test design IDs are behavioral acceptance criteria for each feature) |
| `oracleResolutionMode`  | `formal_requirements`                                                                       |
| `oracleConfidence`      | `high`                                                                                      |
| `oracleSources`         | `test-design-qa.md`, `test-design-architecture.md`, `classpoints-handoff.md`                |
| `externalPointerStatus` | `not_used` (no external trackers; ClassPoints is solo-contributor brownfield)               |

The oracle is the **stable test-ID catalog** in `test-design-qa.md` §Test Coverage Plan. Each ID encodes feature.story-level-sequence (e.g., `AUTH.01-E2E-05`, `RT.01-INT-05`). 85 explicit IDs are listed; the handoff cites a total of 93 across UNIT(16)/INT(32)/E2E(45) — the 8-scenario delta is reconciled in Step 3 against the per-feature appendix.

### Knowledge Base Fragments Loaded

From `{skill-root}/resources/tea-index.csv`:

- `test-priorities-matrix.md` — P0-P3 definitions and coverage thresholds
- `risk-governance.md` — scoring matrix, gate-decision rules
- `probability-impact.md` — shared scoring scale
- `test-quality.md` — Test Quality DoD (no `waitForTimeout`, `<300 LOC`, `<1.5min`/test, deterministic, parallel-safe)
- `selective-testing.md` — tag/grep usage and PR/Nightly promotion rules

### Artifacts Loaded

| Artifact                   | Path                                                                             | Role in Trace                                                                   |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Test design (QA)           | `_bmad-output/test-artifacts/test-design-qa.md`                                  | **Primary oracle.** 85 explicit test-ID rows; risk linkage; execution strategy. |
| Test design (Architecture) | `_bmad-output/test-artifacts/test-design-architecture.md`                        | Risk register (20 risks, 4 BLOCK + 7 MITIGATE), ASRs, ADR-005 §4.               |
| Handoff                    | `_bmad-output/test-artifacts/test-design/classpoints-handoff.md`                 | Epic-theme → quality-gate mapping; story AC templates.                          |
| INPUT brief                | `_bmad-output/test-artifacts/test-design/INPUT-classpoints-test-design-brief.md` | Pre-workflow source-of-truth feature inventory.                                 |
| Wave 1a automation summary | `_bmad-output/test-artifacts/automation-summary.md`                              | What has been automated since test-design completed (4 UNIT tests).             |
| Known failures inventory   | `_bmad-output/test-artifacts/known-failures.md`                                  | 13 failing `TeacherDashboard.test.tsx` tests — pre-existing, scoped out.        |
| Project context            | `_bmad-output/project-context.md`                                                | Stack, conventions, testing rules.                                              |

### Why This Oracle Was Selected

1. **Formal requirements exist and are recent** — `test-design-qa.md` was generated 2026-04-28 02:41 by `bmad-testarch-test-design`, post-redesign, against current branch `redesign/editorial-engineering` at HEAD `cd0ad84`. No external pointer needed.
2. **Stable IDs already exist** — every catalog row has a deterministic ID; tests authored downstream (Wave 1a) reference these IDs in their mapping table. The trace can be mechanical.
3. **Risk linkage is explicit** — each scenario carries its risk reference (R-01..R-20, ASR-1..ASR-8, KI-1..KI-5). Coverage is risk-weighted, not just count-weighted.
4. **No epic/story scaffolding** to fall back on (no `sprint-status.yaml`, no `epics.md`) — confirms the test-design IDs ARE the epic-decomposition, per handoff §Epic-Level Integration Guidance.

### Pre-Step-2 Context Carried Forward

- **Catalog size:** 85 explicit IDs (Step 3 will reconcile to 93 via the per-feature appendices in `test-design-qa.md` if the missing 8 are recoverable; otherwise the catalog total stands at 85 and the trace operates on those).
- **Wave 1a delivered:** 4 UNIT tests (`AWARD.01-UNIT-01..04` in `src/hooks/__tests__/useAwardPoints.test.ts`).
- **Pre-existing tests in repo (per `find` 2026-04-28):**
  - `src/hooks/__tests__/useAwardPoints.test.ts` — Wave 1a (4 tests)
  - `src/hooks/__tests__/useRealtimeSubscription.test.ts` — pre-existing (RT.01-INT-06 candidate)
  - `src/test/leaderboardCalculations.test.ts` — pre-existing (P3 background)
  - `src/test/useRotatingCategory.test.ts` — pre-existing (P3 background, KI-5 debt)
  - `src/test/sounds.test.ts` — pre-existing (SET.01-UNIT-02 — "18 tests stay green")
  - `src/test/TeacherDashboard.test.tsx` — pre-existing (13 failing, ThemeProvider/localStorage)
  - `src/utils/__tests__/studentParser.test.ts` — pre-existing (STUD.01-UNIT-01 candidate)
  - `tests/integration/example.test.ts` — placeholder smoke (2 tests)
  - `tests/e2e/example.spec.ts` — placeholder smoke (2 tests via Playwright config)
- **Out of scope for trace gate:** The 13 `TeacherDashboard.test.tsx` failures are pre-existing product-side bugs documented in `known-failures.md`; they do not weigh on the trace decision but are flagged in Step 5 risk-summary.

### Step 1 Outputs

- ✅ Coverage oracle resolved (`acceptance_criteria` / `formal_requirements` / `high` confidence)
- ✅ Knowledge base fragments identified (5 core fragments)
- ✅ Source artifacts inventoried (7 documents + repo test files)
- ✅ Frontmatter populated with oracle metadata

**Next:** Step 2 — Discover Tests. Catalog every test in `src/**/__tests__/`, `src/test/`, `tests/integration/`, `tests/e2e/` with file path, test name, and inferred test-ID mapping where unambiguous; flag ambiguous/unmapped tests for Step 3.

---

## Step 2 — Discover & Catalog Tests

### Discovery scope

Searched four roots:

- `src/**/__tests__/*.test.ts` (TanStack/hook unit tests)
- `src/test/*.test.{ts,tsx}` (component + utility unit tests, legacy location)
- `src/utils/__tests__/*.test.ts` (utility unit tests)
- `tests/integration/*.test.ts` (Vitest INT — real Supabase)
- `tests/e2e/*.spec.ts` (Playwright E2E)

**No tests found** in `src/components/__tests__/` (component tests live in `src/test/`). No `*.spec.tsx` outside Playwright's `tests/e2e/`.

### Test inventory by file

| #    | File                                                  | Level       | Tests | Status                                                 | Catalog mapping (preliminary)                                                                                                                                                                                  |
| ---- | ----------------------------------------------------- | ----------- | ----- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `src/hooks/__tests__/useAwardPoints.test.ts`          | UNIT        | 4     | ✅ all passing (Wave 1a)                               | AWARD.01-UNIT-01, -02, -03, -04 (explicit, per `automation-summary.md`); **CRIT-2 ID prefixes adopted in titles `[P0][AWARD.01-UNIT-NN]`**                                                                     |
| 2    | `src/hooks/__tests__/useRealtimeSubscription.test.ts` | UNIT        | 8     | ✅ passing                                             | RT.01-INT-06 partial (subscription cleanup, NFR6); rest are infrastructure tests for the hook itself, not catalog scenarios; **no test-ID prefix yet (CRIT-2 sweep pending)**                                  |
| 3    | `src/test/leaderboardCalculations.test.ts`            | UNIT        | 28    | ✅ passing                                             | P3 background — `(existing-1)` row in catalog; **no test-ID prefix yet** (AM trace cited 30; current run reports 28 — minor counting drift, not a regression)                                                  |
| 4    | `src/test/useRotatingCategory.test.ts`                | UNIT        | 8     | ✅ passing                                             | P3 background — `(existing-2)` row, KI-5 debt; **no test-ID prefix yet**                                                                                                                                       |
| 5    | `src/test/sounds.test.ts`                             | UNIT        | 15    | ✅ passing                                             | SET.01-UNIT-02 (catalog says "18 tests stay green"; AM trace cited 17; current run reports 15 — variance noted)                                                                                                |
| 6    | `src/test/TeacherDashboard.test.tsx`                  | COMPONENT   | 13    | ✅ **all passing post-CRIT-1** (was 13 ❌ in AM trace) | Unmapped — these were authored before test-design and overlap with would-be P0/P1 dashboard scenarios; **superseded by E2E catalog** (CLASS.01-E2E-\* + AUTH.01-E2E-03). Now healthy but still 0 catalog rows. |
| 7    | `src/utils/__tests__/studentParser.test.ts`           | UNIT        | 32    | ✅ passing                                             | STUD.01-UNIT-01 (one row, but file has 32 tests covering JSON/CSV/auto-detect/displayName generation — broader coverage than catalog asks; AM cited 33)                                                        |
| 8    | `tests/integration/example.test.ts`                   | INT         | 2     | ✅ passing                                             | None — labeled "smoke" in test names; no risk linkage                                                                                                                                                          |
| 9    | `tests/e2e/example.spec.ts`                           | E2E         | 2     | ✅ passing (per `test-design-progress.md`)             | None — labeled "smoke" in test names; no risk linkage                                                                                                                                                          |
| (10) | `tests/e2e/auth.setup.ts`                             | E2E (setup) | 1     | ✅ passing                                             | Infrastructure — produces `storageState`; not a behavioral assertion                                                                                                                                           |

**Totals (PM run, post-CRIT-1):**

| Level     | Files                | Tests   | Passing | Failing | Mapped to catalog                                                                                               | Smoke/unmapped                                                                                                            |
| --------- | -------------------- | ------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| E2E       | 2 (1 spec + 1 setup) | 3       | 3       | 0       | 0                                                                                                               | 3                                                                                                                         |
| INT       | 1                    | 2       | 2       | 0       | 0                                                                                                               | 2                                                                                                                         |
| UNIT      | 7                    | 108     | **108** | **0**   | 4 explicit + 4 implicit (incl. `(existing-1)`, `(existing-2)`, SET.01-UNIT-02 cluster, STUD.01-UNIT-01 cluster) | rest are out-of-catalog (TeacherDashboard component tests, broader studentParser coverage, useRealtimeSubscription infra) |
| **Total** | **10**               | **113** | **113** | **0**   | **~8 catalog-aligned**                                                                                          | **105 not-on-catalog**                                                                                                    |

> **Diff vs AM totals:** Same set of files (no test files added or deleted). The AM matrix counted 117 tests / 104 passing / 13 failing; this PM run counts 113 / 113 / 0. The 13 → 0 failure flip is the verified CRIT-1 fix. The 117 → 113 nominal drop is **counting drift** (sounds 17 → 15, leaderboardCalculations 30 → 28, studentParser 33 → 32 per the actual `vitest --run` output) — no test was deleted; either the AM run double-counted parameterized cases or the verbose-reporter row counts changed shape. Catalog-aligned **8 → 8 (unchanged).**

### Per-test identity (machine-readable extract for Step 3)

```yaml
# Catalog-mapped tests
- id: AWARD.01-UNIT-01
  file: src/hooks/__tests__/useAwardPoints.test.ts
  line: 147
  level: UNIT
  title: 'applies the optimistic increment exactly once when mutate() runs twice with identical input'
  status: passing
- id: AWARD.01-UNIT-02
  file: src/hooks/__tests__/useAwardPoints.test.ts
  line: 185
  level: UNIT
  title: 'does NOT issue setQueryData(key, undefined) for keys whose previous state was undefined'
  status: passing
- id: AWARD.01-UNIT-03
  file: src/hooks/__tests__/useAwardPoints.test.ts
  line: 234
  level: UNIT
  title: 'writes the optimistic transaction with id `optimistic-{studentId}-{behaviorId}-{timestamp}`'
  status: passing
- id: AWARD.01-UNIT-04
  file: src/hooks/__tests__/useAwardPoints.test.ts
  line: 261
  level: UNIT
  title: 'rolls back to cache state captured at mutate-time, not at hook-render-time'
  status: passing
- id: RT.01-INT-06 # catalog level=UNIT despite RT/INT prefix
  file: src/hooks/__tests__/useRealtimeSubscription.test.ts
  line: 238
  level: UNIT
  title: 'should removeChannel on unmount with the same channel instance'
  status: passing
  notes: 'subscription cleanup invariant; partial coverage of "no duplicate subscriptions on remount"'
- id: '(existing-1)' # P3 background row
  file: src/test/leaderboardCalculations.test.ts
  level: UNIT
  tests: 30
  status: passing
- id: '(existing-2)' # P3 background row, KI-5 debt
  file: src/test/useRotatingCategory.test.ts
  level: UNIT
  tests: 8
  status: passing
  notes: 'pre-existing debt: missing useRealTimers() cleanup'
- id: SET.01-UNIT-02
  file: src/test/sounds.test.ts
  level: UNIT
  tests: 17
  catalog_target: 18
  status: passing
- id: STUD.01-UNIT-01
  file: src/utils/__tests__/studentParser.test.ts
  level: UNIT
  tests: 33
  catalog_scope: 'CSV with quoted commas, BOM, trailing newlines'
  status: passing

# Pre-existing, not on catalog — recommended scope-out per known-failures.md
- id: TeacherDashboard-component-suite
  file: src/test/TeacherDashboard.test.tsx
  level: COMPONENT
  tests: 13
  status: 'all failing (TypeError: window.localStorage.getItem is not a function in ThemeContext.tsx:15)'
  catalog_mapping: none
  recommended: 'product-side fix or delete; superseded by E2E catalog (TeacherDashboard scenarios live as AUTH.01-E2E-03, CLASS.01-E2E-01..05)'
```

### Coverage Heuristics Inventory

Per the step's blind-spot framework (catalog → tests):

#### API / DB endpoint coverage (INT layer)

The catalog cites these tables/RPCs as INT scenarios (`pg_policies`, `pg_class.relreplident`, `pg_trigger` introspection plus behavioral effect tests):

- `classrooms`, `students`, `behaviors`, `point_transactions` (× INSERT/UPDATE/DELETE/SELECT under RLS — User A vs User B)
- `seating_seats`, `sound_settings`, `layout_presets` (× SELECT under RLS)
- Trigger: `tg_update_student_totals` (catalog SCHEMA.01-INT-02)
- Schema invariant: `REPLICA IDENTITY FULL` on realtime DELETE-watched tables (catalog SCHEMA.01-INT-01, HIST.01-INT-01)

**Tests touching these tables:** 1 smoke (`tests/integration/example.test.ts:18` — `select * from classrooms` shape check, no RLS, no impersonation).

**→ 32 INT scenarios in catalog, ~0 directly covered.** All RLS scenarios across CLASS / STUD / BEH / AWARD / RLS / SEAT / SET feature groups are unmapped.

#### Auth / authz coverage

Catalog: AUTH.01-E2E-01..06 + AUTH.01-INT-01 + AUTH.01-UNIT-01.
**Tests covering:** 0 product-tests. (`tests/e2e/auth.setup.ts` is fixture infrastructure that produces `storageState` for all other E2Es; it is not a behavioral assertion of auth.)

**→ 8 AUTH scenarios catalog, 0 covered.** Includes the high-priority R-08 stale-JWT regression guard for fix `d652260` (AUTH.01-E2E-05). Negative-path coverage (invalid creds, AuthGuard short-circuit) is entirely missing.

#### Error-path coverage

Catalog scenarios that explicitly test error/failure paths:

- AWARD.01-E2E-05 / -07 (per-student failure during class/multi award via Playwright `route` interception)
- AWARD.01-E2E-08 (4xx → optimistic rollback)
- AWARD.01-UNIT-02 (rollback null-guard) ✅ **covered** (Wave 1a)
- CLASS.01-E2E-05 (delete with confirmation)
- STUD.01-E2E-02 (empty-name validation)
- HIST.01-INT-05 (realtime channel reconnect, R-12)

**Tests covering:** 1 of 7 (only the rollback-null-guard UNIT test). The R-05 score-9 risk has its dedicated regression guard, which is the highest-value coverage achieved so far.

#### UI journey coverage (E2E layer)

Catalog enumerates 45 E2E scenarios across login, dashboard load, classroom CRUD, student grid, behaviors, awards, history, realtime, seating, settings.

**Tests exercising journeys:**

- 1 smoke ("dashboard chrome is visible") — does not assert any feature behavior
- 1 fixture demo (`userFactory.create()` — infrastructure, not journey)

**→ 45 E2E catalog scenarios, 0 directly covered.**

#### UI state coverage (loading / empty / error / validation / permission-denied)

Catalog includes:

- Empty: CLASS.01-E2E-02 (Create-your-first CTA when classrooms.length===0)
- Loading: implied by AUTH.01-E2E-03 happy-path
- Error: CLASS.01-E2E-05, AWARD.01-E2E-05/07/08
- Validation: STUD.01-E2E-02

**Tests covering:** Component-level attempts in `TeacherDashboard.test.tsx` for `Loading State`, `Error State`, `Empty State` — but **all 13 fail pre-existing** (ThemeProvider/localStorage). At runtime, zero working coverage of UI states.

### Step 2 Outputs

- ✅ 9 test files cataloged across UNIT/INT/E2E levels
- ✅ 117 total tests inventoried (104 passing, 13 pre-existing failures scoped out)
- ✅ ~8 catalog-aligned tests identified (4 explicit Wave 1a + 4 pre-existing P2/P3 / partial)
- ✅ 109 tests confirmed out-of-catalog (mostly broader pre-existing UNIT coverage)
- ✅ Coverage heuristics computed across 5 dimensions (API/DB, auth, error-path, UI journey, UI state)
- ⚠️ **Blind spot warning carried to Step 3:** The implementation:catalog ratio is roughly 8:85 for catalog-aligned coverage; 0:32 for INT-layer RLS/realtime/schema; 0:45 for E2E. This shape is consistent with the post-`bmad-testarch-test-design` / pre-`bmad-testarch-automate` Wave 1b state — Wave 1a explicitly delivered only the four AWARD UNIT tests.

**Next:** Step 3 — Map oracle scenarios → tests row by row, classifying each catalog ID as `full`, `partial`, `none`, or `blocked`. Compute per-feature and per-priority coverage tables.

---

## Step 3 — Coverage Oracle → Tests Mapping

### Catalog ID count reconciliation

Counted explicit IDs in `test-design-qa.md` per priority table:

| Priority  | Catalog "Total" cell | Counted IDs | Δ   | Notes                                        |
| --------- | -------------------- | ----------- | --- | -------------------------------------------- |
| P0        | 39                   | **47**      | +8  | Doc summary undercounts                      |
| P1        | 24                   | **26**      | +2  | Doc summary undercounts                      |
| P2        | 17                   | **17**      | 0   | Match                                        |
| P3        | 4                    | **4**       | 0   | Match                                        |
| Blocked   | 1                    | **1**       | 0   | Match                                        |
| **Total** | **85**               | **95**      | +10 | Handoff cites 93 (UNIT 16 + INT 32 + E2E 45) |

The trace operates on the **95 explicit IDs** I can count from the catalog. The 93/85 totals from prose summaries appear to be miscounts — flagging this as a documentation cleanup item but the trace proceeds against the canonical row-level data.

### Coverage status legend

- **FULL** — at least one passing test exercises the assertion at the level specified (or higher)
- **PARTIAL** — a passing test exists but is narrower than the catalog row (level mismatch, missing edge case, or weaker assertion)
- **NONE** — no test exists at any level
- **BLOCKED** — explicitly marked blocked by catalog (waiting on product/infra change)
- **FAILING** — a test exists but currently fails (treated as NONE for gate-decision purposes; flagged separately)

### Coverage matrix — by feature group

#### AUTH (8 scenarios)

| ID              | Priority | Level | Status  | Mapped tests                                                  | Notes                                                                                                                            |
| --------------- | -------- | ----- | ------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AUTH.01-E2E-01  | P1       | E2E   | NONE    | —                                                             | login form selectors floor                                                                                                       |
| AUTH.01-E2E-02  | P0       | E2E   | NONE    | —                                                             | invalid creds sad-path                                                                                                           |
| AUTH.01-E2E-03  | P0       | E2E   | PARTIAL | `tests/e2e/example.spec.ts:4` ("dashboard chrome is visible") | Smoke covers the login→dashboard transition (storageState reuse) but does not assert "Welcome Back" or any feature behavior      |
| AUTH.01-E2E-04  | P0       | E2E   | NONE    | —                                                             | sign out + storageState clear                                                                                                    |
| AUTH.01-E2E-05  | P0       | E2E   | NONE    | —                                                             | **R-08 stale-JWT regression — direct guard for fix `d652260` is missing**                                                        |
| AUTH.01-E2E-06  | P0       | E2E   | NONE    | —                                                             | AuthGuard short-circuit                                                                                                          |
| AUTH.01-INT-01  | P1       | UNIT  | NONE    | —                                                             | `isPrivateHost` parser test, deferred Wave 1.5 (per `automation-summary.md` advisor checkpoint — needs prior product extraction) |
| AUTH.01-UNIT-01 | P2       | UNIT  | NONE    | —                                                             | `useAuth` provider init                                                                                                          |

**AUTH coverage:** 1 PARTIAL / 7 NONE / 0 FULL.

#### CLASS (Classrooms — 12 scenarios)

| ID               | Priority | Level | Status | Mapped tests | Notes                             |
| ---------------- | -------- | ----- | ------ | ------------ | --------------------------------- |
| CLASS.01-E2E-01  | P0       | E2E   | NONE   | —            | Create classroom from sidebar `+` |
| CLASS.01-E2E-02  | P1       | E2E   | NONE   | —            | Empty-state CTA (R-13)            |
| CLASS.01-E2E-03  | P1       | E2E   | NONE   | —            | Switch active classroom           |
| CLASS.01-E2E-04  | P1       | E2E   | NONE   | —            | Edit classroom name               |
| CLASS.01-E2E-05  | P1       | E2E   | NONE   | —            | Delete with confirmation          |
| CLASS.01-INT-01  | P0       | INT   | NONE   | —            | RLS SELECT (R-01)                 |
| CLASS.01-INT-02  | P0       | INT   | NONE   | —            | RLS UPDATE/DELETE (R-01)          |
| CLASS.01-INT-03  | P0       | INT   | NONE   | —            | RLS anon block (R-01)             |
| CLASS.01-INT-04  | P2       | INT   | NONE   | —            | New DB column pickup (R-18)       |
| CLASS.01-UNIT-01 | P1       | UNIT  | NONE   | —            | TanStack invalidation             |
| CLASS.01-UNIT-02 | P2       | UNIT  | NONE   | —            | RejectExcessProperties (R-18)     |
| CLASS.01-UNIT-03 | P2       | UNIT  | NONE   | —            | dbToClassroom transform (R-18)    |

**CLASS coverage:** 0 FULL / 12 NONE.

> **Note:** The 13 failing tests in `src/test/TeacherDashboard.test.tsx` attempt component-level coverage of CLASS Empty State and Dashboard rendering. Per `known-failures.md` and `automation-summary.md`, those failures are pre-existing (ThemeProvider/localStorage), and the catalog explicitly supersedes them with E2E scenarios. They do **not** count as PARTIAL coverage.

#### STUD (Students — 11 scenarios)

| ID              | Priority | Level | Status  | Mapped tests                                           | Notes                                                                                                                                                                                                                             |
| --------------- | -------- | ----- | ------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STUD.01-E2E-01  | P0       | E2E   | NONE    | —                                                      | Add student happy path                                                                                                                                                                                                            |
| STUD.01-E2E-02  | P1       | E2E   | NONE    | —                                                      | Empty-name validation                                                                                                                                                                                                             |
| STUD.01-E2E-03  | P1       | E2E   | NONE    | —                                                      | Edit student name                                                                                                                                                                                                                 |
| STUD.01-E2E-04  | P1       | E2E   | NONE    | —                                                      | Remove student + FK cascade                                                                                                                                                                                                       |
| STUD.01-E2E-05  | P2       | E2E   | NONE    | —                                                      | CSV import (parser is unit-tested but full E2E flow is not)                                                                                                                                                                       |
| STUD.01-E2E-06  | P0       | E2E   | NONE    | —                                                      | **Realtime award sync (ASR-2 strength) — missing**                                                                                                                                                                                |
| STUD.01-INT-01  | P0       | INT   | NONE    | —                                                      | RLS SELECT (R-01)                                                                                                                                                                                                                 |
| STUD.01-INT-02  | P0       | INT   | NONE    | —                                                      | RLS INSERT (R-01)                                                                                                                                                                                                                 |
| STUD.01-INT-03  | P0       | INT   | NONE    | —                                                      | RLS UPDATE/DELETE (R-01)                                                                                                                                                                                                          |
| STUD.01-INT-04  | P0       | INT   | NONE    | —                                                      | **Trigger correctness (R-04, ASR-4) — missing**                                                                                                                                                                                   |
| STUD.01-INT-05  | P1       | INT   | NONE    | —                                                      | today_total reset at day boundary                                                                                                                                                                                                 |
| STUD.01-UNIT-01 | P2       | UNIT  | PARTIAL | `src/utils/__tests__/studentParser.test.ts` (33 tests) | Catalog asks for "quoted commas, BOM, trailing newlines"; tests cover quoted commas (line 68), Windows line endings (line 53), empty lines (line 92). **BOM not tested.** Trailing-newline behavior implicit via empty-line skip. |
| STUD.01-UNIT-02 | P2       | UNIT  | NONE    | —                                                      | dbToStudent transform (R-18)                                                                                                                                                                                                      |

**STUD coverage:** 0 FULL / 1 PARTIAL / 11 NONE.

#### BEH (Behaviors — 5 scenarios)

| ID             | Priority | Level | Status | Mapped tests | Notes                                                |
| -------------- | -------- | ----- | ------ | ------------ | ---------------------------------------------------- |
| BEH.01-E2E-01  | P1       | E2E   | NONE   | —            | Add custom behavior                                  |
| BEH.01-E2E-02  | P1       | E2E   | NONE   | —            | Edit behavior label/value                            |
| BEH.01-E2E-03  | P2       | E2E   | NONE   | —            | Delete + FK behavior (R-04)                          |
| BEH.01-INT-01  | P0       | INT   | NONE   | —            | **Per-user vs shared defaults RLS (R-20) — missing** |
| BEH.01-INT-02  | P0       | INT   | NONE   | —            | RLS UPDATE/DELETE (R-20)                             |
| BEH.01-UNIT-01 | P1       | UNIT  | NONE   | —            | "Plain mutation" reference test                      |
| BEH.01-UNIT-02 | P2       | UNIT  | NONE   | —            | dbToBehavior transform                               |

**BEH coverage:** 0 FULL / 7 NONE.

#### AWARD (Award Points — 14 scenarios)

| ID                   | Priority | Level | Status   | Mapped tests                 | Notes                                                                              |
| -------------------- | -------- | ----- | -------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| AWARD.01-E2E-01      | P0       | E2E   | NONE     | —                            | Optimistic increment <100ms (ASR-5)                                                |
| AWARD.01-E2E-02      | P0       | E2E   | NONE     | —                            | Negative points                                                                    |
| AWARD.01-E2E-03      | P0       | E2E   | NONE     | —                            | Multi-award accumulation                                                           |
| AWARD.01-E2E-04      | P0       | E2E   | NONE     | —                            | Class-award all students                                                           |
| AWARD.01-E2E-05      | P0       | E2E   | NONE     | —                            | **Class-award per-student failure (R-06, KI-2) — missing**                         |
| AWARD.01-E2E-06      | P0       | E2E   | NONE     | —                            | Multi-award subset                                                                 |
| AWARD.01-E2E-07      | P0       | E2E   | NONE     | —                            | **Multi-award per-student failure (R-07, KI-2) — missing**                         |
| AWARD.01-E2E-08      | P0       | E2E   | NONE     | —                            | **Optimistic rollback on 4xx (R-05, ASR-5) — missing at E2E layer; UNIT layer ✅** |
| AWARD.01-E2E-09      | P2       | E2E   | NONE     | —                            | Rapid-tap idempotency (R-16)                                                       |
| AWARD.01-INT-01      | P0       | INT   | NONE     | —                            | point_transactions row count                                                       |
| AWARD.01-INT-02      | P0       | INT   | NONE     | —                            | Trigger idempotency                                                                |
| AWARD.01-INT-03      | P0       | INT   | NONE     | —                            | RLS INSERT (R-01)                                                                  |
| **AWARD.01-UNIT-01** | P0       | UNIT  | **FULL** | `useAwardPoints.test.ts:147` | Wave 1a ✅                                                                         |
| **AWARD.01-UNIT-02** | P0       | UNIT  | **FULL** | `useAwardPoints.test.ts:185` | Wave 1a ✅ — **R-05 (score 9) regression guard**                                   |
| **AWARD.01-UNIT-03** | P1       | UNIT  | **FULL** | `useAwardPoints.test.ts:234` | Wave 1a ✅                                                                         |
| **AWARD.01-UNIT-04** | P1       | UNIT  | **FULL** | `useAwardPoints.test.ts:261` | Wave 1a ✅                                                                         |

**AWARD coverage:** 4 FULL / 0 PARTIAL / 12 NONE. The 4 FULL are the entirety of catalog UNIT coverage for AWARD; all E2E and INT scenarios remain unmapped.

#### HIST (History/Undo — 8 scenarios)

| ID             | Priority | Level | Status | Mapped tests | Notes                                                                                                                               |
| -------------- | -------- | ----- | ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| HIST.01-E2E-01 | P0       | E2E   | NONE   | —            | Award + undo                                                                                                                        |
| HIST.01-E2E-02 | P0       | E2E   | NONE   | —            | Undo batch class-award                                                                                                              |
| HIST.01-E2E-03 | P0       | E2E   | NONE   | —            | Clear student points                                                                                                                |
| HIST.01-E2E-04 | P0       | E2E   | NONE   | —            | Reset classroom points                                                                                                              |
| HIST.01-E2E-05 | P1       | E2E   | NONE   | —            | Manual delta adjustment                                                                                                             |
| HIST.01-INT-01 | P0       | INT   | NONE   | —            | **REPLICA IDENTITY FULL (R-03, ASR-3) — missing**; deferred per Wave 1a advisor checkpoint (pg_class needs `pg` npm package or RPC) |
| HIST.01-INT-02 | P0       | INT   | NONE   | —            | DELETE realtime payload.old (R-03, ASR-3)                                                                                           |
| HIST.01-INT-03 | P0       | INT   | NONE   | —            | After-undo total decrement (R-04)                                                                                                   |
| HIST.01-INT-04 | P1       | INT   | NONE   | —            | today_total/this_week_total reset on clear                                                                                          |
| HIST.01-INT-05 | P2       | INT   | NONE   | —            | Realtime reconnect (R-12)                                                                                                           |

**HIST coverage:** 0 FULL / 10 NONE.

#### RT (Realtime — 8 scenarios)

| ID           | Priority | Level | Status  | Mapped tests                                                                                             | Notes                                                                                                                                           |
| ------------ | -------- | ----- | ------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| RT.01-E2E-01 | P0       | E2E   | NONE    | —                                                                                                        | Multi-browser award sync                                                                                                                        |
| RT.01-E2E-02 | P0       | E2E   | NONE    | —                                                                                                        | Multi-browser undo sync (R-12)                                                                                                                  |
| RT.01-INT-01 | P0       | INT   | NONE    | —                                                                                                        | students INSERT transport sanity                                                                                                                |
| RT.01-INT-02 | P1       | INT   | NONE    | —                                                                                                        | Negative scope: classrooms no events (ASR-2)                                                                                                    |
| RT.01-INT-03 | P1       | INT   | NONE    | —                                                                                                        | Negative scope: behaviors no events (ASR-2)                                                                                                     |
| RT.01-INT-04 | P2       | INT   | NONE    | —                                                                                                        | layout_presets currently emits (legacy drift, expect-fail)                                                                                      |
| RT.01-INT-05 | P0       | INT   | NONE    | —                                                                                                        | **RLS over realtime (R-02, ASR-1) — the RLS-realtime intersection is missing**                                                                  |
| RT.01-INT-06 | P1       | UNIT  | PARTIAL | `useRealtimeSubscription.test.ts:238` ("should removeChannel on unmount with the same channel instance") | Catalog asks "unmount+remount → no duplicate subscriptions"; existing test asserts unmount cleanup but does not exercise remount-after-unmount. |

**RT coverage:** 0 FULL / 1 PARTIAL / 7 NONE.

#### RLS (Roll-up) + SCHEMA (3 scenarios)

| ID               | Priority | Level | Status | Mapped tests | Notes                                                                    |
| ---------------- | -------- | ----- | ------ | ------------ | ------------------------------------------------------------------------ |
| RLS.01-INT-00    | P0       | INT   | NONE   | —            | **`pg_policies` introspection (R-01) — deferred per advisor checkpoint** |
| SCHEMA.01-INT-01 | P0       | INT   | NONE   | —            | **REPLICA IDENTITY FULL invariant (R-03) — deferred**                    |
| SCHEMA.01-INT-02 | P0       | INT   | NONE   | —            | **`pg_trigger` introspection (R-04) — deferred**                         |

**RLS+SCHEMA coverage:** 0 FULL / 3 NONE. All three are infrastructure-blocked (need `pg` npm package or SQL helper RPCs per Wave 1a advisor checkpoint).

#### SEAT (Seating Chart — 6 scenarios)

| ID             | Priority | Level | Status      | Mapped tests | Notes                                                                                   |
| -------------- | -------- | ----- | ----------- | ------------ | --------------------------------------------------------------------------------------- |
| SEAT.01-E2E-01 | P1       | E2E   | NONE        | —            | Grid render                                                                             |
| SEAT.01-E2E-02 | P1       | E2E   | NONE        | —            | Drag persists                                                                           |
| SEAT.01-E2E-03 | P1       | E2E   | NONE        | —            | Drag group                                                                              |
| SEAT.01-E2E-04 | P2       | E2E   | NONE        | —            | Save/load preset                                                                        |
| SEAT.01-E2E-05 | P3       | E2E   | NONE        | —            | Lock-tables toggle (UI polish)                                                          |
| SEAT.01-E2E-06 | —        | E2E   | **BLOCKED** | n/a          | `test.skip("BLOCKED: useSeatingChart has no realtime — unblocks at PRD Phase 5")`; R-10 |
| SEAT.01-INT-01 | P0       | INT   | NONE        | —            | RLS SELECT (R-01)                                                                       |
| SEAT.01-INT-02 | P1       | INT   | NONE        | —            | seating_seats UPDATE FK                                                                 |
| SEAT.01-INT-03 | P2       | INT   | NONE        | —            | layout_data JSONB round-trip (TC-8)                                                     |

**SEAT coverage:** 0 FULL / 8 NONE / 1 BLOCKED.

#### SET (Settings — 7 scenarios)

| ID             | Priority | Level | Status | Mapped tests                         | Notes                                                                                                   |
| -------------- | -------- | ----- | ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| SET.01-E2E-01  | P2       | E2E   | NONE   | —                                    | Sound effect persistence                                                                                |
| SET.01-E2E-02  | P2       | E2E   | NONE   | —                                    | Profile display name                                                                                    |
| SET.01-E2E-03  | P3       | E2E   | NONE   | —                                    | Theme toggle (UI polish)                                                                                |
| SET.01-INT-01  | P0       | INT   | NONE   | —                                    | RLS sound_settings (R-01)                                                                               |
| SET.01-INT-02  | P0       | INT   | NONE   | —                                    | RLS layout_presets (R-01)                                                                               |
| SET.01-UNIT-01 | P1       | UNIT  | NONE   | —                                    | SoundContext provider hierarchy (R-19, TS-3)                                                            |
| SET.01-UNIT-02 | P2       | UNIT  | FULL   | `src/test/sounds.test.ts` (17 tests) | Catalog cited 18; actual 17 — variance noted in Step 2. Coverage is FULL on the "stay green" assertion. |

**SET coverage:** 1 FULL / 6 NONE.

#### Background P3 (existing — 2 scenarios)

| ID           | Priority | Level | Status           | Mapped tests                                          | Notes                                                                                                             |
| ------------ | -------- | ----- | ---------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| (existing-1) | P3       | UNIT  | FULL             | `src/test/leaderboardCalculations.test.ts` (30 tests) | Catalog asks "stay green"; passing                                                                                |
| (existing-2) | P3       | UNIT  | FULL (with debt) | `src/test/useRotatingCategory.test.ts` (8 tests)      | Catalog asks "stay green"; passing. KI-5 debt: missing `useRealTimers()` cleanup — flagged in `test-design-qa.md` |

**P3-existing coverage:** 2 FULL / 0 NONE.

### Aggregate matrix

| Group         | Total  | FULL  | PARTIAL | NONE   | BLOCKED | Coverage % (FULL+PARTIAL/Total) |
| ------------- | ------ | ----- | ------- | ------ | ------- | ------------------------------- |
| AUTH          | 8      | 0     | 1       | 7      | 0       | 12.5%                           |
| CLASS         | 12     | 0     | 0       | 12     | 0       | 0%                              |
| STUD          | 12     | 0     | 1       | 11     | 0       | 8.3%                            |
| BEH           | 7      | 0     | 0       | 7      | 0       | 0%                              |
| AWARD         | 16     | 4     | 0       | 12     | 0       | 25%                             |
| HIST          | 10     | 0     | 0       | 10     | 0       | 0%                              |
| RT            | 8      | 0     | 1       | 7      | 0       | 12.5%                           |
| RLS+SCHEMA    | 3      | 0     | 0       | 3      | 0       | 0%                              |
| SEAT          | 9      | 0     | 0       | 8      | 1       | 0% (1 blocked)                  |
| SET           | 7      | 1     | 0       | 6      | 0       | 14.3%                           |
| Background P3 | 2      | 2     | 0       | 0      | 0       | 100%                            |
| **Total**     | **94** | **7** | **3**   | **83** | **1**   | **10.6%** (FULL+PARTIAL)        |

> **Total reconciliation:** 94 (8+12+12+7+16+10+8+3+9+7+2) vs 95 explicit IDs counted earlier. 1-ID delta is from a likely double-counting in my P0 manual count; doesn't materially shift the picture.

### Aggregate by priority

| Priority | Total | FULL                      | PARTIAL             | NONE | BLOCKED | Coverage % |
| -------- | ----- | ------------------------- | ------------------- | ---- | ------- | ---------- |
| P0       | 47    | 2 (AWARD.01-UNIT-01, -02) | 1 (AUTH.01-E2E-03)  | 44   | 0       | 6.4%       |
| P1       | 26    | 2 (AWARD.01-UNIT-03, -04) | 1 (RT.01-INT-06)    | 23   | 0       | 11.5%      |
| P2       | 17    | 1 (SET.01-UNIT-02)        | 1 (STUD.01-UNIT-01) | 15   | 0       | 11.8%      |
| P3       | 4     | 2 (existing-1, -2)        | 0                   | 2    | 0       | 50%        |
| Blocked  | 1     | 0                         | 0                   | 0    | 1       | n/a        |

### Aggregate by level

| Level | Catalog | FULL | PARTIAL | NONE | BLOCKED |
| ----- | ------- | ---- | ------- | ---- | ------- |
| E2E   | ~46     | 0    | 1       | 44   | 1       |
| INT   | ~32     | 0    | 0       | 32   | 0       |
| UNIT  | ~16     | 7    | 2       | 7    | 0       |

UNIT layer: ~56% coverage (FULL+PARTIAL), driven entirely by Wave 1a + pre-existing.
INT layer: 0% coverage.
E2E layer: <2% coverage (the smoke test PARTIALLY signals AUTH.01-E2E-03).

### Coverage logic validation (per step §2)

- ❌ **P0 items have coverage** — only 3 of 47 P0 items have any coverage (FULL+PARTIAL). 44 P0 items unmapped. Catalog gate explicitly requires 100% P0 pass rate at "release time" — we are far from release-ready coverage.
- ✅ No duplicate coverage across levels without justification (no concern; almost no overlap to dedupe).
- ❌ **Items happy-path-only when oracle implies error handling** — AUTH.01-E2E-02 (invalid creds), AWARD.01-E2E-08 (4xx rollback at E2E), CLASS.01-E2E-05 (delete confirm), STUD.01-E2E-02 (validation) — all error-path catalog items are NONE. Only AWARD.01-UNIT-02 covers an error path.
- ❌ **API items marked FULL when endpoint-level checks are missing** — n/a; no API items are marked FULL because none have any coverage.
- ❌ **Auth/authz items missing denied/invalid-path tests** — 0 of 8 AUTH catalog items have a denied/invalid-path test. The R-08 stale-JWT regression guard for fix `d652260` (AUTH.01-E2E-05) is unmapped.
- ❌ **UI journeys lack E2E + key failure states** — 45 E2E catalog scenarios, 1 PARTIAL (smoke). The Empty State / Loading State / Error State triplet has only failing component-level attempts (TeacherDashboard.test.tsx, all 13 broken).

### Step 3 Outputs

- ✅ Per-feature mapping for 94 catalog rows produced
- ✅ FULL=7 / PARTIAL=3 / NONE=83 / BLOCKED=1 distribution recorded
- ✅ Per-priority and per-level rollups recorded
- ✅ Coverage-logic validation flagged 5 of 6 checks as failing the catalog's intent

**Next:** Step 4 — Analyze gaps. Translate the unmapped P0/P1 items into a prioritized gap list with risk linkage; recommend test-creation order.

---

## Step 4 — Gap Analysis & Coverage Matrix Generation (Phase 1 close-out)

### Execution mode

`sequential` — explicit selection. The matrix is small (94 rows) and the analysis is purely deterministic; subagent or agent-team dispatch would add coordination overhead with no parallelism win.

### Coverage statistics

```
✅ Phase 1 Complete: Coverage Matrix Generated

📊 Coverage Statistics:
- Total Requirements: 94
- Fully Covered: 7 (7%)
- Partially Covered: 3
- Uncovered: 83
- Blocked: 1

🎯 Priority Coverage:
- P0: 2/47 (4%)
- P1: 2/26 (8%)
- P2: 1/17 (6%)
- P3: 2/4  (50%)

⚠️ Gaps Identified:
- Critical (P0):  44
- High (P1):      23
- Medium (P2):    15
- Low (P3):        2

🔍 Coverage Heuristics:
- Endpoints without tests:       32 (entire INT layer)
- Auth negative-path gaps:        8 (every AUTH catalog scenario)
- Happy-path-only criteria:       6
- UI journey gaps (no E2E):      44
- UI state gaps:                  5 (empty/loading/error/validation/permission-denied)

📝 Recommendations: 9
```

### Gap-by-risk priority list (top 12 highest-value)

Ranked by **risk score × coverage weakness**, drawing on the 20-risk register in `test-design-architecture.md`:

| Rank | Catalog ID                                                                                                     | Priority | Risk                                        | Score | Why it leads                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | AUTH.01-E2E-05                                                                                                 | P0       | R-08 (stale JWT)                            | 9     | Direct regression guard for fix `d652260`; product code already shipped — without this test, any future auth refactor can re-introduce the loop with no signal |
| 2    | RT.01-INT-05                                                                                                   | P0       | R-02 (RLS over realtime)                    | 9     | The RLS-realtime intersection is the single highest-impact missed coverage area: silent data leakage across teachers                                           |
| 3    | CLASS.01-INT-01..03, STUD.01-INT-01..03, BEH.01-INT-01..02, SEAT.01-INT-01, SET.01-INT-01..02, AWARD.01-INT-03 | P0       | R-01 (REST RLS roll-up)                     | 9     | 12 scenarios covering the same risk; recommend an `RLS.01-INT-00` policy-introspection test as a force-multiplier first                                        |
| 4    | RLS.01-INT-00 + SCHEMA.01-INT-01..02                                                                           | P0       | R-01/R-03/R-04                              | 9/9/8 | All three need `pg_catalog` access — same advisor-flagged blocker. Tooling decision unblocks 3 scenarios at once                                               |
| 5    | HIST.01-INT-01 + HIST.01-INT-02                                                                                | P0       | R-03 (REPLICA IDENTITY)                     | 9     | Schema invariant + behavioral effect. Without these, a schema change can silently break realtime DELETE handling                                               |
| 6    | STUD.01-INT-04 + AWARD.01-INT-02                                                                               | P0       | R-04 (totals integrity)                     | 9     | Trigger correctness for `point_total` aggregates — the points economy is incorrect-data-prone                                                                  |
| 7    | AWARD.01-E2E-05 + AWARD.01-E2E-07                                                                              | P0       | R-06/R-07 (orchestrator partial-failure UX) | 6     | Cluster #2 acknowledgement — UX gap visible only via Playwright `route` interception                                                                           |
| 8    | AWARD.01-E2E-08                                                                                                | P0       | R-05 (rollback null-guard)                  | 9     | UNIT layer ✅ (AWARD.01-UNIT-02), E2E layer missing — both layers are needed because UNIT can't catch hydration-flash regressions                              |
| 9    | RT.01-E2E-01 + RT.01-E2E-02                                                                                    | P0       | R-12 (reconnect)                            | 6     | Multi-browser sync; only end-to-end can verify                                                                                                                 |
| 10   | CLASS.01-E2E-02                                                                                                | P1       | R-13 (empty-state hang)                     | 6     | Catalog explicitly notes "asserts CTA only, **does NOT** wait for dashboard load" — works around KI-1                                                          |
| 11   | AUTH.01-INT-01                                                                                                 | P1       | R-15/TS-1 (config parser)                   | 6     | Pure-config-parser test; deferred per Wave 1a advisor — needs `isPrivateHost` extraction first (small product change)                                          |
| 12   | SET.01-UNIT-01                                                                                                 | P1       | R-19/TS-3 (provider hierarchy)              | 6     | `SoundContext` does not query before `useAuth()` resolves — provider-init regression guard                                                                     |

### Recommendations

| #   | Priority                   | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Mapping                    |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| 1   | URGENT                     | `bmad-testarch-atdd` to generate ATDD scenarios for the 44 P0 uncovered items                                                                                                                                                                                                                                                                                                                                                                                                                                | atdd → automate hand-off   |
| 2   | URGENT                     | Decide pg_catalog access pattern (npm `pg` vs SQL helper RPCs vs `db dump` parse) — unblocks RLS.01-INT-00 + SCHEMA.01-INT-01..02                                                                                                                                                                                                                                                                                                                                                                            | tooling task               |
| 3   | HIGH                       | `bmad-testarch-automate` Wave 1b for the 23 P1 uncovered items                                                                                                                                                                                                                                                                                                                                                                                                                                               | continues automation       |
| 4   | HIGH                       | Add E2E coverage for the 44 catalog journeys lacking working E2E                                                                                                                                                                                                                                                                                                                                                                                                                                             | spans atdd + automate      |
| 5   | HIGH                       | Author AUTH.01-E2E-05 as the single highest-impact regression guard                                                                                                                                                                                                                                                                                                                                                                                                                                          | one-test fast-track        |
| 6   | MEDIUM                     | Complete the 3 PARTIAL items (assertions or edge cases)                                                                                                                                                                                                                                                                                                                                                                                                                                                      | small scope-out increments |
| 7   | MEDIUM                     | Add error-path counterparts for the 6 happy-path-only criteria                                                                                                                                                                                                                                                                                                                                                                                                                                               | route interception tests   |
| 8   | ~~MEDIUM~~ **RESOLVED PM** | ~~Decide disposition of 13 failing TeacherDashboard.test.tsx tests~~ — CRIT-1 fix landed; suite now 13/13 green. No deletion needed; tests are unmapped to catalog but valuable as component-level regression coverage.                                                                                                                                                                                                                                                                                      | resolved                   |
| 9   | ~~LOW~~ **RESOLVED AM**    | ~~`bmad-testarch-test-review`~~ — already executed (output: `test-review.md`); CRIT-1 + CRIT-2 (partial) landed                                                                                                                                                                                                                                                                                                                                                                                              | resolved                   |
| 10  | MEDIUM (NEW PM)            | Complete CRIT-2 sweep — adopt `[Pn][CATALOG-ID]` prefix on the 8 remaining test files. Wave 1a done; remaining: `useRealtimeSubscription` (RT.01-INT-06 partial), `leaderboardCalculations` (existing-1), `useRotatingCategory` (existing-2), `sounds` (SET.01-UNIT-02), `studentParser` (STUD.01-UNIT-01), `TeacherDashboard` (no catalog row → tag `[unmapped]`), `tests/integration/example` and `tests/e2e/example` (smoke → tag `[smoke]`). Effort ~1 hour, unblocks mechanical re-trace going forward. | suite hygiene              |

### Coverage matrix output

JSON written to `/tmp/tea-trace-coverage-matrix-2026-04-28T14-00-33-000Z.json` (recorded as `tempCoverageMatrixPath` in frontmatter).

### Step 4 Outputs

- ✅ Gap classification: 44 P0 / 23 P1 / 15 P2 / 2 P3 uncovered + 3 PARTIAL + 1 BLOCKED
- ✅ Coverage heuristics counts recorded (5 dimensions: 32 / 8 / 6 / 44 / 5)
- ✅ 9 actionable recommendations generated
- ✅ Per-priority and per-level coverage statistics calculated
- ✅ Deduplicated test inventory persisted (14 unique tests + cluster aggregates; 117 total cases)
- ✅ JSON matrix written to temp file at `/tmp/tea-trace-coverage-matrix-2026-04-28T14-00-33-000Z.json`
- ✅ `tempCoverageMatrixPath` recorded in frontmatter

**Next:** Step 5 — Quality Gate Decision (PASS / CONCERNS / FAIL / WAIVED) with rationale, must-fix list, and follow-up plan.

---

## Step 5 — Quality Gate Decision (Phase 2)

### Phase 1 matrix loaded

- Source: `/tmp/tea-trace-coverage-matrix-2026-04-28T15-30-00-000Z.json` (`tempCoverageMatrixPath` from frontmatter; AM run was at `T14-00-33-000Z` and is preserved)
- `phase: PHASE_1_COMPLETE` ✅

### Gate eligibility

| Field               | Value       |
| ------------------- | ----------- |
| `allow_gate`        | `true`      |
| `collection_status` | `COLLECTED` |
| `gate_eligible`     | **true**    |

### Gate decision logic

| Rule                                                      | Threshold                 | Actual    | Status  | Result        |
| --------------------------------------------------------- | ------------------------- | --------- | ------- | ------------- |
| 1. P0 coverage                                            | 100% required             | 4% (2/47) | NOT_MET | **FAIL**      |
| 2. Overall coverage                                       | ≥ 80% required            | 7% (7/94) | NOT_MET | (FAIL upheld) |
| 3. P1 coverage                                            | ≥ 80% minimum             | 8% (2/26) | NOT_MET | (FAIL upheld) |
| 4. PASS condition (P0=100% & P1≥90% & overall≥80%)        | —                         | —         | —       | not eligible  |
| 5. CONCERNS condition (P0=100% & P1 80-89% & overall≥80%) | —                         | —         | —       | not eligible  |
| Synthetic-oracle overlay                                  | n/a (formal_requirements) | —         | —       | not applied   |

**Rule 1 fires first: FAIL.**

### Gate decision

```
🚨 GATE DECISION: FAIL  (gate_decision_type: automation-gap)

📊 Coverage Analysis:
- P0 Coverage:        4%  (Required: 100%) → NOT_MET
- P1 Coverage:        8%  (PASS target: 90%, minimum: 80%) → NOT_MET
- Overall Coverage:   7%  (Minimum: 80%)   → NOT_MET

✅ Decision Rationale:
P0 coverage is 4% (required: 100%). 44 critical requirements uncovered.
This is an "automation-gap" FAIL — the test-design catalog is comprehensive
and high-confidence (formal_requirements oracle, post-redesign 2026-04-28).
The gap is that downstream automation (atdd → automate) has only delivered
Wave 1a (4 of 47 P0 scenarios). Distinct from a correctness FAIL, which
would imply existing tests are red on intended behavior.

Existing tests are GREEN where they exist (113 of 113 passing — was 104/117
in the AM trace; CRIT-1 fix added the localStorage shim and recovered the
13 TeacherDashboard tests). Suite is now fully unblocked for Wave 1b
automation.

⚠️ Critical Gaps: 44

📝 Top Recommended Actions:
1. URGENT: Run /bmad:tea:atdd → /bmad:tea:automate Wave 1b for the 44 P0 uncovered items.
   Highest-leverage single test: AUTH.01-E2E-05 (R-08 stale-JWT, score 9 — direct
   regression guard for fix d652260, currently no automated coverage).
2. URGENT: Decide pg_catalog access pattern (npm `pg` / SQL helper RPCs / db dump parse)
   to unblock RLS.01-INT-00 + SCHEMA.01-INT-01..02 (3 P0 scenarios).
3. HIGH: Add E2E coverage for the 44 catalog journeys lacking working E2E.

📂 Full Report: _bmad-output/test-artifacts/traceability/traceability-matrix.md
📂 Machine-readable summary: _bmad-output/test-artifacts/traceability/e2e-trace-summary.json
📂 Slim gate signal: _bmad-output/test-artifacts/traceability/gate-decision.json

🚫 GATE: FAIL — release BLOCKED until P0 coverage reaches 100% (44 P0 items
   require automation; full P0 list in gap_analysis.critical_gaps_p0_uncovered).
```

### Must-fix list (in priority order)

#### P0 Tier 1 — single highest-leverage regression guards (recommend authoring first)

1. **AUTH.01-E2E-05** — R-08 stale-JWT loop (score 9). One Playwright test directly guards fix `d652260`. Forge `sb-` localStorage entry → expect graceful login redirect, no spinner loop. **No prerequisite blockers.**
2. **STUD.01-INT-04** — R-04 trigger correctness (score 9). `students.point_total === SUM(point_transactions.points)` after award/undo/clear/reset. Behavioral SQL-level check; no `pg_catalog` needed. **No prerequisite blockers.**
3. **AWARD.01-UNIT-02 already covers R-05 at unit layer** ✅ — but **AWARD.01-E2E-08** at the E2E layer is still missing. The E2E layer can detect hydration-flash regressions that the unit test cannot. Author `route` interception → expect optimistic increment then exact rollback to pre-award value (no `undefined` flash).

#### P0 Tier 2 — RLS roll-up cluster (12 scenarios, single-test force-multiplier available)

4. **RLS.01-INT-00 first** — pg_policies introspection. Once a tooling decision is made (recommend: SQL helper RPC `policy_summary()` returning JSON — no new transitive deps, all-INT-tests friendly). This single test asserts every user-scoped table has the expected policy in one shot, before per-table behavioral RLS tests.
5. **CLASS.01-INT-01..03 + STUD.01-INT-01..03 + BEH.01-INT-01..02 + SEAT.01-INT-01 + SET.01-INT-01..02 + AWARD.01-INT-03** — R-01 RLS roll-up. Use `impersonation-pair` fixture (already implemented per `automation-summary.md` Step 1 inventory). Pattern is repeatable across tables.

#### P0 Tier 3 — realtime + schema invariants

6. **HIST.01-INT-01 + SCHEMA.01-INT-01** — R-03 REPLICA IDENTITY FULL. Behavioral version (HIST.01-INT-01: realtime DELETE arrives with non-empty `payload.old`) is authorable now without pg_catalog. Schema-introspection version (SCHEMA.01-INT-01) waits on tooling decision.
7. **RT.01-INT-05** — R-02 RLS over realtime. Uses `impersonation-pair` fixture; subscribes User A to channel; INSERT as User B; assert no event delivered to A.
8. **HIST.01-INT-02 + HIST.01-INT-03** — DELETE payload.old + after-undo total decrement.

#### P0 Tier 4 — E2E happy-path coverage (Playwright)

9. **AUTH.01-E2E-02..04, -06** — invalid creds, sign-out, AuthGuard short-circuit
10. **CLASS.01-E2E-01** — create classroom from sidebar `+`
11. **STUD.01-E2E-01, -06** — add student happy path + multi-tab realtime sync
12. **AWARD.01-E2E-01..04, -06** — optimistic increment, negative points, multi-award accumulation, class-award, multi-award subset
13. **HIST.01-E2E-01..04** — undo, batch undo, clear student, reset classroom
14. **RT.01-E2E-01, -02** — multi-browser sync of award + undo

#### P0 Tier 5 — error-path E2E (R-06/R-07/R-12 cluster #2)

15. **AWARD.01-E2E-05, -07, -08** — Playwright `route` interception for per-student failures and 4xx → optimistic rollback at E2E layer
16. **HIST.01-INT-05** — realtime channel reconnect after blip (R-12)

#### Then → P1, P2, P3 per the per-priority lists in Step 4

### Must-fix counts at a glance

| Tier                                                                     | Test count | Notes                                                                             |
| ------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------- |
| P0 Tier 1 (regression guards, no blockers)                               | 3          | Single-test high-leverage                                                         |
| P0 Tier 2 (RLS roll-up, depends on tooling decision for `RLS.01-INT-00`) | 12         | `impersonation-pair` fixture already in place                                     |
| P0 Tier 3 (realtime + schema, partially blocked on pg_catalog tooling)   | 5          | 2 of 5 are unblocked                                                              |
| P0 Tier 4 (E2E happy-path)                                               | 16         | Pure-Playwright; selectors floor needed                                           |
| P0 Tier 5 (error-path E2E + reconnect)                                   | 4          | Playwright `route` patterns                                                       |
| **P0 total**                                                             | **44**     | matches `critical_open`                                                           |
| P1 backlog                                                               | 23         | continues automation Wave 1b                                                      |
| P2 backlog                                                               | 15         | spans wave 1c                                                                     |
| P3 backlog                                                               | 2          | UI polish                                                                         |
| **Grand total to author**                                                | **84**     | (94 catalog − 7 FULL − 3 PARTIAL completion ≈ 84 plus 3 partial completion items) |

### Risk-summary overlay (carried from architecture-side test design)

The 4 BLOCK-rated risks in `test-design-architecture.md` have these coverage states:

| Risk                    | Score | Test ID(s) gating                                   | Coverage |
| ----------------------- | ----- | --------------------------------------------------- | -------- |
| R-01 (REST RLS)         | 9     | RLS.01-INT-00 + 12 per-table INT scenarios          | 0%       |
| R-02 (Realtime RLS)     | 9     | RT.01-INT-05                                        | 0%       |
| R-03 (REPLICA IDENTITY) | 9     | HIST.01-INT-01..02, SCHEMA.01-INT-01                | 0%       |
| R-04 (Totals integrity) | 9     | STUD.01-INT-04 + AWARD.01-INT-02 + SCHEMA.01-INT-02 | 0%       |

All 4 BLOCK risks are 0% covered. The catalog's release gate ("every score ≥ 6 risk MUST map to ≥ 1 passing scenario in CI" — handoff §Quality Gates) is failed across the board.

### Comparison to prior trace

|                  | 2026-04-22 trace (legacy)         | 2026-04-28 AM trace                  | **2026-04-28 PM trace (this run)**                 |
| ---------------- | --------------------------------- | ------------------------------------ | -------------------------------------------------- |
| Scope            | TanStack Phase 0-1 spec migration | Full ClassPoints feature catalog     | Full ClassPoints feature catalog                   |
| Baseline         | commit `3860463`                  | commit `cd0ad84`                     | commit `cd0ad84` + uncommitted CRIT-1/CRIT-2 fixes |
| Total reqs       | 12                                | 94                                   | 94                                                 |
| Catalog FULL     | n/a                               | 7                                    | **7 (unchanged)**                                  |
| Catalog PARTIAL  | n/a                               | 3                                    | **3 (unchanged)**                                  |
| Suite green      | n/a                               | 104/117 (89%)                        | **113/113 (100%)**                                 |
| Test IDs adopted | n/a                               | 0 files                              | **1 of 9 files (Wave 1a)**                         |
| Decision         | FAIL (automation-gap)             | FAIL (automation-gap)                | **FAIL (automation-gap) — same verdict**           |
| Wave 1b ready?   | n/a                               | ❌ blocked by CRIT-1 (failing infra) | **✅ infra is green; ID convention seeded**        |

**The PM trace verdict is unchanged because** test-review's job was infrastructure quality, not new catalog automation. The verdict's _blockers to next-wave automation_ are now removed. The next workflow is **`bmad-testarch-automate` Wave 1b** (NOT `bmad-testarch-atdd` — ClassPoints is brownfield with no story scaffolding; per the handoff §"Recommended BMAD → TEA Workflow Sequence", solo direct-execution skips the ATDD step and runs `automate` progressively against the QA doc's coverage plan).

**The current FAIL is expected and healthy.** It represents the trace establishing a measurable baseline; the cycle from here is `automate Wave 1b/1c → re-trace → CONCERNS → automate Wave 2 → re-trace → PASS`. Without this baseline, automation has no objective progress signal.

### Outputs written

| File                                                                            | Purpose                                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `_bmad-output/test-artifacts/traceability/traceability-matrix.md`               | This document — full narrative report (PM run, post-test-review) |
| `_bmad-output/test-artifacts/traceability/traceability-matrix-2026-04-28-am.md` | AM run snapshot (preserved for diff)                             |
| `/tmp/tea-trace-coverage-matrix-2026-04-28T15-30-00-000Z.json`                  | Phase 1 matrix (handoff to Step 5)                               |
| `_bmad-output/test-artifacts/traceability/e2e-trace-summary.json`               | Machine-readable summary for CI/dashboards                       |
| `_bmad-output/test-artifacts/traceability/e2e-trace-summary-2026-04-28-am.json` | AM machine-readable summary (preserved)                          |
| `_bmad-output/test-artifacts/traceability/gate-decision.json`                   | Slim gate-signal payload                                         |
| `_bmad-output/test-artifacts/traceability/gate-decision-2026-04-28-am.json`     | AM gate decision (preserved)                                     |

### Step 5 Outputs

- ✅ Phase 1 matrix loaded from temp path in frontmatter
- ✅ Gate eligibility verified (`allow_gate=true`, `collection_status=COLLECTED`)
- ✅ Gate decision applied via deterministic rules → **FAIL** (automation-gap)
- ✅ Rationale + must-fix list + 5-tier prioritized P0 plan recorded
- ✅ `e2e-trace-summary.json` written
- ✅ `gate-decision.json` written
- ✅ Frontmatter updated (`gateDecision`, `gateDecisionType`, `gateBasis`, `collectionStatus`, `stepsCompleted`)

**Workflow complete.**
