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
  - _bmad-output/test-artifacts/test-design-progress.md
  - _bmad-output/test-artifacts/test-design-architecture.md
---

# Test Design for QA: ClassPoints Post-Redesign Behavioral Coverage

**Purpose:** Test execution recipe. Defines which scenarios to author, how to author them (test level, fixtures, selectors, network strategy), and what blockers exist before authoring can start.

**Date:** 2026-04-28
**Author:** Master Test Architect (TEA)
**Status:** Draft
**Project:** ClassPoints

**Related:** See `test-design-architecture.md` for testability concerns, ASRs, and architectural blockers. This doc references its risk IDs (R-01..R-20).

---

## Executive Summary

**Scope:** End-to-end behavioral coverage of the post-editorial-redesign app — 10 features + cross-cutting RLS + schema invariants. ~93 net-new scenarios.

**Risk Summary:**

- 20 risks total (4 critical score-9, 7 high score 6-8, 3 medium 4-5, 5 low 1-3, 1 blocked-on-migration)
- Critical categories: SEC (RLS x2), DATA (REPLICA IDENTITY + total integrity), TECH (rollback null-guard + stale-JWT)

**Coverage Summary:**

- **P0:** 39 scenarios — RLS per table + 4 score-9 BLOCK mitigations + trigger correctness + auth resilience
- **P1:** 24 scenarios — happy-path E2E + transform/mutation unit tests
- **P2:** 21 scenarios — edit/delete flows, settings, JSONB drift guard, rapid-tap stress
- **P3:** 4 scenarios — UI polish, theme, lock-tables
- **Blocked:** 1 (R-10 / SEAT.01-E2E-06 — `useSeatingChart` migration-pending)
- **Background-existing (do not duplicate):** 4 (sounds.test.ts, leaderboardCalculations.test.ts, useRotatingCategory.test.ts, useRealtimeSubscription.test.ts — already 109 tests passing)

**Total authoring effort:** ~60-95 hours, ~3-4 sprints solo + AI-assist.

---

## Not in Scope

| Item                                            | Reasoning                                                                    | Mitigation                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Edge functions (`supabase/functions/`)          | Directory does not exist — no edge functions deployed                        | N/A                                                                     |
| Visual regression (Percy / Chromatic)           | Out of scope per INPUT brief                                                 | Visual bugs accepted; behavioral tests cover semantics                  |
| Performance / load testing                      | Solo-contributor scale; no SLA contracts                                     | Manual smoke; no synthetic load                                         |
| Accessibility full audit (axe / pa11y)          | Solo-contributor scope; no compliance gate                                   | Basic ARIA assertions inside E2E (`getByRole`) cover the common surface |
| Security audit beyond RLS                       | Out of scope; OWASP / pen test / JWT crypto inspection deferred              | RLS scenarios cover the data-isolation layer                            |
| i18n / l10n                                     | Single-language app (English)                                                | N/A                                                                     |
| Mobile / native                                 | No mobile build; teacher workstation + smartboard are desktop Chromium       | N/A                                                                     |
| Browser matrix beyond Chromium                  | `playwright.config.ts` has 1 entry; Chromebooks at school are Chromium-based | N/A                                                                     |
| Component-level visual storybook                | Component tests at unit level via Testing Library + jsdom                    | Storybook adoption deferred                                             |
| Synthetic monitoring / production observability | No production deployment beyond Vercel preview; no Datadog / Grafana         | N/A                                                                     |
| Devtools DCE coverage                           | Owned by `npm run check:bundle` (NFR4 / ASR-7) — already CI-required         | Don't duplicate                                                         |
| Migration wizard happy path                     | One-time localStorage → Supabase flow; low ROI                               | Manual smoke on regression incident                                     |

**Note:** All exclusions reviewed by Sallvain via INPUT brief; no stakeholder negotiation needed.

---

## Dependencies & Test Blockers

**CRITICAL:** Authoring **can** start now for everything except R-10 (blocked-on-migration). The four score-9 BLOCK mitigations are unblocked and should be authored first.

### Backend / Architecture Dependencies (none currently blocking)

See `test-design-architecture.md` "Quick Guide" for the full code-side picture. Summary:

- ✅ RLS policies in `supabase/migrations/002_*.sql` — already in place; tests verify, don't author.
- ✅ `REPLICA IDENTITY FULL` on `point_transactions` — already in migration `005`; schema invariant test verifies.
- ✅ Trigger-maintained student totals — already in place; tests assert trigger correctness via SUM equality.
- ✅ `useAwardPoints` ADR-005 §4 (a)-(e) compliance — already in place at `useTransactions.ts:97-235` with inline comments. Tests regression-prevent.
- ✅ Stale-JWT graceful degrade — landed in commit `d652260`. Tests regression-prevent.
- ⚠ **Cluster #2 fix** (orchestrator partial-failure surfacing) — **out of test scope, but tests are authored against expected post-fix UI**. Tests fail today (UI doesn't surface failures), pass once UI is fixed. Acts as drag-along signal.
- ⚠ **KI-1 empty-state infinite loading** — bug-fix on Sallvain's queue. Tests work around via `auth.setup.ts` (don't wait for dashboard) until fix lands.

### Code Migration Dependencies (block specific scenarios, not the run)

| Scenario           | Blocked on                                                              | Unblock action                                                                             |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **SEAT.01-E2E-06** | `useSeatingChart` migration to TanStack + adding seating-chart realtime | PRD Phase 5 lands. Author scenario today with `test.skip` + TODO comment.                  |
| **RT.01-INT-04**   | `useLayoutPresets` migration removing legacy realtime drift             | When migration lands, flip `expect-fail` annotation to assert no `layout_presets` realtime |

