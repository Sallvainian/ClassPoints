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
lastSaved: '2026-04-22'
---

# Framework Setup Progress

## Step 1 — Preflight

### Stack Detection

- `test_stack_type` (from `_bmad/tea/config.yaml`): `fullstack`
- Effective detected stack: **frontend** (Supabase is BaaS; no backend manifest present)

### Prerequisites

- `package.json` present ✓
- No active `playwright.config.*` / `cypress.config.*` at root ✓
- Frontend manifest context gathered ✓

### Project Context

- Framework: React 18.3
- Bundler: Vite 6
- Language: TypeScript 5.9
- State/data: TanStack Query 5, Supabase JS 2
- Unit tests: Vitest 4 + @testing-library/react + jsdom (already set up)
- Docs: `docs/` directory (architecture + brownfield PRD per CLAUDE.md)
- Secrets: `fnox` (age-encrypted) → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TEST_EMAIL`, `VITE_TEST_PASSWORD`

### Legacy E2E Artifacts (retained, untouched per user decision)

- `@playwright/test ^1.57.0` already in devDependencies
- `@seontechnologies/playwright-utils ^4.3.0` already in devDependencies
- `playwright-legacy-config.ts` (root) — retained
- `e2e.legacy/` (auth.setup.ts, auth.spec.ts, classroom.spec.ts, points.spec.ts, student.spec.ts) — retained
- `test:e2e`, `test:e2e:ui`, `test:e2e:local`, `test:seed` scripts — reference `playwright.config.ts` (currently missing)

### User Decisions

- **Mode: greenfield scaffold.** Do not modify or delete `e2e.legacy/` or `playwright-legacy-config.ts`.
- User will port the Supabase allow-list guard (loopback/RFC1918/Tailscale-CGNAT) and `auth.setup.ts` storageState pattern into the new config manually as a follow-up.

## Step 2 — Framework Selection

**Selected: Playwright**

Rationale:

- Explicit `test_framework: playwright` in `_bmad/tea/config.yaml` (overrides auto-selection).
- Frontend-dominant stack (React + Vite + Supabase BaaS) — browser-based E2E fits.
- `@playwright/test ^1.57.0` and `@seontechnologies/playwright-utils ^4.3.0` already installed.
- Legacy setup was Playwright; straightforward for user to port Supabase allow-list guard + `auth.setup.ts` storageState pattern into the new config as a follow-up.

Cypress rejected: explicit config + existing Playwright investment.

## Step 3 — Scaffold Framework

**Execution mode:** `sequential` (no agent-team/subagent orchestration requested; `tea_execution_mode: auto` with no probe support in this environment).

**User decisions applied:**

- Guard path **[1]** — Supabase allow-list guard + `loadEnv('test', ...)` env injection + `webServer.env` override ported verbatim from `playwright-legacy-config.ts` into new `playwright.config.ts`.
- Factory style **(b)** — no faker; monotonic `Date.now()` + counter slug.

**Files created:**

- `playwright.config.ts` (root) — testDir `./tests/e2e`, action 15s / nav 30s / test 60s, expect 10s, HTML + JUnit + list reporters, `trace/screenshot/video: retain-on-failure`, single `chromium` project with `TODO` pointer for the storageState setup-project port.
- `tests/e2e/example.spec.ts` — two Given/When/Then samples (app bootstrap, factory lifecycle).
- `tests/support/fixtures/index.ts` — `mergeTests(logTest, apiRequestTest, recurseTest)` + local `userFactory` fixture with auto-cleanup. Network error monitor left commented with enable instructions (Supabase realtime/storage returns noisy 4xx).
- `tests/support/fixtures/factories/user.factory.ts` — `UserFactory` with `create()` / `cleanup()`, tracks created auth users, deletes via Supabase admin.
- `tests/support/helpers/supabase-admin.ts` — cached admin client reading `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `tests/support/helpers/auth.ts` — fallback `loginViaUi(page, creds)` for tests not using storageState.
- `tests/support/page-objects/.gitkeep` — empty dir.

**Files NOT created (respecting user constraints and existing templates):**

