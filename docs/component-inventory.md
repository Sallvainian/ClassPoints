# Component Inventory

_Generated 2026-07-17 (exhaustive full rescan; HEAD `e34bbf3` on `main`)._

**51** React component files under `src/components/` (`find src/components -name '*.tsx'` excluding tests → 51), organized by feature folder, including the top-level `DevtoolsGate.tsx` (see Lazy loading). New since the prior scan: `auth/OfflineGate`, `auth/ResetPasswordForm`, `layout/BottomNav`, `profile/DeleteAccountModal`. Twelve component folders have historical sibling `index.ts` barrels (`auth`, `behaviors`, `classes`, `dashboard`, `home`, `layout`, `points`, `profile`, `seating`, `settings`, `students`, `ui`); `common` and `migration` do not. Components MUST use named exports (HMR stability under `react-refresh/only-export-components`). The single exception is `App.tsx` (default export); do NOT add new default exports.

A file exporting a component should export ONLY components — `allowConstantExport: true` permits constants alongside, but no helper functions or types. Move helpers/types to dedicated files: cross-feature → `src/utils/`, feature-scoped → sibling `*.utils.ts`, types → `src/types/` or sibling `*.types.ts`.

## Auth

`src/components/auth/`

| Component            | Purpose                                                                                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthGuard`          | Wraps children. Branch precedence (`AuthGuard.tsx:15-45`): loading → (`user && passwordRecovery`) `ResetPasswordForm` → `authSuspended` `OfflineGate` → no user `AuthPage` → children.                                                             |
| `AuthPage`           | View machine `'login' \| 'signup' \| 'forgot-password'` (`AuthPage.tsx:6`). Reset-password is NOT one of its views — it renders at the AuthGuard level.                                                                                            |
| `LoginForm`          | Email + password form. Calls `useAuth().signIn`; "Forgot your password?" button via the `onForgotPassword` prop (`:86-92`).                                                                                                                        |
| `SignupForm`         | Email + password (+ name). Calls `useAuth().signUp`; shows "Account created. Check your email to confirm."                                                                                                                                         |
| `ForgotPasswordForm` | Email-only form. Calls `useAuth().resetPassword` — the link lands on the app root (native builds redirect to the production web URL, `appUrl.ts`).                                                                                                 |
| `ResetPasswordForm`  | **NEW (PR #134)**, 112 LOC. Sets the new password after the implicit-flow recovery link signs the user in: validates (≥6 chars, match), calls `updatePassword`, then `clearPasswordRecovery()` on success; "Skip for now" clears without changing. |
| `OfflineGate`        | **NEW (PR #134)**, 30 LOC. Rendered when `authSuspended` — a status panel ("You're offline… the app reconnects automatically"), NOT a login form. No retry button by design: recovery is automatic (GoTrue refresh ticker + reconnect kick).       |

## Behaviors

`src/components/behaviors/`

| Component        | Purpose                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `BehaviorButton` | Renders a single behavior as a tappable button (icon + name + points). Used inside `BehaviorPicker`.                             |
| `BehaviorPicker` | Grid of `BehaviorButton`s. Used by `AwardPointsModal` / `ClassAwardModal` / `MultiAwardModal` to choose which behavior to award. |

## Classes

`src/components/classes/`

| Component             | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `ImportStudentsModal` | Bulk-paste student names. Uses `studentParser.ts` to split + dedupe. |

## Common

`src/components/common/`

| Component    | Purpose                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SyncStatus` | Live indicator of Supabase realtime connection. Phone: pinned top-right under the status bar (`top-[calc(env(safe-area-inset-top)+0.75rem)]`); desktop: bottom-right (`md:bottom-4`) (`SyncStatus.tsx`). |

## Dashboard (in-class workflow)

`src/components/dashboard/`