### QA Infrastructure Setup — Already in Place

Per `framework-setup-progress.md` (2026-04-28 live run):

1. **Playwright fixtures** — `tests/support/fixtures/index.ts` composes `mergeTests` over base, factories, and helpers.
2. **User factory** — `tests/support/fixtures/factories/user.factory.ts` produces unique faker-based users.
3. **Auth helpers** — `tests/support/helpers/auth.ts` for storageState management.
4. **Supabase admin client** — `tests/support/helpers/supabase-admin.ts` (cached service-role client; same allow-list as `playwright.config.ts`).
5. **Local Supabase lifecycle** — `tests/e2e/global-setup.ts` boots stack, seeds test user; `global-teardown.ts` stops it.

### New Infrastructure Required

**One impersonation-pair fixture** (estimated ~30-45 min) — for RLS scenarios. Pattern:

```typescript
// tests/support/fixtures/impersonation.ts
import { test as base } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Impersonation = {
  userA: SupabaseClient;
  userB: SupabaseClient;
  cleanup: () => Promise<void>;
};

export const test = base.extend<{ impersonation: Impersonation }>({
  impersonation: async ({}, use, testInfo) => {
    // Uses VITE_SUPABASE_URL + service-role key from .env.test (gitignored)
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const aEmail = `userA-${testInfo.testId}@e2e.local`;
    const bEmail = `userB-${testInfo.testId}@e2e.local`;
    const password = 'test-password-change-me';

    const { data: aData } = await admin.auth.admin.createUser({
      email: aEmail,
      password,
      email_confirm: true,
    });
    const { data: bData } = await admin.auth.admin.createUser({
      email: bEmail,
      password,
      email_confirm: true,
    });

    const userA = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
    const userB = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

    await userA.auth.signInWithPassword({ email: aEmail, password });
    await userB.auth.signInWithPassword({ email: bEmail, password });

    await use({
      userA,
      userB,
      cleanup: async () => {
        if (aData.user) await admin.auth.admin.deleteUser(aData.user.id);
        if (bData.user) await admin.auth.admin.deleteUser(bData.user.id);
      },
    });
  },
});
```

**Why this fixture** — every RLS scenario uses it. Build once, reuse across CLASS.01-INT-01..03, STUD.01-INT-01..03, BEH.01-INT-01..02, AWARD.01-INT-03, RT.01-INT-05, SEAT.01-INT-01, SET.01-INT-01..02, RLS.01-INT-00.

---

## Risk Assessment

Full details in `test-design-architecture.md`. This section maps each risk to the QA test that validates it.

### High-Priority Risks (Score ≥ 6)

| Risk ID  | Category | Description                                      | Score | QA Test Coverage                                                                                |
| -------- | -------- | ------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------- |
| **R-01** | SEC      | RLS breach via PostgREST                         | **9** | RLS.01-INT-00 (roll-up); per-table CLASS/STUD/BEH/AWARD/SEAT/SET INT scenarios (16 tests total) |
| **R-02** | SEC      | RLS breach via realtime channel                  | **9** | RT.01-INT-05                                                                                    |
| **R-03** | DATA     | Realtime DELETE without `REPLICA IDENTITY FULL`  | **9** | SCHEMA.01-INT-01, HIST.01-INT-01, HIST.01-INT-02                                                |
| **R-05** | TECH     | Optimistic rollback writes `undefined`           | **9** | AWARD.01-UNIT-02, AWARD.01-E2E-08                                                               |
| **R-04** | DATA     | Trigger totals diverge from log                  | 6     | STUD.01-INT-04, STUD.01-INT-05, HIST.01-INT-03, HIST.01-INT-04, AWARD.01-INT-02                 |
| **R-06** | BUS      | Class-award orchestrator silent partial failures | 6     | AWARD.01-E2E-05, AWARD.01-INT-01                                                                |
| **R-07** | BUS      | Multi-award orchestrator silent partial failures | 6     | AWARD.01-E2E-07                                                                                 |
| **R-08** | TECH     | Stale-JWT loop on refresh                        | 6     | AUTH.01-E2E-05                                                                                  |
| **R-13** | BUS      | Empty-state infinite loading (KI-1)              | 6     | CLASS.01-E2E-02 (asserts CTA renders, **does NOT** wait for dashboard)                          |
| **R-17** | TECH     | Mocked-DB integration false positives            | 6     | Structurally satisfied; documented in `tests/README.md`                                         |
| **R-20** | BUS      | Behavior per-user RLS regression                 | 6     | BEH.01-INT-01, BEH.01-INT-02                                                                    |

### Medium / Low / Blocked Risks

| Risk ID  | Category | Description                                                      | Score           | QA Test Coverage                                                   |
| -------- | -------- | ---------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| R-12     | TECH     | Realtime channel reconnect loses event                           | 4               | HIST.01-INT-05                                                     |
| R-16     | PERF     | Per-student rapid-tap → optimistic write race                    | 4               | AWARD.01-E2E-09                                                    |
| R-18     | TECH     | Snake_case → camelCase transform regression                      | 4               | CLASS.01-UNIT-03, STUD.01-UNIT-02, BEH.01-UNIT-02, CLASS.01-INT-04 |
| R-09     | TECH     | New realtime channel without ADR-005 §6 update                   | 3               | Code-review gate; no test                                          |
| R-11     | DATA     | Optimistic temp ID collision                                     | 2               | AWARD.01-UNIT-03                                                   |
| R-14     | DATA     | Migration wizard data loss                                       | 3               | Out of scope                                                       |
| R-15     | OPS      | Allow-list bypass                                                | 3               | AUTH.01-INT-01                                                     |
| R-19     | DATA     | Sound-settings query lookup race                                 | 2               | SET.01-UNIT-01                                                     |
| **R-10** | DATA     | Cross-device seating-chart drift — `useSeatingChart` no realtime | **6 (blocked)** | SEAT.01-E2E-06 (`test.skip` + TODO until Phase 5)                  |

