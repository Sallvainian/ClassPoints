---
stepsCompleted:
  [
    'step-01-load-context',
    'step-02-discover-tests',
    'step-03-quality-evaluation',
    'step-03f-aggregate-scores',
    'step-04-generate-report',
  ]
lastStep: 'step-04-generate-report'
lastSaved: '2026-04-28'
workflowType: 'testarch-test-review'
reviewScope: 'suite'
detectedStack: 'fullstack'
playwrightUtilsProfile: 'full-ui-api'
inputDocuments:
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/selective-testing.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/test-healing-patterns.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/timing-debugging.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/overview.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/api-request.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/intercept-network-call.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/recurse.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/log.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/file-utils.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/network-error-monitor.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/fixtures-composition.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/playwright-cli.md
  - _bmad-output/test-artifacts/test-design/classpoints-handoff.md
  - _bmad-output/test-artifacts/traceability/traceability-matrix.md
  - _bmad-output/test-artifacts/traceability/gate-decision.json
  - _bmad-output/test-artifacts/known-failures.md
  - _bmad-output/test-artifacts/automation-summary.md
  - playwright.config.ts
  - vitest.config.ts
  - tests/README.md
---

# Test Quality Review: ClassPoints Suite

**Quality Score**: 78/100 (C — Acceptable)
**Review Date**: 2026-04-28
**Review Scope**: suite
**Reviewer**: Sallvain (TEA: Master Test Architect)

---

## Executive Summary

**Overall Assessment**: Acceptable

**Recommendation**: Request Changes — block merge of new e2e flows / Wave 1b automation until the two HIGH-severity findings are resolved. Existing Wave 1a useAwardPoints tests stand on their own merit and can ship.

### Key Strengths

- ✅ Playwright e2e fixture architecture is correct: `mergeTests(logTest, apiRequestTest, recurseTest)` composition, real `UserFactory` with cleanup ledger, BDD Given/When/Then test names.
- ✅ Fail-closed network allow-list at `playwright.config.ts:33-38` (loopback + RFC1918 + Tailscale CGNAT only) prevents accidental production-Supabase E2E runs.
- ✅ Pure-logic tests (`leaderboardCalculations.test.ts`, `studentParser.test.ts`, `useRotatingCategory.test.ts`) have zero mocks, zero hard waits, zero conditionals — clean determinism.
- ✅ Wave 1a `useAwardPoints.test.ts` (4 P0 ADR-005 §4 regression-guard tests) passes green and follows the test-design priorities cleanly.

### Key Weaknesses

- ❌ **`src/test/setup.ts` does not shim `window.localStorage`**, blowing up `ThemeContext` at mount and producing 13 hard failures across `TeacherDashboard.test.tsx` before any test body runs. This is the single highest-leverage fix in the repo.
- ❌ **Zero test IDs and zero priority markers** suite-wide. The trace workflow already FAIL-gated coverage; in-test traceability hooks are also absent, so future trace runs cannot correlate fixes to requirements without re-mapping by hand.
- ❌ **Two raw `setTimeout(resolve, 10)` flush hacks** in `useRealtimeSubscription.test.ts` are racing with `waitFor()` — flake risk under load even though tests currently pass.

### Summary

Out of 112 tests across 9 files, 95 pass and 13 fail; **all 13 failures share one root cause**, a missing localStorage shim in the Vitest setup file. Once that is fixed, the suite drops from ~12% failure to 0%. The deeper structural issue is traceability: the suite has no test IDs or priority tags, so the FAIL gate from the recent `bmad-testarch-trace` run cannot be progressively burned down without manual re-correlation. Quality dimensions split cleanly: deterministic and parallelizable in design (B-grade determinism + performance), modestly weaker on isolation (fake-timers and global mutations not always restored) and maintainability (no traceability hooks, two oversized files, two placeholder spec files). Approve the existing Wave 1a tests as-is; block any further wave on a fix to `setup.ts` and adoption of a test-ID convention.

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Step 1 — Context & Knowledge Base

### 1.1 Scope Determination

- **review_scope**: `suite` (all tests in repo)
- **test_stack_type**: `fullstack` (explicit in `_bmad/tea/config.yaml:13`)
- **detected_stack**: fullstack — React + Supabase frontend with TypeScript, Vitest unit/component, Playwright e2e
- **Playwright Utils profile**: **Full UI+API** — browser tests detected (`tests/e2e/example.spec.ts`, page-objects scaffolding, auth.setup.ts)
- **Pact / contract tests**: out of scope (`tea_use_pactjs_utils: false`, no pact files in repo)
- **Browser automation mode**: `auto` → load `playwright-cli.md`

