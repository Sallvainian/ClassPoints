# Architecture

_Generated 2026-06-02 (exhaustive full rescan; HEAD `134a1ef` on `main`)._

## Executive summary

ClassPoints is a single-page React application backed by Supabase (Auth + Postgres + Realtime + RLS + RPCs). It runs entirely in the browser; there is no app server, no Node backend, no API layer of our own. The browser talks directly to Supabase via `@supabase/supabase-js`. Authorization happens at the database layer via Postgres Row-Level Security policies — every classroom, student, behavior, transaction, seating chart, and sound-settings row is gated on `auth.uid()`.

The TanStack Query migration's server-data move is essentially done. As of HEAD `134a1ef` on `main` (2026-06-02), four core domains — `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors` — are fully migrated, and **Phase 4 (commit `d8cde26`) dissolved the `AppContext` server-data facade**: `AppContext.tsx` is now 33 LOC of UI/session state only (the active-classroom selection), with the old wrappers/selectors/undo-machinery relocated to direct mutation hooks plus four thin transitional modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `pointSelectors` — a fifth, the in-memory batch-kind map, was deleted by deferred #7: the batch kind now persists as the `point_transactions.batch_kind` column). Two legacy hooks remain (`useLayoutPresets`, `useSeatingChart`); they are migration targets, not templates. `useAwardPoints` is the canonical single-student optimistic-mutation showcase (3 cache patches: transactions + classrooms + students); its all-or-nothing batch counterpart `useAwardPointsBatch` landed with the cluster #2 atomic-batch-award fix (`30da564`).