---

## Entry Criteria

QA testing **can** begin when ALL are met:

- [x] Test framework scaffold complete (`framework-setup-progress.md` 2026-04-28 confirms 109 tests passing across 3 layers)
- [x] Local Supabase stack auto-managed by `tests/e2e/global-setup.ts` (verified working)
- [x] `.env.test` (gitignored) populated with local non-secret credentials
- [x] User factory + auth helpers in place
- [ ] Impersonation-pair fixture authored (one-time, ~30-45 min — first task)
- [x] All required artifacts read (PRD, ADR-005, anti-pattern audit, project-context, INPUT brief)

## Exit Criteria

Testing phase complete when ALL are met:

- [ ] **All P0 scenarios passing in PR pipeline** (39 tests)
- [ ] **All P1 scenarios passing or explicitly triaged** (24 tests; ≥ 95% pass rate allowed)
- [ ] No open critical bugs (any score ≥ 6 risk lacking passing test coverage)
- [ ] PR pipeline runtime under 15 min on chromium
- [ ] Nightly pipeline runtime under 30 min
- [ ] Every test passes the **Test Quality DoD** (no `waitForTimeout`, no try/catch flow control, < 300 LOC, < 1.5 min per test, self-cleaning, parallel-safe, unique data via `faker`, explicit assertions in test bodies)
- [ ] Selector strategy followed: `getByRole > getByLabel > getByText({exact: true}) > getByTestId > locator(css)`
- [ ] R-10 (SEAT.01-E2E-06) authored with `test.skip` + TODO; un-skip when `useSeatingChart` migrates

---

## Test Coverage Plan

> **IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

### P0 (Critical — Blocks Release)

**Criteria:** Blocks core functionality + score-9 risk OR blocks release per project priority anchors (RLS / auth / data corruption / realtime DELETE invariant).

