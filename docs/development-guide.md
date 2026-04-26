# ClassPoints Development Guide

_Generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

## Prerequisites

- Node 24, from `.nvmrc`.
- npm, using the committed `package-lock.json`.
- `mise` with `fnox` available for age-encrypted env injection.
- Supabase CLI 2.95.0 for the local stack.
- Playwright Chromium browser dependencies for E2E tests.

Install dependencies:

```bash
npm ci
```

Install git hooks:

```bash
npm run prepare
```

## Environment

### Local development

`npm run dev` is local-by-default:

```bash
npm run dev
```

It runs `vite --mode test`, so Vite reads `.env.test`. Use a local Supabase stack and local
non-production credentials.

### Hosted development fallback

```bash
npm run dev:hosted
```

This runs `fnox exec -- vite` and injects hosted Supabase credentials from `fnox.toml`.

### Secrets

Secrets are age-encrypted in `fnox.toml` and loaded through `fnox`. Do not hardcode secrets in
`.env` files or source. Browser code only receives `VITE_*` values.

## npm Scripts

| Command                  | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `npm run dev`            | Start local-by-default Vite dev server                 |
| `npm run dev:host`       | Local-by-default dev server exposed on LAN             |
| `npm run dev:hosted`     | Hosted Supabase fallback through `fnox`                |
| `npm run build`          | `tsc -b` plus `fnox exec -- vite build`                |
| `npm run preview`        | Preview build through `fnox`                           |
| `npm run lint`           | ESLint flat-config check                               |
| `npm run typecheck`      | TypeScript project references check                    |
| `npm run check:bundle`   | Assert React Query Devtools is absent from prod bundle |
| `npm test`               | Vitest watch mode                                      |
| `npm run test:seed`      | Seed the local E2E test user                           |
| `npm run test:e2e`       | Playwright E2E                                         |
| `npm run test:e2e:local` | Seed then run Playwright E2E                           |
| `npm run test:e2e:ui`    | Playwright UI mode                                     |
| `npm run migrate`        | Hosted/local migration script through `fnox`           |
| `npm run supabase:up`    | Start local Supabase                                   |
| `npm run supabase:down`  | Stop local Supabase                                    |

## Local Supabase

One-time setup:

```bash
npx supabase start
cp .env.test.example .env.test
```

Fill `.env.test` from `npx supabase status` output:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Also include test credentials:

- `VITE_TEST_EMAIL`
- `VITE_TEST_PASSWORD`

Then seed:

```bash
npm run test:seed
```

`playwright.config.ts` parses `.env.test` directly and force-overrides shell env so E2E cannot
accidentally target hosted Supabase.

## Testing

### Unit tests

```bash
npm test -- --run
npm test -- src/test/TeacherDashboard.test.tsx --run
```

Unit tests live under `src/`, currently:

- `src/test/leaderboardCalculations.test.ts`
- `src/test/sounds.test.ts`
- `src/test/useRotatingCategory.test.ts`
- `src/test/TeacherDashboard.test.tsx`
- `src/hooks/__tests__/useRealtimeSubscription.test.ts`
- `src/utils/__tests__/studentParser.test.ts`

Vitest uses `src/test/setup.ts`.

### E2E tests

```bash
npm run test:e2e:local
```

E2E tests live in `tests/e2e/` and use shared fixtures from `tests/support/fixtures`.
`tests/e2e/auth.setup.ts` signs in with the seeded test user and writes `.auth/user.json` for the
Chromium project.

E2E host guard:

- Allows `localhost`, `127.0.0.1`.
- Allows RFC1918 LAN ranges.
- Allows Tailscale CGNAT `100.64.0.0/10`.
- Rejects public/hosted Supabase hosts.

## Formatting And Hooks

Prettier config:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

Pre-commit runs:

1. `lint-staged`
2. ESLint fix on staged TS/TSX files
3. Prettier on staged source/config/docs files
4. `npm run typecheck`

If a hook fails, fix the issue, re-stage, and create a new commit. Do not bypass hooks.

## Build And Bundle Check

```bash
npm run build
npm run check:bundle
```

`check:bundle` scans `dist/assets` for devtools chunks and forbidden strings:

- `react-query-devtools`
- `ReactQueryDevtools`

The check enforces the development-only import pattern in `src/main.tsx`.

## CI

`.github/workflows/test.yml` runs:

- lint
- typecheck
- bundle build and DCE check
- sharded Playwright E2E against a local Supabase stack
- burn-in job for flake detection

The E2E jobs install Supabase CLI 2.95.0, start the local stack with retry, write `.env.test`, seed
the test user, and run Playwright shards.

`.github/workflows/deploy.yml` runs on `main` and manually. It lints, typechecks, runs unit tests,
builds with `fnox`, and deploys `dist/` to GitHub Pages.

## Development Conventions

- Use named component exports.
- Keep hooks before early returns.
- Use Tailwind utility classes for static styling.
- Use inline styles only for runtime-computed values such as DnD transforms, canvas geometry,
  avatar colors, progress widths, and overlay z-index.
- Use `lucide-react` for new icons.
- Use `src/lib/queryKeys.ts` for every query key.
- Transform DB rows at query boundaries.
- Keep service-role key usage out of `src/**`.
- Use Supabase mutations through typed `Insert` / `Update` payloads from `src/types/database.ts`.

## Common Workflows

### Add or change a table

1. Add a zero-padded migration under `supabase/migrations/`.
2. Enable RLS and add policies in the same migration.
3. Update `src/types/database.ts`.
4. Update app-facing types and transforms if the column is user-facing.
5. Update explicit `.select(...)` clauses if needed.
6. Add or update tests where behavior changes.

### Add server-state UI

1. Add query-key builders first.
2. Implement a thin `useQuery`/`useMutation` hook.
3. Invalidate using the same key builder.
4. Prefer direct hook usage over new `AppContext` wrappers.

### Work on E2E

1. Start local Supabase.
2. Ensure `.env.test` points to the local stack.
3. Run `npm run test:e2e:local`.
4. Use factories and cleanup for created state.
5. Avoid hard waits; use locator expectations.

## Known Stale/Legacy Areas

- `tests/README.md` still has a stale follow-up note about porting storageState even though
  `tests/e2e/auth.setup.ts` and the setup project now exist.
- `tailwind.config.js` remains a vestigial v3-style stub; Tailwind v4 is configured through
  `postcss.config.js` and `src/index.css`.
- `usePersistedState` is exported from the hooks barrel but has no active importer under `src/`.
- `useLayoutPresets` and `useSeatingChart` are legacy state hooks and should not be copied as new
  data-hook templates.
