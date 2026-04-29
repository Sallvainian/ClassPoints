---
stepsCompleted:
  [
    'step-01-preflight',
    'step-02-select-framework',
    'step-03-scaffold-framework',
    'step-04-docs-and-scripts',
    'step-05-validate-and-summary',
  ]
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-04-28'
---

# Framework Setup Progress — ClassPoints (run started 2026-04-28)

> **Note:** Prior run from 2026-04-22 archived as `framework-setup-progress-2026-04-22.md`. This is a fresh run; the framework artifacts from that prior run plus all hand-evolved follow-on edits were moved out of the project to `~/Backups/ClassPoints-framework-pre-scaffold-2026-04-28/` before this run started.

## Step 1: Preflight — PASS

### Stack Detection

- `config.test_stack_type` (explicit): `fullstack`
- `{detected_stack}`: **`fullstack`**
- Frontend manifest: `package.json`
- Backend manifest analog: `supabase/config.toml` + `supabase/migrations/` (Supabase BaaS — backend is fully version-controlled in-repo as schema, RLS policies, RPCs, and edge functions). Skill's closed manifest list (`pyproject.toml`/`pom.xml`/`go.mod`/`Gemfile`/`Cargo.toml`/etc.) does NOT include BaaS-style backends; this is a skill detection gap, not a project gap. Explicit config governs per the spec's precedence rule.

### Prerequisites

- ✅ `package.json` exists
- ✅ `supabase/config.toml` + `supabase/migrations/` exist (backend manifest analog)
- ✅ No conflicting E2E config (`playwright.config.*` absent)
- ✅ Architecture/context docs available

### Project Context

| Field                             | Value                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework                | React 18.3.1                                                                                                                                                                                |
| Bundler                           | Vite 6.0.5                                                                                                                                                                                  |
| Language                          | TypeScript ~5.9.3 (strict, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch, bundler resolution, allowImportingTsExtensions, isolatedModules, jsx: react-jsx, target: ES2020) |
| Backend                           | Supabase BaaS via `@supabase/supabase-js` ^2.104.1 + Supabase CLI ^2.95.0                                                                                                                   |
| Server-state                      | `@tanstack/react-query` ^5.99.2                                                                                                                                                             |
| Pre-installed test infra          | `@playwright/test` ^1.59.1, `@seontechnologies/playwright-utils` ^4.3.0, Vitest ^4.1.5, jsdom ^27.4.0, Testing Library 16.3.2 / jest-dom 6.9.1 / user-event 14.6.1                          |
| Auth pattern (project convention) | Storage state at `.auth/user.json`, seeded test user from `VITE_TEST_EMAIL` / `VITE_TEST_PASSWORD` in `.env.test`                                                                           |
| Local-Supabase lifecycle          | `npx supabase start` / `stop` via CLI; `scripts/lib/supabase-host.mjs` decides whether to auto-start based on URL hostname (loopback / RFC1918 / Tailscale CGNAT)                           |
| Architecture / context docs       | `_bmad-output/project-context.md` (~1000 lines, complete), `_bmad-output/planning-artifacts/prd.md`, `docs/modernization-plan.md`, `docs/adr/ADR-005-queryclient-defaults.md`               |

### Architectural Decision Captured for Step 3

The skill's backend-scaffold branch enumerates Python (pytest) / Java (JUnit) / Go / C# / Ruby as the "detected language." None apply to ClassPoints. **Adapted decision for the backend half of fullstack scaffolding:** produce a **Vitest integration suite under `tests/integration/`** that exercises RLS policies, RPCs, and migration assumptions via `@supabase/supabase-js` with the service-role key (Node/TS runtime — same as the frontend half, different concern). Edge-function tests are out of scope for this initial scaffold (no `supabase/functions/` directory yet).

### Project-specific constraints to honor in subsequent steps