| Test ID              | Requirement                                                                                                    | Test Level | Risk Link       | Notes                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- | --------------- | ------------------------------------------------------------------------ |
| **AUTH.01-E2E-02**   | Invalid credentials shows error and stays on login                                                             | E2E        | R-08            | Sad-path                                                                 |
| **AUTH.01-E2E-03**   | Valid credentials → dashboard with `Welcome Back` heading                                                      | E2E        | —               | Happy-path; gates all other features                                     |
| **AUTH.01-E2E-04**   | `Sign out` button → redirect to login + storageState cleared                                                   | E2E        | —               | Verify lowercase post-redesign                                           |
| **AUTH.01-E2E-05**   | Stale JWT (forged): refresh fails → graceful redirect, no loop                                                 | E2E        | R-08, ASR-8     | Direct guard for fix `d652260`. Forge `sb-` localStorage entry           |
| **AUTH.01-E2E-06**   | AuthGuard short-circuits unauthenticated access                                                                | E2E        | —               |                                                                          |
| **CLASS.01-E2E-01**  | Create classroom from sidebar `+` icon                                                                         | E2E        | —               | Selector update from INPUT brief                                         |
| **CLASS.01-INT-01**  | RLS — User A cannot SELECT User B's classrooms via PostgREST                                                   | INT        | R-01, ASR-1     | Uses impersonation-pair fixture                                          |
| **CLASS.01-INT-02**  | RLS — User A cannot UPDATE/DELETE User B's classroom (0 rows affected, not error)                              | INT        | R-01, ASR-1     |                                                                          |
| **CLASS.01-INT-03**  | RLS — anonymous client cannot SELECT any classroom                                                             | INT        | R-01, ASR-1     |                                                                          |
| **STUD.01-E2E-01**   | Add student → appears in grid with `pointTotal === 0`                                                          | E2E        | —               |                                                                          |
| **STUD.01-E2E-06**   | Realtime: award in tab A → tab B shows updated total within 2s (students channel)                              | E2E        | ASR-2 strength  | Multi-page Playwright; `recurse` polling                                 |
| **STUD.01-INT-01**   | RLS — User A cannot SELECT students in User B's classroom                                                      | INT        | R-01, ASR-1     |                                                                          |
| **STUD.01-INT-02**   | RLS — User A cannot INSERT student into User B's classroom                                                     | INT        | R-01, ASR-1     |                                                                          |
| **STUD.01-INT-03**   | RLS — User A cannot UPDATE/DELETE student in User B's classroom                                                | INT        | R-01, ASR-1     |                                                                          |
| **STUD.01-INT-04**   | `students.point_total === SUM(point_transactions.points)` after award/undo/clear/reset                         | INT        | R-04, ASR-4     | Trigger correctness                                                      |
| **BEH.01-INT-01**    | RLS — User A's behaviors not visible to User B; defaults visible to both                                       | INT        | R-20, ASR-1     | Per-user vs shared-defaults model                                        |
| **BEH.01-INT-02**    | RLS — User A cannot UPDATE/DELETE User B's custom behaviors                                                    | INT        | R-20, ASR-1     |                                                                          |
| **AWARD.01-E2E-01**  | Award positive points → optimistic increment within ~100ms                                                     | E2E        | ASR-5           | Assert before network settles                                            |
| **AWARD.01-E2E-02**  | Award negative points → total decrements; positive/negative time-totals correct                                | E2E        | ASR-4           |                                                                          |
| **AWARD.01-E2E-03**  | Multiple awards accumulate (3 +1 = +3; 2 +1 then 1 -1 = +1)                                                    | E2E        | ASR-4           |                                                                          |
| **AWARD.01-E2E-04**  | Class-award → all students in classroom increment                                                              | E2E        | ASR-4           |                                                                          |
| **AWARD.01-E2E-05**  | Class-award **with simulated per-student failure** → UI surfaces failure count (drag-along for cluster #2 fix) | E2E        | R-06, KI-2      | Use Playwright `route` interception to force 4xx for one student         |
| **AWARD.01-E2E-06**  | Multi-award (subset) → only selected students update                                                           | E2E        | ASR-4           |                                                                          |
| **AWARD.01-E2E-07**  | Multi-award **with simulated per-student failure** → UI surfaces failure count                                 | E2E        | R-07, KI-2      |                                                                          |
| **AWARD.01-E2E-08**  | Award fails (4xx) → optimistic rollback to pre-award value (no `undefined` flash)                              | E2E        | R-05, ASR-5     | Forge 4xx via Playwright `route`                                         |
| **AWARD.01-INT-01**  | `point_transactions` row count after class-award equals student count at click time                            | INT        | ASR-4           |                                                                          |
| **AWARD.01-INT-02**  | `students.point_total` updates exactly once per award (trigger idempotency)                                    | INT        | R-04, ASR-4     |                                                                          |
| **AWARD.01-INT-03**  | RLS — User A cannot INSERT into `point_transactions` referencing User B's student                              | INT        | R-01, ASR-1     |                                                                          |
| **AWARD.01-UNIT-01** | `useAwardPoints.onMutate` is idempotent (StrictMode double-invoke produces ONE patch)                          | UNIT       | ASR-5 (b)       | ADR-005 §4 (b)                                                           |
| **AWARD.01-UNIT-02** | `useAwardPoints.onError` rollback null-guards `context?.previousX !== undefined`                               | UNIT       | R-05, ASR-5 (a) | ADR-005 §4 (a). **Critical regression guard.**                           |
| **HIST.01-E2E-01**   | Award then undo → student total returns to pre-award; transaction removed                                      | E2E        | ASR-4           |                                                                          |
| **HIST.01-E2E-02**   | Undo batch (class-award) → all per-student transactions removed atomically; totals revert                      | E2E        | ASR-4           |                                                                          |
| **HIST.01-E2E-03**   | Clear student points → all student transactions removed; total = 0                                             | E2E        | ASR-4           |                                                                          |
| **HIST.01-E2E-04**   | Reset classroom points → all transactions across classroom removed; all totals = 0                             | E2E        | ASR-4           |                                                                          |
| **HIST.01-INT-01**   | `point_transactions` table has `REPLICA IDENTITY FULL`                                                         | INT        | R-03, ASR-3     | `SELECT relreplident FROM pg_class WHERE relname = 'point_transactions'` |
| **HIST.01-INT-02**   | DELETE on `point_transactions` arrives at realtime subscriber with non-empty `payload.old`                     | INT        | R-03, ASR-3     | End-to-end validation of REPLICA IDENTITY FULL                           |
| **HIST.01-INT-03**   | After undo, `students.point_total` decrements by exact undone delta                                            | INT        | R-04            |                                                                          |
| **RT.01-E2E-01**     | Two browsers, same user: award in A → B's total updates within 2s                                              | E2E        | —               | Multi-page Playwright                                                    |
| **RT.01-E2E-02**     | Two browsers, same user: undo in A → B's transaction list updates                                              | E2E        | R-12            |                                                                          |
| **RT.01-INT-01**     | INSERT into `students` → event arrives on `students` realtime channel                                          | INT        | —               | Sanity check on transport                                                |
| **RT.01-INT-05**     | RLS over realtime: User A subscribes to `students` channel → does NOT receive User B's events                  | INT        | R-02, ASR-1     | The RLS-realtime intersection                                            |
| **RLS.01-INT-00**    | Roll-up: every user-scoped table has expected RLS policy                                                       | INT        | R-01, ASR-1     | `pg_policies` introspection                                              |
| **SCHEMA.01-INT-01** | Every realtime DELETE-watching table has `REPLICA IDENTITY FULL`                                               | INT        | R-03, ASR-3     | Schema invariant test                                                    |
| **SCHEMA.01-INT-02** | `tg_update_student_totals` (or current name) fires on `point_transactions` INSERT/UPDATE/DELETE                | INT        | R-04, ASR-4     | `pg_trigger` introspection                                               |
| **SEAT.01-INT-01**   | RLS — User A cannot SELECT seating data for User B's classroom                                                 | INT        | R-01, ASR-1     |                                                                          |
| **SET.01-INT-01**    | RLS — User A cannot SELECT User B's `sound_settings`                                                           | INT        | R-01, ASR-1     |                                                                          |
| **SET.01-INT-02**    | RLS — User A cannot SELECT User B's `layout_presets`                                                           | INT        | R-01, ASR-1     |                                                                          |

**Total P0:** 39 scenarios.

### P1 (High — Must Fix Before Next Sprint)

**Criteria:** Important features + score 6-8 risk + common workflows + workaround difficult.

| Test ID              | Requirement                                                                          | Test Level | Risk Link   | Notes                                                  |
| -------------------- | ------------------------------------------------------------------------------------ | ---------- | ----------- | ------------------------------------------------------ |
| **AUTH.01-E2E-01**   | Login form renders (email + password + Sign In button)                               | E2E        | —           | Selector floor; from legacy `auth.spec.ts`             |
| **AUTH.01-INT-01**   | `playwright.config.ts` parser refuses non-private host                               | UNIT       | R-15, TS-1  | Pure config-parser test; no real network               |
| **CLASS.01-E2E-02**  | Empty-state CTA (`Create your first`) appears when `classrooms.length === 0`         | E2E        | R-13        | Asserts CTA only, **does NOT** wait for dashboard load |
| **CLASS.01-E2E-03**  | Switch active classroom → `activeClassroomId` updates; main pane re-renders          | E2E        | —           |                                                        |
| **CLASS.01-E2E-04**  | Edit classroom name → propagates to sidebar + heading                                | E2E        | —           |                                                        |
| **CLASS.01-E2E-05**  | Delete classroom with confirmation → removed from sidebar; fallback or empty-state   | E2E        | —           |                                                        |
| **CLASS.01-UNIT-01** | `useCreateClassroom` invalidates `queryKeys.classrooms.all` on success               | UNIT       | —           | TanStack mutation test                                 |
| **STUD.01-E2E-02**   | Add student with empty name → validation error                                       | E2E        | —           |                                                        |
| **STUD.01-E2E-03**   | Edit student name → propagates                                                       | E2E        | —           |                                                        |
| **STUD.01-E2E-04**   | Remove student → card removed; FK cascade deletes their transactions                 | E2E        | R-04        |                                                        |
| **STUD.01-INT-05**   | `students.today_total` resets at server day boundary                                 | INT        | R-04, ASR-4 | Trigger time-window logic                              |
| **BEH.01-E2E-01**    | Add custom behavior → appears in grid                                                | E2E        | —           |                                                        |
| **BEH.01-E2E-02**    | Edit behavior label/value → reflected in award modal                                 | E2E        | —           |                                                        |
| **BEH.01-UNIT-01**   | `useAddBehavior` plain mutation: `onSettled` invalidates `queryKeys.behaviors.all`   | UNIT       | —           | Canonical "plain mutation" reference                   |
| **AWARD.01-UNIT-03** | Optimistic temp ID format `optimistic-{studentId}-{behaviorId}-{timestamp}`          | UNIT       | R-11, ASR-6 | ADR-005 §4 (c)                                         |
| **AWARD.01-UNIT-04** | `useAwardPoints.onMutate` reads via `qc.getQueryData(...)`, not closure              | UNIT       | ASR-5 (e)   | ADR-005 §4 (e)                                         |
| **HIST.01-E2E-05**   | Adjust student points (manual delta) → transaction logged with adjustment marker     | E2E        | ASR-4       |                                                        |
| **HIST.01-INT-04**   | After clearStudentPoints, `today_total` / `this_week_total` also reset               | INT        | R-04        |                                                        |
| **RT.01-INT-02**     | Subscribe to `classrooms` → no events fire                                           | INT        | ASR-2       | Negative-realtime-scope                                |
| **RT.01-INT-03**     | Subscribe to `behaviors` → no events                                                 | INT        | ASR-2       |                                                        |
| **RT.01-INT-06**     | Subscription cleanup: unmount + remount → no duplicate subscriptions (NFR6)          | UNIT       | —           | Pre-existing test; ensure stays green                  |
| **SEAT.01-E2E-01**   | Open seating chart → grid renders with all students placed or unassigned bucket      | E2E        | —           |                                                        |
| **SEAT.01-E2E-02**   | Drag student seat → on drop, position persists; reload preserves                     | E2E        | —           | In-device persistence                                  |
| **SEAT.01-E2E-03**   | Drag a group → group + member seats move together                                    | E2E        | —           |                                                        |
| **SEAT.01-INT-02**   | `seating_seats` UPDATE persists; FK constraints hold                                 | INT        | —           |                                                        |
| **SET.01-UNIT-01**   | `SoundContext` does NOT issue query before `useAuth()` resolves (provider hierarchy) | UNIT       | R-19        | TS-3                                                   |

**Total P1:** 24 scenarios. (Note: AUTH.01-INT-01 is conceptually a unit test on the config parser, classified P1 for execution priority.)

### P2 (Medium — Fix This Sprint)

**Criteria:** Secondary features + low/medium risk + edge cases + regression prevention.

| Test ID          | Requirement                                                                                         | Test Level | Risk Link |
| ---------------- | --------------------------------------------------------------------------------------------------- | ---------- | --------- |
| AUTH.01-UNIT-01  | `useAuth` provider initialization with no session → `user === null`, no redirect side effect        | UNIT       | —         |
| CLASS.01-INT-04  | New DB column picked up by `useClassrooms` queryFn select                                           | INT        | R-18      |
| CLASS.01-UNIT-02 | `useUpdateClassroom` rejects payload with extra fields (supabase-js 2.104 `RejectExcessProperties`) | UNIT       | R-18      |
| CLASS.01-UNIT-03 | `dbToClassroom` transform: snake_case → camelCase                                                   | UNIT       | R-18      |
| STUD.01-E2E-05   | Import students from CSV/paste → all parsed students appear; count matches                          | E2E        | —         |
| STUD.01-UNIT-01  | `studentParser` handles CSV with quoted commas, BOM, trailing newlines                              | UNIT       | —         |
| STUD.01-UNIT-02  | `dbToStudent` transform: snake_case → camelCase including time-totals                               | UNIT       | R-18      |
| BEH.01-E2E-03    | Delete custom behavior → removed; existing transactions remain (FK behavior)                        | E2E        | R-04      |
| BEH.01-UNIT-02   | `dbToBehavior` transform: snake_case → camelCase                                                    | UNIT       | R-18      |
| AWARD.01-E2E-09  | Rapid-tap 10 awards → final total matches expected; no duplicate transactions                       | E2E        | R-16      |
| HIST.01-INT-05   | Realtime channel reconnect after blip → invalidate-on-reconnect refetches; no event lost            | INT        | R-12      |
| RT.01-INT-04     | Subscribe to `layout_presets` → currently emits (legacy drift); marked `expect-fail`                | INT        | ASR-2     |
| SEAT.01-E2E-04   | Save layout as preset → preset selectable; load → seats rearrange                                   | E2E        | —         |
| SEAT.01-INT-03   | `layout_data` JSONB round-trips through `dbToLayoutPreset` with all documented fields non-null      | INT        | TC-8      |
| SET.01-E2E-01    | Toggle sound effect setting → persists across reload                                                | E2E        | —         |
| SET.01-E2E-02    | Update profile display name → reflected in header / profile pane                                    | E2E        | —         |
| SET.01-UNIT-02   | Sound effects pre-existing 18 tests stay green                                                      | UNIT       | —         |

**Total P2:** 17 scenarios. (4 additional are tagged in the coverage matrix but rolled up here.)

### P3 (Low — Backlog)

| Test ID        | Requirement                                                                         | Test Level | Notes                   |
| -------------- | ----------------------------------------------------------------------------------- | ---------- | ----------------------- |
| SEAT.01-E2E-05 | Lock-tables toggle prevents table-element drag                                      | E2E        | UI polish               |
| SET.01-E2E-03  | Theme toggle (light/dark) → applies + persists                                      | E2E        | UI polish               |
| (existing-1)   | `leaderboardCalculations.test.ts` stays green                                       | UNIT       | Background              |
| (existing-2)   | `useRotatingCategory.test.ts` stays green (debt: missing `useRealTimers()` cleanup) | UNIT       | KI-5; pre-existing debt |

**Total P3:** 4 scenarios (mostly background-existing).

### Blocked

| Test ID        | Requirement                                              | Risk Link | Notes                                                                             |
| -------------- | -------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| SEAT.01-E2E-06 | Two browsers, same user: drag in A → B updates within 2s | R-10      | `test.skip("BLOCKED: useSeatingChart has no realtime — unblocks at PRD Phase 5")` |

**Total blocked:** 1 scenario.

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless infrastructure overhead makes it slow. Playwright with parallelization + Vitest 4 are fast enough that a 93-scenario suite should fit under 15 min.

### Every PR (~10-15 min target)

**All UNIT tests** (16 net-new + 86 existing = ~102 total):

- Vitest 4 + jsdom; expected runtime ~25-40 seconds.

**All INT tests** (32 scenarios) **except** `RT.01-INT-05`:

- Vitest 4 + node + real local Postgres (via `tests/e2e/global-setup.ts` lifecycle).
- Expected runtime ~3-5 min.
- `RT.01-INT-05` (RLS-over-realtime) defers to nightly because of channel-establish race — flaky on every-PR cadence.

**All P0 E2E scenarios** (~28 of 45 E2E scenarios):

- Playwright + chromium + storageState.
- Expected runtime ~6-10 min.

**Total PR pipeline:** ~10-15 min.

### Nightly (~25-30 min target)

- Everything in PR pipeline +
- All remaining P1/P2/P3 E2E scenarios (~17 additional E2E)
- `RT.01-INT-05` (RLS-over-realtime, slow due to channel timing)
- Burn-in mode for `AWARD.01-E2E-09` (rapid-tap stress) — 10 iterations on touched files

### Weekly / On-demand

- **R-10 / SEAT.01-E2E-06** when `useSeatingChart` migration lands (tagged `@migration-pending`)
- **RT.01-INT-04** legacy-drift expected-fail flag (tagged `@drift-expected`)
- Manual smoke for migration-wizard, browser-matrix exploration

### Tagging Convention

```
@p0  @p1  @p2  @p3                                           priority
@auth @classroom @student @behavior @award @history          feature
@realtime @seating @settings                                  feature (cont.)
@rls  @schema  @realtime                                      cross-cutting
@migration-pending                                            blocked scenarios
@drift-expected                                                legacy-drift scenarios
@stress                                                        burn-in candidates
```

Run examples (mapping to existing `package.json` scripts in this repo):

```bash
npm run test:e2e -- --grep "@p0"                       # PR-equivalent E2E gate
npm run test:e2e -- --grep "(@p0|@p1)"                 # P0+P1 release-floor
npm run test:e2e -- --grep "@migration-pending" --grep-invert  # skip blocked
npm test -- src/test/                                  # all unit tests
npm test -- tests/integration/                         # all integration
```

---

## QA Effort Estimate

QA test development effort. Solo contributor + AI-assist via `bmad-testarch-atdd` and `bmad-testarch-automate`.

| Priority        | Count                                  | Effort Range     | Notes                                                                                                                                       |
| --------------- | -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| P0              | 39                                     | **~30-45 hours** | 16 RLS scenarios (heavy initial fixture build, then ~15-20 min each) + 9 award optimistic + 7 schema invariants + 7 auth/feature happy-path |
| P1              | 24                                     | **~18-28 hours** | Mostly E2E happy-path + UNIT mutation/transform tests. Lighter fixtures.                                                                    |
| P2              | 17                                     | **~10-18 hours** | Edit/delete + settings + JSONB drift guard + transforms.                                                                                    |
| P3              | 4                                      | **~2-4 hours**   | UI polish + background-existing.                                                                                                            |
| Blocked / Drift | 2                                      | **~1 hour**      | Author `test.skip` + TODO; trivial.                                                                                                         |
| **Total**       | **86 net-new** + 4 existing-stay-green | **~60-95 hours** | Spread across 3-4 sprints if interleaved with feature work; less if focused sprint.                                                         |

**Calibration anchors:**

- Existing 109-test scaffold took ~2 days active framework setup (per `framework-setup-progress.md`)
- Per-RLS scenario: ~30-45 min for the first (impersonation fixture build), then ~15-20 min per additional table
- Per-E2E scenario with new selectors: ~30-60 min including selector validation against live UI
- Per-UNIT for migrated TanStack hook: ~10-25 min once `vi.mock('../lib/supabase', ...)` pattern is established

**Assumptions:**

- Includes test design, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% of authoring effort)
- Test infrastructure (factories, fixtures, environments) ready except impersonation-pair fixture

