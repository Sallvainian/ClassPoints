# Project Overview

_Generated 2026-06-02 (exhaustive full rescan; HEAD `c9ca66f` on `main`)._

ClassPoints is a classroom-management web app for teachers. It tracks per-student behavior points, classroom totals, today/this-week roll-ups, seating charts, and per-user sound feedback. It is a client-only React SPA — there is no app server. The browser talks directly to Supabase Auth + Postgres + Realtime + RLS + RPCs.

## Snapshot

| Attribute          | Value                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Type               | Single-page web application, monolith                                                                   |
| Architecture       | React SPA + Supabase BaaS                                                                               |
| Language           | TypeScript ~5.9.3, strict mode                                                                          |
| Runtime (Node)     | `>=25` (`package.json` engines; `.nvmrc` = 25; `@types/node` 25.9.1)                                    |
| Framework          | React 19.2.7 (React Compiler NOT enabled)                                                               |
| Build              | Vite 8.0.16 + `@vitejs/plugin-react` 6.0.2 (`base: '/ClassPoints/'`)                                    |
| Styling            | Tailwind CSS 4.3.0 + `@tailwindcss/postcss` 4.3.0 (v4 syntax only)                                      |
| Server-state cache | TanStack Query 5.100.14 (devtools 5.100.14)                                                             |
| Backend            | `@supabase/supabase-js` 2.106.2                                                                         |
| Drag-and-drop      | `@dnd-kit/core` 6.3.1 + `@dnd-kit/utilities` 3.2.2                                                      |
| Icons              | `lucide-react` 1.17.0 (sole library — no Heroicons / FontAwesome)                                       |
| Tests              | Vitest 4.1.8 + jsdom 29.1.1 + Vitest backend integration + Playwright 1.60.0                            |
| Lint / Format      | ESLint 10.4.1 (flat config) + `eslint-plugin-react-hooks` 7.1.1, Prettier 3.8.3                         |
| Hooks              | `simple-git-hooks` + `lint-staged` (pre-commit: eslint-fix + prettier + typecheck)                      |
| Secrets            | `fnox` + age-encrypted `fnox.toml`                                                                      |
| Env loader         | mise (`mise.toml`)                                                                                      |
| Deploy             | GitHub Pages (`.github/workflows/deploy.yml`)                                                           |
| Local DB           | Supabase CLI — brew-installed global, no longer an npm dep (`supabase start` / `npm run dev` lifecycle) |

## Current HEAD

`main` at `c9ca66f` (`docs(lint): fix stale set-state-in-effect rationale comment`). Since the prior scan's `cad3cfa`, the major changes are: **Phase 4 dissolved the `AppContext` server-data facade** (`d8cde26` — `AppContext.tsx` 710→33 LOC, now UI/session state only); the **invalidate-not-merge cross-device totals refactor** (`ea9f406`); the **React 19 + Vite 8** dependency bump (`e9ae285`); the **ESLint 10 ecosystem** adoption (`2e28130`) and enforcement of **`react-hooks/set-state-in-effect` as `'error'`** (`749b9d2`); plus dependabot GitHub Actions bumps (`supabase/setup-cli` v2, `upload-pages-artifact` v5, `mise-action` v4). The earlier editorial UI redesign (PR #86, `6b06828`), context-hook split, Node-25 sync, brew Supabase CLI, database-linter-hardening migration, and Insubordination default behavior all remain in place.

## What's in motion

- **TanStack migration**: `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors` are migrated, and **Phase 4 dissolved the `AppContext` facade** (server data, wrappers, selectors, and undo machinery moved to direct hooks + five thin transitional modules: `useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `pointSelectors`, `batchKindStore`). `useLayoutPresets` and `useSeatingChart` remain legacy hand-rolled hooks scheduled for migration (deferred #11/#12).
- **Editorial UI redesign** (landed via PR #86): terracotta accent, Instrument Serif + Geist + JetBrains Mono typography, semantic-token system. Cascade aliases retone hardcoded `bg-blue-*`/`from-indigo-*`/`from-purple-*` for free; hand-redesigned surfaces include Sidebar, ClassPointsBox, DashboardView, and parts of seating + settings. A few screens (SeatingChart\*, ImportStudentsModal, MigrationWizard, SyncStatus) are cascade-only by design.
- **Local-first dev loop** (landed): `npm run dev` is local-by-default; Docker daemon preflight + auto-managed Supabase stack lifecycle, with brew-CLI stale-state recovery. Hosted-Supabase is `npm run dev:hosted` (explicit fnox).

## Quick reference

```bash
npm run dev              # Local-by-default dev server (auto-manages local Supabase)
npm run dev:hosted       # Hosted-Supabase fallback (fnox exec -- vite)
npm run build            # Production build (tsc -b && fnox exec -- vite build)
npm run check:bundle     # CI: assert no react-query-devtools in prod bundle
npm run lint             # ESLint
npm run typecheck        # tsc -b --noEmit
npm test                 # Vitest watch
npm test -- --run        # Vitest single run
npm run test:integration # Vitest backend integration against LOCAL Supabase
npm run test:e2e         # Playwright (auto-starts/seeds/stops local Supabase)
npm run test:e2e:ui      # Playwright UI mode
npm run supabase:up      # Explicit local-stack lifecycle
npm run supabase:down
```

## Entry points

- App root: `src/main.tsx` → `src/App.tsx`
- Supabase client: `src/lib/supabase.ts`
- Query client: `src/lib/queryClient.ts`
- Query keys (single source of truth): `src/lib/queryKeys.ts`
- App UI/session context: `src/contexts/AppContext.tsx` (33 LOC — active-classroom selection only; Phase 4 dissolved the facade)

## See also

- [Architecture](./architecture.md) — full architectural detail
- [Data Models](./data-models.md) — schema, RLS, triggers, RPC
- [State Management](./state-management.md) — TanStack patterns + adapter layer
- [Component Inventory](./component-inventory.md) — UI surface map
- [Source Tree Analysis](./source-tree-analysis.md) — directory walkthrough
- [Development Guide](./development-guide.md) — setup, scripts, CI/CD
- [ADR-005 QueryClient Defaults](./adr/ADR-005-queryclient-defaults.md) — authoritative §1-§6
- [Modernization Plan](./modernization-plan.md) — TanStack migration strategy
- [`_bmad-output/project-context.md`](../_bmad-output/project-context.md) — LLM-optimized rule digest
- [`_bmad-output/planning-artifacts/prd.md`](../_bmad-output/planning-artifacts/prd.md) — migration PRD