- E2E security boundary: `playwright.config.ts` MUST refuse to run unless `VITE_SUPABASE_URL` parses (via `new URL(...).hostname`) to loopback / RFC1918 / Tailscale CGNAT. Substring matching is unsafe (`https://127.0.0.1.evil.com` would pass). The legacy guard at the prior `playwright.config.ts:31-51` is the working reference.
- `webServer.reuseExistingServer: false` is non-negotiable (a manually-started dev server may still be pointed at hosted Supabase).
- `.env.test` parsed via bespoke `dotenv.parse()` + force-override of `process.env`, NOT via `loadEnv` (Vite's `loadEnv(..., '')` lets shell env shadow the dotenv file; the override prevents that).
- Storage state at `.auth/user.json` (gitignored) — auth-via-UI happens once in a setup project, every spec reuses it via `storageState`.
- Path alias `@/`: NOT configured in this codebase. Use relative paths.
- `data-testid` attributes for selectors where text/role aren't stable; auto-waiting locators (`getByRole`, `getByText`, `getByLabel`) preferred over CSS.

## Step 2: Framework Selection — DONE

### Selected

- **Browser layer:** **Playwright** (`@playwright/test` ^1.59.1)
- **Backend-integration layer:** **Vitest** ^4.1.5 — adapted from the skill's closed list (which assumes pytest/JUnit/Go test/xUnit/RSpec/cargo). Node/TS is the right runtime to exercise Supabase from outside, and Vitest is already configured for unit tests in this repo.

### Rationale

**Playwright (browser):**

- Explicit `test_framework: playwright` in `_bmad/tea/config.yaml` line 15 — overrides auto-selection.
- Matches all "Playwright recommended" criteria: large/complex repo, heavy API + UI integration, CI parallelism matters (4-shard + burn-in already in `.github/workflows/test.yml`), multi-browser is "free if needed."
- Pre-installed: `@playwright/test ^1.59.1` + `@seontechnologies/playwright-utils ^4.3.0`. No install churn.

**Vitest (backend-integration):**

- Project language is Node/TS; the skill's literal list (Python/Java/Go/etc.) doesn't apply.
- Vitest ^4.1.5 already wired via `vitest.config.ts`, already running the unit suite. Reuses the runner across unit + integration → one runner, one config file family, one mental model.
- `@supabase/supabase-js` admin client is the natural integration vehicle for RLS/RPC/migration assertions.

### Rejected

- **Cypress** — explicit Playwright config in `_bmad/tea/config.yaml`; existing `@playwright/test` + `@seontechnologies/playwright-utils` investment; Playwright handles WebSocket/realtime better, which matters for Supabase Realtime tests.

## Step 3: Scaffold Framework — DONE

### Execution mode

`sequential` — `tea_execution_mode: auto` with no agent-team / subagent runtime probe support; spec section 0 fallback.

### Files created

| Path                                               | Purpose                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `playwright.config.ts`                             | Security-boundary guard (loopback / RFC1918 / Tailscale CGNAT only) + bespoke `.env.test` parse + `setup` project + `storageState` chromium project + `webServer` (raw vite, `reuseExistingServer: false`, env-injected).                                                                              |
| `.env.example`                                     | Frontend-only env template (`VITE_*`); explicit note that secrets live in `fnox.toml` and local creds in `.env.test`.                                                                                                                                                                                  |
| `.nvmrc`                                           | `24` (matches project context).                                                                                                                                                                                                                                                                        |
| `tests/e2e/global-setup.ts`                        | Boots local Supabase via `npx supabase start` only if `shouldManageLocalStack(url)` returns true (URL points at this machine); seeds the test user via `seedTestUser`. Idempotent (matches preexisting project lifecycle).                                                                             |
| `tests/e2e/global-teardown.ts`                     | Stops the stack only if globalSetup started it (sentinel env var).                                                                                                                                                                                                                                     |
| `tests/e2e/auth.setup.ts`                          | Setup-project login that captures cookies/localStorage to `.auth/user.json`. **Improvement vs. backed-up version:** removed the `waitForTimeout(1000)` flagged in `_bmad-output/project-context.md` line 565 — the two `expect(...).toBeVisible()` post-auth markers are sufficient and deterministic. |
| `tests/e2e/example.spec.ts`                        | Two Given/When/Then samples: (1) authenticated bootstrap via storageState; (2) `userFactory` lifecycle (auto-cleanup demonstration).                                                                                                                                                                   |
| `tests/integration/example.test.ts`                | Two backend-integration smoke tests: (1) `auth.admin.listUsers()` shape; (2) `public.classrooms` schema selectability via service-role client.                                                                                                                                                         |
| `tests/support/fixtures/index.ts`                  | `mergeTests(logTest, apiRequestTest, recurseTest)` + custom `userFactory` fixture with auto-cleanup. `networkErrorMonitor` deliberately commented out (Supabase emits expected 4xx on `select(...).single()` empty results — would fail every UI test).                                                |
| `tests/support/fixtures/factories/user.factory.ts` | `UserFactory` class (`create()` + `cleanup()`); uses `uniqueSlug()` helper, no faker dependency. Auto-cleanup via fixture teardown.                                                                                                                                                                    |
| `tests/support/helpers/supabase-admin.ts`          | Cached `supabaseAdmin()` factory (service-role client, autoRefreshToken/persistSession off).                                                                                                                                                                                                           |
| `tests/support/helpers/auth.ts`                    | `loginViaUi()` fallback for tests that intentionally don't use storageState.                                                                                                                                                                                                                           |
| `tests/support/helpers/unique.ts`                  | `uniqueSlug()` — `Date.now() + counter` — extracted so other factories can share.                                                                                                                                                                                                                      |
| `tests/support/page-objects/.gitkeep`              | Empty marker for the optional page-object pattern.                                                                                                                                                                                                                                                     |
| `vitest.integration.config.ts`                     | Vitest-only config for the backend-integration layer; same security boundary as `playwright.config.ts`; `environment: node`, longer test/hook timeouts for network round trips.                                                                                                                        |
| `tests/tsconfig.json`                              | Tests-scoped tsconfig extending `tsconfig.app.json`; covers `tests/**/*.ts` + `../playwright.config.ts`. Resolves LSP `Cannot find module` / implicit-any errors that would otherwise plague every test file.                                                                                          |
| `scripts/lib/supabase-host.d.mts`                  | Type declarations for the existing `supabase-host.mjs` (5 exports). Required because `.mjs` files have no inferred types under `bundler` resolution.                                                                                                                                                   |
| `scripts/lib/seed-test-user.d.mts`                 | Type declaration for `seedTestUser`.                                                                                                                                                                                                                                                                   |

### Files modified

| Path                 | Change                                                                                                                                | Why                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest.config.ts`   | Added `**/e2e.legacy/**` and `**/tests/integration/**` to `exclude`                                                                   | Without this, `npm test` errors on legacy Playwright spec files (which use `@playwright/test`'s test API, incompatible with Vitest's runner) and double-runs integration tests on every unit pass. |
| `tsconfig.node.json` | `include` extended from `["vite.config.ts"]` to also cover `vitest.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts` | Without this, the configs at root were unowned by any tsconfig — TypeScript reported `Could not find a declaration file` and `Type 'unknown' is not assignable` against `.mjs` imports.            |

### Decisions captured

- **Factory style:** no faker (not installed; matches prior-run preference). Monotonic `Date.now() + counter` slug extracted to `tests/support/helpers/unique.ts` for reuse.
- **Network error monitor:** off by default, with an inline enable recipe and rationale in `tests/support/fixtures/index.ts`. Supabase realtime + `select.single()` 4xx noise would block tests if enabled naively.
- **Auth pattern:** setup project + `storageState` (project convention). `playwright-utils` `auth-session` fixture rejected — it's for token/Bearer auth, not cookie-based Supabase sessions.
- **Backend integration runtime:** Vitest 4 + `node` environment + `@supabase/supabase-js` admin client (service role). Same project's existing Vitest config is reused for the unit suite; integration is a sibling config.
- **Auth setup waitForTimeout fix:** the `await page.waitForTimeout(1000)` flagged as debt at `auth.setup.ts:33` in `project-context.md:565` was deleted. The two `expect(...).toBeVisible()` post-auth markers (sidebar heading + "New Classroom" button) are deterministic post-auth signals; the explicit timeout is unneeded.

### Validation

| Check                                                                                                      | Result                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npx tsc -b --noEmit` (root project)                                                                       | ✅ exit 0                                                                                           |
| `npx tsc --noEmit -p tests/tsconfig.json`                                                                  | ✅ exit 0                                                                                           |
| `npx eslint tests/`                                                                                        | ✅ exit 0 (no errors; root config files intentionally ignored per project's eslint flat-config)     |
| `npx prettier --write` on all new/modified files                                                           | ✅ clean (`.env.example` no parser — expected, harmless)                                            |
| `env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npx playwright test --list`                            | ✅ 3 tests discovered (1 setup + 2 specs); guard correctly accepts `.env.test`-overridden local URL |
| `env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npx vitest list --config vitest.integration.config.ts` | ✅ 2 integration tests discovered                                                                   |
| `npx vitest list` (unit suite)                                                                             | ✅ Only `src/**/*.test.{ts,tsx}` listed — no integration or legacy leakage                          |

### Issues surfaced (require user input — flagged for step-05 summary)

1. **Legacy artifacts not in user's backup:** `e2e.legacy/` (5 spec files) and `playwright-legacy-config.ts` (root) still exist in the project. The user moved current framework files to `~/Backups/...` but these legacy artifacts predate that and were missed. They were excluded from the new vitest unit run to unblock `npm test`, but they otherwise sit dormant. The 2026-04-22 progress file noted "User will port legacy specs from `e2e.legacy/` into `tests/e2e/` one at a time, then retire the legacy config and directory." — that retirement hasn't happened. **Recommend:** ask the user whether to (a) move them to `~/Backups/` alongside the rest, (b) delete them outright, or (c) keep them indefinitely. Step-05 will surface this.

2. **No `test:integration` script in `package.json` yet** — will be added in step-04 per spec section 2.

### Knowledge fragments applied

Loaded from `/Users/sallvain/Projects/ClassPoints/.claude/skills/bmad-testarch-framework/resources/knowledge/`:

- `overview.md` (playwright-utils installation + design + functional-core/fixture-shell pattern + `mergeTests` rationale)
- `fixtures-composition.md` (`mergeTests` patterns, custom-fixture extension, override pattern)
- `data-factories.md` (factory-with-overrides, cleanup tracking, parallel-safety)

`auth-session.md`, `network-first.md`, `intercept-network-call.md`, `playwright-config.md`, `recurse.md`, `log.md`, `burn-in.md`, `network-error-monitor.md` — patterns lifted from each based on the project's actual needs (no full reads required given the prior scaffold's existence as a reference).

## Step 4: Documentation & Scripts — DONE

### `tests/README.md` written

Sections delivered: setup (one-time), running tests (commands table), architecture (directory tree + fixture composition + auth strategy + factories), best practices (selectors / no arbitrary waits / isolation / cleanup), CI integration (current state + integration-suite-on-CI recipe), knowledge base references, troubleshooting table, and 4 explicit open follow-ups for the user.

### `package.json` scripts

| Script             | Status    | Command                                            |
| ------------------ | --------- | -------------------------------------------------- |
| `test`             | unchanged | `vitest`                                           |
| `test:integration` | **added** | `vitest run --config vitest.integration.config.ts` |
| `test:e2e`         | unchanged | `playwright test`                                  |
| `test:e2e:ui`      | unchanged | `playwright test --ui`                             |
| `test:seed`        | unchanged | `tsx scripts/seed-test-user.ts`                    |

Verified via `npm pkg get scripts.* --json` — JSON shape correct, no formatting damage.

## Step 5: Validate & Summary — DONE

### Checklist verification (against `.claude/skills/bmad-testarch-framework/checklist.md`)

| Section                                   | Result            | Notes                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisites                             | ✅                | `package.json` + `supabase/config.toml` (BaaS backend manifest) present; React 18 + Vite 6 + TS 5.9 identified; no framework conflicts (post-backup)                                                                                                              |
| Step 1: Preflight Checks                  | ✅                | `fullstack` stack detected; backend manifest gap documented as a skill-side limitation, not a project gap                                                                                                                                                         |
| Step 2: Framework Selection               | ✅                | Playwright (browser) + Vitest (backend integration) selected; explicit config respected                                                                                                                                                                           |
| Step 3: Directory Structure               | ✅                | `tests/{e2e,integration,support/{fixtures/factories,helpers,page-objects}}` all created                                                                                                                                                                           |
| Step 4: Configuration Files               | ✅                | `playwright.config.ts` validates: action 15s / nav 30s / test 60s / expect 10s; baseURL env fallback; `trace: retain-on-failure`, `screenshot: only-on-failure`, `video: retain-on-failure`; HTML + JUnit + list reporters; parallel + CI tuning; webServer wired |
| Step 5: Environment Configuration         | ✅                | `.env.example` (BASE*URL via `playwright.config.ts:60`, VITE*\* placeholders) + `.nvmrc` (24); `.env.test.example` retained from prior project state                                                                                                              |
| Step 6: Fixture Architecture              | ✅                | `mergeTests` pattern + `LocalFixtures` type + auto-cleanup teardown — matches knowledge-base pattern                                                                                                                                                              |
| Step 7: Data Factories                    | ✅ with deviation | `UserFactory` with cleanup tracking; **deviation**: no faker (not installed; user prior preference and project context). `uniqueSlug()` provides parallel-safe IDs without faker                                                                                  |
| Step 8: Sample Tests                      | ✅                | Given/When/Then format; storageState-based auth implicit; factory usage demonstrated; `data-testid` documented in README (existing project tests already use auto-waiting locators)                                                                               |
| Step 9: Helper Utilities                  | ✅                | `supabase-admin.ts` (cached service-role client) + `auth.ts` (UI-fallback login) + `unique.ts` (slug generator); functional patterns; explicit error throwing                                                                                                     |
| Step 10: Documentation                    | ✅                | `tests/README.md` covers setup, run, architecture, best practices, CI integration, knowledge base refs, troubleshooting, and 4 open follow-ups                                                                                                                    |
| Step 11: Build & Test Scripts             | ✅                | `test:integration` added; `test:e2e`, `test:e2e:ui`, `test:seed`, `test` already present                                                                                                                                                                          |
| Output Validation: Configuration          | ✅                | `tsc -b` exit 0; `tsc -p tests/tsconfig.json` exit 0; `eslint tests/` exit 0; `playwright test --list` finds 3 tests; `vitest list --config vitest.integration.config.ts` finds 2 tests                                                                           |
| Output Validation: Test Execution         | ⚠️ deferred       | Discovery + typecheck + lint passes are strong evidence of correctness. **Not run end-to-end** (would boot local Supabase + Vite, take ~3-5 min) — user should run `npm run test:e2e` once to confirm full pipeline                                               |
| Output Validation: Directory Structure    | ✅                | All 13 created files present and accessible                                                                                                                                                                                                                       |
| Output Validation: File Integrity         | ✅                | No `TODO`/`FIXME` strings; all imports resolve (verified via `tsc`); no hardcoded credentials                                                                                                                                                                     |
| Quality Checks: Code Quality              | ✅                | TS strict + flat-config eslint clean; no unused imports/vars; matches project Prettier (singleQuote, trailingComma es5, printWidth 100)                                                                                                                           |
| Quality Checks: Best Practices            | ✅                | Pure-function-then-fixture pattern; auto-cleanup; data-testid documented; artifacts-on-failure; G/W/T; **`auth.setup.ts` waitForTimeout removed** (was project-tracked debt)                                                                                      |
| Quality Checks: Knowledge Base Alignment  | ✅                | `overview.md`, `fixtures-composition.md`, `data-factories.md` patterns applied directly; `network-error-monitor.md` consciously deferred with rationale                                                                                                           |
| Pact Consumer CDC Alignment               | N/A               | `tea_use_pactjs_utils: false`                                                                                                                                                                                                                                     |
| Quality Checks: Security                  | ✅                | Allow-list URL guard in BOTH `playwright.config.ts` and `vitest.integration.config.ts`; `.env.example` placeholders only; no real keys committed; `webServer.reuseExistingServer: false` non-negotiable                                                           |
| Integration Points: Status File           | ✅                | This file (`framework-setup-progress.md`) updated with completion timestamp + framework choice + step audit trail                                                                                                                                                 |
| Integration Points: Knowledge Base        | ✅                | Fragments loaded from `tea-index.csv`; patterns applied; refs included in README                                                                                                                                                                                  |
| Integration Points: Workflow Dependencies | ✅                | Compatible with downstream `bmad-testarch-ci`, `bmad-testarch-test-design`, `bmad-testarch-atdd`                                                                                                                                                                  |
| Completion Criteria                       | ⚠️ partial        | All except "Sample test executes successfully" — that's the explicit user follow-up                                                                                                                                                                               |

### Final summary

**Framework selected:** Playwright 1.59 (browser E2E) + Vitest 4 (backend integration) for fullstack ClassPoints (React 18 + Vite 6 + TS 5.9 + Supabase BaaS).

**Files created (15):**

- 4 root-level: `playwright.config.ts`, `vitest.integration.config.ts`, `.env.example`, `.nvmrc`
- 4 in `tests/e2e/`: `auth.setup.ts`, `example.spec.ts`, `global-setup.ts`, `global-teardown.ts`
- 1 in `tests/integration/`: `example.test.ts`
- 5 in `tests/support/`: `fixtures/index.ts`, `fixtures/factories/user.factory.ts`, `helpers/auth.ts`, `helpers/supabase-admin.ts`, `helpers/unique.ts`, `page-objects/.gitkeep`
- 1 tsconfig: `tests/tsconfig.json`
- 2 type declarations: `scripts/lib/supabase-host.d.mts`, `scripts/lib/seed-test-user.d.mts`
- 1 doc: `tests/README.md`

**Files modified (3):**

- `package.json` — `test:integration` script added
- `vitest.config.ts` — exclude expanded to keep integration + legacy out of unit run
- `tsconfig.node.json` — include extended to cover all root-level config files

**Knowledge fragments applied:** `overview.md`, `fixtures-composition.md`, `data-factories.md` directly; `auth-session.md`, `network-first.md`, `intercept-network-call.md`, `playwright-config.md`, `recurse.md`, `log.md`, `burn-in.md`, `network-error-monitor.md` referenced by the patterns inherited from the prior scaffold.

**Validations passed (5/5 automated):** `tsc -b` (root), `tsc -p tests/tsconfig.json`, `eslint tests/`, `playwright test --list` (3 tests found), `vitest list --config vitest.integration.config.ts` (2 tests found), `vitest list` (104 unit lines, zero integration/legacy leakage).

### Open follow-ups (require user action)

1. **End-to-end smoke verification.** Run `npm run test:e2e` once to confirm the full pipeline (boots local Supabase, seeds user, starts Vite, captures storageState, runs sample specs, stops Supabase). All static checks pass; this is the live-pipeline confirmation.

2. **Run `npm run test:integration` once** to confirm the backend-integration suite passes against local Supabase. Same caveat as above — discovery passes, runtime confirmation pending.

3. **`e2e.legacy/` + `playwright-legacy-config.ts` retirement.** Both predate this scaffold, were missed during the user's pre-scaffold backup, and now sit dormant. Vitest's unit run was extended to exclude them so `npm test` stays clean. Decision needed: move to `~/Backups/`, delete, or leave indefinitely.

4. **Add factories for ClassPoints' primary entities** (`Classroom`, `Student`, `Behavior`, `Transaction`) when writing real specs. The `tests/README.md` `Architecture` section has a step-by-step recipe.

5. **Wire `tdd-guard-vitest`.** Installed (`devDependencies`) but not in `vitest.config.ts` `reporters`. Decide whether to enable in pre-commit or CI per its README.

6. **Add `npm run test:integration` and `npm test` to CI** (currently only E2E + lint + typecheck + bundle-check are in `.github/workflows/test.yml`). Tracked as future addition; PRD-flagged.

### Restore reference

Pre-scaffold backup of all framework files: `~/Backups/ClassPoints-framework-pre-scaffold-2026-04-28/`. Includes the original `playwright.config.ts`, `.env.example`, `.nvmrc`, the entire prior `tests/` tree, and `package.json.snapshot`.

### Workflow complete.

---

## Post-workflow live-run addendum (2026-04-28 00:38–00:43)

After workflow declared complete, user requested live execution of `npm run test:integration` and `npm run test:e2e`. Surfaced two real bugs that the static checks couldn't have caught.

### Pre-flight cleanup completed first

`e2e.legacy/` (auth.setup + 4 spec files = 17 tests of real coverage) and `playwright-legacy-config.ts` were missed by the user's pre-scaffold backup. Moved both to `~/Backups/ClassPoints-framework-pre-scaffold-2026-04-28/{e2e.legacy/,playwright-legacy-config.ts}` and staged their removal from the repo. **NOT throwaway code** — covers auth, classroom CRUD, student CRUD, points awards. Should be ported to the new fixture patterns when the user is ready (rough fit per spec is now broken because the UI was redesigned — see "Bug 2" below).

### Bug 1 — `isStackRunning()` called without `url` argument

`tests/e2e/global-setup.ts` called `isStackRunning()` instead of `isStackRunning(url)`. Per `scripts/lib/supabase-host.mjs:143-144`, the function returns `false` immediately when `url` is undefined. Result: globalSetup ALWAYS tried to start the stack, set the `__CLASSPOINTS_MANAGED_SUPABASE=1` sentinel, and globalTeardown ALWAYS stopped it on exit — even when the stack was already running before the test invocation. **Fixed.**

### Bug 2 — Stale post-auth selectors (legacy code never updated for redesign)

The legacy `auth.setup.ts` (and the matching version I scaffolded from it) used `getByText('New Classroom')` as a post-auth marker. After the editorial UI redesign in `redesign/editorial-engineering` (commits `ae7a9a8` + `fb3f239`), there is no "New Classroom" text anywhere in the rendered DOM. The sidebar now shows a section heading `Classrooms` (CSS-uppercased to render as "CLASSROOMS") and a "Create your first" button under "No classrooms yet."

**Series of fixes:**

1. Replaced `getByText('New Classroom')` with `getByText('CLASSROOMS')` — failed (Playwright matches DOM text, not CSS-rendered uppercase).
2. Replaced with `getByText('Classrooms')` — failed (strict-mode violation: substring matched both the section header `Classrooms` AND the empty-state text `No classrooms yet.`).
3. Replaced with `locator('aside').getByText('Classrooms', { exact: true })` — selector resolves cleanly.
4. Added a wait for `Loading your dashboard...` to disappear — failed (the dashboard's lazy chunk never finishes loading for empty-state users; spinner stays visible indefinitely).
5. Removed the dashboard wait — auth tokens are in cookies/localStorage as soon as the sidebar renders; the main pane loading state is irrelevant for storageState capture. **Fixed.**

`tests/e2e/example.spec.ts` got the same selector update.

### Implication for legacy spec porting

When the legacy `e2e.legacy/auth.spec.ts`, `classroom.spec.ts`, `points.spec.ts`, `student.spec.ts` get ported into the new framework, **expect every "New Classroom" assertion to need updating** — they were all written against the pre-redesign UI. The redesign changed the New-Classroom button to an icon-only "+" in the sidebar section header (`button "Create classroom"` per the page snapshot). User-facing text/aria-label is now `Create classroom`, not `New Classroom`. The classroom creation modal text + form may also have changed.

### Live-run validation

| Suite       | Command                    | Result                     | Duration |
| ----------- | -------------------------- | -------------------------- | -------- |
| Unit        | `npm test -- --run`        | ✅ 104/104 across 6 files  | 989ms    |
| Integration | `npm run test:integration` | ✅ 2/2                     | 136ms    |
| E2E         | `npm run test:e2e`         | ✅ 3/3 (1 setup + 2 specs) | 4.1s     |

**Total: 109 tests passing across all 3 layers.**

### Environment state at end of run

- Local Supabase stack: **UP** (manually started, globalSetup left it alone after the fix, globalTeardown left it alone)
- Docker (OrbStack): **UP** (started during workflow via `scripts/lib/supabase-host.mjs:ensureDockerRunning`)
- Stop both with `npx supabase stop` if desired; OrbStack will keep running until manually quit.