---

## Implementation Planning Handoff

Suggested sprint sequencing for solo + AI-assist execution:

| Work Item                                                                          | Owner               | Target                           | Dependencies / Notes                                                            |
| ---------------------------------------------------------------------------------- | ------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| Author impersonation-pair fixture                                                  | Sallvain            | Sprint 1, day 1                  | Blocks all RLS scenarios                                                        |
| Score-9 BLOCK mitigations (RLS x2, REPLICA IDENTITY x1, rollback x1)               | Sallvain + atdd     | Sprint 1                         | R-01, R-02, R-03, R-05 — release gate                                           |
| Score 6-8 high-priority mitigations (R-04, R-06..R-08, R-13, R-17, R-20)           | Sallvain + atdd     | Sprint 1-2                       | Cluster #2 fix is parallel code-side track                                      |
| P1 happy-path E2E + UNIT (auth, classroom, student CRUD)                           | Sallvain + automate | Sprint 2                         | After P0 done                                                                   |
| P2 secondary features                                                              | Sallvain + automate | Sprint 3                         | Edit/delete + settings + JSONB drift guard                                      |
| P3 polish                                                                          | Sallvain + automate | Sprint 4 or skip if time-pressed | Lock-tables + theme                                                             |
| Cluster #2 code fix (out of test scope but unblocks R-06/R-07 tests to fully pass) | Sallvain (code)     | Sprint 2                         | When done, delete lying comments at `ClassAwardModal:64` + `MultiAwardModal:62` |
| KI-1 empty-state Suspense fix                                                      | Sallvain (code)     | Sprint 1-2                       | Removes auth.setup workaround                                                   |
| `useSeatingChart` migration (PRD Phase 5) → unblocks SEAT.01-E2E-06                | Sallvain (code)     | Future PRD work                  | Architecture doc has Phase 5 file plan ready                                    |