### 1.2 Knowledge Base Loaded

**Core fragments (always-load, suite-applicable):**

- `test-quality.md` — Definition of Done: no hard waits, ≤300 lines, ≤1.5 min, self-cleaning
- `data-factories.md` — Factory functions w/ overrides, API-first setup
- `test-levels-framework.md` — Unit vs integration vs E2E selection
- `selective-testing.md` — Tag/grep usage, duplicate-coverage detection
- `test-healing-patterns.md` — Failure-pattern → automated-fix recipes (key for known-failures triage)
- `selector-resilience.md` — Robust locators, debugging
- `timing-debugging.md` — Race conditions, deterministic waits

**Playwright Utils — Full UI+API profile** (`tea_use_playwright_utils: true`, browser tests present):

- `overview.md`, `api-request.md`, `network-recorder.md`, `auth-session.md`, `intercept-network-call.md`, `recurse.md`, `log.md`, `file-utils.md`, `burn-in.md`, `network-error-monitor.md`, `fixtures-composition.md`

**Playwright CLI** (`tea_browser_automation: auto`):

- `playwright-cli.md`

**NOT loaded (out of scope):** Pact.js Utils (`tea_use_pactjs_utils: false`), Pact MCP (`tea_pact_mcp: none`), specialized email-auth/visual-debugging/feature-flags/webhook (no relevant patterns in current tests).

### 1.3 Context Artifacts Found

| Artifact                 | Path                                                              | Purpose                                                    |
| ------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Test design handoff      | `_bmad-output/test-artifacts/test-design/classpoints-handoff.md`  | P0/P1/P2 catalog & priorities                              |
| Traceability matrix      | `_bmad-output/test-artifacts/traceability/traceability-matrix.md` | 94-row coverage map (10.6% FULL+PARTIAL)                   |
| Gate decision            | `_bmad-output/test-artifacts/traceability/gate-decision.json`     | FAIL — automation-gap                                      |
| Known failures inventory | `_bmad-output/test-artifacts/known-failures.md`                   | 13 pre-existing TeacherDashboard.test.tsx failures         |
| Automation summary       | `_bmad-output/test-artifacts/automation-summary.md`               | Wave 1a closeout (4 useAwardPoints regression-guard tests) |
| Playwright config        | `playwright.config.ts`                                            | E2E framework config                                       |
| Vitest config            | `vitest.config.ts`                                                | Unit/component framework config                            |
| Tests README             | `tests/README.md`                                                 | Test-suite layout & conventions                            |

### 1.4 Inferred Test Inventory (preview — full discovery in Step 2)

- **Unit/component (Vitest)**: 7 files
  - `src/test/leaderboardCalculations.test.ts`
  - `src/test/TeacherDashboard.test.tsx` (13 known failures)
  - `src/test/useRotatingCategory.test.ts`
  - `src/test/sounds.test.ts`
  - `src/hooks/__tests__/useAwardPoints.test.ts` (Wave 1a, 4 tests, GREEN)
  - `src/hooks/__tests__/useRealtimeSubscription.test.ts`
  - `src/utils/__tests__/studentParser.test.ts`
- **Integration**: `tests/integration/example.test.ts`
- **E2E (Playwright)**: `tests/e2e/example.spec.ts` (+ auth.setup, global-setup, global-teardown)

### 1.5 Step-1 Notes

- Coverage mapping and coverage-gate concerns are explicitly out of scope here — those belong in `trace` (already produced; FAIL gate, automation-gap).
- This review focuses on **quality of existing tests**: determinism, isolation, maintainability, performance, BDD format, fixtures, factories, selectors.
- Special focus areas given prior context:
  - Root-cause and fix recommendation for the 13 TeacherDashboard.test.tsx failures (`window.localStorage.getItem is not a function`).
  - Validation that Wave 1a useAwardPoints tests follow ADR-005 §4 contract correctly and are not over-mocked.
  - Audit `tests/e2e/example.spec.ts` (and adjacent setup files) for fixture/auth-session pattern conformance now that legacy specs have been deleted.

---

