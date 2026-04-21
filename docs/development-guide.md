# Development Guide

_Last generated: 2026-04-21_

This is the bootstrap guide for a new developer coming to ClassPoints. Read `CLAUDE.md` alongside it — that doc has the same info in more concise form, tuned for AI agents.

---

## Prerequisites

| Tool           | Version             | Why                                                                                                             |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Node.js        | `24` (see `.nvmrc`) | Runtime                                                                                                         |
| npm            | ships with Node     | Package manager                                                                                                 |
| `fnox`         | latest              | Decrypts `fnox.toml` secrets at runtime. Install via `mise` or `brew install jdx/tap/fnox`.                     |
| `age`          | any recent          | Required by fnox.                                                                                               |
| Age key        | project-private     | Without the matching key, fnox can't decrypt `fnox.toml` — you won't have Supabase credentials. Ask a teammate. |
| `supabase` CLI | `^2.92`             | Required for local stack + E2E. Shipped as a dev dependency — `npx supabase <cmd>` works out of the box.        |
| Docker         | any modern          | Required by `supabase start` to run Postgres/Realtime/Auth/Storage locally.                                     |

Without a working fnox setup, you will not be able to run `npm run dev`/`build`/`preview` — they are wrapped in `fnox exec --`. Do not attempt to unwrap them in `package.json`; instead, fix fnox.

---

## First-time Setup

```bash
# 1. Install deps
nvm use                    # Node 24 per .nvmrc
npm ci

# 2. Install fnox (one-time, machine-wide)
mise use -g fnox@latest    # or: brew install jdx/tap/fnox

# 3. Import the age key
age-keygen -o ~/.config/fnox/age.txt  # If creating — ask team for the shared key instead

# 4. Smoke-test fnox
fnox exec -- printenv VITE_SUPABASE_URL  # Should print the Supabase project URL

# 5. Start the dev server
npm run dev                # → http://localhost:5173/ClassPoints/
```

`vite.config.ts` serves the app under `/ClassPoints/` (subpath deploy for GitHub Pages) — visiting `http://localhost:5173/` redirects or 404s; use the `/ClassPoints/` prefix.

---

## Daily Commands

```bash
npm run dev                # Start dev server (localhost:5173/ClassPoints)
npm run dev:host           # Same but binds 0.0.0.0 (for LAN testing)
npm run build              # Typecheck + Vite production build → dist/
npm run preview            # Serve the production build locally (fnox-wrapped)

npm run lint               # ESLint (flat config)
npm run typecheck          # tsc -b --noEmit

npm test                   # Vitest watch mode
npm test -- --run          # Vitest run once (CI mode)
npm test -- src/test/TeacherDashboard.test.tsx  # Single file
```

**Pre-commit hook** (installed by `npm install` via `simple-git-hooks`):

1. `lint-staged` — runs `eslint --fix` + `prettier --write` on staged `{ts,tsx,js,jsx,json,css,md}` files.
2. `npm run typecheck` — blocks commit on type errors.

If a hook fails, **fix the issue and make a NEW commit** — do not `--amend` (the prior commit already went through; amending rewrites unrelated history). Do not `--no-verify` unless you have a reason you'd say out loud to the team.

---

## Local E2E Setup

E2E tests must hit a **local** Supabase stack. `playwright.config.ts` refuses to run otherwise — the URL hostname must be loopback, RFC1918, or Tailscale CGNAT.

```bash
# Terminal 1 — start the local Supabase stack (boots Postgres/Realtime/Auth/Storage on 127.0.0.1)
npx supabase start
# Capture the printed anon key and service-role key.

# One-time setup
cp .env.test.example .env.test
# Edit .env.test — paste the anon key and service-role key.

# Terminal 2 — seed the test user
npm run test:seed          # Creates VITE_TEST_EMAIL in local Auth with email_confirm=true

# Run E2E
npm run test:e2e:local     # Seeds then runs Playwright
# OR
npm run test:e2e           # Runs without seeding (assumes test user exists)
npm run test:e2e:ui        # Playwright UI
```

Notes:

- `.env.test` is gitignored. `.env.test.example` is the committed template.
- `playwright.config.ts` spawns its own dev server (`reuseExistingServer: false`) — this is intentional. A manually-started dev server might be pointed at hosted Supabase. Never flip this to `true`.
- Playwright uses `fullyParallel: true`. Every spec must clean up after itself in `afterEach`/`afterAll`, including removing any rows it inserted.
- Authentication is handled once by `e2e/auth.setup.ts` and stored at `.auth/user.json` — specs reuse it via `storageState`. Don't add per-test sign-in flows.

---

## Debugging

### Supabase

- **Inspect current env:** `fnox exec -- printenv VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY`
- **Open local Supabase Studio:** `npx supabase status` prints the Studio URL (usually `http://127.0.0.1:54323`).
- **Tail local logs:** `npx supabase logs db` (or `realtime`, `auth`, `storage`).
- **Regenerate types:** `npx supabase gen types typescript --project-id <id> > src/types/database.ts`. Do this after any schema change.

### Realtime subscriptions

If a realtime subscription isn't firing:

1. Check the table is in the publication: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
2. For DELETE events: verify `REPLICA IDENTITY FULL`. Without it, DELETE payloads have only the PK.
3. Check the filter syntax. PostgREST format: `classroom_id=eq.<uuid>`. Typos silently match no rows.
4. The `useRealtimeSubscription` helper logs via `onStatusChange` — pass a callback to surface `CHANNEL_ERROR` / `TIMED_OUT` states.

### Optimistic updates double-counting

