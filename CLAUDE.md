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
npm run test:seed    # Seed the test user into the LOCAL Supabase stack
npm run test:e2e     # Playwright E2E (loads .env.test; refuses to run against hosted Supabase)
npm run test:e2e:local # Same as test:e2e, but seeds the test user first
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

E2E tests must hit a LOCAL Supabase stack, never hosted:

```bash
# One-time setup
npx supabase start                    # boots Postgres/Realtime/Auth on 127.0.0.1
cp .env.test.example .env.test        # fill in anon + service-role keys from `npx supabase status`
npm run test:seed                     # creates the test user in local auth
npm run test:e2e:local                # runs full suite against local stack
```

`playwright.config.ts` fail-closes: it parses `VITE_SUPABASE_URL` and refuses to run unless the host is loopback, RFC1918 LAN, or Tailscale CGNAT. `.env.test` holds local (non-secret) credentials and is gitignored; `.env.test.example` is the committed template.

### On-demand local stack

`npm run dev` (via `scripts/dev.mjs`) and Playwright (via `tests/e2e/global-setup.ts` / `global-teardown.ts`) auto-manage the local Supabase stack. `scripts/lib/supabase-host.mjs` decides whether the URL points at this machine using Node `os.networkInterfaces` plus the `tailscale ip` CLI:

- URL is local AND stack is down → start it; stop it on exit.
- URL is local AND stack is already up → leave it alone (do not stop on exit).
- URL is remote (e.g. another machine's Tailscale IP) → skip lifecycle entirely; assume the remote host is managing it.

`npm run supabase:up` / `supabase:down` remain available for explicit lifecycle (e.g. switching projects on the same port).