The "editorial / engineering" UI redesign has merged to `main` (PR #86, `6b06828`). It replaced the prior visual language with a terracotta accent, Instrument Serif + Geist + JetBrains Mono typography, and a semantic-token system in `src/index.css` `@theme`. Phase 1 introduced the token cascade; Phase 2 redesigned inner screens (in-class workflow + settings). Hardcoded `bg-blue-*` / `from-indigo-*` references throughout the codebase pick up the new accent automatically via the cascade aliases.

## Technology stack

See `docs/project-overview.md` for the version-pinned table. Critical version constraints AI agents must respect:

- React **19** is installed (19.2.7) but barely used — new code MAY use React 19 features (ref-as-prop especially; do NOT reintroduce `forwardRef`), but keep server state in TanStack Query rather than `useOptimistic`, and match the prevailing style.
- Tailwind **v4** syntax (no v3 `tailwind.config.js` theme extensions, no legacy plugin).
- Vitest **4** API.
- ESLint **10 flat config** only (`eslint.config.js`); no `.eslintrc*`. `eslint-plugin-react-hooks` is **v7**, which enables `react-hooks/set-state-in-effect` — set to `'error'` here; disable per-site with a justification (the React Compiler is NOT enabled, so it also flags correct idiomatic effects). See `docs/development-guide.md`.
- supabase-js **2.106+** semantics — typed `UpdateX` payloads on `.update()` (`RejectExcessProperties`).
- `uuid` **v14+** — security override (`GHSA-w5hq-g745-h8pq`) pinned in `package.json` `overrides`.

## Architecture pattern

| Aspect        | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Topology      | Client SPA + BaaS. No app-tier server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| State         | Server state in TanStack Query (4 migrated domains, 2 legacy). UI state in component-local React state. `AppContext` holds ONLY the active-classroom selection (Phase 4 dissolved its server-data facade). Batch correlation + undo machinery live in thin modules (`useBatchAward`, `useUndoableAction`); the undo-label kind persists on rows (`point_transactions.batch_kind`, deferred #7).                                                                                                                                      |
| Auth          | Supabase Auth (`@supabase/supabase-js`). JWT in `localStorage` (key prefix `sb-`). On boot, `AuthContext` validates the cached session with `supabase.auth.getUser()`, wrapped in `Promise.race` against a 5s timeout that genuinely fires (the earlier unwired `AbortController` was replaced, since `getUser()` accepts no `AbortSignal`); validation failure signs out locally, purges `sb-*` keys, and routes to login.                                                                                                          |
| Authorization | Postgres RLS. Every table has policies keyed on `auth.uid()`; classrooms own users, and students/transactions/seating descend transitively.                                                                                                                                                                                                                                                                                                                                                                                          |
| Realtime      | 2 target domains: `students` table (stored lifetime totals / identity changes) and `point_transactions`. `useStudents` owns the `students` subscription; `useTransactions` owns `point_transactions`. Both are invalidate-not-merge (commit `ea9f406` removed the old `useStudents` merge + `point_transactions` DELETE local-decrement). Legacy `useLayoutPresets` still subscribes to `layout_presets` (drift to remove on migration). Seating-chart cross-device drag was dropped 2026-05-13; it now uses on-demand invalidation. |
| Routing       | None. View state is `useState<View>` in `App.tsx`, persisted to `localStorage:app:view`. Five views: `home`, `dashboard`, `settings`, `migration`, `profile`.                                                                                                                                                                                                                                                                                                                                                                        |
| Styling       | Tailwind v4 with `@theme` tokens. Semantic tokens (surface-1/2/3, ink-strong/mid/muted, hairline) flip via `.dark { ... }` overrides. Cascade aliases retone hardcoded `bg-blue-*`/`from-indigo-*`/`from-purple-*` to terracotta.                                                                                                                                                                                                                                                                                                    |
| Build         | Vite 8, `@vitejs/plugin-react` (React Compiler NOT enabled), `base: '/ClassPoints/'` for GitHub Pages.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Bundle        | Lazy-loaded views: `MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`. React Query Devtools dynamically imported inside a `useEffect` body gated on `import.meta.env.DEV` so Rollup never registers the chunk in prod (CI-asserted by `scripts/check-bundle.mjs`).                                                                                                                                                                                                                           |
| Testing       | Vitest unit + Vitest backend integration + Playwright E2E (Chromium only, fail-closed network allow-list for local Supabase).                                                                                                                                                                                                                                                                                                                                                                                                        |
| Deployment    | GitHub Pages via `.github/workflows/deploy.yml`. Build with hosted Supabase creds inlined; anon key is public, RLS guards data.                                                                                                                                                                                                                                                                                                                                                                                                      |

## Provider stack (`src/App.tsx`)

```
<AuthProvider>           ← Supabase auth, stale-JWT graceful degrade, queryClient.clear() on user-id transition
  <AuthGuard>            ← Renders <AuthPage /> when no user; otherwise children
    <ThemeProvider>      ← light/dark, prefers-color-scheme + localStorage
      <SoundProvider>    ← Web Audio context, user_sound_settings sync
        <AppProvider>    ← UI/session state only: activeClassroomId + setActiveClassroom (Phase 4 dissolved the facade)
          <AppContent /> ← View routing + Layout + Suspense fallbacks (5 lazy views)
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

- `get_student_time_totals_all_for_user(p_start_of_today, p_start_of_week)` — returns `(classroom_id, student_id, today_total, this_week_total)` for every student in every classroom the caller owns (RLS-bounded under `SECURITY INVOKER` — no classroom param to spoof). Called ONCE inside `useStudents.queryFn` (rows filtered to its classroom client-side) and ONCE inside `useClassrooms.queryFn` (deferred #8 replaced the per-classroom `get_student_time_totals` fan-out, migration `20260611145458`). Pre-filters on `created_at >= p_start_of_week` for performance (served by `idx_transactions_created_at`).

### Realtime

ADR-005 §6 specifies the realtime scope as exactly 2 domains:

| Domain                             | Tables               | Why                                                                     |
| ---------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `students` (lifetime point totals) | `students`           | Cross-device student-row changes refetch stored + time totals           |
| `point_transactions`               | `point_transactions` | Cross-device award / undo events propagate (owned by `useTransactions`) |

Non-realtime (explicit, NOT default-by-omission): `classrooms`, `behaviors`, `layout_presets`, `seating-chart`, `user_sound_settings` (the last is realtime-enabled in the migration but only used for cross-device settings sync, which doesn't fit the 2-domain count). They use `refetchOnWindowFocus: false` defaults + on-demand `invalidateQueries` after mutations. Seating-chart was previously a target realtime domain for cross-device drag sync; that use case was dropped 2026-05-13.

**Realtime callback strategy — invalidate-not-merge** (now aligned with the migration target, ADR-005 §7): the live-sync callbacks call ONLY `invalidateQueries`. `useStudents` subscribes to `students` and, on any INSERT/UPDATE/DELETE, invalidates `students.byClassroom` (refetch re-reads authoritative columns + re-runs the batched `get_student_time_totals_all_for_user` RPC, so all-time/today/week refresh identically) plus `classrooms.all`. `useStudents` no longer owns a `point_transactions` subscription — `useTransactions` owns `point_transactions` (any event) and invalidates its own keys. Legacy `useLayoutPresets` still subscribes to `layout_presets` (drift to remove when that hook migrates). `useSeatingChart` is hand-rolled and has no realtime subscription — that matches the post-2026-05-13 target. Cross-device `point_transactions` INSERT/DELETE now refresh `today_total` / `this_week_total` via the DB trigger's `students` UPDATE event (`011:45-47`) → refetch; the day-boundary case still relies on the visibility-change handler.

**Cross-cutting realtime DELETE rule**: any table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL` in its migration (DB-level requirement; migration `005` is still required for filtered-DELETE event delivery). Without it, DELETE payloads arrive empty. Note the client no longer reads `payload.old`'s extra columns for `point_transactions` — the invalidate-not-merge callbacks ignore the payload body. Currently `point_transactions`, `students`, and `user_sound_settings` have `REPLICA IDENTITY FULL`.

### Type-system boundaries

- **DB types** (`snake_case`) live in `src/types/database.ts` as `Database` + `DbX` / `NewX` / `UpdateX` aliases.
- **App types** (`camelCase`) live in `src/types/index.ts`.
- **Conversion** in `src/types/transforms.ts`: forward `dbToBehavior`, `dbToClassroom`, `dbToStudent`, `dbToPointTransaction` (called at the `queryFn` boundary so `snake_case` never leaks into components), plus the Phase-4 app-shape (camelCase) transforms `dbStudentToApp` (`:113`) and `dbClassroomToApp` (`:134`), relocated verbatim from the dissolved AppContext `mapped*` bridges and consumed by `useAppClassrooms`/`useActiveClassroom` (thin and transitional).
- **Exception**: `useTransactions` deliberately keeps `DbPointTransaction` shape; consumers read it directly via `useTransactions(classroomId)`. `dbToPointTransaction` is a `{ ...row }` passthrough that formalizes the boundary without reshaping fields.

## State management

See `docs/state-management.md` for the full pattern catalog. Two-layer model:

- **Server state**: TanStack Query (`useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`) for migrated domains; hand-rolled `useState`+`useEffect` for the two legacy ones.
- **UI/session state**: React component state for transient UI; `AppContext` for the active-classroom selection ONLY.
- **Per-device prefs**: `useDisplaySettings` (`localStorage:classpoints-display-settings`), `ThemeContext` (`localStorage:theme`).
- **Cross-device prefs**: `SoundContext` (`user_sound_settings` table).

`AppContext` post-Phase-4 (`src/contexts/AppContext.tsx`, 33 LOC):

- Holds ONLY `activeClassroomId` + `setActiveClassroom` (localStorage `app:activeClassroomId`). No server data, no wrappers, no selectors.
- The dissolved facade's responsibilities were relocated: mutation fan-out → `useBatchAward` (`awardClass`/`awardSubset`); undo window → `useUndoableAction` (the batch kind rides the DB `batch_kind` column since deferred #7; the interim in-memory kind map is deleted); camelCase bridges → `useAppClassrooms`/`useActiveClassroom` + `dbClassroomToApp`/`dbStudentToApp`; point/transaction selectors → `pointSelectors.ts`; the ~20 imperative wrappers → direct TanStack mutation hooks.
- **Atomic batch awards (audit cluster #2, REAL sev 5 — FIXED in `30da564`)**: `useBatchAward`'s `awardClass` (`:228`) / `awardSubset` (`:237`) fire ONE atomic multi-row insert via `useAwardPointsBatch` (`useTransactions.ts:267`, bare `.select()` → all-or-none) and **THROW `BatchAwardError`** (`useBatchAward.ts:27`/`:218`) on any failure — the prior per-student `Promise.all` + silent `.catch(() => null)` filter is gone. A bounded recovery re-query (`classifyAndRecover`, `:77`, `AbortSignal.timeout(2000)`) names the offending student(s) and disambiguates a lost ack (CAP-6: a late-confirmed commit is suppressed as success). Genuine failures record a session-ephemeral `failedBatchStore` notice surfaced as a synthetic FAILED activity-feed entry (CAP-3, `activityFeed.ts:18`). Batch call sites CAN now rely on a clean throw contract.

**New components MUST**:

- Call mutation hooks (or `useBatchAward`) directly (`useAwardPoints`, `useAddStudent`, …)
- NOT re-add server-data fields, wrapper functions, or selectors to `AppContext`
- NOT clone the Phase-4 transitional modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `pointSelectors`) as new patterns

### Optimistic-mutation pattern (canonical: `useAwardPoints`)

ADR-005 §4 (a)–(e) compliance, inline in the hook (`src/hooks/useTransactions.ts:86-95` comments). The pattern:

- `onMutate` patches THREE caches: `transactions.list(classroomId)`, `classrooms.all`, `students.byClassroom(classroomId)`.
- `onMutate` is **pure + idempotent**: deterministic optimistic id (`optimistic-${studentId}-${behaviorId}-${timestamp}`) + a dedup guard (`alreadyPatched`) that skips ALL three patches if the temp row already exists. The guard protects duplicate mutation invocations such as double submits, effect-driven retries, or explicit replays; React StrictMode does not double-run button event handlers.
- `onError` null-guards `context.previous*` (undefined post-cancel would overwrite the cache, worse than no rollback) and restores all three caches.
- `onSettled` invalidates all three keys to reconcile with server truth.
- **Read previous state from cache via `qc.getQueryData`, never from the component closure** — the closure goes stale across re-renders.

### Realtime hook pattern (`useRealtimeSubscription`)

- Generic over postgres_changes events. A single optional `onChange` callback receives the full payload; the legacy `onInsert`/`onUpdate`/`onDelete` API and its DEV warning were removed (deferred #13). Status-only subscriptions (just `onStatusChange`/`onReconnect`) remain legitimate.
- Channel names use `crypto.randomUUID()` per mount (`useRealtimeSubscription.ts:79`). Prior `Date.now()` collided under StrictMode dev double-mount because cleanup→remount happens in the same millisecond, and Supabase reuses the existing channel for matching topics — the second `.on('postgres_changes', …)` on a rejoining channel throws. (The dev double-mount mechanism is unchanged under React 19.)
- Callbacks held in refs to avoid re-subscribing on every render.
- Tracks subscription status transitions; fires `onReconnect` when SUBSCRIBED returns from CHANNEL_ERROR / TIMED_OUT / CLOSED.

## Auth flow

`src/contexts/AuthContext.tsx`:

1. On mount, `getSession()` reads the cached session from `localStorage`.
2. If a cached session exists, validate it against the server with `supabase.auth.getUser()`.
3. If validation fails OR throws: log warning, `signOut({ scope: 'local' })`, `purgeAuthStorage()` removes every `sb-*` key from `localStorage`, route to login. Validation is bounded by `Promise.race([getUser(), timeoutPromise])` where `timeoutPromise` rejects after 5s — a genuine enforced timeout (the prior unwired `AbortController` was replaced because `getUser()` accepts no `AbortSignal`). A detached `userPromise.catch(() => {})` prevents an unhandled rejection if the timeout wins.
4. `onAuthStateChange` listener handles user-id transitions. The first event (`prev === undefined`) is INITIAL_SESSION and is NOT treated as a transition (so user A's cache can't flash on user B's first render). On a user-id transition (account-switch), `queryClient.clear()` runs.
5. `signOut()` also `queryClient.clear()`s — defense-in-depth, doesn't depend on the listener winning the race.

This is the "stale-JWT graceful degrade" fix from commit `d652260`.

## UI / Design System

Editorial / engineering redesign, merged to `main` via PR #86 (`6b06828`). Lives entirely in `src/index.css` `@theme` block + the redesigned components.

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

- **Unit (Vitest)**: 26 active `*.test.{ts,tsx}` files under `src/test/`, `src/hooks/__tests__/`, `src/utils/__tests__/`, `src/types/`, `src/lib/`, and `src/contexts/`. Coverage includes leaderboard math, sound synthesis/settings, rotating-category timer, student parser, realtime subscription wiring, `useStudents` `onReconnect` refresh contract, `useBehaviors`, `useAwardPoints` ADR-005 guards, the Phase-4 modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `transforms`, `pointSelectors`), the cluster #2 atomic-batch modules (`useAwardPointsBatch`, `failedBatchStore`, `activityFeed`, `TodaySummary`, `batchAwardModals`), `AwardPointsModal`, TeacherDashboard rendering, AppProvider, the `dashboard-students-mount` regression guard (exactly one `useStudents` AND one `point_transactions` subscription per dashboard mount, each with a non-vacuity control), and the `DashboardView.undo-timer` fake-timer suite (event-driven undo-window expiry / reschedule / unmount-cleanup, deferred #6 — replaced the dashboard's 1Hz tick interval; TodaySummary relative-time labels now refresh only on data-driven renders, an ACCEPTED trade-off).
- **Backend integration (Vitest + Node)**: 5 active files under `tests/integration/`. They hit a real local Supabase stack through service-role helpers and cover schema smoke, classroom RLS, point-total triggers, `point_transactions` realtime DELETE payloads, and batch-award atomicity (an FK-violation insert rolls back to 0 rows with SQLSTATE `23503`).
- **E2E (Playwright)**: Chromium-only, storage-state-based auth, fail-closed network allow-list. 3 active specs cover authenticated shell bootstrap, stale cached-session recovery, and cross-device realtime point totals (`realtime-cross-device-totals.spec.ts`, two-page / two-client).
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
