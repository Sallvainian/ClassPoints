# Component Inventory

_Generated 2026-04-29 (exhaustive full rescan)._

46 React component files under `src/components/`, organized by feature folder. Twelve component folders have historical sibling `index.ts` barrels (`auth`, `behaviors`, `classes`, `dashboard`, `home`, `layout`, `points`, `profile`, `seating`, `settings`, `students`, `ui`); `common` and `migration` do not. Components MUST use named exports (HMR stability under `react-refresh/only-export-components`). The single exception is `App.tsx` (default export); do NOT add new default exports.

A file exporting a component should export ONLY components — `allowConstantExport: true` permits constants alongside, but no helper functions or types. Move helpers/types to dedicated files: cross-feature → `src/utils/`, feature-scoped → sibling `*.utils.ts`, types → `src/types/` or sibling `*.types.ts`.

## Auth

`src/components/auth/`

| Component            | Purpose                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AuthGuard`          | Wraps children. Renders `AuthPage` when no user; otherwise children. Shows a loading state during auth init. |
| `AuthPage`           | Tab between Login / Signup / ForgotPassword.                                                                 |
| `LoginForm`          | Email + password form. Calls `useAuth().signIn`.                                                             |
| `SignupForm`         | Email + password (+ optional name). Calls `useAuth().signUp`.                                                |
| `ForgotPasswordForm` | Email-only form. Calls `useAuth().resetPassword`.                                                            |

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

| Component    | Purpose                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| `SyncStatus` | Live indicator of Supabase realtime connection. Pinned bottom of screen via `App.tsx`. |

## Dashboard (in-class workflow)

`src/components/dashboard/`

| Component       | Purpose                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardView` | The main "I'm in class right now" surface. Renders student grid OR seating chart, BottomToolbar, modals, undo toast, error toast. Called from `App.tsx` when view == 'dashboard'. |
| `BottomToolbar` | Toolbar pinned to the bottom of `DashboardView` — quick-award buttons, view-mode toggle, selection-mode toggle, settings shortcut. Editorial-redesign Phase 2 surface.            |

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