## Step 2 — Test Discovery

### 2.1 Files in Scope

9 test files (no `.skip`/`.only`/`.todo` markers in any of them):

| #   | Path                                                  | Framework  | Lines | Bytes  | describe | tests | expects | mocks | waits | network | selectors |
| --- | ----------------------------------------------------- | ---------- | ----- | ------ | -------- | ----- | ------- | ----- | ----- | ------- | --------- |
| 1   | `src/test/leaderboardCalculations.test.ts`            | Vitest     | 340   | 10,570 | 7        | 28    | 53      | 0     | 0     | 0       | 0         |
| 2   | `src/test/TeacherDashboard.test.tsx`                  | Vitest+RTL | 288   | 8,959  | 6        | 13    | 20      | 26    | 0     | 3       | 20        |
| 3   | `src/test/useRotatingCategory.test.ts`                | Vitest     | 141   | 3,751  | 1        | 8     | 17      | 0     | 0     | 0       | 0         |
| 4   | `src/test/sounds.test.ts`                             | Vitest     | 346   | 9,824  | 4        | 15    | 42      | 24    | 0     | 7       | 0         |
| 5   | `src/hooks/__tests__/useAwardPoints.test.ts`          | Vitest     | 287   | 10,874 | 5        | 4     | 14      | 10    | 0     | 3       | 0         |
| 6   | `src/hooks/__tests__/useRealtimeSubscription.test.ts` | Vitest     | 295   | 7,727  | 1        | 8     | 25      | 14    | 4     | 8       | 0         |
| 7   | `src/utils/__tests__/studentParser.test.ts`           | Vitest     | 225   | 8,147  | 5        | 32    | 37      | 0     | 0     | 0       | 0         |
| 8   | `tests/integration/example.test.ts`                   | Vitest     | 31    | 1,010  | 1        | 2     | 4       | 0     | 0     | 3       | 0         |
| 9   | `tests/e2e/example.spec.ts`                           | Playwright | 30    | 1,110  | 2        | 2     | 4       | 0     | 0     | 0       | 2         |