Symptom: awarding 1 point shows +2 momentarily, then settles.
Cause: the optimistic update wasn't mirrored onto both levels (student row AND classroom summary). The realtime UPDATE event's delta calculation then re-applies the delta.
Fix: ensure `updateStudentPointsOptimistically` AND `updateClassroomPointsOptimistically` are BOTH called together; see `AppContext.awardPoints`.

### "Missing Supabase environment variables"

Means `fnox exec` wasn't in the npm script. Re-install fnox or import the age key. Do not hard-code URLs in `src/lib/supabase.ts`.

---

## CI / GitHub Actions

Four workflows in `.github/workflows/`:

### `test.yml` — Pushes/PRs to `main` and `develop`

Jobs, in order:

1. `lint` — ESLint + `tsc` typecheck.
2. `test` — Playwright E2E sharded 4 ways (`--shard=N/4`). Up to 2 retries per shard, 15-min timeout, `fnox exec -- npm run test:e2e`. Requires `FNOX_AGE_KEY` secret.
3. `burn-in` — Runs the entire E2E suite 10 times in a loop to detect flaky tests. Runs in parallel with `test` (both depend on `lint`).
4. `test-summary` — Branch-protection gate; fails if any prior job failed.

Also runs weekly Monday 6am UTC via cron.

### `deploy.yml` — Push to `main` → GitHub Pages

Build → lint → typecheck → unit tests (`--run`) → Vite build → upload-pages-artifact → deploy-pages. Uses `FNOX_AGE_KEY` secret.

### `claude.yml` / `claude-code-review.yml`

Claude Code integration + automated PR review. Not part of the build/test pipeline; independent.

---

## Deployment

Deployed to **GitHub Pages** at a subpath. `vite.config.ts` sets `base: '/ClassPoints/'` — this prefixes every asset URL, so the app only works when served from `/ClassPoints/` (or locally under `http://localhost:5173/ClassPoints/`).

- Production URL: the `deploy.yml` workflow's `github-pages` environment prints it — typically `https://<org>.github.io/ClassPoints/`.
- Build artifact is `dist/` (gitignored).
- The deploy uses the repo's built-in GitHub Pages integration — no third-party hosts, no DNS setup.
- Secrets needed: `FNOX_AGE_KEY` GitHub Actions secret. Without it, the build can't decrypt the Supabase URL/key.
- No separate staging environment.

### What the build includes

`npm run build` runs:

1. `tsc -b` — incremental TypeScript project build (references `tsconfig.app.json` + `tsconfig.node.json`).
2. `vite build` — production bundle into `dist/` using the Vite 6 build pipeline. With `@vitejs/plugin-react`. Tree-shaking, code-splitting, minification enabled by default.

The five lazy-imported routes (`MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`) plus `SeatingChartEditor` produce separate chunks.

---

## Conventions

### Code style

- **Named exports** for components (`export function Foo()`). Default exports break HMR with `eslint-plugin-react-refresh`.
- **Hooks-before-returns** — all hooks at the top of the component, early returns after. `eslint-plugin-react-hooks` catches most violations.
- **No direct context imports from components.** Always `const { … } = useApp()` / `useAuth()` etc. — never `useContext(AppContext)`.
- **No barrels in component folders.** The hook barrel `src/hooks/index.ts` is the one intentional exception.
- **Comments:** default to none. Only write a comment for a non-obvious _why_: hidden constraint, subtle invariant, workaround. Don't reference PRs/tickets/authors in code.
- **TypeScript strict.** Flags: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`. Delete unused imports; don't silence with `_`.
- **Prettier**: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: 'es5'`, `printWidth: 100`.

### Testing

- **Unit tests** (`src/test/**`, `src/**/__tests__/**`): Vitest + jsdom + Testing Library. **Mock `@/lib/supabase`** at the module boundary — don't hit the network. Assert on observable behavior (Testing Library queries), not hook internals.
- **E2E tests** (`e2e/**`): Playwright Chromium against LOCAL Supabase only. Use `data-testid` attributes for selectors over fragile text/CSS selectors. No `setTimeout`/arbitrary waits — use auto-waiting locators and `findBy*` / `waitFor`.
- **`tdd-guard-vitest`** is wired up and will surface when tests are added without a prior red state.

### Adding a new feature

1. If new DB state is needed: create `supabase/migrations/<NNN>_<description>.sql` (zero-padded sequential). Include the table, RLS policies, any triggers, and realtime / `REPLICA IDENTITY FULL` settings together. Regenerate types.
2. Add/update types in `src/types/database.ts` (DB snake_case) and `src/types/index.ts` (app camelCase) + the `transformX` at the context/hook boundary.
3. If the data needs CRUD + realtime: add a data hook under `src/hooks/` matching the `{ data, loading, error, refetch }` + optimistic helper shape of the existing hooks. Compose it into `AppContext` if it's app-wide.
4. Add components under `src/components/<feature>/`. Prefer extending an existing feature folder over creating a new one.
5. Add unit tests under `src/test/` (or `src/<feature>/__tests__/`). Add E2E coverage for user-visible flows.

### What NOT to do

- Don't run E2E against hosted Supabase, "even just once to check prod parity." The private-URL guard exists for this reason.
- Don't modify `playwright.config.ts`'s private-URL guard without explicit approval.
- Don't aggregate `point_transactions[]` client-side to display totals — read from stored columns on `students`.
- Don't introduce icons from Heroicons/FontAwesome — use `lucide-react`.
- Don't introduce CSS Modules / styled-components / emotion — use Tailwind v4 utility classes. Inline `style={{}}` is only allowed for `@dnd-kit` transforms.
- Don't introduce state containers (Redux, Zustand, TanStack Query, Jotai). The app uses Context + hand-rolled hooks; extend those.
