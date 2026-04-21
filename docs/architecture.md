# Architecture

_Last generated: 2026-04-21 — Master architecture overview. Cross-links to the detail docs under `docs/`._

ClassPoints is a **single-page React app** with a **Supabase BaaS** backend — PostgreSQL 15 + Realtime (WebSocket) + Auth + RLS. There is **no application-level server of our own** — the browser talks directly to Supabase, constrained by Row Level Security tied to `auth.uid()`.

---

## Executive Summary

| Attribute        | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Repository type  | Monolith, 1 part                                                                                            |
| Project type     | Web SPA                                                                                                     |
| Frontend         | React 18.3 + TypeScript 5.9 strict                                                                          |
| Build            | Vite 6 (subpath deploy `/ClassPoints/`)                                                                     |
| Styling          | Tailwind CSS 4 via `@tailwindcss/postcss`                                                                   |
| Backend          | Supabase 2.90 (hosted) — Auth, PostgREST, Realtime                                                          |
| Database         | PostgreSQL 15+ (Supabase-hosted)                                                                            |
| Auth model       | Email/password, session stored client-side by supabase-js                                                   |
| Authorization    | Row Level Security keyed to `auth.uid()`; anon key constrained by RLS; service role never shipped to client |
| State management | React Context + hand-rolled data hooks with optimistic updates + realtime reconciliation                    |
| Unit tests       | Vitest 4 + jsdom + Testing Library                                                                          |
| E2E tests        | Playwright 1.57 against LOCAL Supabase only (fail-closed URL guard)                                         |
| Secrets          | `fnox` + age encryption; `fnox exec --` wraps all Vite scripts                                              |
| Deploy           | GitHub Pages; `main` push triggers `.github/workflows/deploy.yml`                                           |

---

## Architecture Pattern

**Client-only SPA with BaaS.**

```
┌──────────────────────────────────────────────────────┐
│                   Browser (React SPA)                │
│  ┌──────────────────────────────────────────────┐   │
│  │ Contexts: Auth → Theme → Sound → App          │   │
│  │  (see state-management.md)                    │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │ Data hooks: useClassrooms / useStudents /     │   │
│  │   useBehaviors / useTransactions /            │   │
│  │   useSeatingChart / useLayoutPresets          │   │
│  │  (composed by AppContext)                     │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │ useRealtimeSubscription (one helper, all     │   │
│  │ realtime channels go through it)             │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │ src/lib/supabase.ts — single createClient    │   │
│  │   with anon key; used by every hook           │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   HTTPS/PostgREST   WebSocket        Auth API
   (CRUD + RPC)     (Realtime)      (sessions)
         │               │               │
         ▼               ▼               ▼
┌──────────────────────────────────────────────────────┐
│           Supabase (hosted)                          │
│  ┌──────────────────────────────────────────────┐   │
│  │ PostgreSQL 15 — 10 tables + triggers + 1 RPC │   │
│  │ RLS policies constrained by auth.uid()       │   │
│  │ (see data-models.md)                         │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

No bespoke backend. No API routes we own. No middleware. The browser is the only client; the Supabase project is the only server.

---

## Technology Stack

Runtime:

- **React 18.3.1** + `react-dom@18.3.1`. Not React 19 — no `use()`, `useActionState`, or form actions yet.
- **TypeScript ~5.9.3** strict. Flags: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`. `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`, `isolatedModules: true`, `moduleDetection: "force"`.
- **Vite 6.0.5** with `@vitejs/plugin-react`. Target ES2020, `jsx: react-jsx`.

UI:

- **Tailwind CSS 4.1.17** via `@tailwindcss/postcss` — v4 PostCSS plugin, NOT the legacy `tailwindcss` plugin.
- **`@dnd-kit/core` 6.3.1** + **`@dnd-kit/utilities` 3.2.2** — drag-and-drop in the seating editor.
- **`lucide-react` 1.8.0** — icon library.
- **`uuid` 13** — client-side batch_id generation for multi-student awards.

