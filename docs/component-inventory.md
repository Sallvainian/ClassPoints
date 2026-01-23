# Component Inventory - ClassPoints

## Overview

ClassPoints has **53 React components** organized into 12 feature domains. All components follow the functional component pattern with TypeScript props interfaces.

## Component Categories

### Authentication (5 components)

| Component            | Path                                   | Description                             |
| -------------------- | -------------------------------------- | --------------------------------------- |
| `AuthPage`           | components/auth/AuthPage.tsx           | Tab-based auth container (login/signup) |
| `LoginForm`          | components/auth/LoginForm.tsx          | Email/password login form               |
| `SignupForm`         | components/auth/SignupForm.tsx         | Registration form                       |
| `ForgotPasswordForm` | components/auth/ForgotPasswordForm.tsx | Password reset request                  |
| `AuthGuard`          | components/auth/AuthGuard.tsx          | Route protection wrapper                |

### Layout (2 components)

| Component | Path                          | Description                   |
| --------- | ----------------------------- | ----------------------------- |
| `Layout`  | components/layout/Layout.tsx  | Main app layout with sidebar  |
| `Sidebar` | components/layout/Sidebar.tsx | Navigation and classroom list |

### Home/Dashboard (4 components)

| Component          | Path                                 | Description                            |
| ------------------ | ------------------------------------ | -------------------------------------- |
| `TeacherDashboard` | components/home/TeacherDashboard.tsx | Main teacher view with classroom cards |
| `ClassroomCard`    | components/home/ClassroomCard.tsx    | Classroom summary card                 |
| `LeaderboardCard`  | components/home/LeaderboardCard.tsx  | Top students display                   |
| `StatsCard`        | components/home/StatsCard.tsx        | Statistics summary                     |

### Classroom Dashboard (2 components)

| Component       | Path                                   | Description           |
| --------------- | -------------------------------------- | --------------------- |
| `DashboardView` | components/dashboard/DashboardView.tsx | Active classroom view |
| `BottomToolbar` | components/dashboard/BottomToolbar.tsx | Quick action toolbar  |

### Students (2 components)

| Component          | Path                                     | Description                         |
| ------------------ | ---------------------------------------- | ----------------------------------- |
| `StudentGrid`      | components/students/StudentGrid.tsx      | Student card grid layout            |
| `StudentPointCard` | components/students/StudentPointCard.tsx | Individual student card with points |

### Behaviors (2 components)

| Component        | Path                                    | Description                   |
| ---------------- | --------------------------------------- | ----------------------------- |
| `BehaviorButton` | components/behaviors/BehaviorButton.tsx | Single behavior action button |
| `BehaviorPicker` | components/behaviors/BehaviorPicker.tsx | Behavior selection grid       |

### Points (6 components)

| Component          | Path                                   | Description                   |
| ------------------ | -------------------------------------- | ----------------------------- |
| `AwardPointsModal` | components/points/AwardPointsModal.tsx | Single student point award    |
| `ClassAwardModal`  | components/points/ClassAwardModal.tsx  | Class-wide point award        |
| `MultiAwardModal`  | components/points/MultiAwardModal.tsx  | Multi-student selection award |
| `ClassPointsBox`   | components/points/ClassPointsBox.tsx   | Class total display           |
| `TodaySummary`     | components/points/TodaySummary.tsx     | Daily point summary           |
| `UndoToast`        | components/points/UndoToast.tsx        | Undo notification toast       |

### Seating Chart (8 components)

| Component            | Path                                      | Description                  |
| -------------------- | ----------------------------------------- | ---------------------------- |
| `SeatingChartView`   | components/seating/SeatingChartView.tsx   | Main seating chart container |
| `SeatingChartCanvas` | components/seating/SeatingChartCanvas.tsx | Draggable canvas area        |
| `SeatingChartEditor` | components/seating/SeatingChartEditor.tsx | Edit mode with tools         |
| `TableGroup`         | components/seating/TableGroup.tsx         | Grouped seating arrangement  |
| `SeatCard`           | components/seating/SeatCard.tsx           | Individual seat display      |
| `RoomElementDisplay` | components/seating/RoomElementDisplay.tsx | Static room elements         |
| `ViewModeToggle`     | components/seating/ViewModeToggle.tsx     | Grid/seating view switch     |
| `EmptyChartPrompt`   | components/seating/EmptyChartPrompt.tsx   | Empty state call-to-action   |

### Settings (5 components)

