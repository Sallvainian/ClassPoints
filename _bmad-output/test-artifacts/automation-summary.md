---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-identify-targets',
    'step-03-generate-tests',
    'step-03c-aggregate',
    'step-04-validate-and-summarize',
  ]
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-04-29'
projectName: 'ClassPoints'
sourceWorkflow: 'bmad-testarch-automate'
mode: 'BMad-Integrated'
detectedStack: 'fullstack'
inputDocuments:
  - _bmad/tea/config.yaml
  - package.json
  - playwright.config.ts
  - vitest.config.ts
  - vitest.integration.config.ts
  - tests/README.md
  - tests/support/fixtures/index.ts
  - _bmad-output/test-artifacts/test-design/classpoints-handoff.md
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
  - _bmad-output/test-artifacts/test-design-progress.md
  - _bmad-output/test-artifacts/test-review.md
  - _bmad-output/test-artifacts/known-failures.md
  - _bmad-output/test-artifacts/traceability/traceability-matrix.md
  - _bmad-output/project-context.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/data-factories.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/test-quality.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/overview.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/api-request.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/auth-session.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/intercept-network-call.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/recurse.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/log.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/file-utils.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/burn-in.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/network-error-monitor.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/fixtures-composition.md
  - .agents/skills/bmad-testarch-automate/resources/knowledge/playwright-cli.md
  - tests/e2e/example.spec.ts
  - tests/e2e/auth.setup.ts
  - tests/e2e/global-setup.ts
  - tests/integration/example.test.ts
  - tests/support/fixtures/factories/user.factory.ts
  - tests/support/helpers/supabase-admin.ts
  - tests/support/helpers/impersonation.ts
  - tests/support/helpers/auth.ts
  - tests/support/helpers/unique.ts
---

# ClassPoints — Test Automation Expansion Summary

## Step 1: Preflight & Context — 2026-04-29 Create Run

### Stack & Framework Verification

- **Configured stack:** `fullstack` from `_bmad/tea/config.yaml`.
- **Frontend test framework present:** `playwright.config.ts`, `@playwright/test`, Chromium-only projects, setup project, storageState reuse, and fail-closed `.env.test` private-host guard.
- **Unit/component framework present:** `vitest.config.ts`, jsdom, Testing Library, and `src/test/setup.ts`.
- **Backend/integration framework present:** `vitest.integration.config.ts`, `tests/integration/`, local-Supabase private-host guard, and service-role helper infrastructure.
- **Result:** framework verification passes. No need to run the framework setup workflow.

### Execution Mode

- **Mode:** BMad-Integrated.
- **Reason:** current BMAD artifacts exist and are recent: PRD, architecture, QA test design, handoff, traceability matrix, test review, known failures, and existing automation summary.
- **No story file found:** no `story` / `stories` / acceptance-criteria files were present under `_bmad-output`; the test-design catalog remains the acceptance oracle.

### Existing Test Inventory Loaded

| Area           | Files / state                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/component | `src/hooks/__tests__/useAwardPoints.test.ts`, `useRealtimeSubscription.test.ts`, `src/test/*.test.{ts,tsx}`, `src/utils/__tests__/studentParser.test.ts` |
| Integration    | `tests/integration/example.test.ts` plus local Supabase helpers                                                                                          |
| E2E            | `tests/e2e/auth.setup.ts`, `example.spec.ts`, global setup/teardown                                                                                      |
| Fixtures       | `tests/support/fixtures/index.ts` merges `logTest`, `apiRequestTest`, `recurseTest`, and `userFactory`                                                   |
| Helper state   | `createImpersonationPair()`, `uniqueSlug()`, `supabaseAdmin()`, `loginViaUi()` available                                                                 |

### Knowledge Loaded

- **Core workflow fragments:** `test-levels-framework`, `test-priorities-matrix`, `data-factories`, `selective-testing`, `ci-burn-in`, `test-quality`.
- **Playwright Utils profile:** Full UI+API, because browser tests use `page.goto` / `page.locator`.
- **Playwright Utils fragments:** `overview`, `api-request`, `network-recorder`, `auth-session`, `intercept-network-call`, `recurse`, `log`, `file-utils`, `burn-in`, `network-error-monitor`, `fixtures-composition`.
- **Browser automation fragment:** `playwright-cli`, because `tea_browser_automation` is `auto`.
- **Skipped:** Pact.js / Pact MCP / contract-testing fragments. No Pact dependency, pact directory, pact URLs, or broker env references were found.

### Configuration Flags

| Flag                       | Value       | Effect                                      |
| -------------------------- | ----------- | ------------------------------------------- |
| `tea_use_playwright_utils` | `true`      | Full UI+API profile selected                |
| `tea_use_pactjs_utils`     | `false`     | Pact utils skipped                          |
| `tea_pact_mcp`             | `none`      | Pact MCP skipped                            |
| `tea_browser_automation`   | `auto`      | Playwright CLI knowledge loaded             |
| `test_stack_type`          | `fullstack` | Explicit override; no auto-detection needed |
| `risk_threshold`           | `p1`        | P0 + P1 are the practical gate focus        |

### Context Carried Forward

- The current formal catalog is the post-redesign test design: about 93 scenarios across UNIT / INT / E2E, with critical risks R-01, R-02, R-03, and R-05.
- Previous automation work already authored `AWARD.01-UNIT-01..04` in `src/hooks/__tests__/useAwardPoints.test.ts`.
- Existing traceability still reports an automation-gap gate, even after the Wave 1a unit tests.
- The next target selection should avoid duplicating the completed AWARD unit coverage and should prefer the remaining P0/P1 gaps, especially integration and E2E coverage around RLS, realtime DELETE invariants, trigger totals, and stale-JWT behavior.
- The worktree is already dirty with many BMAD/test-scaffold changes from earlier work. This workflow must preserve those changes and only edit files required by the selected automation targets.

### Step 1 Output

