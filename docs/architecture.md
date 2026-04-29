# Architecture

_Generated 2026-04-29 (exhaustive full rescan)._

## Executive summary

ClassPoints is a single-page React application backed by Supabase (Auth + Postgres + Realtime + RLS + RPCs). It runs entirely in the browser; there is no app server, no Node backend, no API layer of our own. The browser talks directly to Supabase via `@supabase/supabase-js`. Authorization happens at the database layer via Postgres Row-Level Security policies — every classroom, student, behavior, transaction, seating chart, and sound-settings row is gated on `auth.uid()`.

The app is mid-migration from a hand-rolled `useState + useEffect + AppContext` data layer to TanStack Query. As of HEAD `4126a49` on `redesign/editorial-engineering` (2026-04-29), four core domains — `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors` — are fully migrated. Two legacy hooks remain (`useLayoutPresets`, `useSeatingChart`); they are migration targets, not templates. `AppContext` survives as a thin imperative-wrapper layer for legacy consumers and is scheduled for Phase 4 dissolution. `useAwardPoints` is the canonical optimistic-mutation showcase (3 cache patches: transactions + classrooms + students).

A separate, parallel UI redesign (the "editorial / engineering" track on `redesign/editorial-engineering`) replaces the prior visual language with a terracotta accent, Instrument Serif + Geist + JetBrains Mono typography, and a semantic-token system in `src/index.css` `@theme`. Phase 1 introduced the token cascade; Phase 2 redesigned inner screens (in-class workflow + settings). Hardcoded `bg-blue-*` / `from-indigo-*` references throughout the codebase pick up the new accent automatically via the cascade aliases.

## Technology stack

See `docs/project-overview.md` for the version-pinned table. Critical version constraints AI agents must respect:

- React **18** features only (no `use()`, `useActionState`, React-19 form actions; `useTransition` / `useDeferredValue` allowed).
- Tailwind **v4** syntax (no v3 `tailwind.config.js` theme extensions, no legacy plugin).
- Vitest **4** API.
- ESLint **flat config** only (`eslint.config.js`); no `.eslintrc*`.
- supabase-js **2.104+** semantics — typed `UpdateX` payloads on `.update()` (`RejectExcessProperties`).
- `uuid` **v14+** — security override (`GHSA-w5hq-g745-h8pq`) pinned in `package.json` `overrides`.

## Architecture pattern

| Aspect        | Choice                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topology      | Client SPA + BaaS. No app-tier server.                                                                                                                                                                                                                                                                                                                                          |
| State         | Server state in TanStack Query (4 migrated domains, 2 legacy). UI state in component-local React state. Cross-cutting UI/session state (active classroom, modal flags, batch correlation refs) in `AppContext`.                                                                                                                                                                 |
| Auth          | Supabase Auth (`@supabase/supabase-js`). JWT in `localStorage` (key prefix `sb-`). On boot, `AuthContext` validates the cached session with `supabase.auth.getUser()`; validation failure signs out locally, purges `sb-*` keys, and routes to login. A 5s `AbortController` exists in code, but its signal is not passed to `getUser()` yet, so it is not an enforced timeout. |
| Authorization | Postgres RLS. Every table has policies keyed on `auth.uid()`; classrooms own users, and students/transactions/seating descend transitively.                                                                                                                                                                                                                                     |
| Realtime      | 3 domains: `students` table (stored lifetime totals / identity changes), `point_transactions`, and `seating-chart` (target state). `useStudents` is the SINGLE realtime owner for `students` AND for `point_transactions` DELETE events; `useTransactions` subscribes to `point_transactions` for invalidation.                                                                 |
| Routing       | None. View state is `useState<View>` in `App.tsx`, persisted to `localStorage:app:view`. Five views: `home`, `dashboard`, `settings`, `migration`, `profile`.                                                                                                                                                                                                                   |
| Styling       | Tailwind v4 with `@theme` tokens. Semantic tokens (surface-1/2/3, ink-strong/mid/muted, hairline) flip via `.dark { ... }` overrides. Cascade aliases retone hardcoded `bg-blue-*`/`from-indigo-*`/`from-purple-*` to terracotta.                                                                                                                                               |
| Build         | Vite 6, React plugin, `base: '/ClassPoints/'` for GitHub Pages.                                                                                                                                                                                                                                                                                                                 |
| Bundle        | Lazy-loaded views: `MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`. React Query Devtools dynamically imported inside a `useEffect` body gated on `import.meta.env.DEV` so Rollup never registers the chunk in prod (CI-asserted by `scripts/check-bundle.mjs`).                                                                      |
| Testing       | Vitest unit + Vitest backend integration + Playwright E2E (Chromium only, fail-closed network allow-list for local Supabase).                                                                                                                                                                                                                                                   |
| Deployment    | GitHub Pages via `.github/workflows/deploy.yml`. Build with hosted Supabase creds inlined; anon key is public, RLS guards data.                                                                                                                                                                                                                                                 |