**Suite totals:** 32 describe blocks, **112 test cases** across 9 files. 95 currently pass, 13 fail (all in #2). Vitest excludes `tests/e2e/**`, `tests/integration/**`, and `e2e.legacy/**` per `vitest.config.ts:11-16` — Playwright owns e2e, the integration `example.test.ts` is currently isolated from Vitest entirely (orphaned).

Support files (not test files, but reviewed for fixture/setup quality):

- `src/test/setup.ts` — Vitest global setup (matchMedia mock only)
- `tests/e2e/auth.setup.ts` — Playwright storage-state seeder
- `tests/e2e/global-setup.ts` — Supabase lifecycle + test-user seed
- `tests/e2e/global-teardown.ts` — best-effort stack stop
- `tests/support/fixtures/index.ts` — `mergeTests(logTest, apiRequestTest, recurseTest)` + UserFactory
- `tests/support/fixtures/factories/user.factory.ts` — proper factory with `created[]` ledger + `cleanup()`

### 2.2 Framework Detection

- **Vitest** (jsdom env, globals enabled, `src/test/setup.ts` only) — 7 unit/component files, all in `src/`.
- **Vitest** (no e2e or integration coverage in vitest.config exclude list) — `tests/integration/example.test.ts` runs out-of-band; not currently picked up by `npm test`.
- **Playwright** with `@seontechnologies/playwright-utils` (Full UI+API profile) — 1 e2e file in `tests/e2e/`. Setup project chains `auth.setup.ts` → `chromium` via `storageState: '.auth/user.json'`. Fail-closed allow-list at config root for Supabase URL.

### 2.3 Test ID & Priority Markers

**Test IDs**: 0 across the suite. No `TEST-ID-XXX` annotations on `it()` / `test()` titles.
**Priority markers (P0/P1/P2/P3)**: 0 across the suite. No `@P0`, `@P1`, `@regression`, `@smoke`, `@critical` tags.

This is a Step-3 maintainability finding (traceability matrix already FAIL-gated; here we record the lack of in-test traceability hooks).

### 2.4 BDD Format (Given-When-Then)

- ✅ `tests/e2e/example.spec.ts` — both tests use full Given/When/Then phrasing in titles AND in body comments.
- ⚠️ Vitest tests use plain "should X" naming throughout. Not strict BDD, but conventional and readable. Knowledge fragment `test-quality.md` recommends Given/When/Then but accepts conventional behavioral names — not a critical violation.

### 2.5 Hard Waits & Conditional Control Flow

| File                              | Hard waits / setTimeout                                                                     | Conditional `if` (in test bodies) |
| --------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------- |
| `useRealtimeSubscription.test.ts` | **2 raw `setTimeout(resolve, 10)` flushes** at L202, L232; 7 `waitFor()` calls (legitimate) | 1 (low — likely guard on mock cb) |
| All other files                   | 0                                                                                           | 0                                 |

**Action item flagged for Step 3 — Determinism:** The two `await new Promise(resolve => setTimeout(resolve, 10))` patterns in `useRealtimeSubscription.test.ts` are flush-microtask hacks. `waitFor()` should already cover this; the raw sleeps suggest a race condition the test author worked around rather than fixed. Cross-reference `timing-debugging.md` and `test-healing-patterns.md`.

### 2.6 Imports / Fixtures / Factories / Network Patterns Observed

- **Vitest stack**: `@testing-library/react` (`renderHook`, `render`, `act`, `waitFor`), `vi.mock`, `vi.fn`. No data-factories pattern in unit tests (`leaderboardCalculations` uses inline `createMock*` helpers — counted 49 in factories regex but those are local builders, not the canonical `factory({...overrides})` shape). `TeacherDashboard.test.tsx` mocks Supabase context heavily (26 `vi.mock`/`vi.fn` calls).
- **Playwright e2e**: Proper `mergeTests` composition, real `UserFactory` with cleanup ledger, no custom selector helpers. Uses `page.locator('aside').getByRole(...)` chained selectors — somewhat brittle if sidebar layout changes; flagged for Step 3 maintainability.

### 2.7 Recent Failure Data (Already Captured)

`_bmad-output/test-artifacts/known-failures.md` records the 13 `TeacherDashboard.test.tsx` failures verbatim — all share root cause `TypeError: window.localStorage.getItem is not a function` in `src/contexts/ThemeContext.tsx:15`. Suite-wide snapshot at recording: `13 failed | 95 passed (108 tests)` (the `108` differs from our 112 because `tests/integration/example.test.ts` and `tests/e2e/example.spec.ts` aren't picked up by `npm test`).

**Pre-emptive root-cause hypothesis (verified for Step 3):** `src/test/setup.ts` mocks `window.matchMedia` but does NOT mock or enable `window.localStorage`. The console warning `--localstorage-file was provided without a valid path` indicates Vitest 4's jsdom localStorage shim is mis-flagged. The fix recipe will live in Step 4.

### 2.8 Evidence Collection (CLI Browser Trace)

Skipped per workflow guidance — there is no live browser flow under review (the e2e suite has just 2 smoke tests covering bootstrap + factory lifecycle; running playwright-cli trace adds no signal beyond what static review already shows). Re-enable for future reviews when more behavioral e2e flows exist.

## Step 3 — Quality Evaluation

### 3.1 Execution

- **Mode**: `subagent` (resolved from `tea_execution_mode: auto` after capability probe → parallel-capable)
- **Timestamp**: `2026-04-28T10-46-00`
- **Workers dispatched**: 4 (determinism, isolation, maintainability, performance) in parallel
- **Worker outcomes**: Isolation and Performance subagents wrote JSON directly. Determinism and Maintainability agents reported `completed` but terminated mid-stream without writing their JSONs; the parent (this workflow) reconstructed those two JSONs from the same evidence base captured in Step 2 and the same scoring rules in their step-files. All 4 dimension JSONs validated as parseable and on-schema.

### 3.2 Dimension Scores

| Dimension             | Score | Grade | HIGH | MEDIUM | LOW | Total Violations |
| --------------------- | ----- | ----- | ---- | ------ | --- | ---------------- |
| Determinism (30%)     | 80    | B     | 1    | 2      | 0   | 3                |
| Isolation (30%)       | 75    | C     | 0    | 3      | 4   | 7                |
| Maintainability (25%) | 73    | C     | 1    | 4      | 2   | 7                |
| Performance (15%)     | 86    | B     | 0    | 1      | 3   | 4                |

### 3.3 Weighted Overall Score

```
Determinism      80 × 0.30 = 24.00
Isolation        75 × 0.30 = 22.50
Maintainability  73 × 0.25 = 18.25
Performance      86 × 0.15 = 12.90
                          --------
Overall                     77.65 → 78/100 (C, "Acceptable")
```

**Overall: 78/100 (Grade C — "Acceptable")**

### 3.4 Aggregated Violation Counts

- **HIGH**: 2 (1 environment-determinism, 1 missing-test-traceability)
- **MEDIUM**: 10
- **LOW**: 9
- **TOTAL**: 21 across 4 dimensions

### 3.5 Top HIGH-Severity Violations

1. **`src/test/setup.ts:1` — `environment-determinism`** (Determinism dim).
   Vitest globalSetup shims `window.matchMedia` but not `window.localStorage`. ThemeContext crashes on mount → all 13 `TeacherDashboard.test.tsx` tests fail before any test body runs. **Single fix unblocks 13 currently-failing tests.**

2. **(suite-wide) — `missing-test-traceability`** (Maintainability dim).
   0 test IDs and 0 priority markers (P0/P1/P2/P3) across 112 tests. Trace workflow already FAIL-gated; in-test traceability hooks are also absent. Adoption sweep needed.

### 3.6 Summary JSON

Aggregated machine-readable output written to `/tmp/tea-test-review-summary-2026-04-28T10-46-00.json` (used by Step 4 for fix-report generation).

## Step 4 — Fix Report

### 4.1 Critical Issues (Must Fix Before Merge)

#### CRIT-1. Vitest setup is missing a `window.localStorage` shim — blocks 13 tests

- **Severity**: P0 (Critical)
- **Dimension**: Determinism (environment-determinism, HIGH)
- **Location**: `src/test/setup.ts:1` (root cause); `src/contexts/ThemeContext.tsx:15` (consumer); 13 failing tests in `src/test/TeacherDashboard.test.tsx`
- **Knowledge Base**: `test-quality.md` (env. green criteria), `test-healing-patterns.md` (jsdom env shims), `timing-debugging.md`

**Issue**: Vitest 4 + jsdom does not provision `window.localStorage` reliably (the `--localstorage-file was provided without a valid path` warning observed in the run is the smoking gun). `ThemeContext` reads `window.localStorage.getItem('theme')` synchronously inside its `useState` initializer, so every `render()` of any tree wrapping `ThemeProvider` throws `TypeError: window.localStorage.getItem is not a function` at mount. All 13 currently-failing tests share this stack — they fail in `mountIndeterminateComponent`, before any `it()` body runs.

**Current code** (`src/test/setup.ts`):

```ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// matchMedia is shimmed because ThemeProvider reads it on mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
// ❌ localStorage NOT shimmed → ThemeContext crashes
```

**Recommended fix** — add an in-memory `localStorage` shim alongside the existing `matchMedia` shim:

```ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom under Vitest 4 does not always provision a working localStorage.
// ThemeContext reads window.localStorage.getItem('theme') on mount.
function createMemoryStorage(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
  };
}

if (typeof window !== 'undefined') {
  // Replace whatever jsdom provided (often a half-broken stub) with a working
  // in-memory implementation. Reset between test files via Vitest globalSetup
  // semantics — each file gets a fresh module-level `store`.
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    configurable: true,
    value: createMemoryStorage(),
  });
  Object.defineProperty(window, 'sessionStorage', {
    writable: true,
    configurable: true,
    value: createMemoryStorage(),
  });
}
```

**Why this matters**: One missing shim causes 13 hard failures and a misleading 12% suite-failure rate. Anyone reading the dashboard sees the suite as broken when it is actually a setup-only issue. A new contributor onboarding from `npm test` is greeted with a wall of red.

**Verification**:

```bash
# After applying the fix
npx vitest run src/test/TeacherDashboard.test.tsx
# Expect: 13 passed
npx vitest run
# Expect: 1 failed → 0 failed; full suite green
```

**Optional belt-and-braces**: drop a one-line guard in setup.ts so a future Vitest upgrade silently breaking the shim fails loudly:

```ts
if (window.localStorage.getItem('__shim_check__') !== null) {
  throw new Error('test setup: localStorage shim is not isolating across calls');
}
window.localStorage.setItem('__shim_check__', 'ok');
window.localStorage.clear();
```

---

#### CRIT-2. Suite has zero test IDs and zero priority markers

- **Severity**: P1 (High) — not a flake risk, but blocks trace correlation
- **Dimension**: Maintainability (missing-test-traceability, HIGH)
- **Location**: All 9 test files / 112 tests
- **Knowledge Base**: `test-priorities-matrix.md`, `selective-testing.md`

**Issue**: The recent `bmad-testarch-trace` run produced a FAIL gate with 94 catalog rows and only 10.6% FULL+PARTIAL coverage. To progressively close that gap, each test must declare _which_ requirement it covers and at _what_ priority — otherwise every future trace run has to re-derive the mapping by hand. Currently no test in the suite has either signal.

**Recommended convention** (match what test-design already uses — P0/P1/P2 + AC-XX-XXX style IDs):

```ts
// Vitest — embed priority + ID in describe/it names so the trace step can grep
describe('useAwardPoints — ADR-005 §4 optimistic mutation', () => {
  it('[P0][AC-AWD-001] rolls back to previous snapshot when the RPC fails', ...);
  it('[P0][AC-AWD-002] preserves order under concurrent awards', ...);
});

// Playwright — use test.tag for queryability + retain the ID prefix in the title
test('[P0][AC-BOOT-001] dashboard chrome is visible after auth',
  { tag: ['@P0', '@regression', '@smoke'] },
  async ({ page }) => { ... }
);
```

**Adoption order** (lowest cost first):

1. Wave 1a `useAwardPoints.test.ts` (4 tests) — already P0 ADR-005-pinned, just retrofit the prefix.
2. e2e `example.spec.ts` (2 tests) — smoke + factory lifecycle.
3. Pure-logic Vitest files (leaderboardCalculations, studentParser, useRotatingCategory) — straight prefix sweep.
4. Component / hook tests (TeacherDashboard, sounds, useRealtimeSubscription) — once CRIT-1 is fixed.

**Why this matters**: Without IDs, the trace gate stays FAIL even after Wave 1b automation lands new tests. With IDs, the trace step's `coverage_status` aggregation is fully automated.

---

### 4.2 Recommendations (Should Fix)

#### REC-1. Replace `setTimeout` flush hacks in `useRealtimeSubscription.test.ts`

- **Severity**: P2 (Medium) — Determinism
- **Location**: `src/hooks/__tests__/useRealtimeSubscription.test.ts:202`, `:232`

**Current**:

```ts
await new Promise((resolve) => setTimeout(resolve, 10));
```

**Better** — assert what the test is actually waiting for:

```ts
await waitFor(() => {
  expect(mockOnChange).toHaveBeenCalled(); // or whatever observable condition
});
```

If the underlying mock genuinely needs a microtask flush before the assertion (Supabase realtime mock fires `SUBSCRIBED` via `setTimeout(..., 0)`), a `vi.advanceTimersByTime(0)` plus fake timers is the right primitive — not a real-time sleep.

#### REC-2. Restore fake timers in `useRotatingCategory.test.ts`

- **Severity**: P2 (Medium) — Isolation
- **Location**: `src/test/useRotatingCategory.test.ts:12`

**Issue**: `beforeEach` calls `vi.useFakeTimers()` but `afterEach` only calls `vi.restoreAllMocks()` — fake timers are not reverted to real timers between tests. This currently appears benign because every test in this file uses fake timers, but it leaks if the file ever grows a test that needs real timing.

**Fix**:

```ts
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

#### REC-3. Save and restore `global.fetch` in `sounds.test.ts`

- **Severity**: P2 (Medium) — Isolation
- **Location**: `src/test/sounds.test.ts:317`

**Issue**: Two tests in `validateAudioUrl` reassign `global.fetch = vi.fn()` without saving the original. The next file in the run order inherits the stub.

**Fix**:

```ts
let originalFetch: typeof globalThis.fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
```

#### REC-4. Decide what to do with `tests/integration/example.test.ts`

- **Severity**: P2 (Medium) — Isolation + Maintainability
- **Location**: `tests/integration/example.test.ts`

**Issue**: File runs nowhere — `vitest.config.ts:11-16` excludes `tests/integration/**` and Playwright doesn't pick up `.test.ts`. It contributes 0 coverage but 31 lines of placeholder code.

**Pick one**:

- **Delete**: `git rm tests/integration/example.test.ts` and remove the `tests/integration/` placeholder entirely until there's a real integration use case.
- **Wire in**: add a Vitest project config (e.g., `vitest.integration.config.ts`) and a `npm run test:integration` script, then replace the placeholder with actual integration coverage.

#### REC-5. Split `sounds.test.ts` (346 lines)

- **Severity**: P2 (Medium) — Maintainability
- **Location**: `src/test/sounds.test.ts`

Split along the existing describe seams: `sounds.lifecycle.test.ts` (init/teardown), `sounds.playback.test.ts`, `sounds.validateAudioUrl.test.ts`. Each comes in well under 300 lines.

#### REC-6. Add `vi.restoreAllMocks()` to `TeacherDashboard.test.tsx`

- **Severity**: P3 (Low) — Isolation
- **Location**: `src/test/TeacherDashboard.test.tsx:50`

`beforeEach` clears call history but never restores module-level `vi.mock(...)` factories between tests. Add `afterEach(() => vi.restoreAllMocks())`. Defer until CRIT-1 unblocks the file.

#### REC-7. Reduce `TeacherDashboard.test.tsx` mock density

- **Severity**: P3 (Low) — Maintainability
- **Location**: `src/test/TeacherDashboard.test.tsx`

26 `vi.mock`/`vi.fn` calls in 288 lines. Extract a `mountWithProviders({ user, classrooms, error })` helper into `src/test/TeacherDashboard.testHelpers.ts`; tests then state only the deviation from defaults. Defer until CRIT-1 lands.

#### REC-8. Mark `playwright.config.ts:44` CI-single-worker as a deliberate trade-off

- **Severity**: P3 (Low) — Performance
- **Location**: `playwright.config.ts:44`

`workers: process.env.CI ? 1 : undefined` is a deliberate choice (probably to avoid races on the shared `.auth/user.json` storageState and the seeded test user). Add a one-line comment so a future contributor doesn't "fix" it back to `undefined`:

```ts
// CI: 1 worker — all e2e tests share .auth/user.json + the seeded test user;
// parallel CI workers would race on Supabase auth.users for that account.
workers: process.env.CI ? 1 : undefined,
```

---

### 4.3 Best Practices Found (use as references for new tests)

#### BP-1. Composable Playwright fixtures with cleanup

- **Location**: `tests/support/fixtures/index.ts:15-28`, `tests/support/fixtures/factories/user.factory.ts:13-46`
- **Pattern**: Pure factory class → fixture wraps factory with auto-cleanup → `mergeTests` composes with utility fixtures.

```ts
// tests/support/fixtures/index.ts
const merged = mergeTests(logTest, apiRequestTest, recurseTest);
export const test = merged.extend<LocalFixtures>({
  userFactory: async ({}, provide) => {
    const factory = new UserFactory();
    await provide(factory);
    await factory.cleanup(); // runs after the test
  },
});
```

`UserFactory` keeps a `created[]` ledger and deletes every user it created on cleanup. This matches the `data-factories.md` and `fixture-architecture.md` patterns precisely. **Use this as the template for every new factory** (classroom, student, points-event).

#### BP-2. Fail-closed network allow-list at config root

- **Location**: `playwright.config.ts:18-38`
- **Pattern**: Parse `VITE_SUPABASE_URL` host, allow only loopback / RFC1918 / Tailscale CGNAT, throw otherwise.

```ts
const isPrivateHost =
  supabaseHost === 'localhost' ||
  supabaseHost === '127.0.0.1' ||
  /^10\./.test(supabaseHost) ||
  /^192\.168\./.test(supabaseHost) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(supabaseHost) ||
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(supabaseHost);
if (!isPrivateHost) throw new Error('E2E refuses to run against ...');
```

This is a textbook supply-chain safeguard. **Don't loosen it without an equivalent control.**

#### BP-3. BDD test names in e2e

- **Location**: `tests/e2e/example.spec.ts:4-14`, `:18-29`
- **Pattern**: `Given X, When Y, Then Z` in title AND in the test body comments.

Use this format on every new e2e test going forward.

#### BP-4. Idempotent global setup with ownership tracking

- **Location**: `tests/e2e/global-setup.ts:34-58`
- **Pattern**: Check if Supabase is already running; if not, start it and mark "we own it"; on teardown, only stop if we started it.

This avoids racing with `npm run dev` (which has its own Supabase lifecycle owner). Reuse for any future shared infrastructure (e.g., a contract test broker).

---

### 4.4 Quality Score Breakdown

```
Determinism      80 × 0.30 = 24.00
Isolation        75 × 0.30 = 22.50
Maintainability  73 × 0.25 = 18.25
Performance      86 × 0.15 = 12.90
                          --------
Final Score:                77.65 → 78/100
Grade:                      C (Acceptable)
```

| Severity | Count | Penalty per | Total Penalty |
| -------- | ----- | ----------- | ------------- |
| HIGH     | 2     | 10          | 20            |
| MEDIUM   | 10    | 5           | 50            |
| LOW      | 9     | 2           | 18            |

(Per-dimension scores already apply these penalties; the 78 above is the weighted aggregate of dimension scores, not a re-derivation from raw violation counts.)

---

### 4.5 Decision

**Recommendation**: **Request Changes** — block any new e2e/automate work until CRIT-1 lands. CRIT-2 is a sweep that can run in parallel with new feature work.

> Test quality is acceptable at 78/100, but two HIGH-severity issues must be addressed before further test-suite expansion. CRIT-1 (`localStorage` shim) is a one-file change that unblocks 13 currently-failing tests and turns the suite green. CRIT-2 (test-ID + priority adoption) is a cross-suite sweep that the trace workflow's FAIL gate already implies is necessary. Existing Wave 1a `useAwardPoints` tests stand on their own merit and do not need to be reverted.

---

### 4.6 Next Steps

#### Immediate (before next merge)

1. **Fix `src/test/setup.ts`** — add `localStorage`/`sessionStorage` shims per CRIT-1 fix recipe. **Owner**: next contributor touching tests. **Effort**: 15 min. **Verify**: `npx vitest run` → 0 failed.
2. **Adopt test-ID convention on Wave 1a** — apply `[P0][AC-AWD-001..004]` prefix to `useAwardPoints.test.ts` titles. **Owner**: Sallvain. **Effort**: 10 min.

#### Follow-up (next 1–2 PRs)

3. **Sweep test-ID convention across remaining 8 files** (REC-2 / CRIT-2 follow-on). **Effort**: ~1 hour.
4. **Replace `setTimeout` flush hacks in `useRealtimeSubscription.test.ts`** (REC-1). **Effort**: 20 min.
5. **Restore fake timers + `global.fetch`** in `useRotatingCategory.test.ts` and `sounds.test.ts` (REC-2, REC-3). **Effort**: 15 min total.
6. **Decide and act on `tests/integration/example.test.ts`** (REC-4). **Effort**: 5 min if delete, ~1 hour if wire in.

#### Backlog (lower priority)

7. **Split `sounds.test.ts`** by describe seam (REC-5).
8. **Refactor `TeacherDashboard.test.tsx`** mock setup once unblocked (REC-6, REC-7).
9. **Add CI-single-worker rationale comment** in `playwright.config.ts:44` (REC-8).

#### Re-Review

⚠️ **Re-review after CRIT-1 + CRIT-2 land** — the suite green status is the precondition for any further bmad-testarch-automate Wave 1b work.

---

### 4.7 Re-Entry Into BMAD TEA Workflow

Per the brownfield Engagement Model 5 sequencing:

- **Now (after this review)**: apply CRIT-1 + CRIT-2 fixes.
- **Then**: re-run `bmad-testarch-trace` — coverage rows previously marked `automation-gap` may flip to `PARTIAL`/`FULL` once test IDs let the trace step correlate. Expect the gate to remain FAIL until Wave 1b automation lands new tests for the gap rows.
- **Then**: launch `bmad-testarch-automate` Wave 1b targeting the highest-risk uncovered rows from the refreshed trace gap list.
- **Then**: another `bmad-testarch-test-review` pass to validate the Wave 1b additions before they ship.

---

### 4.8 Subagent Execution Notes (for future runs)

- 4 subagents launched in parallel; total wall-clock ≈ 80s (slowest worker).
- Determinism + Maintainability subagents reported `completed` in the runtime but did not write their JSON files (`output_file` empty after completion notice). Parent (this workflow) reconstructed both JSONs from the same Step-2 evidence base + step-file scoring rules. Aggregation and the report were unaffected.
- Action item for the BMAD TEA module: surface a hard failure when a subagent's `outputFile` is missing rather than relying on the parent to verify after the fact. Without that, a silently-empty subagent is invisible to the workflow.