- Stack detected and verified: `fullstack`.
- Execution mode selected: BMad-Integrated.
- Artifacts and knowledge fragments loaded.
- Progress saved to `_bmad-output/test-artifacts/automation-summary.md`.

---

## Step 2: Identify Automation Targets — 2026-04-29 Create Run

### Browser Exploration

Required browser exploration was completed with Playwright CLI:

```bash
playwright-cli -s=tea-automate open http://localhost:5173/ClassPoints/
playwright-cli -s=tea-automate snapshot
playwright-cli -s=tea-automate close
```

Observed first-viewport structure:

- Public unauthenticated page at `/ClassPoints/`.
- Sign-in form with `Email`, `Password`, and `Sign in` controls.
- Secondary controls: `Forgot your password?` and `Create an account`.
- Sidebar copy and marketing text are present before auth.
- Query devtools button appears in the dev build only.

Target impact:

- `AUTH.01-E2E-01` is already observable from the login page.
- `AUTH.01-E2E-05` can assert a forged/stale session degrades back to this login surface with no spinner loop.

### Source & API Analysis

- No OpenAPI/Swagger/Pact/route-controller files exist. The app's backend boundary is Supabase Auth, PostgREST tables, Realtime channels, and the `get_student_time_totals` RPC.
- RLS policy surface is in SQL migrations:
  - Core tables: `classrooms`, `students`, `behaviors`, `point_transactions` in `002_add_user_auth.sql`.
  - Sound settings: `user_sound_settings` in `007_add_sound_settings.sql`.
  - Seating/layout tables: `seating_charts`, `seating_groups`, `seating_seats`, `room_elements`, `layout_presets` in `008_add_seating_charts.sql`.
- Realtime publication drift exists in migrations (`classrooms`, `behaviors`, `user_sound_settings` are published), but client-side target subscriptions remain limited by ADR-005. Tests in this pass avoid treating publication membership alone as the app contract.
- Trigger total behavior is testable through PostgREST effects: `011_add_student_point_totals.sql` updates `students.point_total`, `positive_total`, and `negative_total` on `point_transactions` insert/delete.
- `REPLICA IDENTITY FULL` is declared for `point_transactions` in `005_replica_identity_full.sql`; the load-bearing behavior is that realtime DELETE payloads include enough `payload.old` data to update totals without a refetch.
- Existing helper infrastructure supports real local-stack integration tests:
  - `supabaseAdmin()` for service-role setup/cleanup.
  - `createImpersonationPair()` for two signed-in anon-key clients.
  - `uniqueSlug()` for parallel-safe row names.
  - `UserFactory` cleanup cascades through owned rows.

### Duplicate Coverage Check

- No separate ATDD output files were found.
- Explicit implemented catalog IDs in source are only `AWARD.01-UNIT-01..04` in `src/hooks/__tests__/useAwardPoints.test.ts`.
- Existing integration and E2E files are smoke/sample tests and do not satisfy catalog scenarios.
- Pre-existing unit clusters (`studentParser`, `sounds`, `useRealtimeSubscription`, `leaderboardCalculations`) remain background coverage and should not be duplicated in this slice.

### Selected Wave 1b Targets

Risk-weighted selective scope: remaining unblocked P0 scenarios that can be automated without product-code refactors or `pg_catalog` introspection decisions.

| Test ID           | Scenario                                                                               | Level | Priority | Risk         | Destination                                                   |
| ----------------- | -------------------------------------------------------------------------------------- | ----- | -------- | ------------ | ------------------------------------------------------------- |
| `CLASS.01-INT-01` | User A cannot SELECT User B's classrooms via PostgREST                                 | INT   | P0       | R-01 / ASR-1 | `tests/integration/rls/classrooms.test.ts`                    |
| `CLASS.01-INT-02` | User A cannot UPDATE/DELETE User B's classroom                                         | INT   | P0       | R-01 / ASR-1 | `tests/integration/rls/classrooms.test.ts`                    |
| `CLASS.01-INT-03` | Anonymous client cannot SELECT any classroom                                           | INT   | P0       | R-01 / ASR-1 | `tests/integration/rls/classrooms.test.ts`                    |
| `STUD.01-INT-04`  | Student lifetime totals match `point_transactions` effects after award/delete sequence | INT   | P0       | R-04 / ASR-4 | `tests/integration/schema/student-totals.test.ts`             |
| `HIST.01-INT-02`  | DELETE on `point_transactions` emits realtime `payload.old` with row data              | INT   | P0       | R-03 / ASR-3 | `tests/integration/realtime/point-transaction-delete.test.ts` |
| `AUTH.01-E2E-05`  | Forged stale JWT refresh degrades to login, no spinner loop                            | E2E   | P0       | R-08 / ASR-8 | `tests/e2e/auth.spec.ts`                                      |

Support target:

| Artifact           | Purpose                                                                                          | Destination                                             |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `ClassroomFactory` | Parallel-safe classroom setup/cleanup for RLS and future classroom/student integration scenarios | `tests/support/fixtures/factories/classroom.factory.ts` |

### Test Level Choices

- **Integration tests** cover RLS, trigger totals, and realtime payload integrity because the behavior depends on Supabase policies/triggers/realtime, not isolated React code.
- **E2E** covers stale-JWT recovery because the defect is user-visible boot behavior across localStorage, Supabase auth hydration, `AuthContext`, and `AuthGuard`.
- **No new unit tests** in this pass. The highest-value unit slice (`AWARD.01-UNIT-01..04`) already exists.

### Deferred Targets

