# ClassPoints Component Inventory

_Generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

## Summary

The UI has 45 TSX component files across 14 feature folders under `src/components/`.

| Folder      | Count | Components                                                                                                                                           |
| ----------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`      |     5 | `AuthGuard`, `AuthPage`, `ForgotPasswordForm`, `LoginForm`, `SignupForm`                                                                             |
| `behaviors` |     2 | `BehaviorButton`, `BehaviorPicker`                                                                                                                   |
| `classes`   |     1 | `ImportStudentsModal`                                                                                                                                |
| `common`    |     1 | `SyncStatus`                                                                                                                                         |
| `dashboard` |     2 | `DashboardView`, `BottomToolbar`                                                                                                                     |
| `home`      |     4 | `ClassroomCard`, `LeaderboardCard`, `StatsCard`, `TeacherDashboard`                                                                                  |
| `layout`    |     2 | `Layout`, `Sidebar`                                                                                                                                  |
| `migration` |     1 | `MigrationWizard`                                                                                                                                    |
| `points`    |     6 | `AwardPointsModal`, `ClassAwardModal`, `ClassPointsBox`, `MultiAwardModal`, `TodaySummary`, `UndoToast`                                              |
| `profile`   |     2 | `DeleteClassroomModal`, `ProfileView`                                                                                                                |
| `seating`   |     8 | `EmptyChartPrompt`, `RoomElementDisplay`, `SeatCard`, `SeatingChartCanvas`, `SeatingChartEditor`, `SeatingChartView`, `TableGroup`, `ViewModeToggle` |
| `settings`  |     5 | `AdjustPointsModal`, `ClassSettingsView`, `ResetPointsModal`, `SoundSettings`, `SoundSettingsModal`                                                  |
| `students`  |     2 | `StudentGrid`, `StudentPointCard`                                                                                                                    |
| `ui`        |     4 | `Button`, `ErrorToast`, `Input`, `Modal`                                                                                                             |

## Top-Level Views

`src/App.tsx` lazy-loads these named exports:

- `MigrationWizard`
- `DashboardView`
- `ClassSettingsView`
- `ProfileView`
- `TeacherDashboard`

The active view is local React state. Non-migration views persist through `app:view`.

## Auth Components

| Component            | Role                                                | Primary dependencies    |
| -------------------- | --------------------------------------------------- | ----------------------- |
| `AuthGuard`          | Displays auth page until a user is signed in        | `useAuth`               |
| `AuthPage`           | Switches between login/signup/forgot-password flows | local state             |
| `LoginForm`          | Sign-in form                                        | `useAuth.signIn`        |
| `SignupForm`         | Sign-up form                                        | `useAuth.signUp`        |
| `ForgotPasswordForm` | Password reset request                              | `useAuth.resetPassword` |

## Home Components

| Component          | Role                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `TeacherDashboard` | Teacher home screen; aggregate stats, leaderboard, classroom cards |
| `ClassroomCard`    | Clickable classroom summary                                        |
| `StatsCard`        | Visual aggregate metric                                            |
| `LeaderboardCard`  | Rotating leaderboard categories across students/classes            |

`TeacherDashboard` still consumes `useApp()` for classrooms and classroom creation.

## Dashboard Components

| Component       | Role                                      |
| --------------- | ----------------------------------------- |
| `DashboardView` | Main active-classroom interaction surface |
| `BottomToolbar` | Mobile/compact action toolbar             |

`DashboardView` owns selection mode, selected students, modal open state, undo toast state,
activity visibility, and operation errors. It switches between alphabetical and seating views via
`useDisplaySettings`.

## Point Components

| Component          | Role                                  |
| ------------------ | ------------------------------------- |
| `AwardPointsModal` | Award a behavior to one student       |
| `ClassAwardModal`  | Award a behavior to every student     |
| `MultiAwardModal`  | Award a behavior to selected students |
| `ClassPointsBox`   | Display class-level points            |
| `TodaySummary`     | Recent transaction list               |
| `UndoToast`        | Short-lived undo affordance           |

The three award modals use `useSoundEffects` and legacy `useApp()` award wrappers.

## Seating Components

| Component            | Role                                                        |
| -------------------- | ----------------------------------------------------------- |
| `SeatingChartView`   | View/edit mode wrapper, zoom/fit controls, lazy editor load |
| `SeatingChartEditor` | Full editor surface; 1350 lines                             |
| `SeatingChartCanvas` | Read/display canvas                                         |
| `TableGroup`         | Draggable/droppable table group                             |
| `SeatCard`           | Seat display with student assignment                        |
| `RoomElementDisplay` | Room object display                                         |
| `EmptyChartPrompt`   | First-chart prompt                                          |
| `ViewModeToggle`     | Alphabetical/seating switch                                 |

Seating uses `@dnd-kit` and runtime inline styles for transforms, positions, dimensions, and canvas
scale. `SeatingChartEditor` is the largest UI file and is a good future split candidate.

## Settings And Profile

| Component              | Role                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `ClassSettingsView`    | Classroom name, student add/import/edit/remove, adjust/reset points        |
| `AdjustPointsModal`    | Set a student's target points by inserting a manual adjustment transaction |
| `ResetPointsModal`     | Confirm classroom-wide point reset                                         |
| `SoundSettings`        | Sound preference editor                                                    |
| `SoundSettingsModal`   | Floating sound settings entry/modal                                        |
| `ProfileView`          | Password update, classroom deletion management                             |
| `DeleteClassroomModal` | Delete confirmation                                                        |

`ClassSettingsView` uses shared `Modal`, `Button`, and `Input` primitives for several dialogs, while
some older point/sound modals still reimplement modal chrome.

## Shared UI

| Component    | Role                                                     |
| ------------ | -------------------------------------------------------- |
| `Button`     | Variant/size button primitive                            |
| `Input`      | Labeled input with error display                         |
| `Modal`      | Shared dialog chrome with escape/backdrop close behavior |
| `ErrorToast` | Timed dismissible error display                          |

Prefer these primitives for new UI. Avoid adding new component-folder barrels; existing barrels are
historical except the deliberate `src/hooks/index.ts` barrel.

## Primary Hook Consumption

| Area      | Hook/context dependencies                                  |
| --------- | ---------------------------------------------------------- |
| Auth      | `useAuth`                                                  |
| Home      | `useApp`, `useAuth`, `useRotatingCategory`                 |
| Layout    | `useApp`, `useAuth`, `useTheme`                            |
| Dashboard | `useApp`, `useDisplaySettings`                             |
| Points    | `useApp`, `useSoundEffects`                                |
| Settings  | `useApp`, `useTheme`, `useSoundContext`, `useSoundEffects` |
| Seating   | `useSeatingChart`, `useLayoutPresets`, `useTheme`          |
| Students  | Props plus `CardSize`; avatar color helpers                |

## Implementation Notes

- Component files use named exports except the root `App` default export.
- Hooks are expected before early returns.
- Static styling is Tailwind; inline styles appear for runtime-calculated canvas, avatar, progress,
  and DnD values.
- `lucide-react` is the icon dependency, though several older controls still use text or emoji.
- `ImportStudentsModal` and `MigrationWizard` still contain `key={index}` style list keys in
  warning/error rendering paths.