## Provider stack (`src/App.tsx`)

```
<AuthProvider>           ← Supabase auth, stale-JWT graceful degrade, queryClient.clear() on user-id transition
  <AuthGuard>            ← Renders <AuthPage /> when no user; otherwise children
    <ThemeProvider>      ← light/dark, prefers-color-scheme + localStorage
      <SoundProvider>    ← Web Audio context, user_sound_settings sync
        <AppProvider>    ← Phase 4 dissolution target — wraps TanStack hooks for legacy consumers
          <AppContent /> ← View routing + Layout + Suspense fallbacks
        </AppProvider>
      </SoundProvider>
    </ThemeProvider>
  </AuthGuard>
</AuthProvider>
```

`<QueryClientProvider client={queryClient}>` and `<DevtoolsGate />` wrap `<App />` at the root in `src/main.tsx`.

## Data architecture

See `docs/data-models.md` for full schema. Highlights:

### Tables (10)

- `classrooms` — owned by `auth.users` (1:N). Cascade-delete from auth.
- `students` — `classroom_id` FK. Stores `point_total`, `positive_total`, `negative_total` columns maintained by a trigger on `point_transactions` (INSERT/DELETE).
- `behaviors` — system defaults (`user_id IS NULL`) OR per-user custom. Visible to a user when `user_id IS NULL OR user_id = auth.uid()`.
- `point_transactions` — student/classroom/behavior FKs + `behavior_name`/`behavior_icon` snapshots + `note` + `batch_id`. Realtime + REPLICA IDENTITY FULL.
- `user_sound_settings` — per-user 1-row config. Realtime + REPLICA IDENTITY FULL.
- `seating_charts` — 1:1 with classroom (UNIQUE constraint). `snap_enabled`, `grid_size`, `canvas_width`, `canvas_height`.
- `seating_groups` — 4-seat table groups within a chart. UNIQUE `(seating_chart_id, letter)`.
- `seating_seats` — 4 seats per group, auto-created by `auto_create_group_seats()` trigger. `student_id` FK with single-seat-per-chart enforcement via `ensure_student_single_seat()` trigger.
- `room_elements` — teacher_desk / door / window / countertop / sink (enum `room_element_type`).
- `layout_presets` — user-owned, importable JSON layouts (no student assignments).

### RPC

- `get_student_time_totals(p_classroom_id, p_start_of_today, p_start_of_week)` — returns `(student_id, today_total, this_week_total)` per student. Called inside `useStudents.queryFn` and `useClassrooms.queryFn` (the latter once per classroom). Pre-filters on `created_at >= p_start_of_week` for performance.

### Realtime

ADR-005 §6 specifies the realtime scope as exactly 3 domains:

| Domain                             | Tables                                                               | Why                                                     |
| ---------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| `students` (lifetime point totals) | `students`                                                           | Cross-device student-row changes update stored totals   |
| `point_transactions`               | `point_transactions`                                                 | Cross-device undo; DELETE branch decrements time totals |
| `seating-chart`                    | `seating_charts`, `seating_groups`, `seating_seats`, `room_elements` | Drag on laptop → smartboard moves the seat              |

Non-realtime (explicit, NOT default-by-omission): `classrooms`, `behaviors`, `layout_presets`, `user_sound_settings` (the last is realtime-enabled in the migration but only used for cross-device settings sync, which doesn't fit the 3-domain count). They use `refetchOnWindowFocus: false` defaults + on-demand `invalidateQueries` after mutations.

**Current HEAD drift from target**: `useStudents` subscribes to `students` + `point_transactions` (DELETE), `useTransactions` subscribes to `point_transactions` (any event), and legacy `useLayoutPresets` still subscribes to `layout_presets`. `useSeatingChart` is hand-rolled and currently has no realtime subscription. Cross-device `point_transactions` INSERTs do not immediately refresh `today_total` / `this_week_total`; those time totals refresh through own-device optimism, DELETE realtime undo handling, visibility/refetch paths, or reload. Treat `layout_presets` realtime as legacy drift to remove when that hook migrates; treat seating-chart realtime as target work, not current implementation.

**Cross-cutting realtime DELETE rule**: any table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL` in its migration. Without it, DELETE payloads arrive empty and `payload.old` is unusable. Currently `point_transactions`, `students`, and `user_sound_settings` have it.

### Type-system boundaries

- **DB types** (`snake_case`) live in `src/types/database.ts` as `Database` + `DbX` / `NewX` / `UpdateX` aliases.
- **App types** (`camelCase`) live in `src/types/index.ts`.
- **Conversion** in `src/types/transforms.ts`: `dbToBehavior`, `dbToClassroom`, `dbToStudent`, `dbToPointTransaction`. Transform at the `queryFn` boundary so `snake_case` never leaks into components.
- **Exception**: `useTransactions` deliberately keeps `DbPointTransaction` shape because 45 legacy consumers read it directly via `useApp().transactions`. `dbToPointTransaction` is `{ ...row }` passthrough that formalizes the boundary without reshaping fields.

## State management

See `docs/state-management.md` for the full pattern catalog. Two-layer model:

- **Server state**: TanStack Query (`useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`) for migrated domains; hand-rolled `useState`+`useEffect` for legacy ones.
- **UI/session state**: React component state for transient UI; `AppContext` for cross-cutting things (active classroom id, modal flags, `batchKindRef`).
- **Per-device prefs**: `useDisplaySettings` (`localStorage:classpoints-display-settings`), `ThemeContext` (`localStorage:theme`).
- **Cross-device prefs**: `SoundContext` (`user_sound_settings` table).

`AppContext` post-Phase-3:

- Holds UI/session state (`activeClassroomId`, modal flags, `batchKindRef`).
- Holds thin imperative wrappers (`createClassroom`, `awardPoints`, `awardClassPoints`, `awardPointsToStudents`, `addBehavior` family, `clearStudentPoints`, `adjustStudentPoints`, `resetClassroomPoints`) that adapt the new mutation hooks to legacy callers. Most direct mutation wrappers propagate `mutateAsync` errors; legacy student wrappers catch/log and batch award orchestrators handle failures separately.
- **Wrapper-throw nuance**: `awardClassPoints` and `awardPointsToStudents` orchestrate per-student `Promise.all` and SILENTLY filter rejected promises to nulls (`AppContext.tsx:410-424`, `:455-469`). The orchestrator returns the "successful" results; per-item failures vanish. Both wrappers now delete the local `batchKindRef` entry when every mutation fails, but they still do not surface partial failure counts to the caller.

**New components MUST**:

- Call mutation hooks directly (`useAwardPoints`, `useAddStudent`, …)
- NOT add new fields to `AppContext`
- NOT add new wrapper functions to `AppContext`, even if they mirror existing ones
- NOT extend existing wrappers with new parameters

### Optimistic-mutation pattern (canonical: `useAwardPoints`)

ADR-005 §4 (a)–(e) compliance, inline in the hook (`src/hooks/useTransactions.ts:86-95` comments). The pattern:

- `onMutate` patches THREE caches: `transactions.list(classroomId)`, `classrooms.all`, `students.byClassroom(classroomId)`.
- `onMutate` is **pure + idempotent**: deterministic optimistic id (`optimistic-${studentId}-${behaviorId}-${timestamp}`) + a dedup guard (`alreadyPatched`) that skips ALL three patches if the temp row already exists. The guard protects duplicate mutation invocations such as double submits, effect-driven retries, or explicit replays; React StrictMode does not double-run button event handlers.
- `onError` null-guards `context.previous*` (undefined post-cancel would overwrite the cache, worse than no rollback) and restores all three caches.
- `onSettled` invalidates all three keys to reconcile with server truth.
- **Read previous state from cache via `qc.getQueryData`, never from the component closure** — the closure goes stale across re-renders.

### Realtime hook pattern (`useRealtimeSubscription`)

- Generic over postgres_changes events. Supports `onChange` (preferred, single payload) plus legacy `onInsert`/`onUpdate`/`onDelete` callbacks for remaining migration consumers. Do not add new legacy callback callers.
- Channel names use `crypto.randomUUID()` per mount (commit `e1b3c49`). Prior `Date.now()` collided under React 18 StrictMode because cleanup→remount happens in the same millisecond, and Supabase reuses the existing channel for matching topics — the second `.on('postgres_changes', …)` on a joining channel throws.
- Callbacks held in refs to avoid re-subscribing on every render.
- Tracks subscription status transitions; fires `onReconnect` when SUBSCRIBED returns from CHANNEL_ERROR / TIMED_OUT / CLOSED.

## Auth flow

`src/contexts/AuthContext.tsx`:

1. On mount, `getSession()` reads the cached session from `localStorage`.
2. If a cached session exists, validate it against the server with `supabase.auth.getUser()`.
3. If validation fails OR throws: log warning, `signOut({ scope: 'local' })`, manually `localStorage.removeItem(...)` every `sb-*` key, route to login. The surrounding 5s `AbortController` is scaffolding until its signal is wired into the auth request.
4. `onAuthStateChange` listener handles user-id transitions. The first event (`prev === undefined`) is INITIAL_SESSION and is NOT treated as a transition (so user A's cache can't flash on user B's first render). On a user-id transition (account-switch), `queryClient.clear()` runs.
5. `signOut()` also `queryClient.clear()`s — defense-in-depth, doesn't depend on the listener winning the race.

This is the "stale-JWT graceful degrade" fix from commit `d652260`.

## UI / Design System

Editorial / engineering redesign on `redesign/editorial-engineering`. Lives entirely in `src/index.css` `@theme` block + the redesigned components.

**Tokens** (`src/index.css`):

- **Type stack**: `--font-display` Instrument Serif (display headings), `--font-sans` Geist (body), `--font-mono` JetBrains Mono (numerics + uppercase labels). Class names: `font-display`, `font-mono`. Default body uses `var(--font-sans)`.
- **Surfaces**: `--color-surface-1` (page bg, warm off-white `#f7f5f1` light / true near-black `#0a0a0b` dark), `--color-surface-2` (cards), `--color-surface-3` (hover wash). Class names: `bg-surface-1`, `bg-surface-2`, `bg-surface-3`. `.dark { ... }` flips them.
- **Ink**: `--color-ink-strong`, `--color-ink-mid`, `--color-ink-muted`. Class names: `text-ink-strong`, `text-ink-mid`, `text-ink-muted`.
- **Hairlines**: `--color-hairline`, `--color-hairline-strong`. Class names: `border-hairline`.
- **Accent**: terracotta scale `--color-accent-50` ... `--color-accent-950`. Class names: `bg-accent-500`, `text-accent-600`, `ring-accent-500/40`, etc.
- **Cascade aliases**: `--color-blue-*`, `--color-indigo-*`, `--color-purple-*` ALL retone to terracotta. The codebase has ~80 hardcoded `bg-blue-*` / `from-indigo-*` / `from-purple-*` references in legacy screens; aliasing those scales onto terracotta retones every cascade screen for free without hand-redesigning.
- **Dark zinc scale**: `--color-zinc-950` ... `--color-zinc-600` tuned to a kitty-terminal dark bg.

**Note**: `:root { --chart-grid-line }` MUST come BEFORE `.dark { ... }` overrides — both selectors have specificity `(0,1,0)`, the later rule wins. (This bit the redesign before — grid was showing light value in dark mode.)

**Hand-redesigned surfaces** (Phase 1 + 2): Sidebar (terracotta dot + Instrument Serif title + uppercase tracked section labels), Layout, ClassPointsBox (NEW — class total promoted to its own card), DashboardView, parts of seating views and settings. Other screens use the cascade aliases for free.

## Source tree

See `docs/source-tree-analysis.md`.

## Development workflow

See `docs/development-guide.md`.

## Deployment

- Production: GitHub Pages via `.github/workflows/deploy.yml`.
- Build inlines hosted Supabase URL + anon key (anon key is public-readable; RLS protects data).
- Service-role key is NEVER bundled. Lives only in `.env.test` (local) and CI secrets (`SUPABASE_SERVICE_ROLE_KEY` synthesized from `supabase status` + `FNOX_AGE_KEY` for test creds).
- `npm run check:bundle` is a CI gate that asserts no React Query Devtools chunks leaked.

## Testing strategy

- **Unit (Vitest)**: 9 active unit files under `src/test/`, `src/hooks/__tests__/`, `src/utils/__tests__/`, and `src/contexts/`. Current coverage includes leaderboard math, sound synthesis/settings, rotating-category timer, student parser, realtime subscription wiring, `useStudents` DELETE fallback, `useAwardPoints` ADR-005 guards, TeacherDashboard rendering, and AppProvider disabled-query loading.
- **Backend integration (Vitest + Node)**: 4 active files under `tests/integration/`. They hit a real local Supabase stack through service-role helpers and cover schema smoke, classroom RLS, point-total triggers, and `point_transactions` realtime DELETE payloads.
- **E2E (Playwright)**: Chromium-only, storage-state-based auth, fail-closed network allow-list. Active specs cover authenticated shell bootstrap, stale cached-session recovery, and sample user-factory cleanup.
- **CI burn-in**: `test.yml` runs the active Playwright suite 10 times to flush flake on every push/PR. Unit and integration suites run locally today; `deploy.yml` also runs unit tests before the Pages build.

## Authoritative sources

| Doc                                        | Status                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_bmad-output/planning-artifacts/prd.md`   | TanStack migration PRD (scope, phases, AC).                                                                                                                             |
| `docs/modernization-plan.md`               | Strategy doc (diagnosis, target architecture). Hand-written.                                                                                                            |
| `docs/adr/ADR-005-queryclient-defaults.md` | §1-§6 all in force as of HEAD `1b0decb`.                                                                                                                                |
| `_bmad-output/anti-pattern-audit.md`       | 2026-04-25 audit with REAL / OVERSTATED / FALSE-POSITIVE verdicts on 10 clusters. Consult before re-raising rejected concerns.                                          |
| `_bmad-output/project-context.md`          | LLM-optimized critical-rules digest. The "snapshot at HEAD" line gates which sections are still trustworthy.                                                            |
| `docs/legacy/legacy-*.md`                  | AS-IS pattern inventory. Authoritative subset still correct: `legacy-migrations.md`, `legacy-testing.md`, `legacy-utils.md`. The rest describe patterns being reversed. |