| Deferred                                                | Reason                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SCHEMA.01-INT-01`, `SCHEMA.01-INT-02`, `RLS.01-INT-00` | Require a schema-introspection decision: `pg` package, SQL helper RPCs, or parsing `supabase db dump`. Do not block this behavioral slice.                   |
| `AUTH.01-INT-01`                                        | Requires extracting duplicated private-host allow-list logic from `playwright.config.ts` / `vitest.integration.config.ts` to a shared module before testing. |
| `RT.01-INT-05`                                          | RLS-over-realtime channel timing is reserved for slower/nightly cadence per test design.                                                                     |
| `AWARD.01-E2E-05`, `AWARD.01-E2E-07`                    | Blocked on cluster #2 partial-failure UX fix; current app still silently filters failures.                                                                   |
| `SEAT.01-E2E-06`                                        | Blocked on PRD Phase 5 seating-chart realtime migration.                                                                                                     |

### Coverage Scope Justification

This is a **critical-path selective** slice. It avoids duplicate unit coverage and avoids infrastructure decisions that would force product-code refactors before tests can exist. The chosen targets advance three score-9/score-6 risk areas that are still not automated:

- R-01 REST RLS isolation.
- R-03 realtime DELETE payload integrity.
- R-04 trigger-maintained point totals.
- R-08 stale-JWT graceful degrade.

### Step 2 Output

- Target set selected: 6 P0 scenarios + 1 support factory.
- Test levels assigned: 5 integration, 1 E2E.
- Duplicates avoided: `AWARD.01-UNIT-01..04` excluded as already implemented.
- Progress saved to `_bmad-output/test-artifacts/automation-summary.md`.

---

## Step 3C: Aggregate Test Generation Results — 2026-04-29 Create Run

### Execution Mode

- **Requested:** `auto`
- **Probe enabled:** `true`
- **Resolved:** `sequential`
- **Reason:** subagents/agent teams were not explicitly requested by the user in this run, so worker steps were executed locally and sequentially while preserving the temp-output contract.
- **Timestamp:** `2026-04-29T03-40-11-406Z`

### Worker Outputs

| Worker  | Temp output                                                     | Result                                                               |
| ------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| API     | `/tmp/tea-automate-api-tests-2026-04-29T03-40-11-406Z.json`     | success; 0 tests because no conventional REST endpoints are in scope |
| E2E     | `/tmp/tea-automate-e2e-tests-2026-04-29T03-40-11-406Z.json`     | success; 1 P0 test                                                   |
| Backend | `/tmp/tea-automate-backend-tests-2026-04-29T03-40-11-406Z.json` | success; 5 P0 tests                                                  |

### Generated Files

| File                                                          | Coverage                                      |
| ------------------------------------------------------------- | --------------------------------------------- |
| `tests/support/fixtures/factories/classroom.factory.ts`       | Shared `ClassroomFactory` with cleanup ledger |
| `tests/integration/rls/classrooms.test.ts`                    | `CLASS.01-INT-01..03`                         |
| `tests/integration/schema/student-totals.test.ts`             | `STUD.01-INT-04`                              |
| `tests/integration/realtime/point-transaction-delete.test.ts` | `HIST.01-INT-02`                              |
| `tests/e2e/auth.spec.ts`                                      | `AUTH.01-E2E-05`                              |

### Summary

| Metric                    | Count |
| ------------------------- | ----: |
| Total generated tests     |     6 |
| API tests                 |     0 |
| Integration/backend tests |     5 |
| E2E tests                 |     1 |
| New support fixtures      |     1 |
| P0 coverage               |     6 |
| P1/P2/P3 coverage         |     0 |

### Notes Carried to Validation

- `authenticatedStorageState` already exists via Playwright setup project; only `ClassroomFactory` was created.
- The realtime DELETE test uses a bounded timeout guard for event failure, not an arbitrary wait.
- The E2E stale-session test mutates the existing Supabase `sb-*-auth-token` localStorage entry and asserts return to login plus auth-key purge.
- Validation must include formatting before test execution because these are newly generated TypeScript files.

---

## Step 4: Validate & Summarize — 2026-04-29 Create Run

### Formatting & Static Validation

```bash
npx prettier --write \
  tests/support/fixtures/factories/classroom.factory.ts \
  tests/integration/rls/classrooms.test.ts \
  tests/integration/schema/student-totals.test.ts \
  tests/integration/realtime/point-transaction-delete.test.ts \
  tests/e2e/auth.spec.ts \
  _bmad-output/test-artifacts/automation-summary.md

npx prettier --check \
  tests/support/fixtures/factories/classroom.factory.ts \
  tests/integration/rls/classrooms.test.ts \
  tests/integration/schema/student-totals.test.ts \
  tests/integration/realtime/point-transaction-delete.test.ts \
  tests/e2e/auth.spec.ts
# PASS: all matched files use Prettier code style

npx tsc -p tests/tsconfig.json --noEmit
# PASS

npx eslint \
  src/hooks/__tests__/useStudents.test.ts \
  tests/support/fixtures/factories/classroom.factory.ts \
  tests/support/helpers/unique.ts \
  tests/integration/rls/classrooms.test.ts \
  tests/integration/schema/student-totals.test.ts \
  tests/integration/realtime/point-transaction-delete.test.ts \
  tests/e2e/auth.spec.ts
# PASS
```

### Integration Validation

```bash
npm run test:integration -- \
  tests/integration/rls/classrooms.test.ts \
  tests/integration/schema/student-totals.test.ts \
  tests/integration/realtime/point-transaction-delete.test.ts \
  --reporter=verbose
```

Result:

| File                                                          | Tests | Result |
| ------------------------------------------------------------- | ----: | ------ |
| `tests/integration/rls/classrooms.test.ts`                    |     3 | PASS   |
| `tests/integration/schema/student-totals.test.ts`             |     1 | PASS   |
| `tests/integration/realtime/point-transaction-delete.test.ts` |     1 | PASS   |

R-03 follow-up resolution:

```text
PG catalog verification:
point_transactions|f
students|f
```

The active local database has `REPLICA IDENTITY FULL` applied. The test contract was corrected to match Supabase Realtime under RLS: DELETE payloads must be non-empty and identify the deleted transaction via `payload.old.id`; full old-row fields are asserted only when present because RLS can filter them down to primary-key-only fields.

Companion unit coverage was added for the product behavior: `src/hooks/__tests__/useStudents.test.ts` proves `useStudents` invalidates the classroom students query when a `point_transactions` DELETE payload is primary-key-only or missing `created_at`, and locally decrements totals only when the required row fields are present.

The targeted integration set now passes:

```text
Test Files  3 passed (3)
Tests       5 passed (5)
```

### E2E Validation

Initial sandboxed run failed because Playwright could not bind the Vite web server to `0.0.0.0:5173` (`listen EPERM`). Rerunning with approved local-server permissions passed:

```bash
npm run test:e2e -- tests/e2e/auth.spec.ts

