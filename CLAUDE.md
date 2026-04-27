# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassPoints is a React classroom management app for teachers to track student behavior points. It uses Supabase for real-time data synchronization.

## Commands

```bash
npm run dev          # Start dev server LOCAL-by-default (loads .env.test; http://localhost:5173). Auto-starts/stops local Supabase when the URL points at this machine.
npm run dev:host     # Same as dev, exposed on LAN
npm run dev:hosted   # Dev against HOSTED Supabase (fnox exec -- vite — requires age key)
npm run build        # TypeScript compile + Vite build (fnox exec -- for hosted build)
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run check:bundle # Assert prod bundle has no react-query-devtools (run after build)
npm test             # Vitest unit tests (watch mode)
npm run test:seed    # Manually seed the test user (rarely needed — globalSetup does this)
npm run test:e2e     # Playwright E2E — auto-starts/seeds/stops local Supabase via globalSetup
npm run test:e2e:ui  # Playwright with UI
```

**Single test file:** `npm test -- src/test/specificFile.test.ts`

**Pre-commit hook:** Runs lint-staged + typecheck automatically.

## Environment

### fnox / age

Secrets live in `fnox.toml` at the project root, age-encrypted against two recipients (`linux`, `mac` public keys — see `fnox.toml`). `fnox exec --` decrypts the age payloads and injects them as env vars into the wrapped process. You need the matching age private key to decrypt.

`fnox.toml` provides:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TEST_EMAIL`
- `VITE_TEST_PASSWORD`

**Which scripts use fnox:**

- `npm run dev` and `dev:host` are **local-by-default** — plain `vite --mode test`, no fnox. Vite reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env.test` (see below) and hits a local Supabase stack. Default because most iteration is against local Postgres.
- `npm run dev:hosted` is the **hosted fallback** — `fnox exec -- vite`. Use when you need real prod data or to reproduce a hosted-only bug.
- `npm run build` and `preview` still wrap `fnox exec --` so prod bundles/preview inherit real credentials.

Do NOT drop `fnox exec --` from `build` or `preview`; those genuinely need the age-decrypted vars. `dev` deliberately does not.

### Local Supabase stack (for E2E)

E2E tests must hit a LOCAL Supabase stack, never hosted. One-time setup:

```bash
cp .env.test.example .env.test  # fill in anon + service-role keys (see `.env.test.example` comments)
npm run test:e2e                # globalSetup boots the stack, seeds the user, runs tests, stops the stack
```

`playwright.config.ts` fail-closes: it parses `VITE_SUPABASE_URL` and refuses to run unless the host is loopback, RFC1918 LAN, or Tailscale CGNAT. `.env.test` holds local (non-secret) credentials and is gitignored; `.env.test.example` is the committed template.

### On-demand local stack

There are TWO independent contexts that may auto-manage the local Supabase stack — each owns it fully in its own context, no overlap:

- **`npm run dev` (standalone)** — `scripts/dev.mjs` is the owner. Auto-starts the stack on launch, auto-stops on exit. Webserver-flavored.
- **`npm run test:e2e` (Playwright)** — `tests/e2e/global-setup.ts` is the owner. Starts the stack, seeds the test user (idempotent), and `global-teardown.ts` stops it. Playwright's `webServer` is plain `vite` — it intentionally does NOT touch Supabase, to avoid racing with globalSetup.

`scripts/lib/supabase-host.mjs` decides whether the URL points at this machine using Node `os.networkInterfaces` plus the `tailscale ip` CLI:

- URL is local AND stack is down → start it; stop it on exit.
- URL is local AND stack is already up → leave it alone (do not stop on exit).
- URL is remote (e.g. another machine's Tailscale IP) → skip lifecycle entirely; assume the remote host is managing it.

`npm run supabase:up` / `supabase:down` remain available for explicit lifecycle (e.g. switching projects on the same port). `npm run test:seed` remains as a dev utility for seeding without running tests.