- `.env.example` — already exists, untouched.
- `.env.test.example` — already exists with correct Supabase-local vars, untouched.
- `.nvmrc` — already exists (`24`), untouched.
- `tests/auth.setup.ts` — user will port manually as follow-up.
- Any modification to `e2e.legacy/` or `playwright-legacy-config.ts`.

**Validation:** `env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npx playwright test --list` lists both sample tests. Guard correctly rejects leaked production URLs from the shell.

**Known user-environment note:** Running shell has leaked `VITE_SUPABASE_URL=https://hxclfwawibrtfjvptxno.supabase.co` (prod) from a prior fnox-wrapped session. The ported guard fail-closes on this, which is the intended behavior — no scaffold change required.

## Step 4 — Documentation & Scripts

**`tests/README.md` written** covering: setup (local Supabase + `.env.test` + seed), run commands (headed/debug/UI/single-file/show-report), architecture (fixtures / factories / helpers), best practices (selectors, isolation, no hard waits, network-first intercepts), CI integration, knowledge base references, troubleshooting, and three explicit user follow-ups (port auth.setup.ts storageState, retire e2e.legacy once ported, decide on networkErrorMonitor).

**Scripts:** `package.json` already has `test:e2e`, `test:e2e:ui`, `test:e2e:local`, `test:seed`. These were dormant because `playwright.config.ts` was absent — now they resolve correctly. No package.json changes made.

## Step 5 — Validate & Summary

### Checklist verification

| Area                                                                                                                                                 | Result                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Preflight (stack, manifest, no active config collision)                                                                                              | ✅                                                                                                   |
| Framework selected (Playwright, explicit config)                                                                                                     | ✅                                                                                                   |
| Directory structure (`tests/{e2e,support/{fixtures,fixtures/factories,helpers,page-objects}}`)                                                       | ✅                                                                                                   |
| `playwright.config.ts` — timeouts, baseURL env fallback, retain-on-failure artifacts, HTML + JUnit + list reporters, parallel + CI tuning, webServer | ✅                                                                                                   |
| `.env*` templates                                                                                                                                    | Existing `.env.example` + `.env.test.example` + `.nvmrc` retained per user instruction               |
| Fixture architecture (`mergeTests` + local user fixture, auto-cleanup)                                                                               | ✅                                                                                                   |
| Data factories (cleanup tracking via Supabase admin; no faker per user choice)                                                                       | ✅                                                                                                   |
| Sample tests (Given/When/Then, data-testid guidance, factory demo)                                                                                   | ✅                                                                                                   |
| Helpers (supabase-admin, auth-via-UI fallback)                                                                                                       | ✅                                                                                                   |
| `tests/README.md` — setup, run, architecture, best practices, CI, troubleshooting, follow-ups                                                        | ✅                                                                                                   |
| Build/test scripts                                                                                                                                   | Already present in `package.json`; no changes                                                        |
| Lint                                                                                                                                                 | `npx eslint tests/` clean                                                                            |
| Prettier                                                                                                                                             | Ran on all new files; `tests/README.md` table formatting normalized                                  |
| Playwright config parse + test discovery                                                                                                             | `env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY npx playwright test --list` → 2 tests discovered |

### Knowledge fragments applied

`_bmad/tea/testarch/` is not populated in this install, so knowledge fragments referenced by the workflow (`fixtures-composition.md`, `auth-session.md`, `api-request.md`, `recurse.md`, `log.md`, `burn-in.md`, `network-error-monitor.md`, `data-factories.md`, `intercept-network-call.md`) were not loaded. Patterns were implemented from the actual `@seontechnologies/playwright-utils` TypeScript declarations and README in `node_modules/`.

### Next steps for the user

1. **Port the `auth.setup.ts` storageState pattern** (see `tests/README.md` → TODO section; `playwright-legacy-config.ts` + `e2e.legacy/auth.setup.ts` are the working references).
2. **Verify against a fresh shell** — `unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY` (or open a new terminal tab) then `npm run test:e2e:local`. Current shell has leaked production Supabase vars from a prior fnox-wrapped session; the guard correctly rejects them.
3. **Port legacy specs** from `e2e.legacy/` into `tests/e2e/` one at a time, then retire the legacy config and directory.
4. **Decide on `networkErrorMonitor`** and enable it in `tests/support/fixtures/index.ts` with a curated `excludePatterns` list if desired.

### Workflow complete.
