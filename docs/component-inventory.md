# Component Inventory

_Last generated: 2026-04-21 — Source of truth: `src/components/**/*.tsx`._

**45 components** across **14 feature folders**. All components use named exports (per project convention). All components have Tailwind dark-mode classes. Feature folders have barrel `index.ts` files.

> Prop signatures below are summarized — read the component file for the exact TypeScript interface.

---

## `auth/` — Authentication flow (5 components)

Auth wraps the whole app. `AuthGuard` short-circuits render until the session exists; `AuthPage` is only visible to unauthenticated users.

| Component            | Purpose                                                                           | Hooks                 |
| -------------------- | --------------------------------------------------------------------------------- | --------------------- |
| `AuthGuard`          | Wraps app; renders `AuthPage` if no session, otherwise `children`.                | `useAuth`             |
| `AuthPage`           | Container switching between login / signup / forgot-password subforms.            | `useState`            |
| `LoginForm`          | Email + password → `signIn`.                                                      | `useAuth`, `useState` |
| `SignupForm`         | Name + email + password → `signUp` (display name goes into `user_metadata.name`). | `useAuth`, `useState` |
| `ForgotPasswordForm` | Email → `resetPassword` (sends recovery email).                                   | `useAuth`, `useState` |

---

## `behaviors/` — Behavior selection UI (2 components)

| Component        | Purpose                                                                 | Hooks     |
| ---------------- | ----------------------------------------------------------------------- | --------- |
| `BehaviorPicker` | Grid of behavior buttons grouped by category. Consumed by award modals. | `useMemo` |
| `BehaviorButton` | Clickable behavior tile (icon + name + points). Presentational.         | none      |

---

## `classes/` — Classroom-scoped modals (1 component)

| Component             | Purpose                                                                                                             | Hooks      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| `ImportStudentsModal` | Drag-drop import accepting JSON/CSV/plain text; previews students before commit. Uses `src/utils/studentParser.ts`. | `useState` |

---

## `common/` — Cross-cutting UI (1 component)

| Component    | Purpose                                                                                                                       | Hooks |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----- |
| `SyncStatus` | Floating badge showing realtime connection status / offline indicator. Mounted once in `App.tsx` at the root of `AppContent`. | —     |

> Note: `SyncStatus` is a singleton — only one instance mounts. It does not re-render per route.

---

## `dashboard/` — Per-classroom dashboard (2 components)

| Component       | Purpose                                                                                                                                                                        | Hooks                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `DashboardView` | The classroom screen: student grid OR seating chart, ClassPointsBox, TodaySummary sidebar, all award modals. Entry point for per-classroom work. Lazy-imported from `App.tsx`. | `useApp`, `useDisplaySettings`, `useState`, `useCallback`, `useRef` |
| `BottomToolbar` | Bulk-selection footer — student count + "Award" / "Randomize" actions. Appears when 1+ students are multi-selected.                                                            | —                                                                   |

---

## `home/` — Teacher home screen (4 components)

Home is what a teacher sees immediately after logging in.

| Component          | Purpose                                                                                        | Hooks                                      |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `TeacherDashboard` | The home page: stats strip + classroom cards grid + leaderboard. Lazy-imported from `App.tsx`. | `useApp`, `useCallback`, `useState`        |
| `ClassroomCard`    | Tappable classroom tile: name, student count, totals.                                          | —                                          |
| `StatsCard`        | Presentational metric tile (icon + label + value + optional sub-value).                        | —                                          |
| `LeaderboardCard`  | Top-N students list with rotating behavior category (uses `useRotatingCategory`).              | `useApp`, `useRotatingCategory`, `useMemo` |

---

## `layout/` — App chrome (2 components)

| Component | Purpose                                                                        | Hooks                                       |
| --------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| `Layout`  | Sidebar + main content area wrapper.                                           | —                                           |
| `Sidebar` | Classroom list, create-classroom action, profile link, theme toggle, sign-out. | `useApp`, `useAuth`, `useTheme`, `useState` |

---

## `migration/` — Legacy localStorage migration (1 component)