| Component       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DashboardView` | The main "I'm in class right now" surface (553 LOC). Renders student grid OR seating chart, BottomToolbar, modals, undo toast, error toast. The activity feed is responsive (PR #132): full-area overlay on phone (`absolute inset-0 z-10`, phone-only close button, Escape + focus management gated on `matchMedia('(min-width: 48rem)')`), classic `md:w-80` side panel at `md+` (`:479`). Header clears the status bar via `env(safe-area-inset-top)` (`:323`). |
| `BottomToolbar` | Toolbar pinned to the bottom of `DashboardView` — quick-award buttons, view-mode toggle, selection-mode toggle, settings shortcut. Responsive padding (`px-3 py-2.5 md:px-6 md:py-4`); the "Selected" label hides on the smallest screens (`hidden sm:inline`). Stacks above `BottomNav` (both in-flow).                                                                                                                                                           |

## Home

`src/components/home/`

| Component          | Purpose                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `TeacherDashboard` | Home view (view == 'home'). Lists classroom cards + leaderboard + stats. Called from `App.tsx`.                                               |
| `ClassroomCard`    | One classroom card on the home screen. Shows name, student count, lifetime/today/week totals. Click → set active classroom + go to dashboard. |
| `LeaderboardCard`  | Cross-classroom leaderboard (top students by today's points).                                                                                 |
| `StatsCard`        | Aggregate stats card (total points, classrooms, etc.).                                                                                        |

## Layout

`src/components/layout/`

| Component   | Purpose                                                                                                                                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Layout`    | Top-level responsive chrome (PR #132): `flex h-dvh flex-col md:flex-row` (`Layout.tsx:23`) — phone stacks main + BottomNav in a dynamic-viewport column; desktop puts Sidebar in a row. Renders BOTH `Sidebar` and `BottomNav`; each self-hides via `md:` classes. Threads the new `activeView` prop to `BottomNav`.              |
| `Sidebar`   | Desktop-only (`hidden md:flex w-64`, `Sidebar.tsx:50`). Terracotta dot + Instrument Serif "ClassPoints" title + uppercase tracked subtitle. Dashboard nav button + classrooms list (with create modal) + footer (theme toggle + profile + signout). Its phone-hidden affordances grew phone-only equivalents elsewhere.           |
| `BottomNav` | **NEW (PR #132)**, 69 LOC. Phone-only (`md:hidden`) in-flow 3-tab bar — Home / Class / Profile (lucide icons, `aria-current`). Class tab is active for both `dashboard` and `settings` views, dimmed (`opacity-40`) + routed to Home when no classroom exists. Safe-area padded (`pb-[env(safe-area-inset-bottom)]`), `h-14` bar. |

## Migration

`src/components/migration/`

| Component         | Purpose                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `MigrationWizard` | One-time localStorage → Supabase migration wizard. Lazy-loaded. Shown when `hasLocalStorageData()` returns true on app boot. |

## Points (the core in-class workflow)

`src/components/points/`

| Component          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AwardPointsModal` | Award points to a single student. Picks behavior via `BehaviorPicker`, supports note, calls `useAwardPoints().mutateAsync` directly (`:48`) and reads the student's stored totals via `studentPoints` from `pointSelectors` (`:78`).                                                                                                                                                                                                                                                                                                                          |
| `ClassAwardModal`  | Award points to the entire class. `await`s `useBatchAward(classroomId).awardClass` (`:29`/`:53`); the award is now atomic (cluster #2 FIXED in `30da564`), so a failure throws `BatchAwardError` and the modal stays open with a named error — it no longer silently drops per-student failures.                                                                                                                                                                                                                                                              |
| `MultiAwardModal`  | Award points to a multi-select subset of students. `await`s `useBatchAward(classroomId).awardSubset` (`:25`/`:50`) — same atomic all-or-none throw contract as `ClassAwardModal`.                                                                                                                                                                                                                                                                                                                                                                             |
| `ClassPointsBox`   | **NEW (commit 350c7c9)** — Class-total card promoted to its own surface. Tap to open `ClassAwardModal`. Displays total + breakdown (positive / negative) + today + this-week chips. Editorial design: Instrument Serif heading, JetBrains Mono numerics, hairline divider.                                                                                                                                                                                                                                                                                    |
| `TodaySummary`     | Today's-points activity feed. Renders the most recent transactions; a synthetic `failed`-flagged entry (injected by `mergeFailedIntoFeed`) renders a distinct red **FAILED** badge instead of a signed point delta (cluster #2 surfacing, `:52-75`).                                                                                                                                                                                                                                                                                                          |
| `UndoToast`        | Undo toast (5s display via its internal `duration` default; the undo WINDOW is 10s). Receives the current undoable `action` as a prop from `DashboardView` (`DashboardView.tsx:548`), which derives it from `useUndoableAction` via `useMemo` + an event-driven one-shot expiry timeout (deferred #6 — no 1s tick, no polling inside the toast). Shows different copy for batch vs single-student undo (label kind from the rows' `batch_kind`). Anchored `bottom-[calc(var(--app-bottom-nav-h)+1.5rem)]`, width clamped to `calc(100vw-2rem)` (phone shell). |

All three award modals (`AwardPointsModal`, `ClassAwardModal`, `MultiAwardModal`) fire native haptics alongside sounds — `hapticAwardSuccess`/`hapticAwardNegative` from `src/lib/haptics.ts` in the same positive/negative branches (no-ops on web, PR #136).

## Profile

`src/components/profile/`

| Component              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProfileView`          | User profile + account self-service (532 LOC). Display-name save (`auth.updateUser({ data: { name } })`), **email change** (request-not-change UX: persistent "confirmation email sent" banner until the link(s) are opened, current-address rejected locally), password change, phone-only Preferences section (theme toggle / sign out — the sidebar footer is hidden below `md`), privacy-policy link, and the **Danger zone** opening `DeleteAccountModal`. |
| `DeleteClassroomModal` | Confirmation modal for classroom deletion.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `DeleteAccountModal`   | **NEW (PR #137)**, 119 LOC. Type-to-confirm (exact account email match enables the button), runs `useDeleteAccount` (the `delete-account` Edge Function) THEN `signOut()` — deletion strictly precedes sign-out; failure surfaces a named error, re-enables the form, and does NOT sign out.                                                                                                                                                                    |

## Seating

`src/components/seating/`

| Component            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SeatingChartView`   | Read-only seating chart view (used in `DashboardView` when `viewMode == 'seating'`). PR #135: `useLayoutEffect` fit-scale (no scale-1 flash on phones), `overflow-x-auto` pan wrapper, per-action `ErrorToast`, load-error gate narrowed to `error && !chart` so a failed background refetch keeps the chart visible.                                                                                                                                                                                                                                                             |
| `SeatingChartEditor` | Edit mode (1630 LOC) — add/move/rotate groups, place room elements, manage assignments, save preset. **Touch-first (PR #135)**: `PrimaryButtonMouseSensor` (`distance: 5` — the PR #120 click-select fix: sub-5px presses stay clicks) + `TouchSensor` (`delay: 200, tolerance: 8` press-and-hold so swipes still scroll) + `KeyboardSensor`; all drag/resize math divides by the current `scale`; auto-fit on mount/resize with a `MIN_TOUCH_SCALE = 0.44` floor on coarse pointers (44px seat touch targets); window-attached pointer-event resize with `pointercancel` revert. |
| `SeatingChartCanvas` | Pan/zoom + grid + drop targets. Shared between view and editor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `SeatCard`           | One seat — student name + avatar color + tap to award points.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `TableGroup`         | A group of 4 seats arranged as a table. Drag handle + rotate button (editor only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `RoomElementDisplay` | Renders a teacher_desk / door / window / countertop / sink element.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `EmptyChartPrompt`   | Empty-state prompt when no seating chart exists yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ViewModeToggle`     | Toggle between alphabetical and seating view modes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Settings

`src/components/settings/`

| Component            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ClassSettingsView`  | Class settings screen (view == 'settings'). Manages the student roster (add / import via `ImportStudentsModal` / rename / remove), per-student point adjustment (`AdjustPointsModal` → `useAdjustStudentPoints`), classroom-points reset (`ResetPointsModal` → `useResetClassroomPoints`), and classroom rename/delete (`useUpdateClassroom`/`useDeleteClassroom`). It does NOT manage behaviors, sound, or layout presets — sound lives in `SoundSettings`/`SoundSettingsModal`, and the behavior-mutation hooks (`useAddBehavior`/`useUpdateBehavior`/`useDeleteBehavior`) currently have no component consumer. |
| `AdjustPointsModal`  | Set a student's total to a target value (creates a delta `point_transactions` row via `useAdjustStudentPoints`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ResetPointsModal`   | Confirm reset of an entire classroom's points.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `SoundSettings`      | Inline sound settings panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `SoundSettingsModal` | Modal-form sound settings (used from `DashboardView`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Students

`src/components/students/`

| Component          | Purpose                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StudentGrid`      | Grid of `StudentPointCard`s. Card sizing controlled by `useDisplaySettings().cardSize`. Used in `DashboardView` when `viewMode == 'alphabetical'`. |
| `StudentPointCard` | One student tile — avatar + name + (optional) point total + tap to award. Selection-mode aware.                                                    |

## UI primitives

`src/components/ui/`

| Component    | Purpose                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`     | Primary / secondary / ghost button variants. Editorial-redesign aware (terracotta accent for primary).                                                                                              |
| `Dialog`     | Chromeless dialog primitive: overlay, ARIA, escape-to-close, scroll lock, body owner controls markup. Phone-fit: `max-h-[calc(100dvh-2rem)] flex flex-col` so the body scrolls internally.          |
| `Modal`      | Title-and-body modal primitive with overlay, ARIA, escape-to-close, and scroll lock. Phone-fit: `max-h-[calc(100dvh-2rem)] overflow-y-auto`; title `break-words`. Stays centered — no bottom-sheet. |
| `Input`      | Text input with consistent border / focus ring.                                                                                                                                                     |
| `ErrorToast` | Error toast (auto-dismiss). Anchored `bottom-[calc(var(--app-bottom-nav-h)+5rem)]` so it stacks above `UndoToast` and floats above the phone tab bar; width clamps to `calc(100vw-2rem)`.           |

## Categorization

| Category          | Folders                                                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout            | `layout/`                                                                                                                                                                                          |
| Navigation        | `layout/Sidebar` (desktop), `layout/BottomNav` (phone tabs), `auth/AuthGuard` (gate)                                                                                                               |
| Form              | `auth/*Form` (incl. `ResetPasswordForm`), `classes/ImportStudentsModal`, `settings/*Modal`, `points/*Modal`, `profile/DeleteAccountModal`, `migration/MigrationWizard`, `behaviors/BehaviorPicker` |
| Display / data    | `home/*Card`, `students/StudentGrid`, `students/StudentPointCard`, `points/ClassPointsBox`, `points/TodaySummary`, `dashboard/DashboardView`, `seating/*`                                          |
| Toolbar / control | `dashboard/BottomToolbar`, `seating/ViewModeToggle`                                                                                                                                                |
| Feedback          | `points/UndoToast`, `ui/ErrorToast`, `common/SyncStatus`, `auth/OfflineGate`                                                                                                                       |
| Primitives        | `ui/Button`, `ui/Dialog`, `ui/Input`, `ui/Modal`                                                                                                                                                   |

## Lazy loading

`App.tsx` uses `React.lazy` for the 5 view-level components: `MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`. `<Suspense>` with a small spinner fallback wraps each view switch. This keeps the initial bundle lean (Auth + Layout + Sidebar + provider stack only).

`DevtoolsGate` lives in its own file `src/components/DevtoolsGate.tsx` (extracted from `main.tsx` so the entry module declares no internal-only components) and is rendered by `main.tsx` as a sibling of `<App />` inside `QueryClientProvider`. It dynamically imports `@tanstack/react-query-devtools` inside a `useEffect` body gated on `import.meta.env.DEV`. Vite replaces the flag with a `false` literal in prod, the entire `if` block dead-codes, and Rollup emits no chunk for the devtools package. CI asserts via `scripts/check-bundle.mjs`.

## Design system patterns (editorial / engineering redesign)

- **Display heading**: `font-display` (Instrument Serif) + `tracking-[-0.02em]` + `text-ink-strong`. Used in ClassPointsBox, Sidebar brand, dashboard headers.
- **Body text**: `text-ink-mid` (default) or `text-ink-strong` (emphasis). Default font is Geist via `body { font-family: var(--font-sans) }`.
- **Numerics**: `font-mono` (JetBrains Mono) + `tabular-nums` + `tracking-[-0.02em]`. Used for point totals.
- **Uppercase tracked labels**: `font-mono text-[10-11px] uppercase tracking-[0.16em-0.18em] text-ink-muted`. Used for "Today / This week" chips, section labels, helper text.
- **Surfaces**: `bg-surface-1` (page), `bg-surface-2` (cards), `bg-surface-3` (hover wash). Borders: `border-hairline`, `border-hairline-strong`. All semantic — flip via `.dark { ... }`.
- **Accent**: `bg-accent-500`, `text-accent-600`, `ring-accent-500/40` (focus rings always with `/40` opacity). Hover transforms: `hover:-translate-y-[1px]` on cards.
- **Cascade aliases**: untouched legacy screens keep `bg-blue-*` / `from-indigo-*` / `from-purple-*` and pick up terracotta automatically.
- **Phone shell (PR #132)**: `md` (48rem) is THE breakpoint. `--app-bottom-nav-h` offsets fixed toasts above the tab bar; `env(safe-area-inset-top/bottom)` clears the status bar / home indicator; `h-dvh`/`100dvh` for viewport-fit; `@media (pointer: coarse)` 16px input floor kills iOS focus-zoom; `.touch-callout-none` on drag surfaces. Grids tighten on phone (`StudentGrid` 4/3/2 columns by card size) and stat tiles shrink (`p-3 sm:p-5`, icons `hidden sm:inline-flex`).

Refer to `_bmad-output/planning-artifacts/ux-design-specification.md` for the reverse-engineered UX spec.