Running 2 tests using 1 worker
  PASS [setup] tests/e2e/auth.setup.ts: authenticate
  PASS [chromium] tests/e2e/auth.spec.ts:
       [P0][AUTH.01-E2E-05] stale cached session returns to login without a spinner loop
```

### Generated Coverage Status

| Test ID           | File                                                          | Result |
| ----------------- | ------------------------------------------------------------- | ------ |
| `CLASS.01-INT-01` | `tests/integration/rls/classrooms.test.ts`                    | PASS   |
| `CLASS.01-INT-02` | `tests/integration/rls/classrooms.test.ts`                    | PASS   |
| `CLASS.01-INT-03` | `tests/integration/rls/classrooms.test.ts`                    | PASS   |
| `STUD.01-INT-04`  | `tests/integration/schema/student-totals.test.ts`             | PASS   |
| `HIST.01-INT-02`  | `tests/integration/realtime/point-transaction-delete.test.ts` | PASS   |
| `AUTH.01-E2E-05`  | `tests/e2e/auth.spec.ts`                                      | PASS   |

### Files Created / Updated

Created:

- `tests/support/fixtures/factories/classroom.factory.ts`
- `src/hooks/__tests__/useStudents.test.ts`
- `tests/integration/rls/classrooms.test.ts`
- `tests/integration/schema/student-totals.test.ts`
- `tests/integration/realtime/point-transaction-delete.test.ts`
- `tests/e2e/auth.spec.ts`

Updated:

- `_bmad-output/test-artifacts/automation-summary.md`
- `tests/support/helpers/unique.ts`

### Open Risks

1. **Schema introspection tests remain deferred.** `SCHEMA.01-INT-01`, `SCHEMA.01-INT-02`, and `RLS.01-INT-00` still need a tooling decision (`pg`, SQL helper RPCs, or `supabase db dump` parsing).
2. **Cluster #2 partial-failure E2Es remain blocked.** The current app still silently filters per-student award failures.

### Next Recommended Workflow

1. Run `bmad-testarch-test-review` on the new and corrected test files.
2. Run `bmad-testarch-trace` after review to refresh traceability and gate status.

---

## Step 1: Preflight & Context

### Stack & Framework Verification

- **Stack type:** `fullstack` (from `_bmad/tea/config.yaml`, overrides auto-detection).
- **Frontend frameworks present:**
  - `playwright.config.ts` (E2E, Chromium, security-guarded against non-private hosts).
  - `vitest.config.ts` (Vitest 4 + jsdom for `src/**/*.test.{ts,tsx}` unit tests).
- **Backend frameworks present:**
  - `vitest.integration.config.ts` (Vitest 4 + node for `tests/integration/**/*.{test,spec}.ts`).
- **Result:** verification PASSES. No framework gaps.

### Execution Mode

- **BMad-Integrated.** Test-design artifacts exist:
  - `_bmad-output/test-artifacts/test-design/classpoints-handoff.md` (handoff, 2026-04-28).
  - `test-design-architecture.md`, `test-design-qa.md`, `test-design-progress.md` (full bundle, 2026-04-28).
- 93 scenarios catalogued (16 UNIT / 32 INT / 45 E2E), 20 risks scored (4 BLOCK + 7 MITIGATE).

### Existing Test Infrastructure (verified in source)

| Surface            | Path                                                 | State                                                                                           |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| E2E config         | `playwright.config.ts`                               | setup-project + storageState chain; `.env.test` force-override; private-host allow-list         |
| Integration config | `vitest.integration.config.ts`                       | Same security guard; node env; 30s/60s timeouts                                                 |
| Unit config        | `vitest.config.ts`                                   | jsdom; existing unit tests under `src/**/*.test.{ts,tsx}` continue to apply                     |
| Fixture root       | `tests/support/fixtures/index.ts`                    | `mergeTests(logTest, apiRequestTest, recurseTest)` + `userFactory`                              |
| Factories          | `tests/support/fixtures/factories/`                  | `user.factory.ts` and `classroom.factory.ts`; Student / Behavior / Transaction not yet authored |
| Auth helpers       | `tests/support/helpers/auth.ts`, `supabase-admin.ts` | `loginViaUi()`, cached `supabaseAdmin()` service-role                                           |
| Impersonation      | `tests/support/helpers/impersonation.ts`             | `createImpersonationPair()` — pair of anon-key clients for two distinct seeded users            |
| Unique-data        | `tests/support/helpers/unique.ts`                    | `uniqueSlug()` — Date.now() + per-process salt + counter, parallel-safe                         |
| E2E samples        | `tests/e2e/example.spec.ts`                          | Bootstrap smoke + userFactory lifecycle sample                                                  |
| INT samples        | `tests/integration/example.test.ts`                  | listUsers + classrooms select smoke                                                             |
| Page objects       | `tests/support/page-objects/`                        | Empty (POM available but unused)                                                                |

### Knowledge Fragments

Core TEA fragments (`risk-governance`, `probability-impact`, `test-levels-framework`, `test-priorities-matrix`, `test-quality`) were absorbed during test-design. Additional fragments referenced for automation expansion:

- **`data-factories`** — overrides + cleanup tracking + parallel-safety patterns. Direct application: scaffolding `ClassroomFactory`, `StudentFactory`, `BehaviorFactory`, `TransactionFactory`.
- **`selective-testing`** — tag/grep usage for P0/P1/P2/P3 promotion gates and CI shard orchestration.
- **`ci-burn-in`** — re-run loops for the existing E2E burn-in job in `.github/workflows/test.yml`.
- **`recurse`** — polling helper already merged; canonical pattern for realtime eventual-consistency assertions (cross-tab sync, undo propagation).
- **`intercept-network-call`** + **`network-first`** — intercept-before-navigate for failure-injection scenarios (R-08 stale-JWT graceful degrade tests).
- **`fixtures-composition`** — `mergeTests` extension pattern for adding factory and impersonation fixtures.
- **`selector-resilience`** — guides the `data-testid` placements listed in the handoff.
- **`error-handling`** — `if (error) throw error` (preserve `.code`) vs `throw new Error(error.message)` consequences in mutation hooks.

### Configuration Flags Loaded

- `tea_use_playwright_utils`: **true** → full UI+API profile selected (browser tests detected).
- `tea_use_pactjs_utils`: false (no microservices architecture; ClassPoints is a single-tenant SPA + Supabase).
- `tea_pact_mcp`: `none`.
- `tea_browser_automation`: `auto`.
- `tea_capability_probe`: true.
- `risk_threshold`: `p1` (P0 + P1 are the gating release criteria).

### Decision Outputs Carried Forward

- **Effort priority** (handoff §"Recommended BMAD → TEA Workflow Sequence" + Open Items): expand P0 score-9 BLOCK risks first (R-01 RLS REST, R-02 RLS realtime, R-03 REPLICA IDENTITY, R-05 onMutate idempotency / rollback null-guard), then score-6 P1 mitigations.
- **Drag-along blockers acknowledged:** R-06/R-07 (cluster #2 partial-failure UX) need code-fix to land before tests pass; R-10 (SEAT.01-E2E-06) is `test.skip` until PRD Phase 5.
- **`data-testid` rollout:** non-blocking but required for stable AwardPoints / ClassAward / MultiAward / Undo / SeatingChartEditor selectors. Authored per-scenario as the test that needs them.

## Next: Step 2 — Identify Targets

Determine the concrete scenarios to author next pass. Inputs: the 93-scenario catalog from `test-design-qa.md`, the risk-mapping table in the handoff, and the existing 0-scenario E2E coverage gap (only `example.spec.ts` smoke + `userFactory` sample exist).

---

## Step 2: Identify Automation Targets

### Path & Mode

- **Mode:** post-implementation expansion (BMad-Integrated). User invoked `bmad-testarch-automate` directly without an intervening `bmad-testarch-atdd` red-phase. The implementation is at HEAD `d652260`; rollback null-guard, stale-JWT graceful-degrade, and `REPLICA IDENTITY FULL` are all already shipped. Tests authored in Wave 1 are **regression guards for already-passing code**, not red-phase ATDD scenarios.

### Wave 1 Scope (this pass) — 13 scenarios + 1 factory

Risk-weighted P0-first slice that locks the score-9 BLOCK mitigations and the critical regression guards for code that just landed.

| Test ID          | Title                                                                                               | Level          | Priority | Risk Link    | File destination                                      |
| ---------------- | --------------------------------------------------------------------------------------------------- | -------------- | -------- | ------------ | ----------------------------------------------------- |
| AWARD.01-UNIT-01 | `useAwardPoints.onMutate` is idempotent (StrictMode-safe — duplicate invocations produce ONE patch) | UNIT           | P0       | ASR-5(b)     | `src/hooks/__tests__/useAwardPoints.onMutate.test.ts` |
| AWARD.01-UNIT-02 | `useAwardPoints.onError` rollback null-guards `context?.previousX !== undefined`                    | UNIT           | P0       | **R-05 (9)** | `src/hooks/__tests__/useAwardPoints.onError.test.ts`  |
| AWARD.01-UNIT-03 | Optimistic temp-row ID format = `optimistic-{studentId}-{behaviorId}-{timestamp}`                   | UNIT           | P1       | R-11         | `src/hooks/__tests__/useAwardPoints.tempId.test.ts`   |
| AWARD.01-UNIT-04 | `onMutate` reads via `qc.getQueryData(...)`, not closure                                            | UNIT           | P1       | ASR-5(e)     | (same file as UNIT-01)                                |
| SCHEMA.01-INT-01 | Every realtime DELETE-watching table has `REPLICA IDENTITY FULL`                                    | INT            | P0       | **R-03 (9)** | `tests/integration/schema/replica-identity.test.ts`   |
| SCHEMA.01-INT-02 | Trigger fires on `point_transactions` INSERT/UPDATE/DELETE                                          | INT            | P0       | R-04         | `tests/integration/schema/triggers.test.ts`           |
| HIST.01-INT-01   | DELETE on `point_transactions` arrives at realtime subscriber with non-empty `payload.old`          | INT            | P0       | **R-03 (9)** | `tests/integration/schema/realtime-delete.test.ts`    |
| RLS.01-INT-00    | Every user-scoped table has expected RLS policy (`pg_policies` roll-up)                             | INT            | P0       | **R-01 (9)** | `tests/integration/rls/policy-rollup.test.ts`         |
| CLASS.01-INT-01  | RLS — User A cannot SELECT User B classrooms via PostgREST                                          | INT            | P0       | **R-01 (9)** | `tests/integration/rls/classrooms.test.ts`            |
| CLASS.01-INT-02  | RLS — User A cannot UPDATE/DELETE User B classroom (0 rows affected, not error)                     | INT            | P0       | **R-01 (9)** | (same file)                                           |
| CLASS.01-INT-03  | RLS — anonymous client cannot SELECT any classroom                                                  | INT            | P0       | **R-01 (9)** | (same file)                                           |
| AUTH.01-E2E-05   | Stale JWT (forged): refresh fails → graceful redirect to login, no spinner loop                     | E2E            | P0       | R-08 (6)     | `tests/e2e/auth.spec.ts`                              |
| AUTH.01-INT-01   | `playwright.config.ts` allow-list parser refuses non-private host                                   | UNIT-style INT | P1       | R-15         | `tests/integration/security/allow-list.test.ts`       |

**Factory addition:** `ClassroomFactory` at `tests/support/fixtures/factories/classroom.factory.ts` — needed by `CLASS.01-INT-*`. Auto-cleanup pattern mirrors `UserFactory`; tracks created classroom ids.

### Test Levels Summary

- **UNIT:** 4 scenarios (`AWARD.01-UNIT-01..04`) — Vitest 4 + jsdom; mock Supabase at module boundary per `vi.mock('../../lib/supabase', ...)` pattern.
- **INT:** 8 scenarios (SCHEMA, HIST, RLS, CLASS, AUTH config-parser) — Vitest 4 + node; real local Supabase via `supabaseAdmin()` and `createImpersonationPair()`.
- **E2E:** 1 scenario (AUTH.01-E2E-05) — Playwright + chromium; storageState manipulation to forge a stale JWT.

### Priority Coverage

| Priority | Wave 1 count | Total in catalog | Pct of catalog covered after Wave 1 |
| -------- | ------------ | ---------------- | ----------------------------------- |
| P0       | 11           | 39               | 28%                                 |
| P1       | 2            | 24               | 8%                                  |
| P2/P3    | 0            | 21               | 0%                                  |

### Out of scope (this pass)

| Deferred                                         | Reason                                                                       | Target wave                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------- |
| R-02 / RT.01-INT-05 (RLS over realtime channel)  | Channel-establish race; handoff reserves for nightly cadence                 | Wave 3                       |
| R-06 / R-07 (cluster #2 partial-failure UX)      | Drag-along with code fix that has not landed                                 | After cluster #2 fix         |
| R-10 / SEAT.01-E2E-06 (cross-device seat sync)   | Blocked on PRD Phase 5 (`useSeatingChart` migration)                         | Author `test.skip` in Wave 4 |
| All P1 happy-path E2E (auth/class/student CRUD)  | Lower risk; build on Wave 1 fixtures                                         | Wave 2                       |
| All P2/P3 (edit/delete, settings, theme, polish) | Backlog; pick up after Wave 2 stable                                         | Wave 3-4                     |
| STUD/BEH/AWARD per-table RLS                     | Same pattern as CLASS RLS; replicate Wave 1 pattern after Wave 1 ships green | Wave 2                       |

### Coverage Plan Justification

**Scope: critical-paths.** This is the smallest meaningful slice that makes the suite useful as a regression guard for the features that just shipped:

- **R-05 rollback null-guard** = the bug the optimistic-mutation fix was written for; without UNIT-02 a regression here ships silently.
- **R-01 RLS REST** = the data-isolation guarantee; without RLS.01-INT-00 + CLASS RLS, every other feature can leak across tenants and we won't know.
- **R-03 REPLICA IDENTITY** = the realtime-DELETE invariant; without SCHEMA.01-INT-01 a future migration silently breaks cross-device undo.
- **R-08 stale-JWT loop** = the user-visible regression from `d652260`; without AUTH.01-E2E-05 the next change to `AuthContext.tsx` could reintroduce the infinite-spinner bug.

The scope intentionally does not chase happy-path E2E coverage (lower risk; cheaper to add later) and does not include the cluster #2 dragalong (would author red and stay red until code fix lands — wasted effort in an automate-expansion pass).

### Tagging Strategy (applied at test-write time in step 3)

Per `test-design-qa.md` Appendix A:

- `@p0` / `@p1` (priority, applied to every test)
- `@auth` / `@award` / `@classroom` / `@history` / `@schema` (feature)
- `@rls` / `@schema` (cross-cutting)

Wave 1 tag matrix:

```
AWARD.01-UNIT-01..04   → (no @p* tag in unit; file location implies suite)
SCHEMA.01-INT-01       → @p0 @schema
SCHEMA.01-INT-02       → @p0 @schema
HIST.01-INT-01         → @p0 @history @schema @realtime
RLS.01-INT-00          → @p0 @rls @schema
CLASS.01-INT-01..03    → @p0 @rls @classroom
AUTH.01-E2E-05         → @p0 @auth
AUTH.01-INT-01         → @p1 @auth @security
```

Selective execution at the end of Wave 1:

```bash
npm run test:e2e -- --grep "@p0"                     # P0 E2E gate
npm run test:integration -- --reporter=verbose      # full INT (no grep — small set)
npm test -- src/hooks/__tests__/useAwardPoints       # all AWARD unit tests
```

### Decision Outputs Carried Forward to Step 3

- Wave 1 = 13 scenarios + `ClassroomFactory`. All authoring goes into the file destinations listed in the test-table above.
- Each test must pass the `test-quality.md` Definition of Done: no `waitForTimeout`, no try/catch flow control, < 300 LOC per test file, < 1.5 min per individual test, self-cleaning, parallel-safe.
- Selectors follow handoff order: `getByRole > getByLabel > getByText({exact:true}) > getByTestId > locator(css)`.
- Existing post-mortem: `loginViaUi()` is the fallback for the AUTH.01-E2E-05 storageState manipulation (the test specifically does NOT use the shared `.auth/user.json` because it forges JWT corruption in the page context).

## Next: Step 3 — Generate Tests

Author the 13 Wave 1 scenarios and `ClassroomFactory` per the file destinations above. Each test self-cleans.

---

## Step 3: Generate Tests — Wave 1a delivered

### Execution Mode

`sequential` — chosen explicitly for the tight 4-test scope. Subagent dispatch (3a/3b) and aggregation (3c) compressed into a single pass since there is no parallel API/E2E split for Wave 1a (UNIT only).

### Scope Adjustment from Step 2 (advisor checkpoint)

The advisor flagged three pitfalls before authoring; verifications confirmed all three:

1. **Cleanup ordering is safe.** `classrooms.user_id REFERENCES auth.users(id) ON DELETE CASCADE` (`supabase/migrations/002_add_user_auth.sql:9`); `behaviors`, `sound_settings`, `seating_charts` all CASCADE. UserFactory cleanup is sufficient — no ordered-delete needed in `ClassroomFactory`.
2. **AUTH.01-INT-01 deferred.** `isPrivateHost` parser is duplicated inline in both `playwright.config.ts:18-32` and `vitest.integration.config.ts:17-31`; nothing exported from `scripts/lib/*.mjs`. Authoring the test requires extracting `isPrivateHost(url: string): boolean` to a shared module first — that's a product-code change, deferred to Wave 1.5 alongside the extraction.
3. **`pg_*` introspection tests deferred.** `pg_class`, `pg_trigger`, `pg_policies` are in `pg_catalog`, not exposed by PostgREST. Three options exist (add `pg` npm package, add SQL helper RPCs, parse `supabase db dump`); deferred to Wave 1.5 as a tooling decision. Behavioral effect tests (`HIST.01-INT-01` for REPLICA IDENTITY effect, `STUD.01-INT-04` for trigger correctness via SUM) cover the load-bearing invariants and are scheduled for Wave 1b.

**User selected scope: Option 2** — the four AWARD UNIT tests only. Highest risk-weighted regression-guard value (R-05 score 9 protects code that just landed in `d652260`), zero infrastructure risk, single PR.

### Files Created

| Path                                         | Purpose                                                               | LOC |
| -------------------------------------------- | --------------------------------------------------------------------- | --- |
| `src/hooks/__tests__/useAwardPoints.test.ts` | Four `describe` blocks covering ADR-005 §4 (a)/(b)/(c)/(e) compliance | 287 |

### Tests Authored

```
useAwardPoints — ADR-005 §4 compliance regression guards
  ✓ onMutate is idempotent (StrictMode-safe)
    ✓ applies the optimistic increment exactly once when mutate() runs twice with identical input
  ✓ onError rollback null-guards context.previous*
    ✓ does NOT issue setQueryData(key, undefined) for keys whose previous state was undefined
  ✓ deterministic temp-row id format
    ✓ writes the optimistic transaction with id `optimistic-{studentId}-{behaviorId}-{timestamp}`
  ✓ onMutate reads via qc.getQueryData, not closure
    ✓ rolls back to cache state captured at mutate-time, not at hook-render-time
```

### Mapping to Test-Design Catalog

| Test ID          | ADR-005 §4 clause | Risk         | Source assertion                                                                                                                                                                        |
| ---------------- | ----------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AWARD.01-UNIT-01 | §4(b)             | ASR-5(b)     | `previousTransactions?.some((t) => t.id === optimisticId)` dedup guard at `useTransactions.ts:138` short-circuits the second invocation's three setQueryData patches.                   |
| AWARD.01-UNIT-02 | §4(a)             | **R-05 (9)** | `if (context?.previousTransactions !== undefined)` rollback guard at `useTransactions.ts:213/219/222` — verified that `setQueryData(key, undefined)` is never issued for unseeded keys. |
| AWARD.01-UNIT-03 | §4(c)             | R-11         | Optimistic ID format `optimistic-${studentId}-${behaviorId}-${timestamp}` derived at `useTransactions.ts:132`; deterministic across duplicate invocations.                              |
| AWARD.01-UNIT-04 | §4(e)             | ASR-5(e)     | `qc.getQueryData<DbPointTransaction[]>(listKey)` at `useTransactions.ts:127-129` reads cache state at mutate-time, not closure-captured at hook-render time.                            |

### Quality Properties (Test Quality DoD per `test-quality.md`)

| Criterion                                                                                      | Status                                                                     |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No `waitForTimeout` / hard waits                                                               | ✅                                                                         |
| No try/catch for flow control                                                                  | ✅                                                                         |
| < 300 LOC per file (287 actual)                                                                | ✅                                                                         |
| < 1.5 min per test (each runs ~15 ms)                                                          | ✅                                                                         |
| Self-cleaning (`mockInsertResponse.mockReset()` in `beforeEach`; fresh `QueryClient` per test) | ✅                                                                         |
| Parallel-safe (no shared global state, no order dependencies)                                  | ✅                                                                         |
| TypeScript strict (typecheck `tsc -b --noEmit` exits 0)                                        | ✅                                                                         |
| ESLint clean (no new warnings on the file)                                                     | ✅                                                                         |
| Deterministic (no `Date.now()`, no `crypto.randomUUID()` in test inputs)                       | ✅                                                                         |
| Behavior-asserted, not internal-state-asserted                                                 | ✅ — all assertions read cache via `qc.getQueryData(...)` (the public API) |

### Convention Choices

- **Test descriptions:** `should X` / declarative form, matching the convention of the sibling test `useRealtimeSubscription.test.ts`. Per project context §Testing, "match the convention of nearby tests."
- **Priority tagging:** No inline `@p0` tags in test names. Per `test-design-qa.md:296` (Note column on `AWARD.01-UNIT-01..04`): "no @p\* tag in unit; file location implies suite." File path `src/hooks/__tests__/useAwardPoints.test.ts` IS the suite identifier.
- **Mock surface:** `vi.mock('../../lib/supabase', () => ({ supabase: { from, channel, removeChannel } }))` matching the pattern at `src/test/sounds.test.ts:29` and `src/hooks/__tests__/useRealtimeSubscription.test.ts:22`. Configurable via `mockInsertResponse.mockResolvedValue(...)` / `.mockImplementation(...)` per test.
- **Provider wrapping:** `createElement(QueryClientProvider, { client: qc }, children)` keeps the file `.test.ts` (no JSX). `retry: false` on both queries and mutations so failure paths surface immediately.
- **Type fixtures:** Local helper builders (`makeClassroom`, `makeStudent`, `makeRealTransaction`, `makeStudentSummary`) accept `Partial<T>` overrides — same shape as the test-factory pattern in `src/test/leaderboardCalculations.test.ts`.

---

## Step 4: Validate & Summarize

### Validation Run

```
npx vitest run src/hooks/__tests__/useAwardPoints.test.ts

 ✓ src/hooks/__tests__/useAwardPoints.test.ts (4 tests) ~65 ms
   Test Files  1 passed (1)
        Tests  4 passed (4)
```

```
npx tsc -b --noEmit --force   →   exit 0 (no errors)
npm run lint                   →   no errors; 5 pre-existing warnings unrelated to this file
```

### Full-Suite Regression Check

```
npx vitest run

 Test Files  1 failed | 6 passed (7)
       Tests  13 failed | 95 passed (108)
```

The 13 failures are all in `src/test/TeacherDashboard.test.tsx` — every failure originates in `<ThemeProvider>` initialization (`getInitialTheme` reads `localStorage`/`matchMedia` at module load). **Pre-existing, not introduced by this Wave.** Verified by isolating the file:

```
npx vitest run src/test/TeacherDashboard.test.tsx
 Test Files  1 failed (1)
       Tests  13 failed (13)
```

This pre-existing failure is out of scope for `bmad-testarch-automate` — it's a `bmad-testarch-test-review` or product-side fix item. **Action recommended for Sallvain:** open a separate cleanup PR or surface in the next `bmad-testarch-test-review` run; this Wave's deliverable does not regress it.

### Coverage Snapshot After Wave 1a

| Test level | Before                                                                                 | After Wave 1a        | Catalog target                                                             |
| ---------- | -------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| UNIT       | 95 passing (across 6 files; 13 broken in `TeacherDashboard.test.tsx` are pre-existing) | 99 passing (added 4) | 16 UNIT scenarios in catalog (Wave 1a covers 4 of 4 ADR-005 §4 compliance) |
| INT        | 2 passing (smoke samples)                                                              | unchanged            | 32 INT scenarios in catalog                                                |
| E2E        | 2 passing (smoke samples)                                                              | unchanged            | 45 E2E scenarios in catalog                                                |

**Wave 1a P0 risk coverage:** R-05 (rollback null-guard, score 9) ✅ — direct regression guard via AWARD.01-UNIT-02. Plus three secondary ADR-005 compliance guards.

### Files Changed Summary

**Created:**

- `src/hooks/__tests__/useAwardPoints.test.ts` — 287 LOC, 4 passing tests
- `_bmad-output/test-artifacts/automation-summary.md` — this document

**Not modified:**

- No source changes (`src/`).
- No `package.json` script changes (existing `npm test` / `npm test -- src/hooks/...` cover the new file).
- No fixture / factory changes (Wave 1b will add `ClassroomFactory`).
- No CI config changes (`.github/workflows/test.yml` already runs lint + typecheck + e2e + bundle-check on every PR; Vitest unit-tests-in-CI is separately tracked).

### Test Execution Commands

```bash
npm test -- src/hooks/__tests__/useAwardPoints.test.ts   # this Wave's file (watch mode)
npm test -- --run src/hooks/__tests__/useAwardPoints     # single pass
npm test                                                  # full Vitest suite (watch)
npm test -- --run                                         # full Vitest suite (single pass)
npm run typecheck                                         # tsc -b --noEmit
```

### Definition of Done — Wave 1a

| Criterion                                                           | Status |
| ------------------------------------------------------------------- | ------ |
| 4 ADR-005 §4 compliance unit tests authored                         | ✅     |
| All 4 tests pass on local                                           | ✅     |
| Tests pass typecheck and lint                                       | ✅     |
| Tests follow `vi.mock(...)` pattern matching existing convention    | ✅     |
| No new `waitForTimeout` / try-catch / hardcoded-data anti-patterns  | ✅     |
| Tests are self-cleaning and parallel-safe                           | ✅     |
| No regression in the 95 pre-existing passing tests                  | ✅     |
| Output document `automation-summary.md` complete with Wave 1a state | ✅     |

### Open Items / Known Constraints

1. **13 pre-existing failures in `TeacherDashboard.test.tsx`** — unrelated to Wave 1a; surface in next `bmad-testarch-test-review` or open a side PR.
2. **Wave 1b queue (deferred Wave 1 scope):**
   - `ClassroomFactory` at `tests/support/fixtures/factories/classroom.factory.ts` (~30 min).
   - `CLASS.01-INT-01..03` RLS scenarios (`tests/integration/rls/classrooms.test.ts`) — uses existing `createImpersonationPair()`.
   - `HIST.01-INT-01` REPLICA IDENTITY effect (`tests/integration/schema/realtime-delete.test.ts`).
   - `STUD.01-INT-04` trigger correctness via SUM (`tests/integration/schema/triggers-behavioral.test.ts`).
   - `AUTH.01-E2E-05` stale-JWT graceful degrade (`tests/e2e/auth.spec.ts`).
3. **Wave 1.5 (refactor + introspection-helper decision):**
   - Extract `isPrivateHost(url: string): boolean` from inline `playwright.config.ts:18-32` + `vitest.integration.config.ts:17-31` into `scripts/lib/supabase-host.mjs`. Then author `AUTH.01-INT-01`.
   - Decide schema-introspection strategy (`pg` npm package vs SQL helper RPCs). Then author `SCHEMA.01-INT-01`, `SCHEMA.01-INT-02`, `RLS.01-INT-00`.
4. **R-06 / R-07 cluster #2 partial-failure UX tests** still blocked on the cluster #2 code fix landing.
5. **R-10 / SEAT.01-E2E-06** still blocked on PRD Phase 5 (`useSeatingChart` migration).

### Next Recommended Workflow

`bmad-testarch-automate` Wave 1b — author the 5 deferred Wave 1 scenarios + `ClassroomFactory`. Use the AWARD test pattern as a reference for unit + the existing integration smoke as a reference for INT.

If you prefer to broaden the safety net before moving to integration tests:

- `bmad-testarch-test-review` — clean up the 13 pre-existing `TeacherDashboard.test.tsx` failures so the unit-suite is fully green.

After Wave 1b lands and `cluster #2` code fix is in:

- `bmad-testarch-trace` — generate traceability matrix; gate decision on whether P0 coverage is sufficient to release.
- `bmad-testarch-test-review` — final quality validation before declaring P0 Wave 1 complete.
