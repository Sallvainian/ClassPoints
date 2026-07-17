# Architecture

_Generated 2026-07-17 (exhaustive full rescan; HEAD `e34bbf3` on `main`)._

## Executive summary

ClassPoints is a single-page React application backed by Supabase (Auth + Postgres + Realtime + RLS + RPCs + one Edge Function). It runs entirely in the browser; there is no app server, no Node backend, no API layer of our own. The browser talks directly to Supabase via `@supabase/supabase-js`. Authorization happens at the database layer via Postgres Row-Level Security policies — every classroom, student, behavior, transaction, seating chart, and sound-settings row is gated on `auth.uid()`. Since PR #132/#136 the same codebase also ships as a **Capacitor 8 native app (iOS + Android)**: the native shell wraps the production `dist/` bundle in a WebView, with a responsive phone shell (bottom tab bar below Tailwind `md`), Preferences-backed auth storage, status-bar/splash/haptics/back-button glue that is a no-op on web, and an App-Store-mandated in-app account-deletion flow.

**The TanStack Query migration is COMPLETE.** All six server-state domains — `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`, `useLayoutPresets` (#11, PR #112), and `useSeatingChart` (Phase 5, PR #111) — are TanStack `useQuery`/`useMutation` hooks; no hand-rolled `useState + useEffect` server-state hooks remain. **Phase 4 (commit `d8cde26`) dissolved the `AppContext` server-data facade**: `AppContext.tsx` is 33 LOC of UI/session state only (the active-classroom selection), with the old wrappers/selectors/undo-machinery relocated to direct mutation hooks plus four thin transitional modules (`useBatchAward`, `useUndoableAction`, `useAppClassrooms`, `pointSelectors` — a fifth, the in-memory batch-kind map, was deleted by deferred #7: the batch kind now persists as the `point_transactions.batch_kind` column). `useAwardPoints` is the canonical single-student optimistic-mutation showcase (3 cache patches: transactions + classrooms + students); its all-or-nothing batch counterpart `useAwardPointsBatch` landed with the cluster #2 atomic-batch-award fix (`30da564`). Supabase error handling is normalized behind `unwrap()` / `isPostgrestError` (#14, PR #116), and multi-statement seating writes go through four single-transaction Postgres RPCs (#27, PR #114). Auth boot is resilience-hardened (PR #134): network-class failures never destroy a session — they suspend into an offline gate that auto-recovers.

The "editorial / engineering" UI redesign has merged to `main` (PR #86, `6b06828`). It replaced the prior visual language with a terracotta accent, Instrument Serif + Geist + JetBrains Mono typography, and a semantic-token system in `src/index.css` `@theme`. Phase 1 introduced the token cascade; Phase 2 redesigned inner screens (in-class workflow + settings). Hardcoded `bg-blue-*` / `from-indigo-*` references throughout the codebase pick up the new accent automatically via the cascade aliases.

## Technology stack

See `docs/project-overview.md` for the version-pinned table. Critical version constraints AI agents must respect:

- React **19** is installed (19.2.7) but barely used — new code MAY use React 19 features (ref-as-prop especially; do NOT reintroduce `forwardRef`), but keep server state in TanStack Query rather than `useOptimistic`, and match the prevailing style.
- Tailwind **v4** syntax (no v3 `tailwind.config.js` theme extensions, no legacy plugin).
- Vitest **4** API.
- ESLint **10 flat config** only (`eslint.config.js`); no `.eslintrc*`. `eslint-plugin-react-hooks` is **v7**, which enables `react-hooks/set-state-in-effect` — set to `'error'` here; disable per-site with a justification (the React Compiler is NOT enabled, so it also flags correct idiomatic effects). See `docs/development-guide.md`.
- supabase-js **2.110+** semantics — typed `UpdateX` payloads on `.update()` (`RejectExcessProperties`).
- **Zod 4** guards the `layout_data` JSONB boundary (both read and write directions, #15).
- **Capacitor 8** — direct `@capacitor/*` imports are confined to `src/lib/` (`native.ts`, `haptics.ts`, `authStorage.ts`) + `supabase.ts`; components/hooks reach native features only through those wrappers, and every wrapper is a no-op on web.
- `uuid` **v14+** — security override pinned in `package.json` `overrides` (alongside `tar` and `minimatch` overrides from the 2026-07 Dependabot resolution, `4f1ea1f`).

## Architecture pattern

| Aspect        | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Topology      | Client SPA + BaaS. No app-tier server. The SAME bundle also ships inside a Capacitor 8 WebView shell (iOS + Android) — native is a packaging target, not a separate part.                                                                                                                                                                                                                                                                                                                                                                              |
| State         | Server state in TanStack Query (ALL six domains — migration COMPLETE). UI state in component-local React state. `AppContext` holds ONLY the active-classroom selection (Phase 4 dissolved its server-data facade). Batch correlation + undo machinery live in thin modules (`useBatchAward`, `useUndoableAction`); the undo-label kind persists on rows (`point_transactions.batch_kind`, deferred #7).                                                                                                                                                |
| Auth          | Supabase Auth. Session storage: `localStorage` (`sb-*` keys) on web, **Capacitor Preferences on native** (WKWebView localStorage is evictable; adapter in `src/lib/authStorage.ts`, wired at `supabase.ts:31`). Boot is a two-stage bounded validation (8s `getSession` race + 5s `getUser` race) with **network-class discrimination** (`isNetworkClassAuthError`, whitelist): genuine rejection purges + routes to login; transient failure keeps the session (suspending into `OfflineGate` if it can't hydrate) and auto-revalidates on reconnect. |
| Authorization | Postgres RLS. Every table has policies keyed on `auth.uid()`; classrooms own users, and students/transactions/seating descend transitively. Account deletion runs through the `delete-account` Edge Function (JWT-derived identity, service-role `deleteUser`, FK cascade).                                                                                                                                                                                                                                                                            |
| Realtime      | Exactly 2 domains (ADR-005 §6 target MET): `students` table (stored lifetime totals / identity changes) and `point_transactions`. `useStudents` owns the `students` subscription (`useStudents.ts:46`); `useTransactions` owns `point_transactions` (`useTransactions.ts:83`). Both are invalidate-not-merge. The legacy `useLayoutPresets` `layout_presets` subscription was DELETED with the #11 migration (PR #112). Seating is a non-realtime domain by design (on-demand invalidation).                                                           |
| Routing       | None. View state is `useState<View>` in `App.tsx` (`:38`), persisted to `localStorage:app:view`. Five views: `home`, `dashboard`, `settings`, `migration`, `profile`. Two auth-level screens render ABOVE the view router via `AuthGuard` branches: `ResetPasswordForm` (password recovery) and `OfflineGate` (suspended session).                                                                                                                                                                                                                     |
| Styling       | Tailwind v4 with `@theme` tokens. Semantic tokens (surface-1/2/3, ink-strong/mid/muted, hairline) flip via `.dark { ... }` overrides. Cascade aliases retone hardcoded `bg-blue-*`/`from-indigo-*`/`from-purple-*` to terracotta. Responsive phone shell below `md`: bottom tab bar (`BottomNav`), `h-dvh` layout column, `env(safe-area-inset-*)` padding, `--app-bottom-nav-h` toast offset token.                                                                                                                                                   |
| Build         | Vite 8, `@vitejs/plugin-react` (React Compiler NOT enabled). Web: `base: '/ClassPoints/'` for GitHub Pages. Native: `vite build --mode capacitor` → relative `base: './'` + a viewport-lock plugin (`maximum-scale=1.0, user-scalable=no` injected at build time; web keeps user zoom for accessibility) (`vite.config.ts:4-24`).                                                                                                                                                                                                                      |
| Bundle        | Lazy-loaded views: `MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`. React Query Devtools dynamically imported inside a `useEffect` body gated on `import.meta.env.DEV` so Rollup never registers the chunk in prod (CI-asserted by `scripts/check-bundle.mjs`; `cap:build` runs the same check). Fonts are self-hosted via `@fontsource` imports in `main.tsx` (offline first paint — no Google CDN).                                                                                                       |
| Testing       | Vitest unit (44 files / 376 tests) + Vitest backend integration (8 files) + Playwright E2E (6 specs across 4 projects: setup, desktop Chromium, 390×844 mobile, 834×1194 iPad touch; fail-closed network allow-list for local Supabase).                                                                                                                                                                                                                                                                                                               |
| Deployment    | Web: GitHub Pages via `.github/workflows/deploy.yml` (hosted Supabase creds inlined; anon key is public, RLS guards data). Native: `npm run cap:build` → Xcode / Android Studio via `npx cap open`. `public/privacy.html` serves the App-Store-required privacy policy at `/ClassPoints/privacy.html`.                                                                                                                                                                                                                                                 |

## Provider stack (`src/App.tsx`)

```
<AuthProvider>           ← Supabase auth, network-class-aware boot, queryClient.clear() on user-id transition
  <AuthGuard>            ← Branch precedence: loading → (user && passwordRecovery) <ResetPasswordForm />
    │                      → authSuspended <OfflineGate /> → !user <AuthPage /> → children
    <ThemeProvider>      ← light/dark, prefers-color-scheme + localStorage; syncStatusBar(theme) on native
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
- `point_transactions` — student/classroom/behavior FKs + `behavior_name`/`behavior_icon` snapshots + `note` + `batch_id` + `batch_kind` (`'class' | 'subset' | NULL`, named CHECK; deferred #7). Realtime + REPLICA IDENTITY FULL. The totals trigger is `SECURITY DEFINER` since `20260717033000` (account-deletion cascade fix).
- `user_sound_settings` — per-user 1-row config. Realtime + REPLICA IDENTITY FULL.
- `seating_charts` — 1:1 with classroom (UNIQUE constraint). `snap_enabled`, `grid_size`, `canvas_width`, `canvas_height`.
- `seating_groups` — 4-seat table groups within a chart. UNIQUE `(seating_chart_id, letter)`.
- `seating_seats` — 4 seats per group, auto-created by `auto_create_group_seats()` trigger. `student_id` FK with single-seat-per-chart enforcement via `ensure_student_single_seat()` trigger.
- `room_elements` — teacher_desk / door / window / countertop / sink (enum `room_element_type`).
- `layout_presets` — user-owned, importable JSON layouts (no student assignments).

### RPC + Edge Function

- `get_student_time_totals_all_for_user(p_start_of_today, p_start_of_week)` — returns `(classroom_id, student_id, today_total, this_week_total)` for every student in every classroom the caller owns (RLS-bounded under `SECURITY INVOKER` — no classroom param to spoof). Called ONCE inside `useStudents.queryFn` (rows filtered to its classroom client-side) and ONCE inside `useClassrooms.queryFn` (deferred #8 replaced the per-classroom `get_student_time_totals` fan-out, migration `20260611145458`). Pre-filters on `created_at >= p_start_of_week` for performance (served by `idx_transactions_created_at`).
- Four **atomic seating RPCs** (`20260610224711`, deferred #27) — `seating_assign_student`, `seating_swap_students`, `seating_randomize`, `seating_apply_preset`. Single-transaction `plpgsql`, `SECURITY INVOKER`, `SET search_path = ''`; the ONLY client write path for multi-statement seat operations (`useSeatingChart` calls each via one `supabase.rpc(...)`). See `docs/data-models.md` for signatures.
- **`delete-account` Edge Function** (`supabase/functions/delete-account/`, PR #137) — the only Edge Function. Identity exclusively from the verified JWT (never the body); service-role `auth.admin.deleteUser(user.id)`; user data removed by FK cascade; `verify_jwt = true` pinned in `supabase/config.toml`. Client entry: `useDeleteAccount` → `DeleteAccountModal` (type-your-email confirm) in ProfileView's Danger zone.

### Realtime

ADR-005 §6 specifies the realtime scope as exactly 2 domains:

| Domain                             | Tables               | Why                                                                     |
| ---------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `students` (lifetime point totals) | `students`           | Cross-device student-row changes refetch stored + time totals           |
| `point_transactions`               | `point_transactions` | Cross-device award / undo events propagate (owned by `useTransactions`) |

Non-realtime (explicit, NOT default-by-omission): `classrooms`, `behaviors`, `layout_presets`, `seating-chart`, `user_sound_settings` (the last is realtime-enabled in the migration but only used for cross-device settings sync, which doesn't fit the 2-domain count). They use `refetchOnWindowFocus: false` defaults + on-demand `invalidateQueries` after mutations. Seating-chart was previously a target realtime domain for cross-device drag sync; that use case was dropped 2026-05-13.

**Realtime callback strategy — invalidate-not-merge** (ADR-005 §7): the live-sync callbacks call ONLY `invalidateQueries`. `useStudents` subscribes to `students` and, on any INSERT/UPDATE/DELETE, invalidates `students.byClassroom` (refetch re-reads authoritative columns + re-runs the batched `get_student_time_totals_all_for_user` RPC, so all-time/today/week refresh identically) plus `classrooms.all`. `useStudents` no longer owns a `point_transactions` subscription — `useTransactions` owns `point_transactions` (any event) and invalidates its own keys. Production subscriptions now match the ADR-005 §6 target EXACTLY (2 sites — `grep -rn "table: '" src/hooks` excluding tests): the legacy `useLayoutPresets` `layout_presets` subscription was deleted with the #11 migration (PR #112). `useSeatingChart` is TanStack-migrated and has no realtime subscription — a non-realtime domain by design. Cross-device `point_transactions` INSERT/DELETE refresh `today_total` / `this_week_total` via the DB trigger's `students` UPDATE event (`011:45-47`) → refetch; the day-boundary case still relies on the visibility-change handler.

**Cross-cutting realtime DELETE rule**: any table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL` in its migration (DB-level requirement; migration `005` is still required for filtered-DELETE event delivery). Without it, DELETE payloads arrive empty. Note the client no longer reads `payload.old`'s extra columns for `point_transactions` — the invalidate-not-merge callbacks ignore the payload body. Currently `point_transactions`, `students`, and `user_sound_settings` have `REPLICA IDENTITY FULL`.

### Type-system boundaries

- **DB types** (`snake_case`) live in `src/types/database.ts` as `Database` + `DbX` / `NewX` / `UpdateX` aliases.
- **App types** (`camelCase`) live in `src/types/index.ts`.
- **Conversion** in `src/types/transforms.ts`: forward `dbToBehavior`, `dbToClassroom`, `dbToStudent`, `dbToPointTransaction` (called at the `queryFn` boundary so `snake_case` never leaks into components), plus the Phase-4 app-shape (camelCase) transforms `dbStudentToApp` (`:113`) and `dbClassroomToApp` (`:134`), relocated verbatim from the dissolved AppContext `mapped*` bridges and consumed by `useAppClassrooms`/`useActiveClassroom` (thin and transitional).
- **Exception**: `useTransactions` deliberately keeps `DbPointTransaction` shape; consumers read it directly via `useTransactions(classroomId)`. `dbToPointTransaction` is a `{ ...row }` passthrough that formalizes the boundary without reshaping fields.

## State management

See `docs/state-management.md` for the full pattern catalog. Two-layer model:

- **Server state**: TanStack Query for ALL six domains (`useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`, `useLayoutPresets`, `useSeatingChart`) — the migration is complete; no hand-rolled server-state hooks remain.
- **UI/session state**: React component state for transient UI; `AppContext` for the active-classroom selection ONLY.
- **Per-device prefs**: `useDisplaySettings` (`localStorage:classpoints-display-settings`), `ThemeContext` (`localStorage:theme`).
- **Cross-device prefs**: `SoundContext` (`user_sound_settings` table).

`AppContext` post-Phase-4 (`src/contexts/AppContext.tsx`, 33 LOC):

- Holds ONLY `activeClassroomId` + `setActiveClassroom` (localStorage `app:activeClassroomId`). No server data, no wrappers, no selectors.
- The dissolved facade's responsibilities were relocated: mutation fan-out → `useBatchAward` (`awardClass`/`awardSubset`); undo window → `useUndoableAction` (the batch kind rides the DB `batch_kind` column since deferred #7; the interim in-memory kind map is deleted); camelCase bridges → `useAppClassrooms`/`useActiveClassroom` + `dbClassroomToApp`/`dbStudentToApp`; point/transaction selectors → `pointSelectors.ts`; the ~20 imperative wrappers → direct TanStack mutation hooks.
- **Atomic batch awards (audit cluster #2, REAL sev 5 — FIXED in `30da564`)**: `useBatchAward`'s `awardClass` (`:228`) / `awardSubset` (`:237`) fire ONE atomic multi-row insert via `useAwardPointsBatch` (`useTransactions.ts:272`, bare `.select()` at `:294` → all-or-none) and **THROW `BatchAwardError`** (`useBatchAward.ts:27`/`:218`) on any failure — the prior per-student `Promise.all` + silent `.catch(() => null)` filter is gone. A bounded recovery re-query (`classifyAndRecover`, `:77`, `AbortSignal.timeout(2000)`) names the offending student(s) and disambiguates a lost ack (CAP-6: a late-confirmed commit is suppressed as success; the network-vs-server hinge is `isPostgrestError(err) && err.code !== ''`, `:83`). Genuine failures record a session-ephemeral `failedBatchStore` notice surfaced as a synthetic FAILED activity-feed entry (CAP-3, `activityFeed.ts:18`). Batch call sites CAN now rely on a clean throw contract.

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

`src/contexts/AuthContext.tsx` (497 LOC — reworked by PR #134 auth resilience + PR #136 Preferences storage). Governing principle (`:73-74`): _network-class failure (offline, timeout, 5xx/429) → the session is not proven invalid; keep it._

1. **Boot** (`init()`, `:76`): `getSession()` raced against an 8s timeout, then — if a cached session exists — `getUser()` validation raced against a 5s timeout. Both timeouts throw the named `AuthValidationTimeoutError` (`src/lib/supabase.ts:136`), which classifies as network-class.
2. **Discrimination** (`isNetworkClassAuthError`, `supabase.ts:157` — whitelist: timeout, `TypeError`, `AuthRetryableFetchError`, `AuthApiError` ≥500/429, `AuthUnknownError`): genuine rejection → `purgeAndSignOut()` (purges `sb-*` localStorage keys AND Capacitor Preferences on native) and routes to login; network-class → keep the cached session, arm a one-shot revalidation. A no-session network failure sets `authSuspended` → `AuthGuard` renders `OfflineGate` (no login form — the session isn't lost, just unhydrated; recovery is automatic via GoTrue's refresh ticker + a reconnect kick).
3. **Session storage**: web = `localStorage` (`sb-*`); native = Capacitor Preferences via the `capacitorPreferencesStorage` adapter (`authStorage.ts:25`, wired at `supabase.ts:31`) because WKWebView localStorage is evictable under storage pressure.
4. **Password reset**: `resetPassword(email)` sends a link that lands on the **app root** (GitHub Pages 404s unknown SPA routes; native `capacitor://` builds redirect to the production web URL — `appUrl.ts`). The implicit-flow link signs the user in; the `passwordRecovery` flag (seeded from the boot URL hash at module-eval, or the `PASSWORD_RECOVERY` event) makes `AuthGuard` render `ResetPasswordForm` before the app.
5. **Email change**: `updateEmail` — success means "requested", not "changed"; ProfileView keeps a persistent pending banner until the confirmation link(s) are opened (both inboxes under Supabase secure email change).
6. `onAuthStateChange` handles user-id transitions: only a genuine `userA → userB` transition runs `queryClient.clear()` (INITIAL_SESSION never does); explicit `signOut()` also clears — defense-in-depth.

## Native shell (Capacitor 8)

One codebase, three targets: web (GitHub Pages), iOS, Android. The native platforms (`ios/` 23 tracked files, `android/` 77) are standard generated Capacitor projects wrapping the production `dist/` bundle (`capacitor.config.ts`: `appId: 'com.frankcottone.classpoints'`, `webDir: 'dist'`).

- **Bridge modules** (all no-ops on web via `Capacitor.isNativePlatform()` guards; the ONLY files importing `@capacitor/*` besides `supabase.ts`):
  - `src/lib/native.ts` (47 LOC) — `syncStatusBar(theme)` (called from ThemeContext), `hideSplash()` (called from an App.tsx mount effect so the native splash covers the WebView until the first render commits; `launchAutoHide: false` in config), `registerBackButton({isHome, goHome})` (Android back: minimize from home, otherwise go home).
  - `src/lib/haptics.ts` (22 LOC) — `hapticAwardSuccess`/`hapticAwardNegative`, called in the three award modals inside the same positive/negative branches as the sound calls.
  - `src/lib/authStorage.ts` (104 LOC) — the Preferences session adapter + purge/probe helpers (see Auth flow).
  - `src/lib/appUrl.ts` (65 LOC) — boot-URL facts + auth-email redirect resolution (non-http(s) protocols → production web URL).
- **Build**: `npm run cap:build` = `tsc -b && fnox exec -- vite build --mode capacitor && node scripts/check-bundle.mjs && npx cap sync`. Capacitor mode flips `base` to relative `'./'` and injects the viewport lock. `cap:assets` regenerates icons/splash from the 3 source images in `resources/`. Live reload: `CAP_SERVER_URL=http://<lan-ip>:5173 npx cap sync ios` points the WebView at a LAN Vite dev server.
- **Hand-edited platform files**: `android/app/src/main/AndroidManifest.xml` sets `android:allowBackup="false"` (Auto Backup would carry the live Preferences session into cloud/adb backups); `ios/App/App/Info.plist` customizes `CFBundleDisplayName`.
- **App Store compliance**: in-app account deletion (Guideline 5.1.1(v), PR #137) + `public/privacy.html` (standalone, self-contained policy page served at `/ClassPoints/privacy.html`).

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

**Hand-redesigned surfaces** (Phase 1 + 2): Sidebar (terracotta dot + Instrument Serif title + uppercase tracked section labels), Layout, ClassPointsBox (class total promoted to its own card), DashboardView, parts of seating views and settings. Other screens use the cascade aliases for free.

**Responsive phone shell (PR #132)** — Tailwind `md` (48rem) is the breakpoint; no JS media queries at the shell level:

- `Layout.tsx:23`: `flex h-dvh flex-col md:flex-row` — dynamic-viewport column on phone, sidebar row on desktop. `Sidebar` is `hidden md:flex` (`Sidebar.tsx:50`); `BottomNav` (NEW, 69 LOC) is `md:hidden` — a 3-tab in-flow bar (Home / Class / Profile, lucide icons, `aria-current`, dimmed Class tab when no classroom) padded by `pb-[env(safe-area-inset-bottom)]`.
- `--app-bottom-nav-h` token (`index.css:137-147`): `calc(3.5rem + env(safe-area-inset-bottom))` below `md`, `0px` at `md+` — `UndoToast`/`ErrorToast` anchor `bottom-[calc(var(--app-bottom-nav-h)+…)]` so one rule serves phone and desktop; widths clamp to `calc(100vw-2rem)`.
- `DashboardView`'s activity feed is a full-area overlay on phone (`absolute inset-0 z-10`) and the classic `md:w-80` side panel at `md+` (`DashboardView.tsx:479`); phone mode gets a close button, focus management, and Escape handling gated on `matchMedia('(min-width: 48rem)')` — the one deliberate JS media query (`:72-81`).
- Top-of-screen surfaces clear the status bar / Dynamic Island via `pt-[calc(…+env(safe-area-inset-top))]` (DashboardView header, TeacherDashboard, SyncStatus repositioned top-right on phone).
- `Modal`/`Dialog` stay centered but clamp to `max-h-[calc(100dvh-2rem)]` with internal scroll. iOS focus-zoom is prevented by `@media (pointer: coarse) { input… { font-size: max(16px, 1em) } }` (`index.css:124-131`). `.touch-callout-none` (`index.css:263-267`) suppresses the iOS long-press callout on drag surfaces.
- Fonts are self-hosted `@fontsource` imports in `main.tsx:13-18` (Instrument Serif, Geist 400/500/600, JetBrains Mono 500) — no Google CDN, offline-capable first paint (PR #134). They live in `main.tsx`, not `index.css`, because Tailwind v4's `@import` resolver inlines node_modules CSS without rebasing relative font URLs (`index.css:3-8`).

## Source tree

See `docs/source-tree-analysis.md`.

## Development workflow

See `docs/development-guide.md`.

## Deployment

- Production web: GitHub Pages via `.github/workflows/deploy.yml`.
- Build inlines hosted Supabase URL + anon key (anon key is public-readable; RLS protects data).
- Service-role key is NEVER bundled. Lives only in `.env.test` (local) and CI secrets (`SUPABASE_SERVICE_ROLE_KEY` synthesized from `supabase status` + `FNOX_AGE_KEY` for test creds).
- `npm run check:bundle` is a CI gate that asserts no React Query Devtools chunks leaked; `cap:build` runs the same check before `cap sync`.
- Native: `npm run cap:build` then `npx cap open ios` / Android Studio. Supabase migrations + Edge Functions auto-deploy on merge to `main` via the Supabase GitHub integration.

## Testing strategy

- **Unit (Vitest)**: **44** `*.test.{ts,tsx}` files / **376 tests** (all passing at this scan) under `src/test/`, `src/hooks/__tests__/`, `src/utils/__tests__/`, `src/types/`, `src/lib/`, `src/components/seating/__tests__/`, and `src/contexts/`. Coverage now spans the prior suites (leaderboard math, sounds, `useAwardPoints` ADR-005 guards, Phase-4 modules, cluster #2 atomic-batch modules, `dashboard-students-mount` regression guard, `DashboardView.undo-timer` fake-timer suite) PLUS the new-in-range surfaces: auth-boot resilience matrix (`AuthContext.test.tsx`, 25 cases: network-class vs genuine-rejection, 8s/5s timeouts, reconnect revalidation), recovery-boot hash capture, `AuthGuard` branch precedence, `ResetPasswordForm`, ProfileView email-change/danger-zone/preferences, `DeleteAccountModal` + `useDeleteAccount`, `BottomNav` + `Layout.responsive` + `toasts.responsive` class contracts, the `DashboardView.activity-overlay` phone/desktop matrix, `SeatingChartEditor` touch/mouse/resize/zoom suite (36 cases), `seatingChart` Zod schema I/O matrix, `authStorage`/`appUrl`/`haptics` native-lib tests, and the `unwrap`/`isPostgrestError` matrix (`supabase.test.ts`).
- **Backend integration (Vitest + Node)**: **8** files under `tests/integration/`. Real local Supabase stack through service-role helpers: schema smoke, classroom RLS, point-total triggers, `point_transactions` realtime DELETE payloads, batch-award atomicity (FK-violation → 0 rows, SQLSTATE `23503`), batched time-totals RPC, the four seating RPCs (18 rollback/RLS/grant proofs incl. cross-tenant swap + anon EXECUTE denial), and the `delete-account` Edge Function (cascade proof, JWT-not-body identity, 401 unauthenticated).
- **E2E (Playwright)**: **6** specs across **4 projects** — `setup` (login → storage state), `chromium` (desktop), `mobile` (390×844 + touch, runs only `mobile-shell.spec.ts`), `ipad` (834×1194 + touch, runs only `seating-touch.spec.ts`). Fail-closed network allow-list. Specs: authenticated shell bootstrap, stale cached-session recovery, offline-boot resilience (session survives unreachable auth server; offline gate + recovery), cross-device realtime totals (two-page/two-client), phone shell (bottom nav, activity overlay, toast stacking, dialog fit), and seating touch (auto-fit, tap-lands-under-finger at scale, element toolbar).
- **CI (`test.yml`)**: lint → bundle-check → **unit** (NEW job — gates PRs) → **integration** (NEW job — boots a local stack in CI; the realtime DELETE test is CI-skipped as non-deterministic on cold stacks) → 4-shard E2E → 10× burn-in → `test-summary` branch-protection gate (needs all six). `deploy.yml` (push to `main`) runs lint + typecheck + unit tests + build → Pages.

## Authoritative sources

| Doc                                        | Status                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_bmad-output/planning-artifacts/prd.md`   | TanStack migration PRD (scope, phases, AC).                                                                                                                             |
| `docs/modernization-plan.md`               | Strategy doc (diagnosis, target architecture). Hand-written.                                                                                                            |
| `docs/adr/ADR-005-queryclient-defaults.md` | §1-§6 all in force as of HEAD `1b0decb`.                                                                                                                                |
| `_bmad-output/anti-pattern-audit.md`       | 2026-04-25 audit with REAL / OVERSTATED / FALSE-POSITIVE verdicts on 10 clusters. Consult before re-raising rejected concerns.                                          |
| `_bmad-output/project-context.md`          | LLM-optimized critical-rules digest. The "snapshot at HEAD" line gates which sections are still trustworthy.                                                            |
| `docs/legacy/legacy-*.md`                  | AS-IS pattern inventory. Authoritative subset still correct: `legacy-migrations.md`, `legacy-testing.md`, `legacy-utils.md`. The rest describe patterns being reversed. |
