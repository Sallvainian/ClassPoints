# Development Guide

_Generated 2026-04-28 (deep-scan rescan)._

## Prerequisites

- **Node** — version pinned in `.nvmrc`. Use `nvm use` (or rely on mise — see below).
- **mise** (`mise.toml` is committed) — manages `fnox` (and any other future tool versions). Without mise the project still works, but you'll need to install fnox manually.
- **fnox** — age-encrypted secrets loader. Required for hosted dev / build / preview / migrate. NOT required for local dev (default mode reads `.env.test`).
- **age private key** — needed to decrypt `fnox.toml`. The two recipient public keys are listed in `fnox.toml`.
- **Docker daemon** — required for local Supabase (`npm run test:e2e`, `npm run dev` when pointed at a local URL). On macOS use OrbStack (preferred — fastest cold-start), Docker Desktop, or Colima. `scripts/dev.mjs` will preflight and auto-start the daemon if it's down (commit `136f493`).
- **Supabase CLI** — installed as a devDependency (`supabase ^2.95.0`). Invoked via `npx supabase ...`. CI pins to the same version (see `.github/workflows/test.yml`).
- **Playwright browsers** — installed by `npx playwright install chromium` the first time you run E2E.
- **Tailscale** (optional) — `playwright.config.ts` and `scripts/lib/supabase-host.mjs` allow Tailscale CGNAT (`100.64.0.0/10`) hosts so a Linux box can drive a Mac-hosted local Supabase, or vice versa.

## One-time setup

```bash
# Install dependencies
npm ci

# Copy the local-stack env template
cp .env.test.example .env.test
# Edit .env.test to match your local stack (anon + service_role keys)
# — see comments in .env.test.example for what to fill in.

# Make sure mise/fnox can decrypt fnox.toml (one-time age key import)
# (project-local — your global age private key is fine; consult fnox docs if unsure)
```

## Available scripts (`package.json`)

| Command                                         | What it does                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                   | **Default dev loop.** Local-by-default — `node scripts/dev.mjs`. Loads `.env.test`, preflights Docker, starts local Supabase if URL is local, runs `vite --mode test` on `http://localhost:5173`, stops Supabase on exit. Strips fnox-auto-injected env vars before spawning Vite (mise's `mise-env-fnox` plugin would otherwise leak hosted creds into `process.env`). |
| `npm run dev:host`                              | Same as `dev` but with `--host` so the dev server binds to LAN.                                                                                                                                                                                                                                                                                                         |
| `npm run dev:hosted`                            | Hosted-Supabase fallback. `fnox exec -- vite` — decrypts `fnox.toml` for hosted credentials. Use only when reproducing a hosted-only bug.                                                                                                                                                                                                                               |
| `npm run build`                                 | Production build. `tsc -b && fnox exec -- vite build` — typecheck first, then bundle with hosted creds inlined.                                                                                                                                                                                                                                                         |
| `npm run preview`                               | `fnox exec -- vite preview` — preview the production bundle locally.                                                                                                                                                                                                                                                                                                    |
| `npm run lint`                                  | ESLint. Flat config (`eslint.config.js`); ignores `dist`, `.bmad`, `.claude`, `.agent`, `.cursor`, `.serena`, `*.config.{js,ts}`, `supabase`, `scripts`, `coverage`.                                                                                                                                                                                                    |
| `npm run typecheck`                             | `tsc -b --noEmit`. Strict TS — `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`.                                                                                                                                                                                                                                    |
| `npm run check:bundle`                          | CI-required post-build assertion: zero `react-query-devtools` chunks AND zero textual matches in any emitted `.js` (excluding source maps). Run after `npm run build`.                                                                                                                                                                                                  |
| `npm test`                                      | Vitest watch mode.                                                                                                                                                                                                                                                                                                                                                      |
| `npm test -- --run`                             | Vitest single run (no watch). Used in CI deploy step.                                                                                                                                                                                                                                                                                                                   |
| `npm test -- src/test/specificFile.test.ts`     | Run a single test file.                                                                                                                                                                                                                                                                                                                                                 |
| `npm run test:e2e`                              | Playwright E2E. globalSetup auto-starts local Supabase + seeds the test user; globalTeardown stops it. Chromium only. Storage state from `.auth/user.json`.                                                                                                                                                                                                             |
| `npm run test:e2e:ui`                           | Playwright UI mode.                                                                                                                                                                                                                                                                                                                                                     |
| `npm run test:seed`                             | Seed the test user manually (rarely needed — globalSetup does this).                                                                                                                                                                                                                                                                                                    |
| `npm run supabase:up` / `npm run supabase:down` | Explicit local-stack lifecycle (e.g. switching projects on the same port).                                                                                                                                                                                                                                                                                              |
| `npm run migrate`                               | Hosted data migration tooling (`fnox exec -- tsx scripts/migrate-data.ts`).                                                                                                                                                                                                                                                                                             |
| `npm run prepare`                               | Installs `simple-git-hooks` (run once after fresh clone).                                                                                                                                                                                                                                                                                                               |

## Pre-commit hook (auto-installed via `prepare`)

`simple-git-hooks` runs:

1. `lint-staged`
   - `*.{ts,tsx}` → `eslint --fix`
   - `*.{ts,tsx,js,jsx,json,css,md}` → `prettier --write`
2. `npm run typecheck`

**Do NOT bypass with `--no-verify`.** Per `CLAUDE.md` global rules: fix the underlying issue and create a NEW commit. Never `--amend` after a hook failure — the original commit went through.

## Environment files

| File                | What                                                                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.test`         | LOCAL Supabase URL + anon key + service-role key + test user creds. Gitignored. Used by `npm run dev` (via `.env.test` mode) and `playwright.config.ts` (parsed directly with `dotenv.parse`).                                   |
| `.env.test.example` | Committed template with comments explaining what to fill in.                                                                                                                                                                     |
| `fnox.toml`         | Age-encrypted hosted creds (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TEST_EMAIL`, `VITE_TEST_PASSWORD`). Decrypted by `fnox exec --` for `dev:hosted`, `build`, `preview`, `migrate`, and the `bundle-check` CI job. |
| `.env.example`      | Stale legacy template; not used by anything in current scripts.                                                                                                                                                                  |

