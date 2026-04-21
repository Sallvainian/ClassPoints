# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClassPoints is a React classroom management app for teachers to track student behavior points. It uses Supabase for real-time data synchronization.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
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

Secrets live in `fnox.toml` at the project root, age-encrypted against two recipients (`linux`, `mac` public keys — see `fnox.toml`). The `dev`, `build`, and `preview` scripts are wrapped with `fnox exec --` so fnox decrypts the age payloads and injects them as env vars into the Vite process. You need the matching age private key to decrypt.

`fnox.toml` provides:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TEST_EMAIL`
- `VITE_TEST_PASSWORD`

Do NOT replace the `fnox exec --` prefix with bare `vite` in `package.json` scripts; without it, Vite gets none of the above.

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