Backend SDK:

- **`@supabase/supabase-js` 2.90.1** — client. Typed via `createClient<Database>(...)`.
- **`supabase` CLI 2.92** — local stack, types generation.

Tooling:

- **ESLint 9.39** flat config + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`.
- **Prettier 3.8**.
- **`simple-git-hooks`** + **`lint-staged`** — pre-commit hooks.
- **`fnox`** (mise-installed) + **age** — secret injection; `fnox exec --` wraps `vite` in every npm script.
- **`tsx` 4.21** — direct TypeScript execution for `scripts/**`.

Test:

- **Vitest 4.0.17** + **jsdom 27** — unit.
- **Testing Library** (`@testing-library/react@16`, `jest-dom@6`, `user-event@14`).
- **Playwright 1.57** — E2E; Chromium only.
- **`tdd-guard-vitest`** — red-state enforcement.

All versions are frozen in `package.json`. AI agents must not downgrade Tailwind to v3 syntax, introduce React 19 APIs, or emit an `.eslintrc*` file.

---

## Data Architecture

See **[`data-models.md`](./data-models.md)** for the full schema.

Highlights:

- **10 tables** in public schema. Ownership roots at `auth.users`; everything else is owned transitively via `classrooms.user_id`.
- **RLS on every table.** The anon key shipped to the browser is constrained by these policies. Service-role key lives only in Node-side scripts.
- **Denormalized lifetime totals on `students`** (`point_total`, `positive_total`, `negative_total`) maintained by `update_student_point_totals` trigger on `point_transactions` INSERT/DELETE. Never aggregate client-side for display.
- **Time-based totals (today, this week)** computed via the `get_student_time_totals(classroom_id, start_of_today, start_of_week)` RPC. Not stored.
- **Realtime** is enabled on `classrooms`, `students`, `behaviors`, `point_transactions`, `user_sound_settings`. Seating-chart tables are **not** on realtime — the editor assumes one active editor per chart.
- **`REPLICA IDENTITY FULL`** on `point_transactions`, `students`, `user_sound_settings` — required so DELETE events carry the full row, not just the PK.

---

## Application Architecture

See **[`state-management.md`](./state-management.md)** for the full description.

Highlights:

### Context hierarchy (outer → inner)

```
AuthProvider → AuthGuard → ThemeProvider → SoundProvider → AppProvider → AppContent
```

Strict ordering: providers below `AuthGuard` only mount when authenticated. `AppProvider` assumes a valid session exists.

### Single-facade rule

Components read app-wide state only through **`useApp()`**. Direct `useContext(AppContext)` is not allowed — it violates the "facade" pattern that makes the seams easy to find.

### Data hook shape

Every Supabase-backed data hook returns:

```ts
{
  <domain>: X[];
  loading: boolean;
  error: Error | null;
  addX / updateX / removeX: Promise<X | null>;
  updateXOptimistically?: (...) => void;
  refetch: () => Promise<void>;
}
```

Match this shape when adding a new hook. Don't invent new shapes — `AppContext` composes these.

### Optimistic update contract

1. Capture rollback state.
2. Apply optimistic delta to every relevant local store (student row AND classroom summary — both, otherwise the realtime event double-counts).
3. Execute the mutation.
4. On error: rollback + re-throw.
5. On success: do nothing — realtime will reconcile.

### Realtime subscriptions

Use **`useRealtimeSubscription`** — never hand-roll `supabase.channel(...)`. Callbacks are stored in refs so the subscription doesn't re-subscribe on every render. Cleanup is automatic. `onReconnect` exists for gap recovery.

---

## Component Architecture

See **[`component-inventory.md`](./component-inventory.md)** for the full catalog.

**45 components across 14 feature folders** under `src/components/`:

```
auth/ behaviors/ classes/ common/ dashboard/ home/ layout/
migration/ points/ profile/ seating/ settings/ students/ ui/
```

- **Design system primitives** live in `ui/` (Button, Input, Modal, ErrorToast). All feature modals wrap `ui/Modal`.
- **Feature folders** own their own state via hooks; they share domain types via `src/types/index.ts`.
- **`React.memo`** is applied to leaf presentational components (cards, buttons); containers are not memoized. Stable callback refs via `useCallback` are essential — don't pass fresh literals to memoized children.
- **Lazy-loaded routes** (via `React.lazy` in `App.tsx`): `MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`. Plus `SeatingChartEditor` within `SeatingChartView`.
- **Named exports only.** Default exports break HMR under `eslint-plugin-react-refresh/only-export-components`.

---

## Source Tree

See **[`source-tree-analysis.md`](./source-tree-analysis.md)** for the annotated layout. Summary:

- `src/` — all browser code
  - `src/contexts/` — four contexts (Auth, Theme, Sound, App)
  - `src/hooks/` — 12 hooks including the realtime helper
  - `src/components/<feature>/` — 45 components
  - `src/lib/supabase.ts` — single Supabase client instance
  - `src/types/` — DB types (snake_case) + app types (camelCase)
  - `src/utils/` — pure helpers; dateUtils, leaderboardCalculations, studentParser, etc.
  - `src/services/` — NetworkStatus only
  - `src/assets/sounds/` — synthesized Web Audio definitions
  - `src/test/` + `src/hooks/__tests__/` + `src/utils/__tests__/` — unit tests (three locations — match neighbors)
- `supabase/migrations/` — 11 sequential SQL files
- `e2e/` — Playwright specs (5 files)
- `scripts/` — Node-side tooling (seeding, migration, CI helpers)
- `.github/workflows/` — 4 workflows

---

## Development & Deployment

See **[`development-guide.md`](./development-guide.md)** for the full workflow. Summary:

### Bootstrap

```bash
nvm use                          # Node 24
npm ci
mise use -g fnox@latest          # secret manager
# Import the team's shared age key
npm run dev                      # http://localhost:5173/ClassPoints/
```

### Daily commands

```bash
npm run dev          # dev server
npm run build        # tsc -b && vite build → dist/
npm run lint         # ESLint
npm run typecheck    # tsc -b --noEmit
npm test             # Vitest watch
npm run test:e2e:local   # Playwright against local Supabase stack
```

### E2E

Run against a **local** Supabase stack only:

```bash
npx supabase start                       # Terminal 1
cp .env.test.example .env.test           # paste keys from `supabase status`
npm run test:seed
npm run test:e2e:local
```

`playwright.config.ts` refuses to run if `VITE_SUPABASE_URL` isn't loopback / RFC1918 / Tailscale CGNAT. **Do not weaken this guard.**

### CI

- `test.yml` — lint + 4-shard E2E + 10x burn-in for flaky detection. Triggers on push/PR + weekly cron.
- `deploy.yml` — on push to `main`: lint → typecheck → unit tests → `vite build` → GitHub Pages artifact → deploy. Requires `FNOX_AGE_KEY` GitHub secret.
- `claude.yml` / `claude-code-review.yml` — Claude Code assistance + PR review. Non-blocking.

### Deploy

GitHub Pages at `<org>.github.io/ClassPoints/`. No staging env. Vite `base: '/ClassPoints/'` prefixes all assets.

---

## Testing Strategy

Two layers, two harnesses:

| Layer | Location                             | Runner                             | Hits network?              |
| ----- | ------------------------------------ | ---------------------------------- | -------------------------- |
| Unit  | `src/test/**`, `src/**/__tests__/**` | Vitest 4 + jsdom + Testing Library | No — mock `@/lib/supabase` |
| E2E   | `e2e/**/*.spec.ts`                   | Playwright 1.57 (Chromium only)    | Yes — LOCAL Supabase only  |

Unit tests assert on observable behavior via Testing Library queries (`getByRole`, `getByText`), not hook internals. Test names start with `should`.

E2E tests use `data-testid` selectors, storage-state auth (reused across specs), and run `fullyParallel: true`. Every spec must clean up after itself. Don't share mutable module-scope state.

**`tdd-guard-vitest`** is configured — tests added without a prior red state will be flagged.

---

## Security Boundaries

1. **RLS is the authorization boundary.** No application-level permission checks exist; everything is enforced by Postgres RLS against `auth.uid()`. Disabling RLS on a new table effectively publishes the data.
2. **Anon key to the browser; service role to scripts only.** `src/**` uses `import.meta.env.VITE_*`; `scripts/**` uses `process.env`. Never cross these boundaries.
3. **E2E private-URL guard.** `playwright.config.ts` parses the Supabase URL hostname; loopback / RFC1918 / Tailscale CGNAT allowed, everything else rejected. Substring match would be unsafe (`https://127.0.0.1.evil.com`) — always parse.
4. **Secrets in fnox.** `fnox.toml` is age-encrypted against two recipients. CI uses `FNOX_AGE_KEY` secret. Do not commit plaintext `.env` files (and none exist).
5. **No `new Audio()` or random fetch calls.** Sounds go through `SoundProvider` + `useSoundEffects`. Custom audio URLs are fetched via `validateAudioUrl.ts` with CORS and fallback handling.

---

## Architectural Decisions — Why It's This Way

### Why Supabase BaaS instead of our own backend?

Single-team, single-product scale. RLS + Realtime + Auth + Postgres is a complete enough backend that we don't need our own Express/Nest/Go service. The team's effort goes into schema, triggers, and RLS policies — not into writing glue code.

### Why hand-rolled data hooks, not TanStack Query?

Historical — the app grew this way. There's aspirational text in `_bmad-output/project-context.md` and `docs/legacy/*.md` about migrating to TanStack Query, but the migration is **not** installed (`@tanstack/react-query` is not a dep). Treat the hand-rolled pattern as the current reality; only reopen the question as a deliberate piece of work.

### Why denormalized totals on `students`?

Performance — `students.select('*')` returns totals with no aggregation. The alternative (aggregating `point_transactions` on every load) is O(n) per student and scales poorly. Trigger-maintained means no drift.

### Why batch_id for class-wide awards?

Single-click undo. All transactions in a class-wide award share a `batch_id`; undoing deletes by `batch_id` in one query. The `REPLICA IDENTITY FULL` on `point_transactions` means the DELETE events carry the full rows — allowing the client to reconcile student totals instantly.

### Why GitHub Pages + subpath deploy?

Free static hosting, no backend to provision. `vite.config.ts` `base: '/ClassPoints/'` makes this work.

### Why fnox (not Doppler, not .env)?

Client-side secrets (Supabase URL + anon key) are injected at build time; age encryption lets secrets live in the repo without plaintext exposure. Tradeoff: anyone needing to run the app locally needs a matching age key. (An earlier commit suggested a Doppler migration; it was reverted.)

---

## Known Drift / Tech Debt

Items the code hints at but hasn't resolved:

- **`_bmad-output/project-context.md` describes state management as if TanStack Query were in use.** It isn't. The description is aspirational. Treat this architecture.md as the source of truth.
- **`docs/legacy/*.md`** — historical AI rules that used to live at `.claude/rules/`. `.claude/rules/` no longer exists. These are kept for reference.
- **Seating charts are not on realtime.** Multi-device editing of a seating chart would produce lost writes.
- **`src/hooks/usePersistedState.ts`** is a legacy localStorage store for pre-Supabase data. Only used by `MigrationWizard`. Do not add new callers.
- **Three test-file locations** (`src/test/`, `src/hooks/__tests__/`, `src/utils/__tests__/`) are a consistency gap; match the neighbors when adding a test.
- **No README / CONTRIBUTING / LICENSE at root.** New dev onboarding relies entirely on `CLAUDE.md` + `docs/`.