`vite.config.ts` sets `base: '/ClassPoints/'` so the production bundle is served from `https://<user>.github.io/ClassPoints/`.

## Local-Supabase lifecycle (two independent contexts)

`scripts/lib/supabase-host.mjs` decides whether the URL points at "this machine" using `os.networkInterfaces()` PLUS a probe of `tailscale ip` (so Tailscale-assigned addresses count as local). Two contexts each fully own the stack lifecycle in their domain — they never overlap:

1. **`npm run dev`** — `scripts/dev.mjs` is the owner.
   - URL is local AND stack is down → start it (after Docker preflight); stop it on exit.
   - URL is local AND stack is already up → leave it alone (do NOT stop on exit).
   - URL is remote (e.g. another machine's Tailscale IP) → skip lifecycle entirely.
   - `isStackRunning()` uses a `curl` HTTP probe of `<url>/auth/v1/health` instead of `npx supabase status` — the CLI exits 0 even when containers are missing, so it would falsely claim "already up" after a previous run torn things down.

2. **`npm run test:e2e`** — `tests/e2e/global-setup.ts` is the owner.
   - Starts the stack, seeds the test user (idempotent), runs tests.
   - `global-teardown.ts` stops the stack.
   - Playwright's `webServer` runs `npx vite --mode test` directly (NOT `npm run dev`) — that's intentional, to avoid racing with globalSetup over Supabase management.
   - `reuseExistingServer: false` — never reuse a manually-started dev server (it might be pointed at hosted Supabase).

## Testing

### Unit (Vitest)

- Config: `vitest.config.ts`. jsdom environment, globals on, setup file at `src/test/setup.ts`.
- Tests live next to source under `src/test/`, `src/hooks/__tests__/`, `src/utils/__tests__/`.
- Vitest **4** API — older v1 patterns may not apply; check existing tests under `src/test/**`.
- `tdd-guard-vitest` is installed as a devDependency but NOT wired into `vitest.config.ts` — latent tooling only.

### E2E (Playwright)

- Config: `playwright.config.ts`. Chromium only. `tests/e2e/auth.setup.ts` logs in once and saves storage state to `.auth/user.json`; the chromium project depends on `setup` and reuses the storage state.
- **Fail-closed network guard**: `playwright.config.ts` parses `VITE_SUPABASE_URL` and refuses to run unless the host is loopback, RFC1918 (`10/8`, `192.168/16`, `172.16-31/12`), or Tailscale CGNAT (`100.64-127/10`). A mis-pointed dev server can't accidentally hit hosted Supabase with real credentials.
- E2E force-overrides shell env: `playwright.config.ts` parses `.env.test` directly with `dotenv` and writes into `process.env`. Vite's `loadEnv(..., '')` would let shell vars shadow the file (defeating the override) — that's deliberately avoided.
- Run: `npm run test:e2e`. UI mode: `npm run test:e2e:ui`.

### Coverage

Not currently configured.

## CI/CD (`.github/workflows/`)

### `test.yml` — Test pipeline

Triggered on push/PR to `main` or `develop`, weekly Monday cron, manual `workflow_dispatch`. Concurrency-grouped (cancels in-progress runs on the same branch).

Jobs:

1. **`lint`** — Lint + typecheck. Runs `npm ci --ignore-scripts`, `npm run lint`, `npm run typecheck`.
2. **`bundle-check`** — Builds prod bundle and runs `npm run check:bundle` to assert no React Query Devtools leaked into prod (NFR4 + ADR-005). Has a fork-PR / dependabot fallback that builds with dummy `VITE_SUPABASE_*` values when `FNOX_AGE_KEY` isn't available — DCE assertion is compile-time, identical outcome.
3. **`test`** — 4-shard parallel E2E. Installs Supabase CLI 2.95.0, overrides image registry to `public.ecr.aws` (GHCR mirror is incomplete for gotrue), starts local stack with retries (handles Docker Hub anonymous pull rate limits), writes a synthesized `.env.test` (local URL from `supabase status`, test creds via fnox), validates all keys are present, seeds test user, runs the matching shard. Retries on error (max 2 attempts, 15-min timeout). Uploads test results on failure (30-day retention).
4. **`burn-in`** — Same setup as `test`, but runs the full suite 10 times in a row to flush flaky tests.
5. **`test-summary`** — Aggregator job for branch protection. Fails if any of lint/bundle-check/test/burn-in failed.

### `deploy.yml` — GitHub Pages deploy

Triggered on push to `main` and `workflow_dispatch`. Runs lint + typecheck + unit tests + build (with `FNOX_AGE_KEY` from secrets), uploads `dist/` as the Pages artifact, deploys.

### `claude.yml`, `claude-code-review.yml`

Claude Code GitHub actions for review and assistance.

## Branch / commit conventions

- Feature branches: descriptive names, e.g. `redesign/editorial-engineering`.
- Commits follow Conventional-Commits-ish prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, with optional scope: `feat(ui):`, `fix(realtime):`, `fix(dev):`.
- Recent commit style is verbose — explain the WHY in the body. See e.g. `e1b3c49 fix(realtime): use crypto.randomUUID for channel name to survive StrictMode double-mount`.
- Branch is protected via `test-summary` on the test workflow.

## Deployment

- Hosted at GitHub Pages — `https://<user>.github.io/ClassPoints/`.
- `vite.config.ts` `base: '/ClassPoints/'` matches the path.
- Build inlines hosted Supabase URL + anon key (NOT secret — anon key is public-readable; RLS protects data).
- Service-role key is NEVER bundled into the app and lives only in `.env.test` (local) and CI secrets.

## Common workflows

| Task                                                          | Command sequence                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily local dev                                               | `npm run dev`                                                                                                                                                                                                                          |
| Add a Supabase column                                         | Write `supabase/migrations/0NN_*.sql` → `npm run supabase:down && npm run supabase:up` (or rely on dev-script lifecycle) → update `src/types/database.ts` types → update transforms if applicable → verify `.select()` clauses → tests |
| Reproduce hosted-only bug                                     | `npm run dev:hosted` (requires age key)                                                                                                                                                                                                |
| Run a single Vitest file                                      | `npm test -- src/test/leaderboardCalculations.test.ts`                                                                                                                                                                                 |
| Re-seed local test user                                       | `npm run test:seed`                                                                                                                                                                                                                    |
| Switch to a different local Supabase project on the same port | `npm run supabase:down && npm run supabase:up`                                                                                                                                                                                         |
| Verify prod bundle has no devtools                            | `npm run build && npm run check:bundle`                                                                                                                                                                                                |

## Gotchas

- **Vite `base: '/ClassPoints/'`**: every absolute-path asset reference in dev should account for this. `import.meta.env.BASE_URL` resolves to `/ClassPoints/` in both dev and prod.
- **`fnox.toml` is age-encrypted**: cloning the repo gets you the ciphertext. You need the matching age private key (one of the two recipients) to decrypt. Without it, only `npm run dev` (local-by-default) works.
- **Pre-commit typecheck slows commits on large branches**: run `npm run typecheck` periodically while working so the pre-commit pass is incremental.
- **`scripts/dev.mjs` strips fnox-auto-injected env vars**: if you need hosted creds in dev, use `npm run dev:hosted`. Setting `VITE_SUPABASE_URL` directly in your shell will be silently stripped by `dev.mjs` before spawning Vite.
- **React 18 only**: do not introduce `use()`, `useActionState`, or React-19 form actions. `useTransition` / `useDeferredValue` are fine.
- **Tailwind v4 syntax only**: `@import "tailwindcss"` + `@tailwindcss/postcss` plugin. No legacy v3 `tailwind.config.js` theme extensions or v3 PostCSS plugin.
- **Realtime DELETE rule**: any table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL` in its migration. See `supabase/migrations/005_replica_identity_full.sql`.