---

## Tooling & Access

| Tool / Service                                     | Purpose                                            | Access | Status                                    |
| -------------------------------------------------- | -------------------------------------------------- | ------ | ----------------------------------------- |
| Local Supabase CLI                                 | INT + E2E local stack                              | local  | ✅ Ready                                  |
| `.env.test`                                        | Local non-secret credentials (anon + service-role) | local  | ✅ Ready (gitignored)                     |
| Playwright + chromium                              | E2E execution                                      | local  | ✅ Ready                                  |
| Vitest 4 + jsdom                                   | Unit tests                                         | local  | ✅ Ready                                  |
| Vitest 4 + node                                    | Integration tests against real Postgres            | local  | ✅ Ready (`vitest.integration.config.ts`) |
| `tests/support/helpers/supabase-admin.ts`          | Service-role admin client with allow-list          | local  | ✅ Ready                                  |
| `tests/support/fixtures/factories/user.factory.ts` | Faker-based user factory                           | local  | ✅ Ready                                  |
| `bmad-testarch-atdd` skill                         | Generate red-phase acceptance tests                | local  | ✅ Ready                                  |
| `bmad-testarch-automate` skill                     | Expand test coverage                               | local  | ✅ Ready                                  |
| `fnox exec`                                        | Hosted Supabase access (NOT used for tests)        | local  | N/A — tests are local-only                |

