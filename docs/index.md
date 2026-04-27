# ClassPoints Documentation

_Last generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

ClassPoints is a React classroom-management app for teachers to track behavior points, classroom
totals, student totals, seating charts, and sound feedback. It is a client-only SPA backed by
Supabase Auth, Postgres, Realtime, RLS, and RPCs.

| Attribute    | Value                                 |
| ------------ | ------------------------------------- |
| Type         | Single-page web application, monolith |
| Architecture | React SPA + Supabase BaaS             |
| Language     | TypeScript 5.9.3 strict               |
| Framework    | React 18.3.1                          |
| Build        | Vite 6.4.2, base `/ClassPoints/`      |
| Styling      | Tailwind CSS 4.2.4                    |
| Server state | TanStack Query 5.100.1                |
| Backend      | Supabase JS 2.104.1                   |
| Tests        | Vitest 4.1.5 + Playwright 1.59.1      |

## Start Here

| I want to...                     | Read                                              |
| -------------------------------- | ------------------------------------------------- |
| Get the short project summary    | [Project Overview](./project-overview.md)         |
| Understand the full architecture | [Architecture](./architecture.md)                 |
| Touch the database or migrations | [Data Models](./data-models.md)                   |
| Work on data hooks or app state  | [State Management](./state-management.md)         |
| Find UI components               | [Component Inventory](./component-inventory.md)   |
| Navigate the repo                | [Source Tree Analysis](./source-tree-analysis.md) |
| Run/build/test locally           | [Development Guide](./development-guide.md)       |

## Quick Reference

```bash
npm run dev              # local-by-default Vite dev server
npm run dev:hosted       # hosted Supabase fallback through fnox
npm run build            # tsc -b && fnox exec -- vite build
npm run check:bundle     # assert no React Query Devtools in prod bundle
npm run lint
npm run typecheck
npm test -- --run
npm run test:e2e:local   # seed local test user, then Playwright
```

Entry points:

- App root: `src/main.tsx` -> `src/App.tsx`
- Supabase client: `src/lib/supabase.ts`
- Query client: `src/lib/queryClient.ts`
- Query keys: `src/lib/queryKeys.ts`
- Legacy app facade: `src/contexts/AppContext.tsx`

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Data Models](./data-models.md)
- [State Management](./state-management.md)
- [Component Inventory](./component-inventory.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)

## High-Signal Existing Docs

- [Modernization Plan](./modernization-plan.md)
- [ADR-005 QueryClient Defaults](./adr/ADR-005-queryclient-defaults.md)
- [Point Counter Inventory](./point-counter-inventory.md)
- [Rules Review Category 3](./rules-review-category-3.md)
- [Legacy Context Inventory](./legacy/legacy-contexts.md)
- [Legacy Hooks Inventory](./legacy/legacy-hooks.md)
- [Legacy Supabase Inventory](./legacy/legacy-supabase.md)
- [Legacy Testing Inventory](./legacy/legacy-testing.md)

## BMAD Artifacts

- [`_bmad-output/project-context.md`](../_bmad-output/project-context.md)
- [`_bmad-output/planning-artifacts/prd.md`](../_bmad-output/planning-artifacts/prd.md)
- [`_bmad-output/planning-artifacts/architecture.md`](../_bmad-output/planning-artifacts/architecture.md)
- [`_bmad-output/implementation-artifacts/spec-tanstack-phase-3.md`](../_bmad-output/implementation-artifacts/spec-tanstack-phase-3.md)
- [`_bmad-output/anti-pattern-audit.md`](../_bmad-output/anti-pattern-audit.md)

## Current System Snapshot

| Area              | Current state                                                                         |
| ----------------- | ------------------------------------------------------------------------------------- |
| Core data hooks   | `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors` are TanStack-backed |
| Legacy data hooks | `useLayoutPresets`, `useSeatingChart` remain hand-rolled                              |
| Main facade       | `AppContext` adapts migrated hooks to legacy `useApp()` consumers                     |
| Realtime in React | `students`, `point_transactions`, legacy `layout_presets`                             |
| Database          | 10 public tables, 43 RLS policies, trigger-maintained point totals                    |
| E2E safety        | Playwright refuses hosted/public Supabase hosts                                       |

## Feature Map

| Feature                    | Primary files                                                                    |
| -------------------------- | -------------------------------------------------------------------------------- |
| Authentication             | `src/contexts/AuthContext.tsx`, `src/components/auth/*`                          |
| Teacher home               | `src/components/home/*`                                                          |
| Active classroom dashboard | `src/components/dashboard/DashboardView.tsx`                                     |
| Point awards and undo      | `src/hooks/useTransactions.ts`, `src/components/points/*`                        |
| Student data               | `src/hooks/useStudents.ts`, `src/components/students/*`                          |
| Classroom settings         | `src/components/settings/ClassSettingsView.tsx`                                  |
| Seating charts             | `src/hooks/useSeatingChart.ts`, `src/components/seating/*`                       |
| Sound settings             | `src/contexts/SoundContext.tsx`, `src/components/settings/SoundSettings*.tsx`    |
| localStorage migration     | `src/components/migration/MigrationWizard.tsx`, `src/utils/migrateToSupabase.ts` |

## AI Agent Notes

1. Check this index first.
2. For implementation rules, also read `AGENTS.md`, `CLAUDE.md`, and `_bmad-output/project-context.md`.
3. Treat `docs/legacy/` as historical inventory, not current architecture guidance.
4. For data work, read [Data Models](./data-models.md), [State Management](./state-management.md),
   and [ADR-005](./adr/ADR-005-queryclient-defaults.md).
5. If line-specific claims in `_bmad-output/project-context.md` disagree with HEAD, verify against
   source before acting.

## Generated-Doc Provenance

This documentation was regenerated on 2026-04-26 from an exhaustive scan of the current checkout.
The prior scan state was archived under `docs/.archive/`.

State file: `docs/project-scan-report.json`.