| Component            | Path                                       | Description                  |
| -------------------- | ------------------------------------------ | ---------------------------- |
| `ClassSettingsView`  | components/settings/ClassSettingsView.tsx  | Classroom settings page      |
| `SoundSettings`      | components/settings/SoundSettings.tsx      | Sound preferences form       |
| `SoundSettingsModal` | components/settings/SoundSettingsModal.tsx | Sound settings modal wrapper |
| `AdjustPointsModal`  | components/settings/AdjustPointsModal.tsx  | Manual point adjustment      |
| `ResetPointsModal`   | components/settings/ResetPointsModal.tsx   | Reset confirmation dialog    |

### Profile (2 components)

| Component              | Path                                        | Description         |
| ---------------------- | ------------------------------------------- | ------------------- |
| `ProfileView`          | components/profile/ProfileView.tsx          | User profile page   |
| `DeleteClassroomModal` | components/profile/DeleteClassroomModal.tsx | Delete confirmation |

### Classes (1 component)

| Component             | Path                                       | Description         |
| --------------------- | ------------------------------------------ | ------------------- |
| `ImportStudentsModal` | components/classes/ImportStudentsModal.tsx | Bulk student import |

### UI Primitives (4 components)

| Component    | Path                         | Description                 |
| ------------ | ---------------------------- | --------------------------- |
| `Button`     | components/ui/Button.tsx     | Styled button with variants |
| `Input`      | components/ui/Input.tsx      | Styled text input           |
| `Modal`      | components/ui/Modal.tsx      | Modal dialog wrapper        |
| `ErrorToast` | components/ui/ErrorToast.tsx | Error notification          |

### Common (2 components)

| Component         | Path                                     | Description                       |
| ----------------- | ---------------------------------------- | --------------------------------- |
| `SyncStatus`      | components/common/SyncStatus.tsx         | Online/offline indicator          |
| `MigrationWizard` | components/migration/MigrationWizard.tsx | LocalStorage → Supabase migration |

### Root Components (2 components)

| Component | Path     | Description                            |
| --------- | -------- | -------------------------------------- |
| `App`     | App.tsx  | Root component with provider hierarchy |
| `main`    | main.tsx | React DOM entry point                  |

## Component Patterns

### Props Interface Pattern

```tsx
interface ComponentProps {
  prop: Type;
  optional?: Type;
  onAction: (value: Type) => void;
}

export function Component({ prop, optional, onAction }: ComponentProps) {
  // Hooks at top
  const { data } = useApp();

  // Event handlers
  const handleClick = () => onAction(data);

  // Early returns for loading/error
  if (!data) return null;

  // Main render
  return <div>...</div>;
}
```

### State Access Pattern

All components access application state through `useApp()`:

```tsx
export function StudentGrid() {
  const { students, awardPoints, activeClassroom } = useApp();
  // ...
}
```

## Component Dependencies

### High-Level Component Graph

```
App
├── AuthProvider
│   └── AuthGuard
│       └── HybridAppProvider
│           └── Layout
│               ├── Sidebar
│               └── [Routes]
│                   ├── TeacherDashboard
│                   │   ├── ClassroomCard
│                   │   ├── LeaderboardCard
│                   │   └── StatsCard
│                   ├── DashboardView
│                   │   ├── StudentGrid
│                   │   │   └── StudentPointCard
│                   │   ├── BottomToolbar
│                   │   ├── AwardPointsModal
│                   │   │   └── BehaviorPicker
│                   │   │       └── BehaviorButton
│                   │   └── UndoToast
│                   ├── SeatingChartView
│                   │   ├── SeatingChartCanvas
│                   │   │   ├── TableGroup
│                   │   │   │   └── SeatCard
│                   │   │   └── RoomElementDisplay
│                   │   └── ViewModeToggle
│                   └── ClassSettingsView
│                       ├── SoundSettings
│                       ├── AdjustPointsModal
│                       └── ResetPointsModal
```

## Styling

All components use **Tailwind CSS** for styling:

```tsx
<div className="p-4 bg-white rounded-lg shadow-sm">
  <h2 className="text-lg font-semibold text-gray-900">Title</h2>
</div>
```

**No inline styles** - prefer Tailwind utility classes.

## Testing

Component tests are located in `src/test/` using Vitest and React Testing Library:

| Test File                         | Coverage                   |
| --------------------------------- | -------------------------- |
| `TeacherDashboard.test.tsx`       | TeacherDashboard component |
| `useRotatingCategory.test.ts`     | Behavior rotation hook     |
| `sounds.test.ts`                  | Sound playback utilities   |
| `leaderboardCalculations.test.ts` | Leaderboard logic          |

## Accessibility

Components follow basic accessibility patterns:

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management in modals

## Performance Considerations

- **React.memo** for frequently re-rendered cards (StudentPointCard)
- **useMemo** for computed values (sorted students, filtered behaviors)
- **useCallback** for event handlers passed to children
- Grid virtualization not yet implemented (suitable for <100 students)