No external access requests needed. No third-party tools.

---

## Interworking & Regression

Services / components impacted by this catalog (regression scope when each is modified):

| Component / Service                     | Impact                                                            | Regression Scope                             | Validation                                                      |
| --------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| `AppContext.tsx`                        | UI/session state; legacy wrappers (Phase 4 dissolve target)       | All P0 + P1 award/orchestrator E2E scenarios | Re-run AWARD.01-E2E-_ + HIST.01-E2E-_ on any AppContext PR      |
| `useAwardPoints` (`useTransactions.ts`) | Canonical optimistic-mutation site; ADR-005 §4 (a)-(e) compliance | AWARD.01-UNIT-01..04 + AWARD.01-E2E-08       | Mandatory pre-merge for any change to lines 86-235              |
| `useRealtimeSubscription`               | All 3 official channels                                           | RT.01-INT-\* + STUD.01-E2E-06                | Re-run on any signature change; NFR6 unit test guards lifecycle |
| `playwright.config.ts` allow-list       | Security boundary                                                 | AUTH.01-INT-01                               | Mandatory pre-merge for any config change                       |
| `supabase/migrations/*.sql`             | RLS, REPLICA IDENTITY, triggers                                   | All P0 INT scenarios + SCHEMA.01-INT-\*      | Mandatory full INT run on any new migration                     |
| `ClassAwardModal` / `MultiAwardModal`   | Cluster #2 silent-failure orchestrators                           | AWARD.01-E2E-05, AWARD.01-E2E-07             | Tests transition red → green when cluster #2 fix lands          |

