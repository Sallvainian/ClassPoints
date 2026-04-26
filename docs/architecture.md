# ClassPoints Architecture

_Generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

## Executive Summary

ClassPoints is a client-only React SPA backed by Supabase. React renders the teacher
experience, TanStack Query owns the migrated server-state caches, Supabase provides auth,
Postgres data, RLS, RPCs, and Realtime, and GitHub Actions builds/tests/deploys the app to
GitHub Pages.

The codebase is a single monolith. There is no separate server package; privileged work is
limited to Node-side scripts and Playwright support helpers that use the Supabase service-role
key outside the browser bundle.

## Runtime Topology

```text
Browser
  src/main.tsx
    QueryClientProvider
      App
        AuthProvider
          AuthGuard
            ThemeProvider
              SoundProvider
                AppProvider
                  AppContent
                    Layout
                    Dashboard/Home/Profile/Settings/Migration views
      DevtoolsGate (development-only dynamic import)

Supabase
  Auth
  PostgREST
  Realtime
  Postgres tables, triggers, policies, RPCs
```

`DevtoolsGate` is mounted beside `<App />` inside `QueryClientProvider`. It dynamically imports
React Query Devtools only inside a `useEffect` guarded by `import.meta.env.DEV`; production
builds are checked by `scripts/check-bundle.mjs`.

## Entry Points

| File                     | Responsibility                                                       |
| ------------------------ | -------------------------------------------------------------------- |
| `src/main.tsx`           | React root, TanStack Query provider, devtools gate                   |
| `src/App.tsx`            | Provider hierarchy, route-like view switching, lazy-loaded top views |
| `src/lib/supabase.ts`    | Typed Supabase client and startup env validation                     |
| `src/lib/queryClient.ts` | QueryClient defaults                                                 |
| `src/lib/queryKeys.ts`   | Central query-key registry                                           |

## Provider Hierarchy

The current provider order is:

```text
QueryClientProvider
  App
    AuthProvider
      AuthGuard
        ThemeProvider
          SoundProvider
            AppProvider
              AppContent
```

Why it matters:

- `QueryClientProvider` must wrap all TanStack hooks.
- `AuthGuard` prevents downstream data providers from mounting before auth is known.
- `SoundProvider` calls `useAuth()` for user-scoped settings, so it must sit below auth.
- `AppProvider` adapts migrated query hooks to the legacy `useApp()` surface.

## Data Architecture

Supabase is the only backend. The app reads/writes these public tables:

| Domain              | Tables                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| Classrooms          | `classrooms`                                                                           |
| Students and totals | `students`, `point_transactions`                                                       |
| Behavior templates  | `behaviors`                                                                            |
| Sound settings      | `user_sound_settings`                                                                  |
| Seating charts      | `seating_charts`, `seating_groups`, `seating_seats`, `room_elements`, `layout_presets` |

Important database mechanics:

- RLS is enabled on all 10 public tables.
- Ownership is user-scoped directly on `classrooms`, `behaviors`, `user_sound_settings`, and
  `layout_presets`; student/transaction/seating ownership is derived through classroom joins.
- `students.point_total`, `positive_total`, and `negative_total` are trigger-maintained.
- `get_student_time_totals` computes today and this-week totals by classroom.
- `point_transactions.batch_id` groups class-wide or subset awards for batch undo.

## State Architecture

Server state is split between migrated TanStack hooks and remaining legacy hooks.

| Area                            | Current state owner                             |
| ------------------------------- | ----------------------------------------------- |
| Classrooms                      | `useClassrooms` with `queryKeys.classrooms`     |
| Students                        | `useStudents` with `queryKeys.students`         |
| Transactions                    | `useTransactions` with `queryKeys.transactions` |
| Behaviors                       | `useBehaviors` with `queryKeys.behaviors`       |
| Layout presets                  | `useLayoutPresets`, legacy local state          |
| Seating chart                   | `useSeatingChart`, legacy local state           |
| Active classroom and UI session | `AppContext`                                    |
| Theme                           | `ThemeContext` + `localStorage`                 |
| Sound settings                  | `SoundContext` + Supabase                       |
| Display settings                | `useDisplaySettings` + `localStorage`           |

## Realtime Architecture

Current React subscriptions:

| Hook               | Table                       | Purpose                                                               |
| ------------------ | --------------------------- | --------------------------------------------------------------------- |
| `useStudents`      | `students`                  | Merge INSERT/UPDATE/DELETE student row changes into the student cache |
| `useStudents`      | `point_transactions` DELETE | Cross-device undo and time-total decrement path                       |
| `useTransactions`  | `point_transactions`        | Invalidate transaction/classroom caches on changes                    |
| `useLayoutPresets` | `layout_presets`            | Legacy realtime local-state updates                                   |

Publication history includes `classrooms`, `students`, `behaviors`, `point_transactions`, and
`user_sound_settings`. The current React code does not subscribe to `classrooms`, `behaviors`, or
`user_sound_settings`, and seating-chart tables are not yet wired to Realtime despite being a
target live-sync area in the migration planning docs.

`useRealtimeSubscription` owns Supabase channel lifecycle. It supports the preferred `onChange`
callback plus legacy `onInsert` / `onUpdate` / `onDelete` callbacks.

## Component Architecture

Components are grouped by feature under `src/components/`:

| Folder      | Count | Role                                                         |
| ----------- | ----: | ------------------------------------------------------------ |
| `auth`      |     5 | Auth guard and auth forms                                    |
| `behaviors` |     2 | Behavior template buttons/picker                             |
| `classes`   |     1 | Student import modal                                         |
| `common`    |     1 | Sync status                                                  |
| `dashboard` |     2 | Active classroom view and bottom toolbar                     |
| `home`      |     4 | Teacher home dashboard, stats, leaderboards, classroom cards |
| `layout`    |     2 | Shell and sidebar                                            |
| `migration` |     1 | localStorage-to-Supabase wizard                              |
| `points`    |     6 | Award modals, point display, undo, today summary             |
| `profile`   |     2 | Profile and classroom deletion modal                         |
| `seating`   |     8 | Seating chart view/editor/canvas primitives                  |
| `settings`  |     5 | Classroom, reset, adjust, and sound settings                 |
| `students`  |     2 | Student grid/card                                            |
| `ui`        |     4 | Button, input, modal, error toast                            |

Top-level views are lazy-loaded in `App.tsx`: migration wizard, dashboard, class settings,
profile, and teacher dashboard.

## Testing Architecture

| Layer   | Location                       | Notes                                                                     |
| ------- | ------------------------------ | ------------------------------------------------------------------------- |
| Unit    | `src/**/*.test.{ts,tsx}`       | Vitest + jsdom + Testing Library; Supabase is mocked at module boundaries |
| E2E     | `tests/e2e/*.ts`               | Playwright Chromium against local/private Supabase only                   |
| Support | `tests/support/**`             | Fixtures, service-role admin helper, user factory, login helper           |
| CI      | `.github/workflows/test.yml`   | lint, typecheck, bundle DCE check, sharded E2E, burn-in                   |
| Deploy  | `.github/workflows/deploy.yml` | lint, typecheck, unit tests, build, GitHub Pages deploy                   |

`playwright.config.ts` force-loads `.env.test`, refuses hosted/public Supabase hosts, and starts a
fresh dev server for each E2E run.

## Deployment Architecture

Production build:

```bash
npm run build
npm run check:bundle
```

`npm run build` runs `tsc -b` and `fnox exec -- vite build`. The GitHub Pages deployment workflow
installs dependencies, installs fnox through `mise`, runs lint/typecheck/unit tests, builds, and
publishes `dist/`.

## Architectural Constraints

- Browser code must only use `import.meta.env.VITE_*`.
- Service-role keys are restricted to Node-side scripts and test support.
- Query keys must come from `src/lib/queryKeys.ts`.
- New server-state flows should use TanStack Query hooks, not new AppContext wrappers.
- RLS policies are the authorization boundary.
- Point totals should be read from trigger-maintained columns or RPCs, not recomputed in UI code.
- Realtime subscriptions need explicit cleanup through `useRealtimeSubscription` or
  `supabase.removeChannel`.

## Known Drift And Risk Areas

| Area                 | Current risk                                                               |
| -------------------- | -------------------------------------------------------------------------- |
| `AppContext`         | 797-line migration adapter with legacy wrapper contracts                   |
| `useSeatingChart`    | 1118-line legacy hook with 23-value return shape                           |
| `SeatingChartEditor` | 1350-line component with substantial interaction logic                     |
| `useLayoutPresets`   | Legacy local state and legacy realtime callbacks                           |
| Batch awards         | `awardClassPoints` and `awardPointsToStudents` filter per-item failures    |
| Error handling       | Many Supabase hooks throw `new Error(error.message)`, losing `error.code`  |
| Realtime target      | Publication and code-level subscription set do not fully match target docs |