| Component         | Purpose                                                                                                                                                                                                                            | Hooks                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `MigrationWizard` | Multi-step wizard (`check → preview → migrating → complete/error`) for ingesting legacy `classroom-points-data` from localStorage into Supabase. One-time flow: `hasLocalStorageData()` gates entry from `App.tsx`. Lazy-imported. | `useState`, `useCallback` |

---

## `points/` — Point-awarding flows (6 components)

The heart of the app. One, many, or whole-class awards; plus a 10-second undo toast.

| Component          | Purpose                                                                                                                                               | Hooks                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `AwardPointsModal` | Award points to **one** selected student.                                                                                                             | `useSoundEffects`, `useState`            |
| `MultiAwardModal`  | Award points to **many** selected students (atomic batch insert with shared `batch_id`).                                                              | `useSoundEffects`, `useState`, `useMemo` |
| `ClassAwardModal`  | Award points to **all** students in classroom (atomic batch).                                                                                         | `useSoundEffects`, `useState`            |
| `ClassPointsBox`   | Classroom total tile (lifetime points + positive/negative breakdown), click → open class-award modal.                                                 | `useApp`, `useMemo`                      |
| `TodaySummary`     | Recent-transactions feed (icon + student + points + time ago).                                                                                        | `useApp`, `useMemo`                      |
| `UndoToast`        | Post-award countdown toast with Undo button. Disappears after 10s (see `UNDO_WINDOW_MS` in `AppContext`). Handles both single-student and batch undo. | `useEffect`, `useState`                  |

---

## `profile/` — Account + classroom admin (2 components)

| Component              | Purpose                                                                                                  | Hooks                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ProfileView`          | Tabbed view: user profile editing, password change, classroom management (rename/delete). Lazy-imported. | `useAuth`, `useApp`, `useState`, `useCallback` |
| `DeleteClassroomModal` | Destructive-action confirmation — user must type the classroom name to confirm.                          | `useState`                                     |

---

## `seating/` — Seating chart system (8 components)

A sub-app. View-mode renders students on a canvas; edit-mode adds drag-drop groups and room elements.

| Component            | Purpose                                                                                                                                   | Hooks                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SeatingChartView`   | Container for seating-chart UI. Zoom, view/edit mode toggle, preset management. Lazy-imports the editor.                                  | `useSeatingChart`, `useLayoutPresets`, `useState`, `useRef`, `useEffect`, `useCallback` |
| `SeatingChartEditor` | Full-screen editor: drag `TableGroup`s + `RoomElementDisplay`s around the canvas, resize/rotate, save/load presets. Uses `@dnd-kit/core`. | `useSeatingChart`, `useLayoutPresets`, `useState`, `useCallback`, `useRef`, `useMemo`   |
| `SeatingChartCanvas` | Read-only rendering of a chart (used in DashboardView when view mode is "seating").                                                       | `useMemo`                                                                               |
| `TableGroup`         | 2x2 seat cluster with letter badge. `React.memo`'d. Handles drop targets in edit mode.                                                    | —                                                                                       |
| `SeatCard`           | Individual seat. Optional point breakdown badges.                                                                                         | —                                                                                       |
| `RoomElementDisplay` | Renders teacher desk / door / window / countertop / sink with type-specific styling.                                                      | —                                                                                       |
| `EmptyChartPrompt`   | Zero-state shown before any chart exists — "Create chart" or "Import preset" actions.                                                     | —                                                                                       |
| `ViewModeToggle`     | Toggle between alphabetical and seating view modes (persisted via `useDisplaySettings`).                                                  | —                                                                                       |

---

## `settings/` — Per-classroom settings (5 components)

| Component            | Purpose                                                                                                          | Hooks                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `ClassSettingsView`  | Classroom settings screen (name, behavior management, danger zone). Lazy-imported from `App.tsx`.                | `useApp`, `useState`, `useCallback` |
| `AdjustPointsModal`  | Set a student's point total to a target value — creates a "Manual Adjustment" transaction with the signed delta. | `useState`, `useEffect`             |
| `ResetPointsModal`   | Destructive-action modal: deletes all transactions for a classroom (DB trigger resets student totals).           | `useState`                          |
| `SoundSettings`      | Toggle + volume slider — calls into `SoundContext.updateSettings`.                                               | `useState`                          |
| `SoundSettingsModal` | Modal wrapper around `SoundSettings` plus per-category sound pickers.                                            | `useState`, `useCallback`           |