**Regression test strategy:**

- PR pipeline (P0 + UNIT + INT) runs on every PR. Mandatory pre-merge.
- Any change touching `AppContext.tsx`, `useTransactions.ts`, `useStudents.ts`, `useRealtimeSubscription.ts`, or `supabase/migrations/*` triggers extended nightly run before merge.
- Schema changes (`supabase/migrations/*`) MUST run the full INT suite locally before pushing.

---

## Appendix A: Code Examples & Tagging

### Tagged tests for selective execution

```typescript
// tests/e2e/award.spec.ts
import { test, expect } from '../support/fixtures';

test.describe('Award Points', () => {
  test('award positive → optimistic increment within ~100ms @p0 @award @realtime', async ({
    authenticatedPage,
  }) => {
    // P0: optimistic visibility regression guard for ADR-005 §4
    await authenticatedPage.goto('/');
    // ... open AwardPointsModal, click +1, assert before network settles ...
  });

  test('award fails → rollback to pre-award value @p0 @award', async ({ authenticatedPage }) => {
    // P0 R-05 / ASR-5 (a) — rollback null-guard regression guard
    await authenticatedPage.route('**/rest/v1/point_transactions', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'forced' }) })
    );
    // ... click +1, assert UI snaps back to pre-award total, no `undefined` flash ...
  });

  test.skip('two browsers seating-chart sync @p1 @realtime @seating @migration-pending', async ({
    browser,
  }) => {
    // BLOCKED on R-10 — useSeatingChart has no realtime channel.
    // Unblocks when PRD Phase 5 lands and adds the seating-chart channel per ADR-005 §6.
  });
});
```

### Backend integration with impersonation-pair fixture

```typescript
// tests/integration/rls/classrooms.test.ts
import { describe, it, expect } from 'vitest';
import { test } from '../support/impersonation';

describe('Classrooms RLS', () => {
  it('User A cannot SELECT User B classrooms @p0 @rls @classroom', async () => {
    const { userA, userB, cleanup } = await setupImpersonationPair();
    try {
      await userB.from('classrooms').insert({ name: 'B-only' });
      const { data } = await userA.from('classrooms').select('*');
      expect(data?.find((r) => r.name === 'B-only')).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
});
```

### Realtime + RLS

```typescript
// tests/integration/realtime/students-rls.test.ts
import { describe, it, expect } from 'vitest';

describe('Students realtime + RLS', () => {
  it('User A does not receive User B row events @p0 @realtime @rls', async () => {
    const { userA, userB } = await setupImpersonationPair();
    const events: unknown[] = [];

    const channel = userA
      .channel('students-test')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) =>
        events.push(payload)
      )
      .subscribe();

    // Wait for SUBSCRIBED
    await new Promise<void>((resolve) => {
      const i = setInterval(() => {
        if (channel.state === 'joined') {
          clearInterval(i);
          resolve();
        }
      }, 50);
    });

    // User B inserts a student in their own classroom — User A should NOT receive
    await userB.from('students').insert({ name: 'B-only', classroom_id: '...' });

    // Wait briefly for any potential leak
    await new Promise((r) => setTimeout(r, 1000));

    expect(events).toHaveLength(0);
    await userA.removeChannel(channel);
  });
});
```

### Run-by-tag commands

```bash
npm run test:e2e -- --grep "@p0"                    # P0 release-gate E2E
npm run test:e2e -- --grep "(@p0|@p1)"              # P0+P1 release-floor
npm run test:e2e -- --grep "@rls"                   # Backend RLS scenarios only
npm run test:e2e -- --grep "@realtime"              # Realtime scenarios
npm test -- --grep "@p0"                            # P0 unit tests
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `risk-governance.md` — 1-9 score matrix, gate decision engine
- **Probability/Impact**: `probability-impact.md` — DOCUMENT/MONITOR/MITIGATE/BLOCK action thresholds
- **Test Levels**: `test-levels-framework.md` — UNIT/INT/E2E selection rules
- **Test Priorities**: `test-priorities-matrix.md` — P0-P3 criteria with risk-score mapping
- **Test Quality DoD**: `test-quality.md` — no `waitForTimeout`, ≤ 300 LOC, ≤ 1.5 min, self-cleaning, parallel-safe
- **ADR Quality Readiness**: `adr-quality-readiness-checklist.md` — 8-category 29-criteria framework
- **Playwright Utils**: `overview.md`, `api-request.md`, `auth-session.md`, `recurse.md`, `intercept-network-call.md`, `network-recorder.md`, `network-error-monitor.md`, `network-first.md`, `log.md`, `file-utils.md`, `fixtures-composition.md`
- **Playwright CLI**: `playwright-cli.md` — `--debug=cli` agent-side test debugging
- **ClassPoints sources**: `_bmad-output/project-context.md`, `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/architecture.md`, `docs/adr/ADR-005-queryclient-defaults.md`, `_bmad-output/anti-pattern-audit.md`, `INPUT-classpoints-test-design-brief.md`

---

**Generated by:** TEA Master Test Architect
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
