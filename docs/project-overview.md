# Project Overview

_Generated 2026-04-28 (deep-scan rescan)._

ClassPoints is a classroom-management web app for teachers. It tracks per-student behavior points, classroom totals, today/this-week roll-ups, seating charts, and per-user sound feedback. It is a client-only React SPA — there is no app server. The browser talks directly to Supabase Auth + Postgres + Realtime + RLS + RPCs.

## Snapshot

| Attribute          | Value                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Type               | Single-page web application, monolith                                              |
| Architecture       | React SPA + Supabase BaaS                                                          |
| Language           | TypeScript ~5.9.3, strict mode                                                     |
| Framework          | React 18.3.1                                                                       |
| Build              | Vite 6.0.5 (`base: '/ClassPoints/'`)                                               |
| Styling            | Tailwind CSS 4.1.17 + `@tailwindcss/postcss` 4.2.4 (v4 syntax only)                |
| Server-state cache | TanStack Query 5.99.2 (devtools 5.100.1)                                           |
| Backend            | `@supabase/supabase-js` 2.104.1                                                    |
| Drag-and-drop      | `@dnd-kit/core` 6.3.1 + `@dnd-kit/utilities` 3.2.2                                 |
| Icons              | `lucide-react` 1.9.0 (sole library — no Heroicons / FontAwesome)                   |
| Tests              | Vitest 4.1.5 + jsdom 27.4.0 + Playwright 1.59.1 (Chromium only)                    |
| Lint / Format      | ESLint 9.39.2 (flat config), Prettier 3.8.3                                        |
| Hooks              | `simple-git-hooks` + `lint-staged` (pre-commit: eslint-fix + prettier + typecheck) |
| Secrets            | `fnox` + age-encrypted `fnox.toml`                                                 |
| Env loader         | mise (`mise.toml`)                                                                 |
| Deploy             | GitHub Pages (`.github/workflows/deploy.yml`)                                      |
| Local DB           | Supabase CLI 2.95.0 (`npx supabase start` / `npm run dev` lifecycle)               |

## Active branch

`redesign/editorial-engineering` — UI redesign track. Includes the editorial / engineering token cascade (commit `ae7a9a8`), Phase-2 inner-screen restructure (`fb3f239`), local-by-default dev script (`b35fa99`, `21c821f`, `136f493`), realtime channel-name UUID fix (`e1b3c49`), stale-JWT graceful degrade (`d652260`), class-total promotion to ClassPointsBox + tightened seating-chart visibility (`350c7c9`), context refresh + UI Design System Rules (`078d9fe`), and reverse-engineered UX design specification (`9004e6d`).

## What's in motion

- **TanStack migration**: `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors` are migrated. `useLayoutPresets` and `useSeatingChart` are legacy hand-rolled hooks scheduled for migration. `AppContext` is being dissolved (Phase 4).
- **Editorial UI redesign**: terracotta accent, Instrument Serif + Geist + JetBrains Mono typography, semantic-token system. Cascade aliases retone hardcoded `bg-blue-*`/`from-indigo-*`/`from-purple-*` for free; hand-redesigned surfaces include Sidebar, ClassPointsBox, DashboardView, and parts of seating + settings.
- **Local-first dev loop**: `npm run dev` is local-by-default; Docker daemon preflight + auto-managed Supabase stack lifecycle. Hosted-Supabase is `npm run dev:hosted` (explicit fnox).

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
- Legacy app facade: `src/contexts/AppContext.tsx` (Phase 4 dissolution target)

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
