# ClassPoints Documentation

_Last generated: 2026-04-28 via BMad document-project full rescan, deep scan._

ClassPoints is a React classroom-management app for teachers to track behavior points, classroom totals, today/this-week roll-ups, seating charts, and per-user sound feedback. It is a client-only SPA backed by Supabase Auth, Postgres, Realtime, RLS, and RPCs.

| Attribute    | Value                                 |
| ------------ | ------------------------------------- |
| Type         | Single-page web application, monolith |
| Architecture | React SPA + Supabase BaaS             |
| Language     | TypeScript ~5.9.3, strict             |
| Framework    | React 18.3.1                          |
| Build        | Vite 6.0.5, base `/ClassPoints/`      |
| Styling      | Tailwind CSS 4.1.17 (v4 syntax)       |
| Server state | TanStack Query 5.99.2                 |
| Backend      | Supabase JS 2.104.1                   |
| Tests        | Vitest 4.1.5 + Playwright 1.59.1      |

## Start here

| I want to...                     | Read                                              |
| -------------------------------- | ------------------------------------------------- |
| Get the short project summary    | [Project Overview](./project-overview.md)         |
| Understand the full architecture | [Architecture](./architecture.md)                 |
| Touch the database or migrations | [Data Models](./data-models.md)                   |
| Work on data hooks or app state  | [State Management](./state-management.md)         |
| Find UI components               | [Component Inventory](./component-inventory.md)   |
| Navigate the repo                | [Source Tree Analysis](./source-tree-analysis.md) |
| Run/build/test locally           | [Development Guide](./development-guide.md)       |

## Quick reference

```bash
npm run dev              # local-by-default Vite dev server
npm run dev:hosted       # hosted Supabase fallback through fnox
npm run build            # tsc -b && fnox exec -- vite build
npm run check:bundle     # assert no React Query Devtools in prod bundle
npm run lint
npm run typecheck
npm test -- --run
npm run test:e2e         # auto-starts/seeds/stops local Supabase
```

Entry points:

- App root: `src/main.tsx` → `src/App.tsx`
- Supabase client: `src/lib/supabase.ts`
- Query client: `src/lib/queryClient.ts`
- Query keys: `src/lib/queryKeys.ts`
- Legacy app facade: `src/contexts/AppContext.tsx` (Phase 4 dissolution target)

## Generated documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Data Models](./data-models.md)
- [State Management](./state-management.md)
- [Component Inventory](./component-inventory.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)

## High-signal existing docs

- [Modernization Plan](./modernization-plan.md) — TanStack migration strategy (target architecture)
- [ADR-005 QueryClient Defaults](./adr/ADR-005-queryclient-defaults.md) — §1-§6 all in force
- [Point Counter Inventory](./point-counter-inventory.md) — counter-feature inventory
- [Rules Review Category 3](./rules-review-category-3.md) — ruleset audit
- [Legacy Hooks Inventory](./legacy/legacy-hooks.md) — pattern catalog for the legacy hand-rolled hooks
- [Legacy Contexts Inventory](./legacy/legacy-contexts.md)
- [Legacy Supabase Inventory](./legacy/legacy-supabase.md)
- [Legacy Testing Inventory](./legacy/legacy-testing.md) — still authoritative
- [Legacy Migrations Inventory](./legacy/legacy-migrations.md) — still authoritative
- [Legacy Utils Inventory](./legacy/legacy-utils.md) — still authoritative

The remaining `legacy-*.md` files describe patterns being reversed during the TanStack migration. Treat them as refactor targets, not rules.

## BMAD artifacts

- [`_bmad-output/project-context.md`](../_bmad-output/project-context.md) — LLM-optimized critical-rules digest
- [`_bmad-output/planning-artifacts/prd.md`](../_bmad-output/planning-artifacts/prd.md) — TanStack migration PRD (scope, phases, AC)
- [`_bmad-output/planning-artifacts/architecture.md`](../_bmad-output/planning-artifacts/architecture.md) — architecture planning artifact
- [`_bmad-output/planning-artifacts/ux-design-specification.md`](../_bmad-output/planning-artifacts/ux-design-specification.md) — reverse-engineered UX design spec
- [`_bmad-output/anti-pattern-audit.md`](../_bmad-output/anti-pattern-audit.md) — 2026-04-25 audit (10 clusters, REAL/OVERSTATED/FALSE-POSITIVE verdicts)
- [`_bmad-output/implementation-artifacts/spec-tanstack-phase-3.md`](../_bmad-output/implementation-artifacts/spec-tanstack-phase-3.md)
- [`_bmad-output/implementation-artifacts/spec-tanstack-phase-2.md`](../_bmad-output/implementation-artifacts/spec-tanstack-phase-2.md)
- [`_bmad-output/implementation-artifacts/spec-tanstack-phase-0-1.md`](../_bmad-output/implementation-artifacts/spec-tanstack-phase-0-1.md)
- [`_bmad-output/implementation-artifacts/deferred-work.md`](../_bmad-output/implementation-artifacts/deferred-work.md)

## Project root rules

- [CLAUDE.md](../CLAUDE.md) — Claude Code-specific rules
- [AGENTS.md](../AGENTS.md) — Codex/agent rules

## Getting started

1. **Read** [Project Overview](./project-overview.md) and [`_bmad-output/project-context.md`](../_bmad-output/project-context.md) to understand the migration state.
2. **Set up** per [Development Guide](./development-guide.md) — `npm ci`, `cp .env.test.example .env.test`, install Docker, `npm run dev`.
3. **Before writing data-layer code**, read [State Management](./state-management.md) and the `useTransactions` / `useStudents` source to understand the canonical Phase 2/3 hook templates.
4. **Before changing the schema**, follow the checklist in [Data Models](./data-models.md) (migration → `database.ts` → app type → transforms → `.select()` clauses).
5. **Before opening a PR**, run `npm run lint && npm run typecheck && npm test -- --run` and (if you touched the bundle) `npm run build && npm run check:bundle`.