| Component | Purpose                                                                                                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Layout`  | Top-level chrome: `<aside>` Sidebar + `<main>` content. `bg-surface-1`, `text-ink-strong`.                                                                                                                                                |
| `Sidebar` | Editorial-redesign sidebar. Terracotta dot + Instrument Serif "ClassPoints" title + uppercase tracked "Behavior · K-12" subtitle. Dashboard nav button + classrooms list (with create modal) + footer (theme toggle + profile + signout). |

## Migration

`src/components/migration/`

| Component         | Purpose                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `MigrationWizard` | One-time localStorage → Supabase migration wizard. Lazy-loaded. Shown when `hasLocalStorageData()` returns true on app boot. |

## Points (the core in-class workflow)

`src/components/points/`

| Component          | Purpose                                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AwardPointsModal` | Award points to a single student. Picks behavior via `BehaviorPicker`, supports note, calls `awardPoints` wrapper.                                                                                                                                                         |
| `ClassAwardModal`  | Award points to the entire class. Calls `awardClassPoints` wrapper (silently filters per-student failures — see anti-pattern audit cluster #2).                                                                                                                            |
| `MultiAwardModal`  | Award points to a multi-select subset of students. Calls `awardPointsToStudents` wrapper.                                                                                                                                                                                  |
| `ClassPointsBox`   | **NEW (commit 350c7c9)** — Class-total card promoted to its own surface. Tap to open `ClassAwardModal`. Displays total + breakdown (positive / negative) + today + this-week chips. Editorial design: Instrument Serif heading, JetBrains Mono numerics, hairline divider. |
| `TodaySummary`     | Today's-points summary panel.                                                                                                                                                                                                                                              |
| `UndoToast`        | 10-second undo toast. Polls `getRecentUndoableAction()` from `AppContext` on a 1Hz interval. Shows different copy for batch vs single-student undo.                                                                                                                        |

## Profile

`src/components/profile/`

| Component              | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `ProfileView`          | User profile + settings (sign out, delete account, etc.). |
| `DeleteClassroomModal` | Confirmation modal for classroom deletion.                |

## Seating

`src/components/seating/`

| Component            | Purpose                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `SeatingChartView`   | Read-only seating chart view (used in `DashboardView` when `viewMode == 'seating'`).              |
| `SeatingChartEditor` | Edit mode — add/move/rotate groups, place room elements, manage student assignments, save preset. |
| `SeatingChartCanvas` | Pan/zoom + grid + drop targets. Shared between view and editor.                                   |
| `SeatCard`           | One seat — student name + avatar color + tap to award points.                                     |
| `TableGroup`         | A group of 4 seats arranged as a table. Drag handle + rotate button (editor only).                |
| `RoomElementDisplay` | Renders a teacher_desk / door / window / countertop / sink element.                               |
| `EmptyChartPrompt`   | Empty-state prompt when no seating chart exists yet.                                              |
| `ViewModeToggle`     | Toggle between alphabetical and seating view modes.                                               |

## Settings

`src/components/settings/`

| Component            | Purpose                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ClassSettingsView`  | Class settings screen (view == 'settings'). Add/remove students, behaviors, sound, layout presets, reset/clear flows. |
| `AdjustPointsModal`  | Set a student's total to a target value (creates a delta `point_transactions` row via `useAdjustStudentPoints`).      |
| `ResetPointsModal`   | Confirm reset of an entire classroom's points.                                                                        |
| `SoundSettings`      | Inline sound settings panel.                                                                                          |
| `SoundSettingsModal` | Modal-form sound settings (used from `DashboardView`).                                                                |

## Students

`src/components/students/`

| Component          | Purpose                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StudentGrid`      | Grid of `StudentPointCard`s. Card sizing controlled by `useDisplaySettings().cardSize`. Used in `DashboardView` when `viewMode == 'alphabetical'`. |
| `StudentPointCard` | One student tile — avatar + name + (optional) point total + tap to award. Selection-mode aware.                                                    |

## UI primitives

`src/components/ui/`

| Component    | Purpose                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `Button`     | Primary / secondary / ghost button variants. Editorial-redesign aware (terracotta accent for primary). |
| `Dialog`     | Chrome-only dialog primitive: overlay, ARIA, escape-to-close, scroll lock, body owner controls markup. |
| `Modal`      | Title-and-body modal primitive with overlay, ARIA, escape-to-close, and scroll lock.                   |
| `Input`      | Text input with consistent border / focus ring.                                                        |
| `ErrorToast` | Top-of-screen error toast (auto-dismiss).                                                              |

## Categorization

| Category          | Folders                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout            | `layout/`                                                                                                                                                 |
| Navigation        | `layout/Sidebar` (classroom list), `auth/AuthGuard` (gate)                                                                                                |
| Form              | `auth/*Form`, `classes/ImportStudentsModal`, `settings/*Modal`, `points/*Modal`, `migration/MigrationWizard`, `behaviors/BehaviorPicker`                  |
| Display / data    | `home/*Card`, `students/StudentGrid`, `students/StudentPointCard`, `points/ClassPointsBox`, `points/TodaySummary`, `dashboard/DashboardView`, `seating/*` |
| Toolbar / control | `dashboard/BottomToolbar`, `seating/ViewModeToggle`                                                                                                       |
| Feedback          | `points/UndoToast`, `ui/ErrorToast`, `common/SyncStatus`                                                                                                  |
| Primitives        | `ui/Button`, `ui/Dialog`, `ui/Input`, `ui/Modal`                                                                                                          |

## Lazy loading

`App.tsx` uses `React.lazy` for the 5 view-level components: `MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`. `<Suspense>` with a small spinner fallback wraps each view switch. This keeps the initial bundle lean (Auth + Layout + Sidebar + provider stack only).

`<DevtoolsGate />` (in `src/main.tsx`) dynamically imports `@tanstack/react-query-devtools` inside a `useEffect` body gated on `import.meta.env.DEV`. Vite replaces the flag with a `false` literal in prod, the entire `if` block dead-codes, and Rollup emits no chunk for the devtools package. CI asserts via `scripts/check-bundle.mjs`.

## Design system patterns (editorial / engineering redesign)

- **Display heading**: `font-display` (Instrument Serif) + `tracking-[-0.02em]` + `text-ink-strong`. Used in ClassPointsBox, Sidebar brand, dashboard headers.
- **Body text**: `text-ink-mid` (default) or `text-ink-strong` (emphasis). Default font is Geist via `body { font-family: var(--font-sans) }`.
- **Numerics**: `font-mono` (JetBrains Mono) + `tabular-nums` + `tracking-[-0.02em]`. Used for point totals.
- **Uppercase tracked labels**: `font-mono text-[10-11px] uppercase tracking-[0.16em-0.18em] text-ink-muted`. Used for "Today / This week" chips, section labels, helper text.
- **Surfaces**: `bg-surface-1` (page), `bg-surface-2` (cards), `bg-surface-3` (hover wash). Borders: `border-hairline`, `border-hairline-strong`. All semantic — flip via `.dark { ... }`.
- **Accent**: `bg-accent-500`, `text-accent-600`, `ring-accent-500/40` (focus rings always with `/40` opacity). Hover transforms: `hover:-translate-y-[1px]` on cards.
- **Cascade aliases**: untouched legacy screens keep `bg-blue-*` / `from-indigo-*` / `from-purple-*` and pick up terracotta automatically.

Refer to `_bmad-output/planning-artifacts/ux-design-specification.md` for the reverse-engineered UX spec.
