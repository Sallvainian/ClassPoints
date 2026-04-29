---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output',
  ]
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-04-28'
workflowType: 'testarch-test-design'
inputDocuments:
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/test-design/INPUT-classpoints-test-design-brief.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - docs/adr/ADR-005-queryclient-defaults.md
---

# Test Design for Architecture: ClassPoints Post-Redesign Behavioral Coverage

**Purpose:** Architectural concerns, testability gaps, and risk-driven mitigation contract between QA (TEA) and Engineering (Sallvain solo + AI agents). What must be addressed before/alongside test development.

**Date:** 2026-04-28
**Author:** Master Test Architect (TEA)
**Status:** Architecture Review Pending
**Project:** ClassPoints
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md` (TanStack Query migration; Phase 3 complete)
**ADR Reference:** `docs/adr/ADR-005-queryclient-defaults.md` (§4 mutation AC, §6 realtime scope)

---

## Executive Summary

**Scope:** End-to-end behavioral coverage of the post-editorial-redesign ClassPoints app. 10 features + cross-cutting RLS + schema invariants. **Not** the TanStack migration refactor — that's covered by the superseded 2026-04-22 design.

**Business Context:**

- ClassPoints is a single-tenant-per-teacher classroom management app. Solo contributor codebase. Real-time smartboard + phone teacher workflow.
- The migration that drove the prior test design is complete for core domains; test gaps now reflect post-redesign behavioral surface, not refactor-architectural.

**Architecture (key decisions consumed):**

- **Decision 1 (Zustand scope):** No new state library — `AppContext` slim, `@dnd-kit` owns drag transport.
- **Decision 2 (`activeClassroomId` ownership):** Lives in slimmed `AppContext` + `localStorage`. Five consumer sites.
- **Decision 3 (`useRealtimeSubscription` refactor):** `onChange` callback alongside legacy `onInsert`/`onUpdate`/`onDelete`. Migration in flight.
- **Decision 4 (NFR4 — devtools DCE):** `npm run check:bundle` enforces zero `react-query-devtools` chunks in `dist/`. Out of test catalog scope.

**Risk Summary:**

- **Total risks identified:** 20
- **Critical (score = 9):** 4 — R-01 (RLS REST), R-02 (RLS realtime), R-03 (REPLICA IDENTITY), R-05 (rollback `undefined`)
- **High (score 6-8):** 7 — R-04, R-06, R-07, R-08, R-13, R-17, R-20
- **Medium (4-5):** 3 — R-12, R-16, R-18
- **Low (1-3):** 5 — R-09, R-11, R-14, R-15, R-19
- **Blocked-on-migration:** 1 — R-10 (seating-chart cross-device sync)
- **Test effort:** ~93 net-new scenarios (~60-95 hours, ~3-4 sprints solo + AI-assist)

---

## Quick Guide

### 🚨 BLOCKERS — Must Be Mitigated Before Release

| #   | Item                                                          | What Architecture / Code Must Provide                                                                                                                                                                        | Owner                                  |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| 1   | **R-01 / R-02 — Per-teacher RLS isolation** (REST + realtime) | RLS policies on every user-scoped table; **no test data exposure proves this — it must be asserted with two-client integration tests**                                                                       | Sallvain (test) / RLS already in place |
| 2   | **R-03 — Realtime DELETE invariant**                          | `REPLICA IDENTITY FULL` on every realtime DELETE-watching table. Currently only `point_transactions`. **Schema invariant test required** — there is no schema-level enforcement preventing future drift      | Sallvain (test author)                 |
| 3   | **R-05 — Optimistic rollback null-guard**                     | `useAwardPoints.onError` already complies (ADR-005 §4 (a) inline AC at `useTransactions.ts:212-227`). **Test must regression-prevent** — no other mutation in flight without an `onError` null-guard pattern | Sallvain (test author)                 |

**What we need from Sallvain:** Authoring effort and CI wiring for the four score-9 mitigations before next deploy. No architectural change required for any — the patterns exist; tests don't.

---

### ⚠️ HIGH PRIORITY — Validate Within Next Sprint

| #   | Risk                                                                                                                          | Recommendation                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **R-04 (DATA, score 6)** — Trigger-totals divergence from log                                                                 | Integration scenarios on award/undo/clear/reset assert `students.point_total === SUM(point_transactions.points)`                                                   |
| 2   | **R-06 / R-07 (BUS, score 6)** — Class-award + multi-award orchestrator silent partial failures (audit cluster #2 REAL sev 4) | E2E asserts failure-surfacing UX; integration counts `point_transactions` rows after forced per-student failure. **Test now; code fix later (out of test scope)**  |
| 3   | **R-08 (TECH, score 6)** — Stale-JWT loop regression                                                                          | E2E forges expired JWT → asserts graceful redirect to login (no spinner loop). Direct guard for commit `d652260`                                                   |
| 4   | **R-13 (BUS, score 6)** — Empty-state user infinite loading (KI-1)                                                            | Bug-fix on Sallvain's queue. Test catalog **works around** in `auth.setup.ts` until fix lands                                                                      |
| 5   | **R-17 (TECH, score 6)** — Mocked-DB integration false positive                                                               | Already structurally satisfied: integration tests hit real local Postgres. No test scope; document the rule                                                        |
| 6   | **R-20 (BUS, score 6)** — Behavior per-user RLS regression                                                                    | Behavior-table-specific RLS scenario (called out separately because behaviors moved from "global defaults" to "per-user with shared defaults" in recent migration) |

**What we need from Sallvain:** Acknowledge the cluster #2 fix is out-of-scope for this test design and tracked separately in `anti-pattern-audit.md`.

---

### 📋 INFO ONLY — Solutions Provided

1. **Test strategy split:** 16 UNIT (Vitest 4 jsdom) / 32 INT (Vitest 4 node + real local Postgres) / 45 E2E (Playwright + chromium + storageState). Pyramid balance verified — no duplicate coverage.
2. **Tooling:** Existing scaffold complete (109 tests passing 2026-04-28). Playwright Utils Full UI+API profile available; `recurse` polling for realtime eventual-consistency.
3. **Tiered execution:** PR (~10-15 min) / Nightly (~25-30 min) / Weekly burn-in. See QA doc for the recipe.
4. **Coverage:** ~93 net-new scenarios. **39 P0**, 24 P1, 21 P2, 4 P3, 1 blocked-on-migration.
5. **Quality gates:** P0 100% / P1 ≥ 95% / behavioral coverage ≥ 80% / no `await page.waitForTimeout(...)`. See QA doc.

**What we need from Sallvain:** Acknowledge — no decisions required.

---

## For Architects and Devs — Open Topics 👷

### Risk Assessment

**Total risks identified:** 20 (4 critical score=9, 7 high score 6-8, 3 medium score 4-5, 5 low score 1-3, 1 blocked).

#### Critical Risks (Score = 9) — IMMEDIATE ATTENTION

| Risk ID  | Category | Description                                                                                             | P   | I   | Score | Mitigation                                                                                 | Owner    | Timeline           |
| -------- | -------- | ------------------------------------------------------------------------------------------------------- | --- | --- | ----- | ------------------------------------------------------------------------------------------ | -------- | ------------------ |
| **R-01** | **SEC**  | RLS breach via PostgREST: User A reads/writes User B's classrooms / students / behaviors / transactions | 3   | 3   | **9** | Per-table RLS integration scenarios with two impersonated user clients                     | Sallvain | Before next deploy |
| **R-02** | **SEC**  | RLS breach via realtime: User A subscribes to User B's row events                                       | 3   | 3   | **9** | Realtime + RLS integration scenarios on each of the 3 official channels                    | Sallvain | Before next deploy |
| **R-03** | **DATA** | Realtime DELETE on a table missing `REPLICA IDENTITY FULL` → time-totals desync                         | 3   | 3   | **9** | Schema-introspection invariant test enumerating realtime publication membership            | Sallvain | Next sprint        |
| **R-05** | **TECH** | Optimistic rollback writes `undefined` to cache (ADR-005 §4 (a) regression)                             | 3   | 3   | **9** | UNIT test for `useAwardPoints.onError` null-guard + E2E for award-fails-then-rollback flow | Sallvain | Next sprint        |

#### High-Priority Risks (Score 6-8)

| Risk ID  | Category | Description                                                                 | P   | I   | Score | Mitigation                                                                 | Owner    |
| -------- | -------- | --------------------------------------------------------------------------- | --- | --- | ----- | -------------------------------------------------------------------------- | -------- |
| **R-04** | **DATA** | Trigger-maintained totals diverge from `point_transactions` log             | 2   | 3   | **6** | Integration scenarios per award / undo / clear / reset assert SUM equality | Sallvain |
| **R-06** | **BUS**  | Class-award orchestrator silently filters per-student failures (cluster #2) | 3   | 2   | **6** | E2E surfaces failure count; integration counts row deltas                  | Sallvain |
| **R-07** | **BUS**  | Multi-award orchestrator: same as R-06 on `awardPointsToStudents`           | 3   | 2   | **6** | Same as R-06, scoped to `MultiAwardModal`                                  | Sallvain |
| **R-08** | **TECH** | Stale-JWT loop on refresh (regression of fix `d652260`)                     | 2   | 3   | **6** | Auth resilience E2E forging expired JWT                                    | Sallvain |
| **R-13** | **BUS**  | Empty-state user infinite loading (KI-1)                                    | 3   | 2   | **6** | Bug-fix on Sallvain's queue; tests work around                             | Sallvain |
| **R-17** | **TECH** | Mocked-DB integration test false positives                                  | 2   | 3   | **6** | Already structurally satisfied (real local Postgres at integration level)  | Sallvain |
| **R-20** | **BUS**  | Behavior per-user RLS regression                                            | 2   | 3   | **6** | Behavior-table-specific RLS scenario                                       | Sallvain |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description                                   | P   | I   | Score | Mitigation                                                                              |
| ------- | -------- | --------------------------------------------- | --- | --- | ----- | --------------------------------------------------------------------------------------- |
| R-12    | TECH     | Realtime channel reconnect loses event        | 2   | 2   | 4     | Integration: simulate reconnect, assert invalidation refetch                            |
| R-16    | PERF     | Per-student rapid-tap → optimistic write race | 2   | 2   | 4     | E2E: 10 rapid awards, assert no duplicate transactions and final total matches expected |
| R-18    | TECH     | Snake_case → camelCase transform regression   | 2   | 2   | 4     | UNIT tests on transforms additive when DB columns added                                 |

#### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description                                           | P   | I   | Score | Action                                                   |
| ------- | -------- | ----------------------------------------------------- | --- | --- | ----- | -------------------------------------------------------- |
| R-09    | TECH     | New realtime channel added without ADR-005 §6 update  | 1   | 3   | 3     | Code review gate; no test                                |
| R-11    | DATA     | Optimistic temp ID collision (non-deterministic UUID) | 1   | 2   | 2     | UNIT-level invariant guard                               |
| R-14    | DATA     | Migration wizard data loss                            | 1   | 3   | 3     | Out of scope per INPUT brief                             |
| R-15    | OPS      | E2E hits hosted Supabase (allow-list bypassed)        | 1   | 3   | 3     | One-time regression test                                 |
| R-19    | DATA     | Sound-settings query lookup race during signin        | 1   | 2   | 2     | Provider hierarchy invariant; one-time render-order test |

#### Blocked Risk

| Risk ID | Category | Description                                                         | P   | I   | Score | Action                                                                                         |
| ------- | -------- | ------------------------------------------------------------------- | --- | --- | ----- | ---------------------------------------------------------------------------------------------- |
| R-10    | DATA     | Cross-device seating-chart drift — `useSeatingChart` lacks realtime | 3   | 2   | **6** | **P1-blocked-on-migration** — author scenario with `test.skip` + TODO; unblocks at PRD Phase 5 |

#### Risk Category Legend

- **TECH** — Technical/Architecture (integration fragility, type-system holes)
- **SEC** — Security (RLS, auth, data exposure)
- **PERF** — Performance (race conditions, optimistic-write timing)
- **DATA** — Data Integrity (totals, replica identity, JSONB schema drift)
- **BUS** — Business Impact (UX regressions, silent partial failures)
- **OPS** — Operations (env allow-list, deploy gates)

---

### Testability Concerns and Architectural Gaps

#### 🚨 ACTIONABLE CONCERNS

**1. Blockers to Fast Feedback**

| Concern                                               | Impact                                                                                                                       | What's Required                                                                                                                             | Owner    | Timeline                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------- |
| **TC-1 — Empty-state Suspense never resolves** (KI-1) | New-user E2E cannot wait for "dashboard loaded" signal before assertions                                                     | Bug-fix in `TeacherDashboard` chunk so empty `classrooms.length === 0` resolves Suspense fallback                                           | Sallvain | Next sprint (parallel to test work)           |
| **TC-3 — `useSeatingChart` lacks realtime** (KI-3)    | Cross-device seating-chart sync E2E is red-by-design today (P1-blocked-on-migration R-10)                                    | Migrate `useSeatingChart` to TanStack + add seating-chart realtime channel per ADR-005 §6                                                   | Sallvain | PRD Phase 5                                   |
| **TC-4 — Realtime DELETE invariant unenforced**       | A future migration that adds DELETE realtime to a new table without `REPLICA IDENTITY FULL` would silently break time totals | Schema invariant test (covered by mitigation for R-03) is the only enforcement layer; CONSIDER adding a Supabase migration linter long-term | Sallvain | Next sprint (test); long-term linter optional |

**2. Architectural Improvements Needed**

| Improvement                                                             | Current Problem                                                                                                                                                                                                                                                                                       | Required Change                                                                                                                                                                                                                               | Impact if Not Fixed                                                                                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **TC-2 — Orchestrator silent partial failures** (cluster #2 REAL sev 4) | `AppContext.awardClassPoints` and `awardPointsToStudents` wrap `Promise.all + per-promise .catch((err) => null)`. Caller cannot distinguish "5 succeeded" from "5 attempted, 2 failed." Two source comments at `ClassAwardModal.tsx:64` and `MultiAwardModal.tsx:62` actively LIE about the contract. | Surface failure count to UI; remove the lying comments. Tracked separately in `anti-pattern-audit.md`. **Test design works around it now** — assertions go through DB row counts and failure-surfacing UI, not the orchestrator return value. | If unfixed: silent partial-failure regressions ship without detection; lying comments mislead future test authors                          |
| **TC-5 — Lying comments at modal sites** (related to TC-2)              | Comments claim "wrapper throws on error with automatic rollback" — false.                                                                                                                                                                                                                             | Delete comments when cluster #2 fix lands.                                                                                                                                                                                                    | Tests written naively against the comments would assert a clean throw that doesn't exist (false green)                                     |
| **TC-7 — Hand-rolled hooks remain for two domains**                     | `useLayoutPresets` (166 LOC) and `useSeatingChart` (23-value return) still use `useState + useEffect`. Their shapes differ from the canonical TanStack target.                                                                                                                                        | Phase 5 migration. Tests against these hooks tagged `@migration-pending`; re-target post-migration is mechanical.                                                                                                                             | Two parallel test baselines per affected feature until migration lands                                                                     |
| **TC-8 — Three `as T` casts at Supabase realtime / JSONB boundary**     | `useRealtimeSubscription.ts:135-141`, `useLayoutPresets.ts:41`, `seatingChart.ts:211` (JSONB `layout_data`). Schema drift invisible at compile time.                                                                                                                                                  | Add zod / valibot schema validation at `queryFn` boundary, ideally in `transforms.ts`.                                                                                                                                                        | JSONB `layout_data` shape change ships without typecheck failure; only round-trip integration test catches it (already in scope as P2 INT) |

**3. ASRs (Architecturally Significant Requirements)**

Of 10 ASRs identified, 7 are **ACTIONABLE** in the test catalog: ASR-1 (RLS), ASR-2 (realtime scope), ASR-3 (REPLICA IDENTITY FULL), ASR-4 (trigger totals), ASR-5 (optimistic null-guard), ASR-6 (deterministic temp IDs), ASR-8 (stale-JWT graceful degrade). 3 are **FYI**: ASR-7 (NFR4 covered by `check:bundle`), ASR-9 (`AppContext` UI/session-only — covered by lint/typecheck), ASR-10 (`fnox exec` — code-review concern).

---

### Testability Assessment Summary

#### What Works Well (FYI)

- **TS-1 — Local-only Supabase fail-closed allow-list:** `playwright.config.ts` parses `VITE_SUPABASE_URL` and refuses non-private hosts. Same allow-list at `tests/support/helpers/supabase-admin.ts`. Doubles as security boundary + CI safety guard.
- **TS-2 — Zero-step E2E run:** `tests/e2e/global-setup.ts` boots local stack, seeds idempotent, teardown stops it. Host-detection picks the right behavior (local vs remote).
- **TS-3 — Optimistic mutation contract is canonical:** `useAwardPoints` (`useTransactions.ts:97-235`) inline-comments all five ADR-005 §4 (a)-(e) AC. New mutations have a one-template five-checklist target.
- **TS-4 — Realtime scope = exactly 3 domains, PR-block enforced:** Adding a 4th channel without ADR-005 §6 update is a review block. Catalog has finite live-sync surface.
- **TS-5 — Trigger-maintained totals are server-of-truth:** Tests never reproduce client aggregation; backend asserts trigger correctness, UI asserts denormalized-value rendering.
- **TS-6 — Query key registry single source of truth:** `src/lib/queryKeys.ts`. Read-path / invalidation-path drift is structurally impossible.
- **TS-7 — Playwright fixtures established:** `mergeTests`, `userFactory`, `authenticatedPage` — 109 tests passing 2026-04-28.

#### Accepted Trade-offs (No Action Required)

- **Browser matrix Chromium-only.** Single `playwright.config.ts` projects entry. No multi-browser testing. Acceptable: solo-contributor scope, no compliance requirement, primary devices are Chromium-based (Chromebooks at school + Mac/Windows admin).
- **No visual regression / Percy / Chromatic.** Out of scope per INPUT brief. Visual-bug class accepted; behavioral tests cover semantics.
- **Migration wizard not under test.** One-time localStorage → Supabase flow, low ROI for testing. Smoke test only on regression incident.
- **Component-level Storybook absent.** Component tests at unit level via Testing Library + jsdom. Storybook adoption deferred unless component reuse patterns emerge.

---

### Risk Mitigation Plans (Critical + High Priority Risks ≥ 6)

> Note: All mitigations below are **code-side or test-author-side** for Sallvain. No external owners.

#### R-01 + R-02: Per-Teacher RLS Isolation (Score 9 — CRITICAL)

**Mitigation Strategy:**

1. RLS policies already exist in `supabase/migrations/002_*.sql`. **Verification, not creation, is the test scope.**
2. Build a fixture that creates two test users (User A, User B) and an admin client; impersonate each via `supabase.auth.admin.createUser` + `supabase.auth.signInWithPassword`.
3. For each user-scoped table (classrooms, students, behaviors, point_transactions, layout_presets, sound_settings, seating_charts/\_groups/\_seats, room_elements): assert User A's client cannot SELECT/INSERT/UPDATE/DELETE User B's rows.
4. For each of the 3 official realtime channels (students, point_transactions, seating-chart): assert User A's subscription receives only User A's events; User B's row mutation is silent on User A's channel.

**Owner:** Sallvain (test author).
**Timeline:** Before next deploy.
**Status:** Planned.
**Verification:** All RLS scenarios green in PR pipeline; no test currently uses `service_role` to read across user boundaries except the impersonation fixture itself.

#### R-03: REPLICA IDENTITY FULL Schema Invariant (Score 9 — CRITICAL)

**Mitigation Strategy:**

1. Query `pg_publication_tables` for the realtime publication; enumerate every table.
2. For each table, query `pg_class.relreplident` and assert it equals `'f'` (FULL) for any table with DELETE in its replica identity scope, OR demonstrate the table never publishes DELETE events.
3. Currently only `point_transactions` qualifies — test passes today; future migration that adds DELETE without REPLICA IDENTITY FULL fails the test.
4. Companion test: subscribe to `point_transactions` realtime channel, DELETE a row, assert `payload.old.id` is non-null.

**Owner:** Sallvain (test author).
**Timeline:** Next sprint.
**Status:** Planned.
**Verification:** Schema invariant test green on PR; intentional break (drop `REPLICA IDENTITY FULL` in a sandbox migration) reproduces empty `payload.old`.

#### R-05: Optimistic Rollback Null-Guard (Score 9 — CRITICAL)

**Mitigation Strategy:**

1. UNIT test for `useAwardPoints.onError`: invoke with `context = undefined` (post-cancellation simulation); assert `qc.setQueryData(...)` is NOT called with `undefined` value.
2. UNIT test for `useAwardPoints.onError`: invoke with `context = { previousTransactions: undefined, previousClassrooms: [...], ... }`; assert per-key null-guard pattern (`if (context?.previousX !== undefined)`).
3. E2E happy-path then forced-error: award succeeds → undo modal → simulate API failure → assert UI snaps back to pre-award total (no `undefined` flash, no stale state).

**Owner:** Sallvain (test author).
**Timeline:** Next sprint.
**Status:** Planned.
**Verification:** All three tests green; intentional regression (remove the `if` check at `useTransactions.ts:212-227`) fails the unit tests immediately.

#### R-04: Trigger Totals Divergence (Score 6)

**Mitigation Strategy:**

1. Integration scenario per operation (award / undo / clear-student / reset-classroom / adjust): after the operation, query `students.point_total` and compare to `SUM(point_transactions.points)` for that student.
2. Time-totals (`today_total`, `this_week_total`) — assert window logic by inserting transactions with `created_at` outside the window and confirming they don't count.

**Owner:** Sallvain. **Timeline:** Next sprint. **Verification:** All five operations green.

#### R-06 / R-07: Orchestrator Silent Partial Failures (Score 6)

**Mitigation Strategy:**

1. E2E: open class-award modal, select all students; intercept Supabase `point_transactions` INSERT for one student via Playwright `route` and return 4xx; assert UI surfaces failure count (toast / state) — NOT just success.
2. Integration: same setup, count `point_transactions` rows for that classroom after the orchestrator returns; assert row count matches actual successes (not orchestrator return length).
3. Same for `MultiAwardModal` orchestrator.

**Owner:** Sallvain (test). Code fix tracked separately in `anti-pattern-audit.md`.
**Timeline:** Next sprint.
**Verification:** Tests fail today (UI doesn't surface failures); pass once UI is fixed. Acts as drag-along signal for the cluster #2 fix.

#### R-08: Stale-JWT Loop (Score 6)

**Mitigation Strategy:**

1. E2E: log in normally, capture storageState. Forge an expired JWT in `localStorage` (`sb-...-auth-token` key). Reload page.
2. Assert: redirect to login form within 3 seconds; no spinner loop; no `signInWithPassword` retry loop in network tab.
3. Direct regression guard for fix `d652260`.

**Owner:** Sallvain. **Timeline:** Next sprint. **Verification:** Test green; intentional regression of the fix breaks the test.

#### R-13: Empty-State Infinite Loading (KI-1, Score 6)

**Mitigation Strategy:**

1. **Code fix** (out of test scope): `TeacherDashboard` lazy chunk Suspense fallback should resolve regardless of `classrooms.length === 0`.
2. **Test workaround** (in scope today): `tests/e2e/auth.setup.ts` does not wait for dashboard load; documented in spec comments.
3. When code fix lands, remove the workaround comment.

**Owner:** Sallvain (code-side bug + test cleanup). **Timeline:** Next sprint.

#### R-17: Mocked-DB Integration False Positives (Score 6)

**Mitigation Strategy:** Already structurally satisfied. The integration suite hits real local Postgres via `tests/support/helpers/supabase-admin.ts`. No mocks at the integration layer. **No new test required.** Document the rule in `tests/README.md`. (User's persistent memory `feedback_testing.md` enforces this in agent collaborations.)

**Owner:** Doc-only.
**Timeline:** Already complete.

#### R-20: Behavior Per-User RLS (Score 6)

**Mitigation Strategy:**

1. Behavior-table-specific RLS integration scenarios (called out separately because behaviors moved from "global defaults" to "per-user with shared defaults" in a recent migration; the pattern is unfamiliar enough to warrant explicit coverage).
2. Cross-checks: User A creates a custom behavior → User B's behaviors query does NOT include it. Default behaviors (if any are global / shared) are visible to both.

**Owner:** Sallvain. **Timeline:** Next sprint.

---

### Assumptions and Dependencies

#### Architectural Assumptions

1. **RLS policies are correct as written.** The test catalog verifies enforcement, not policy authorship. If `supabase/migrations/002_*.sql` has a logic error, RLS scenarios surface it; they don't author it.
2. **`REPLICA IDENTITY FULL` is the only invariant-style schema constraint that needs CI enforcement.** Other constraints (NOT NULL, FK cascades) are exercised implicitly by the integration scenarios.
3. **Trigger-maintained totals are accurate post-trigger.** The catalog asserts the trigger fires and totals match log; it does not re-implement the aggregation logic.
4. **Single-tenant-per-teacher data model.** No multi-tenant scenarios (classroom shared across teachers, etc.). Out of scope.
5. **Solo-contributor scope.** No QA team; "QA" in the companion doc means "Sallvain authoring tests" — possibly with `bmad-testarch-atdd` / `bmad-testarch-automate` agent assistance.

#### Dependencies

1. **Local Supabase stack** — required for E2E + INT. Already automated via `tests/e2e/global-setup.ts`. **Status: Ready.**
2. **`fnox exec` access** — required for any test that touches hosted Supabase. **None of the test catalog requires this** (E2E is local-only, INT is local-only). Hosted access stays out-of-scope.
3. **`useSeatingChart` migration to TanStack + realtime** — required to unblock R-10 (SEAT.01-E2E-06). **Status: PRD Phase 5 — not gating this catalog.**
4. **Cluster #2 fix** (orchestrator partial-failure surfacing) — gating for R-06 / R-07 tests to pass. **Status: Tracked in `anti-pattern-audit.md`. Tests authored against expected post-fix behavior.**

#### Risks to the Test Plan

- **Risk:** New realtime channel added without ADR-005 §6 update slips past code review → realtime negative-scope test fails or needs update.
  - **Impact:** False alarm on PR pipeline.
  - **Contingency:** Code review enforcement is the primary gate; the test is a backstop. If the test starts failing, audit the new channel against ADR-005 first.

- **Risk:** Editorial UI redesign continues — selectors drift between catalog authoring and execution.
  - **Impact:** E2E re-validation work as features evolve.
  - **Contingency:** Selector strategy normative (`getByRole > getByLabel > getByText({exact:true}) > getByTestId > css`) minimizes drift impact. UI selector update appendix in INPUT brief documents post-redesign-era selectors.

- **Risk:** Solo-contributor authoring throughput limited; 60-95 hour estimate spread across 3-4 sprints.
  - **Impact:** Catalog completion timeline.
  - **Contingency:** P0 (39 scenarios, RLS + score-9 mitigations) prioritized first; downstream `bmad-testarch-atdd` and `bmad-testarch-automate` workflows accelerate authoring.

---

**End of Architecture Document**

**Next Steps for Architecture / Code Side:**

1. Review Quick Guide (🚨 / ⚠️ / 📋) and acknowledge the cluster #2 fix is out-of-scope for this test design.
2. Confirm KI-1 (empty-state infinite loading) bug-fix priority for next sprint.
3. Schedule `useSeatingChart` migration to unblock R-10.

**Next Steps for Test Authoring:**

1. Begin with the four score-9 BLOCK mitigations (R-01/R-02/R-03/R-05) — see companion QA doc for scenario IDs (CLASS.01-INT-01..03, STUD.01-INT-01..03, BEH.01-INT-01..02, AWARD.01-UNIT-01..04, HIST.01-INT-01..02, SCHEMA.01-INT-01..02, RT.01-INT-05).
2. Use existing `tests/support/fixtures/userFactory` + new impersonation-pair fixture.
3. Refer to companion QA doc (`test-design-qa.md`) for test scenarios, execution strategy, and quality gates.