---

## `students/` — Student list + cards (2 components)

| Component          | Purpose                                                             | Hooks                 |
| ------------------ | ------------------------------------------------------------------- | --------------------- |
| `StudentGrid`      | Responsive grid of student cards with filter/sort controls.         | `useState`, `useMemo` |
| `StudentPointCard` | Student tile: avatar, name, point total, optional breakdown badges. | —                     |

---

## `ui/` — Design-system primitives (4 components)

| Component    | Purpose                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- |
| `Button`     | Variants (`primary` / `secondary` / `ghost` / `danger`) and sizes (`sm` / `md` / `lg`). |
| `Input`      | Text input with optional label.                                                         |
| `Modal`      | Base modal: backdrop + title + children. All feature modals wrap this.                  |
| `ErrorToast` | Toast for displaying caught errors with a dismiss affordance.                           |

> Do **not** add component-level barrels (e.g., re-exporting from `src/components/index.ts`) — this hurts HMR behavior with `eslint-plugin-react-refresh`. The hook barrel (`src/hooks/index.ts`) is the intentional exception.

---

## Cross-Cutting Observations

### Patterns that appear repeatedly

1. **Modal signature.** All modals follow `{ isOpen, onClose, onConfirm | onAward | onImport, ...data }`. New modals should match.
2. **Typed destructive confirmation.** `DeleteClassroomModal` and `ResetPointsModal` require explicit typed confirmation (name or keyword) before enabling the destructive button.
3. **`React.memo` on leaf cards.** `ClassroomCard`, `LeaderboardCard` (plus its internal `LeaderboardRow`), `StatsCard`, `RoomElementDisplay`, `SeatCard`, `TableGroup`, `BottomToolbar`, `StudentPointCard` are memoized. Parent containers are not. Pass stable refs (via `useCallback`) from containers to these children.
4. **Named exports, no defaults.** This aligns with `eslint-plugin-react-refresh`'s `only-export-components` rule. Default exports would break HMR.
5. **Dark mode class pairs.** Every surface uses `bg-…` + `dark:bg-…` and `text-…` + `dark:text-…`. New components should follow this.

### Lazy-loaded boundaries (in `App.tsx`)

Five components are behind `React.lazy`:

- `MigrationWizard`
- `DashboardView`
- `ClassSettingsView`
- `ProfileView`
- `TeacherDashboard`

Plus one within `SeatingChartView`:

- `SeatingChartEditor`

These carry chunking value — the editor is only needed in edit mode; the migration wizard is only shown to users with legacy local data. `Suspense` fallbacks use a spinner (`ViewFallback` in `App.tsx`).

### Drag-and-drop

Only used in `seating/`. `@dnd-kit/core` + `@dnd-kit/utilities`. Transforms use inline `style={{ transform }}` — this is the one legitimate exception to "no inline styles" in the codebase. Everything else is Tailwind.

### Potentially misplaced components

- `SyncStatus` in `common/` could arguably live in `layout/` — it's a persistent chrome element. Not worth moving until another true "common" component needs a home.
- `MigrationWizard` sits in its own folder for a one-shot flow. Acceptable; revisit if another "wizard" style flow is added.

### Hook consumption map (which features use which hooks)

```
useApp         → dashboard, home, layout (Sidebar), points (ClassPointsBox, TodaySummary), profile, settings
useAuth        → auth/*, layout (Sidebar), profile
useTheme       → layout (Sidebar)
useSeatingChart→ seating/
useLayoutPresets → seating/
useSoundEffects→ points/*Modal*
useDisplaySettings → dashboard (DashboardView)
useRotatingCategory → home (LeaderboardCard)
```

No component directly imports `AuthContext` / `SoundContext` / `AppContext` — everything goes through a facade hook, per project convention.
