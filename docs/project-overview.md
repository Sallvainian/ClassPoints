# ClassPoints Project Overview

_Generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

ClassPoints is a classroom-management SPA for teachers. It tracks behavior points,
student totals, classroom totals, seating charts, sound feedback, and import/migration
workflows. The app is browser-only and uses Supabase for authentication, Postgres data,
RLS authorization, RPCs, and Realtime.

## Classification

| Attribute         | Value                                       |
| ----------------- | ------------------------------------------- |
| Repository type   | Monolith                                    |
| Project type      | Web application                             |
| Runtime shape     | Client-only React SPA with Supabase BaaS    |
| Primary entry     | `src/main.tsx` -> `src/App.tsx`             |
| Data boundary     | `src/lib/supabase.ts` typed with `Database` |
| Deployment target | GitHub Pages, Vite base `/ClassPoints/`     |

## Current Stack

Versions below are resolved from `package-lock.json` unless noted.

| Category     | Technology                                     |
| ------------ | ---------------------------------------------- |
| UI runtime   | React 18.3.1, React DOM 18.3.1                 |
| Language     | TypeScript 5.9.3, strict mode                  |
| Build        | Vite 6.4.2                                     |
| Styling      | Tailwind CSS 4.2.4 via `@tailwindcss/postcss`  |
| Backend      | Supabase JS 2.104.1, local Supabase CLI 2.95.0 |
| Server state | TanStack Query 5.100.1                         |
| Drag/drop    | `@dnd-kit/core` and `@dnd-kit/utilities`       |
| Icons        | `lucide-react`                                 |
| Unit testing | Vitest 4.1.5, jsdom, Testing Library           |
| E2E          | Playwright 1.59.1, Chromium                    |
| Secrets      | `fnox` + age via `mise`                        |

## Scanned Surface

| Area                        | Count |
| --------------------------- | ----: |
| Source files under `src/`   |   103 |
| Component TSX files         |    45 |
| Component folders           |    14 |
| Hook files in `src/hooks/`  |    12 |
| Context providers           |     4 |
| Supabase migrations         |    11 |
| Public tables               |    10 |
| RLS policies                |    43 |
| Trigger functions           |     8 |
| Triggers                    |    10 |
| Unit test files             |     6 |
| Playwright setup/spec files |     2 |

## Main Domains

| Domain                      | Primary files                                                                    |
| --------------------------- | -------------------------------------------------------------------------------- |
| Auth                        | `src/contexts/AuthContext.tsx`, `src/components/auth/*`                          |
| Classroom and student data  | `src/hooks/useClassrooms.ts`, `src/hooks/useStudents.ts`                         |
| Point transactions          | `src/hooks/useTransactions.ts`, `src/components/points/*`                        |
| Behaviors                   | `src/hooks/useBehaviors.ts`, `src/components/behaviors/*`                        |
| Dashboard                   | `src/components/dashboard/DashboardView.tsx`, `src/components/home/*`            |
| Seating charts              | `src/hooks/useSeatingChart.ts`, `src/components/seating/*`                       |
| Sound settings              | `src/contexts/SoundContext.tsx`, `src/components/settings/SoundSettings*.tsx`    |
| Migration from localStorage | `src/components/migration/MigrationWizard.tsx`, `src/utils/migrateToSupabase.ts` |

## Current Migration Status

The core server-state migration is mid-flight. These hooks are TanStack Query-backed:

- `useClassrooms`
- `useStudents`
- `useTransactions`
- `useBehaviors`

These remain hand-rolled with `useState` / `useEffect`:

- `useLayoutPresets`
- `useSeatingChart`

`AppContext` is still the legacy facade for most components. It adapts TanStack hooks
to the older `useApp()` shape and also stores UI/session state such as active classroom,
modal-adjacent helpers, and batch undo tracking. New data flows should prefer direct
hook usage where the migration plan allows it.

## Documentation Map

Start with `docs/index.md`. The generated documentation set is:

- `docs/architecture.md`
- `docs/data-models.md`
- `docs/state-management.md`
- `docs/component-inventory.md`
- `docs/source-tree-analysis.md`
- `docs/development-guide.md`
- `docs/project-overview.md`

Additional high-signal context lives in:

- `docs/adr/ADR-005-queryclient-defaults.md`
- `docs/modernization-plan.md`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/anti-pattern-audit.md`
