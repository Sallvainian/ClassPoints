# Tech Spec: Student Grid Enhancements

**Author:** Claude Code
**Date:** 2025-12-09
**Status:** Completed

## Overview

Three enhancements to the student grid for better classroom display and bulk operations:

1. **Multi-select Students** - Select multiple students to award points at once
2. **Card Size Options** - Adjust card sizes for different screen sizes
3. **Point Totals on Cards** - Show positive/negative breakdowns on student cards

## Problem Statement

- **Multi-select**: Currently, teachers must click each student individually to award points. For class-wide behaviors (line up quietly, group work), this is tedious with 25+ students.
- **Card Size**: Fixed card sizes don't work well on all screens. Teachers need larger cards when projecting for students to see their names.
- **Point Totals**: Teachers want to see at-a-glance breakdown of positive vs negative points per student.

## Solution Design

### Feature 1: Multi-select Students

**User Flow:**
1. Teacher clicks "Select" button in dashboard header
2. Student cards show checkboxes; clicking toggles selection
3. Header shows "X selected" count with "Award Points" and "Cancel" buttons
4. "Award Points" opens modal → select behavior → awards to ALL selected students
5. Single undo removes the entire batch

**Technical Approach:**
- Add selection state management to `DashboardView`
- Pass selection props down to `StudentGrid` and `StudentPointCard`
- Create new `MultiAwardModal` component (similar to `ClassAwardModal`)
- Use existing `batch_id` pattern for grouped transactions

### Feature 2: Card Size Options

**User Flow:**
1. Teacher sees size toggle buttons [S] [M] [L] in dashboard header
2. Clicking changes card/grid sizing immediately
3. Setting persists per device (localStorage)

**Size Definitions:**
| Size | Columns (responsive) | Avatar | Font |
|------|---------------------|--------|------|
| Small | 3→4→6→8 | 40px | xs |
| Medium | 2→3→4→5→6 | 64px | sm |
| Large | 1→2→3→4 | 80px | base |

### Feature 3: Point Totals on Cards

**User Flow:**
1. Teacher clicks "Show +/-" toggle in header
2. Cards display small badges: green (top-left) for positive, red (top-right) for negative
3. Setting persists per device (localStorage)

**Visual Design:**
```
┌─────────────────────┐
│ +12        -3       │  ← badges in corners
│       [👤]          │
│      Name           │
│      +9 pts         │
│    Today: +2        │
└─────────────────────┘
```

## Implementation Plan

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useDisplaySettings.ts` | localStorage hook for card size + point totals visibility |
| `src/components/points/MultiAwardModal.tsx` | Modal for awarding points to multiple students |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/dashboard/DashboardView.tsx` | Add header controls, selection state |
| `src/components/students/StudentGrid.tsx` | Add size prop, selection props |
| `src/components/students/StudentPointCard.tsx` | Add size variants, selection state, point badges |

## Detailed Implementation

### Task 1: Create Display Settings Hook

**File:** `src/hooks/useDisplaySettings.ts`

```typescript
export type CardSize = 'small' | 'medium' | 'large';

export interface DisplaySettings {
  cardSize: CardSize;
  showPointTotals: boolean;
}

export function useDisplaySettings() {
  // Load from localStorage with defaults
  // Return { settings, setCardSize, setShowPointTotals }
}
```

**Acceptance Criteria:**
- [ ] Loads settings from localStorage on mount
- [ ] Defaults to `{ cardSize: 'medium', showPointTotals: false }`
- [ ] Saves to localStorage on change
- [ ] Returns current settings and setter functions

---

### Task 2: Update StudentPointCard with Size Variants

**File:** `src/components/students/StudentPointCard.tsx`

Add props:
```typescript
interface StudentPointCardProps {
  student: Student;
  onClick: () => void;
  size?: CardSize;           // NEW
  showPointTotals?: boolean; // NEW
  isSelected?: boolean;      // NEW
  selectionMode?: boolean;   // NEW
  onSelect?: () => void;     // NEW
}
```

**Size configurations:**
```typescript
const SIZE_CONFIG = {
  small: { avatar: 'w-10 h-10 text-lg', padding: 'p-2', name: 'text-xs', points: 'text-lg' },
  medium: { avatar: 'w-16 h-16 text-2xl', padding: 'p-4', name: 'text-sm', points: 'text-xl' },
  large: { avatar: 'w-20 h-20 text-3xl', padding: 'p-6', name: 'text-base', points: 'text-2xl' }
};
```

