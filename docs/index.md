# ClassPoints Documentation

_Last generated: 2026-07-17 via BMad document-project full rescan, exhaustive scan (HEAD `e34bbf3` on `main`)._

ClassPoints is a React classroom-management app for teachers to track behavior points, classroom totals, today/this-week roll-ups, seating charts, and per-user sound feedback. It is a client-only SPA backed by Supabase Auth, Postgres, Realtime, RLS, RPCs, and one Edge Function — and it also ships as a Capacitor 8 native app (iOS + Android).

| Attribute    | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| Type         | Single-page web application, monolith + Capacitor native shell  |
| Architecture | React SPA + Supabase BaaS                                       |
| Language     | TypeScript ~6.0.3, strict                                       |
| Framework    | React 19.2.7                                                    |
| Build        | Vite 8.1.5, base `/ClassPoints/` (web) / `./` (capacitor)       |
| Styling      | Tailwind CSS 4.3.3 (v4 syntax)                                  |
| Server state | TanStack Query 5.101.2 — migration COMPLETE, all six domains    |
| Backend      | Supabase JS 2.110.7                                             |
| Native       | Capacitor 8.4.2 (iOS + Android)                                 |
| Tests        | Vitest unit (44 files) + integration (8) + Playwright (6 specs) |
| License      | PolyForm Noncommercial 1.0.0                                    |

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
npm run cap:build        # native bundle (vite --mode capacitor + bundle check + cap sync)
npm run cap:open:ios     # open the Xcode project
npm run lint
npm run typecheck        # app + tests tree
npm test -- --run
npm run test:integration # local Supabase backend integration
npm run test:e2e         # auto-starts/seeds/stops local Supabase (4 Playwright projects)
```

Entry points:

- App root: `src/main.tsx` → `src/App.tsx`
- Supabase client + `unwrap`/auth helpers: `src/lib/supabase.ts`
- Query client: `src/lib/queryClient.ts`
- Query keys: `src/lib/queryKeys.ts`
- App UI/session context: `src/contexts/AppContext.tsx` (33 LOC — active-classroom selection only; Phase 4 dissolved the facade)
- Native shell: `capacitor.config.ts` + `src/lib/{native,haptics,authStorage,appUrl}.ts`
- Edge Function: `supabase/functions/delete-account/`

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

1. **Read** [Project Overview](./project-overview.md) and [`_bmad-output/project-context.md`](../_bmad-output/project-context.md) for current state (note: project-context.md is anchored at an older HEAD — its migration-status staleness check applies).
2. **Set up** per [Development Guide](./development-guide.md) — `npm ci`, `cp .env.test.example .env.test`, install Docker, `npm run dev`.
3. **Before writing data-layer code**, read [State Management](./state-management.md) and the `useTransactions` / `useStudents` source to understand the canonical hook templates (all six domains are TanStack now).
4. **Before changing the schema**, follow the checklist in [Data Models](./data-models.md) (migration → `database.ts` → app type → transforms → `.select()` clauses).
5. **Before touching native code**, read the Native shell section of [Architecture](./architecture.md) — `@capacitor/*` imports stay confined to `src/lib/`.
6. **Before opening a PR**, run `npm run lint && npm run typecheck && npm test -- --run`; run `npm run test:integration` or `npm run test:e2e` when you touched Supabase, auth, realtime, or browser flows; and run `npm run build && npm run check:bundle` if you touched the bundle.