**Acceptance Criteria:**
- [ ] Renders at correct size based on `size` prop
- [ ] Shows positive/negative badges when `showPointTotals` is true
- [ ] Shows checkbox overlay when `selectionMode` is true
- [ ] Blue border highlight when `isSelected` is true
- [ ] Calls `onSelect` instead of `onClick` when in selection mode

---

### Task 3: Update StudentGrid with Selection Support

**File:** `src/components/students/StudentGrid.tsx`

Add props:
```typescript
interface StudentGridProps {
  students: Student[];
  onStudentClick: (student: Student) => void;
  size?: CardSize;                              // NEW
  showPointTotals?: boolean;                    // NEW
  selectionMode?: boolean;                      // NEW
  selectedStudentIds?: Set<string>;             // NEW
  onStudentSelect?: (studentId: string) => void; // NEW
}
```

**Grid column configuration:**
```typescript
const GRID_COLUMNS = {
  small: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
  medium: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  large: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
};
```

**Acceptance Criteria:**
- [ ] Grid columns change based on `size` prop
- [ ] Passes size and selection props to StudentPointCard
- [ ] Default size is 'medium' (current behavior)

---

### Task 4: Create MultiAwardModal

**File:** `src/components/points/MultiAwardModal.tsx`

Similar to `AwardPointsModal` but for multiple students:
- Shows count of selected students
- Uses `awardClassPoints`-like batch operation
- Returns batch_id for undo support

**Acceptance Criteria:**
- [ ] Shows "Award points to X students" header
- [ ] Displays behavior picker (reuse BehaviorPicker)
- [ ] Awards points to all selected students with batch_id
- [ ] Plays sound effect once (not per student)
- [ ] Closes and clears selection on success

---

### Task 5: Update DashboardView with Controls

**File:** `src/components/dashboard/DashboardView.tsx`

New state:
```typescript
const { settings, setCardSize, setShowPointTotals } = useDisplaySettings();
const [selectionMode, setSelectionMode] = useState(false);
const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
```

New header controls:
1. **Size toggle:** Three buttons [S] [M] [L]
2. **Point totals toggle:** Button with "+/-" label
3. **Selection controls:**
   - "Select" button to enter selection mode
   - When in selection mode: "X selected", "Award Points", "Cancel"

**Acceptance Criteria:**
- [ ] Size toggle changes grid immediately
- [ ] Point totals toggle shows/hides badges
- [ ] "Select" button enters selection mode
- [ ] Selection count updates as students are selected
- [ ] "Award Points" opens MultiAwardModal with selected students
- [ ] "Cancel" exits selection mode and clears selection
- [ ] Selection mode exits automatically after successful award

---

## Testing Checklist

### Manual Testing

**Card Size:**
- [ ] Click S/M/L and verify grid columns change
- [ ] Refresh page and verify size preference persisted
- [ ] Test on mobile viewport

**Point Totals:**
- [ ] Toggle on and verify badges appear in corners
- [ ] Verify positive badge is green, negative is red
- [ ] Verify badges scale correctly with card size
- [ ] Refresh and verify preference persisted

**Multi-select:**
- [ ] Click "Select" and verify selection mode activates
- [ ] Click students and verify they become selected (blue border + checkbox)
- [ ] Verify selection count updates
- [ ] Click "Award Points" and select a behavior
- [ ] Verify all selected students receive points
- [ ] Verify single undo removes all awarded points
- [ ] Verify "Cancel" clears selection and exits mode

### Edge Cases

- [ ] Zero students selected → "Award Points" button disabled
- [ ] All students selected → works correctly
- [ ] Mixed positive/negative totals display correctly
- [ ] Large class (30+ students) performs well
- [ ] Selection persists when switching card sizes

## Implementation Order

1. **Task 1:** useDisplaySettings hook (no dependencies)
2. **Task 2:** StudentPointCard updates (depends on Task 1 types)
3. **Task 3:** StudentGrid updates (depends on Task 2)
4. **Task 4:** MultiAwardModal (can be parallel with Tasks 2-3)
5. **Task 5:** DashboardView integration (depends on all above)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Selection state lost on re-render | Use stable Set reference with useCallback |
| Too many re-renders with large selection | Memoize StudentPointCard, use callback refs |
| Confusing UX for entering selection | Clear "Select" button with icon, exit on award complete |

## Out of Scope

- Keyboard shortcuts for selection (Ctrl+click, Shift+click ranges)
- Persisting selection across page refreshes
- Custom card sizes beyond S/M/L
- Different views (list view, table view)

---

**Ready for implementation when approved.**
