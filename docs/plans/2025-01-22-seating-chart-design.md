# Seating Chart Tool - Technical Requirements Design

**Date**: 2025-01-22
**Status**: Approved
**Stakeholder Decisions**: React SPA, template-based layouts, light customization, name-only students, auto-generate + manual assignment, print + image export

---

## 1. Overview

A client-side React application for educators to create, manage, and export classroom seating charts. All data persists in localStorage - no backend required.

### Core Features
- Manage multiple classes with student rosters
- Create multiple seating charts per class
- Template-based layouts with light customization (add/remove desks)
- Drag-and-drop student assignment with randomize option
- Export as printable document or PNG image

---

## 2. Technology Stack

| Category | Choice | Rationale |
|----------|--------|-----------|
| Framework | React 18+ | Component architecture suits interactive chart UI |
| Build Tool | Vite | Fast development, modern defaults |
| Language | TypeScript | Type safety for complex data models |
| Styling | Tailwind CSS | Rapid UI development, utility-first |
| Drag & Drop | @dnd-kit/core | Modern, accessible, well-maintained |
| Image Export | html2canvas | DOM-to-image for PNG export |
| Testing | Vitest + RTL | Fast unit tests, React Testing Library |
| E2E Testing | Playwright | Export functionality validation |

### Package Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "html2canvas": "^1.4.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "playwright": "^1.40.0"
  }
}
```

---

## 3. Data Model

### TypeScript Interfaces

```typescript
// src/types/index.ts

export interface Class {
  id: string;           // UUID v4
  name: string;         // "Period 1 Math", "Homeroom 202"
  students: Student[];
  charts: SeatingChart[];
  createdAt: number;    // Unix timestamp
  updatedAt: number;
}

export interface Student {
  id: string;           // UUID v4
  name: string;         // Display name
}

export interface SeatingChart {
  id: string;
  name: string;         // "Fall Arrangement", "Group Work"
  templateId: string;   // Reference to base template
  desks: Desk[];        // Current desk configuration
  assignments: Assignment[];
  createdAt: number;
  updatedAt: number;
}

export interface Desk {
  id: string;
  row: number;          // Grid row position
  col: number;          // Grid column position
  isRemoved: boolean;   // Soft delete for customization
}

export interface Assignment {
  deskId: string;
  studentId: string | null;  // null = empty seat
}

export interface Template {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  previewImage: string; // Path to preview thumbnail
  desks: TemplateDesk[];
}

export interface TemplateDesk {
  row: number;
  col: number;
}

// localStorage schema
export interface AppState {
  version: number;      // Schema version for migrations
  classes: Class[];
  lastActiveClassId: string | null;
}
```

### localStorage Structure
```
Key: "seating-chart-data"
Value: JSON.stringify(AppState)
```

---

## 4. Component Architecture

### Component Tree
```
App
├── Layout
│   ├── Sidebar
│   │   ├── ClassList
│   │   │   └── ClassListItem
│   │   └── CreateClassButton
│   └── MainContent (router outlet)
│
├── Pages/Views
│   ├── ClassView
│   │   ├── ClassHeader (name, edit, delete)
│   │   ├── StudentRoster
│   │   │   ├── StudentList
│   │   │   │   └── StudentItem
│   │   │   └── AddStudentForm
│   │   └── ChartList
│   │       └── ChartCard (preview thumbnail)
│   │
│   └── ChartEditorView
│       ├── ChartHeader (name, back button)
│       ├── Toolbar
│       │   ├── TemplateSelector
│       │   ├── RandomizeButton
│       │   └── ExportDropdown
│       ├── ChartCanvas (DndContext wrapper)
│       │   └── DeskGrid
│       │       └── Desk (droppable)
│       │           └── AssignedStudent
│       └── UnassignedStudents (sidebar)
│           └── StudentCard (draggable)
│
└── Modals
    ├── CreateClassModal
    ├── EditClassModal
    ├── CreateChartModal
    └── ConfirmDeleteModal
```

### Key Components

#### ChartCanvas
The main chart editing area. Wraps content in DndContext from @dnd-kit.

```typescript
// src/components/charts/ChartCanvas.tsx
interface ChartCanvasProps {
  chart: SeatingChart;
  students: Student[];
  onAssign: (studentId: string, deskId: string) => void;
  onUnassign: (deskId: string) => void;
  onSwap: (deskId1: string, deskId2: string) => void;
}
```

#### Desk
Individual desk cell, acts as drop target.

```typescript
// src/components/charts/Desk.tsx
interface DeskProps {
  desk: Desk;
  assignment: Assignment | null;
  student: Student | null;
  isDropTarget: boolean;
  onToggleRemoved: () => void;
}
```

#### StudentCard
Draggable student representation.

```typescript
// src/components/charts/StudentCard.tsx
interface StudentCardProps {
  student: Student;
  isAssigned: boolean;
  isDragging: boolean;
}
```

---

## 5. State Management

### Context Structure

```typescript
// src/contexts/AppContext.tsx

interface AppContextValue {
  // State
  classes: Class[];
  activeClassId: string | null;
  activeClass: Class | null;

  // Class operations
  createClass: (name: string) => Class;
  updateClass: (id: string, updates: Partial<Class>) => void;
  deleteClass: (id: string) => void;
  setActiveClass: (id: string | null) => void;

  // Student operations
  addStudent: (classId: string, name: string) => Student;
  updateStudent: (classId: string, studentId: string, name: string) => void;
  removeStudent: (classId: string, studentId: string) => void;

  // Chart operations
  createChart: (classId: string, name: string, templateId: string) => SeatingChart;
  updateChart: (classId: string, chartId: string, updates: Partial<SeatingChart>) => void;
  deleteChart: (classId: string, chartId: string) => void;
}
```

### Custom Hooks

```typescript
// src/hooks/usePersistedState.ts
function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T) => void];

// src/hooks/useChart.ts
function useChart(classId: string, chartId: string): {
  chart: SeatingChart | null;
  assignStudent: (studentId: string, deskId: string) => void;
  unassignStudent: (deskId: string) => void;
  swapStudents: (deskId1: string, deskId2: string) => void;
  randomizeAssignments: () => void;
  addDesk: (row: number, col: number) => void;
  removeDesk: (deskId: string) => void;
  restoreDesk: (deskId: string) => void;
};

// src/hooks/useExport.ts
function useExport(chartRef: RefObject<HTMLElement>): {
  exportAsImage: () => Promise<void>;
  printChart: () => void;
};
```

---

## 6. Template System

### Predefined Templates

```typescript
// src/templates/index.ts

export const TEMPLATES: Template[] = [
  {
    id: 'traditional-rows',
    name: 'Traditional Rows',
    description: 'Classic classroom layout with rows facing forward',
    rows: 6,
    cols: 5,
    previewImage: '/templates/traditional-rows.svg',
    desks: generateGrid(6, 5), // All positions filled
  },
  {
    id: 'groups-of-4',
    name: 'Groups of 4',
    description: 'Clustered desks for group work',
    rows: 6,
    cols: 6,
    previewImage: '/templates/groups-of-4.svg',
    desks: [
      // Cluster 1 (top-left)
      { row: 0, col: 0 }, { row: 0, col: 1 },
      { row: 1, col: 0 }, { row: 1, col: 1 },
      // Cluster 2 (top-right)
      { row: 0, col: 4 }, { row: 0, col: 5 },
      { row: 1, col: 4 }, { row: 1, col: 5 },
      // ... more clusters
    ],
  },
  {
    id: 'u-shape',
    name: 'U-Shape',
    description: 'Desks arranged in U for discussions',
    rows: 5,
    cols: 7,
    previewImage: '/templates/u-shape.svg',
    desks: generateUShape(5, 7),
  },
  {
    id: 'pairs',
    name: 'Partner Pairs',
    description: 'Two-desk columns for pair work',
    rows: 6,
    cols: 6,
    previewImage: '/templates/pairs.svg',
    desks: generatePairs(6, 6),
  },
  {
    id: 'seminar',
    name: 'Seminar Circle',
    description: 'Large circle for seminar discussions',
    rows: 7,
    cols: 7,
    previewImage: '/templates/seminar.svg',
    desks: generateCircle(7),
  },
];
```

### Template Selection UI

```typescript
// src/components/charts/TemplateSelector.tsx
interface TemplateSelectorProps {
  currentTemplateId: string | null;
  onSelect: (templateId: string) => void;
}

// Renders grid of template preview cards
// Shows visual thumbnail + name + description
// Highlights currently selected template
```

---

## 7. Drag-and-Drop Implementation

### DnD Setup

```typescript
// src/components/charts/ChartCanvas.tsx
import { DndContext, DragEndEvent, DragOverlay } from '@dnd-kit/core';

function ChartCanvas({ chart, students, onAssign, onUnassign, onSwap }) {
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const student = students.find(s => s.id === event.active.id);
    setActiveStudent(student || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveStudent(null);

    if (!over) {
      // Dropped outside - unassign if was assigned
      const assignment = findAssignmentByStudent(active.id);
      if (assignment) onUnassign(assignment.deskId);
      return;
    }

    const targetDeskId = over.id as string;
    const existingAssignment = findAssignmentByDesk(targetDeskId);

    if (existingAssignment?.studentId) {
      // Desk occupied - swap students
      const sourceAssignment = findAssignmentByStudent(active.id);
      if (sourceAssignment) {
        onSwap(sourceAssignment.deskId, targetDeskId);
      }
    } else {
      // Desk empty - assign
      onAssign(active.id as string, targetDeskId);
    }
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4">
        <DeskGrid chart={chart} students={students} />
        <UnassignedStudents students={unassignedStudents} />
      </div>
      <DragOverlay>
        {activeStudent && <StudentCard student={activeStudent} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
```

### Randomize Algorithm

```typescript
// src/utils/randomize.ts

export function randomizeAssignments(
  students: Student[],
  desks: Desk[]
): Assignment[] {
  const availableDesks = desks
    .filter(d => !d.isRemoved)
    .map(d => d.id);

  const shuffledStudents = fisherYatesShuffle([...students]);

  return availableDesks.map((deskId, index) => ({
    deskId,
    studentId: shuffledStudents[index]?.id || null,
  }));
}

function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

---

## 8. Export Functionality

### Print Export

```typescript
// src/hooks/useExport.ts

export function useExport(chartRef: RefObject<HTMLElement>) {
  const printChart = useCallback(() => {
    window.print();
  }, []);

  // ... image export below
}
```

```css
/* src/styles/print.css */
@media print {
  /* Hide everything except chart */
  body * {
    visibility: hidden;
  }

  .chart-printable,
  .chart-printable * {
    visibility: visible;
  }

  .chart-printable {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }

  /* Hide UI elements */
  .no-print {
    display: none !important;
  }

  /* Clean styling for print */
  .desk {
    border: 1px solid #333;
    background: white;
  }
}
```

### Image Export

```typescript
// src/hooks/useExport.ts
import html2canvas from 'html2canvas';

export function useExport(chartRef: RefObject<HTMLElement>) {
  const exportAsImage = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
      });

      const link = document.createElement('a');
      link.download = `seating-chart-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      // Show error toast to user
    }
  }, [chartRef]);

  return { exportAsImage, printChart };
}
```

### Export UI

```typescript
// src/components/charts/ExportDropdown.tsx
interface ExportDropdownProps {
  onPrint: () => void;
  onExportImage: () => void;
}

// Dropdown menu with:
// - "Print Chart" option (triggers browser print dialog)
// - "Download as Image" option (downloads PNG)
```

---

## 9. localStorage Strategy

### Persistence Hook

```typescript
// src/hooks/usePersistedState.ts

const STORAGE_KEY = 'seating-chart-data';
const CURRENT_VERSION = 1;

const DEFAULT_STATE: AppState = {
  version: CURRENT_VERSION,
  classes: [],
  lastActiveClassId: null,
};

export function usePersistedState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_STATE;

      const parsed = JSON.parse(stored);
      return migrateState(parsed);
    } catch (error) {
      console.error('Failed to load state:', error);
      return DEFAULT_STATE;
    }
  });

  // Debounced save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          // Handle quota exceeded - notify user
          console.error('localStorage quota exceeded');
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [state]);

  return [state, setState] as const;
}
```

### Schema Migration

```typescript
// src/utils/migrations.ts

export function migrateState(state: unknown): AppState {
  if (!state || typeof state !== 'object') {
    return DEFAULT_STATE;
  }

  const version = (state as any).version || 0;

  // Future migrations go here
  // if (version < 2) state = migrateV1toV2(state);

  return state as AppState;
}
```

### Data Backup/Restore

```typescript
// src/utils/backup.ts

export function exportData(): string {
  const data = localStorage.getItem(STORAGE_KEY);
  return data || JSON.stringify(DEFAULT_STATE);
}

export function importData(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    const migrated = migrateState(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return true;
  } catch {
    return false;
  }
}

export function downloadBackup() {
  const data = exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `seating-chart-backup-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
```

---

## 10. Project Structure

```
seating-chart/
├── public/
│   └── templates/           # Template preview SVGs
│       ├── traditional-rows.svg
│       ├── groups-of-4.svg
│       └── ...
├── src/
│   ├── components/
│   │   ├── ui/              # Generic UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── classes/
│   │   │   ├── ClassList.tsx
│   │   │   ├── ClassCard.tsx
│   │   │   └── ClassForm.tsx
│   │   ├── students/
│   │   │   ├── StudentList.tsx
│   │   │   ├── StudentItem.tsx
│   │   │   └── StudentForm.tsx
│   │   └── charts/
│   │       ├── ChartCanvas.tsx
│   │       ├── DeskGrid.tsx
│   │       ├── Desk.tsx
│   │       ├── StudentCard.tsx
│   │       ├── TemplateSelector.tsx
│   │       ├── ExportDropdown.tsx
│   │       └── UnassignedStudents.tsx
│   ├── contexts/
│   │   └── AppContext.tsx
│   ├── hooks/
│   │   ├── usePersistedState.ts
│   │   ├── useChart.ts
│   │   └── useExport.ts
│   ├── templates/
│   │   ├── index.ts
│   │   └── generators.ts    # Grid generation utilities
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── randomize.ts
│   │   ├── migrations.ts
│   │   └── backup.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── print.css
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/
│   │   ├── randomize.test.ts
│   │   └── migrations.test.ts
│   ├── components/
│   │   ├── Desk.test.tsx
│   │   └── ChartCanvas.test.tsx
│   └── e2e/
│       └── export.spec.ts
├── docs/
│   └── plans/
│       └── 2025-01-22-seating-chart-design.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 11. Error Handling

### Error Scenarios & Responses

| Scenario | Detection | User Response |
|----------|-----------|---------------|
| localStorage unavailable | try/catch on access | Show warning banner, continue in-memory |
| localStorage quota exceeded | DOMException QuotaExceededError | Toast: "Storage full. Delete unused classes or export backup." |
| Invalid data on load | JSON.parse failure or schema mismatch | Reset to defaults, toast: "Data was corrupted. Starting fresh." |
| Image export failure | html2canvas rejection | Toast: "Export failed. Try again." |
| Drag-drop failure | DnD event error | Silent recovery, log error |

### Toast Notification System

```typescript
// src/components/ui/Toast.tsx
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// src/hooks/useToast.ts
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (toast: Omit<Toast, 'id'>) => { /* ... */ };
  const dismissToast = (id: string) => { /* ... */ };

  return { toasts, showToast, dismissToast };
}
```

---

## 12. Testing Strategy

### Unit Tests (Vitest)

```typescript
// tests/unit/randomize.test.ts
describe('randomizeAssignments', () => {
  it('assigns all students to available desks', () => {
    const students = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
    const desks = [
      { id: 'd1', row: 0, col: 0, isRemoved: false },
      { id: 'd2', row: 0, col: 1, isRemoved: false },
      { id: 'd3', row: 0, col: 2, isRemoved: true }, // Removed
    ];

    const result = randomizeAssignments(students, desks);

    expect(result).toHaveLength(2);
    expect(result.every(a => a.studentId !== null)).toBe(true);
  });

  it('leaves extra desks empty when fewer students than desks', () => {
    // ...
  });
});
```

### Component Tests (React Testing Library)

```typescript
// tests/components/Desk.test.tsx
describe('Desk', () => {
  it('displays student name when assigned', () => {
    render(
      <Desk
        desk={{ id: 'd1', row: 0, col: 0, isRemoved: false }}
        student={{ id: 's1', name: 'Alice' }}
        assignment={{ deskId: 'd1', studentId: 's1' }}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows empty state when no student assigned', () => {
    // ...
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/export.spec.ts
test('exports chart as PNG image', async ({ page }) => {
  await page.goto('/');

  // Create class and chart
  await page.click('[data-testid="create-class"]');
  await page.fill('[data-testid="class-name"]', 'Test Class');
  await page.click('[data-testid="save-class"]');

  // Create chart
  await page.click('[data-testid="create-chart"]');
  await page.click('[data-testid="template-traditional-rows"]');

  // Export
  const downloadPromise = page.waitForEvent('download');
  await page.click('[data-testid="export-image"]');
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/seating-chart-.*\.png/);
});
```

---

## 13. Performance Considerations

### Optimization Strategies

1. **Debounced localStorage writes** - 300ms debounce prevents excessive disk I/O
2. **Memoized components** - React.memo on Desk, StudentCard to prevent unnecessary re-renders
3. **Virtual scrolling** - If student lists grow large (>100), consider virtualization
4. **Lazy template loading** - Load template previews on demand

### Bundle Size Targets

| Dependency | Estimated Size |
|------------|---------------|
| React + ReactDOM | ~45KB gzipped |
| @dnd-kit | ~15KB gzipped |
| html2canvas | ~40KB gzipped |
| Tailwind (purged) | ~10KB gzipped |
| **Total** | **~110KB gzipped** |

---

## 14. Accessibility (a11y)

### Requirements

- **Keyboard navigation**: All actions accessible via keyboard
- **Screen reader support**: ARIA labels on interactive elements
- **Focus management**: Proper focus handling in modals and drag-drop
- **Color contrast**: WCAG AA compliance for all text

### Implementation

```typescript
// Desk component with accessibility
<div
  role="gridcell"
  aria-label={student ? `Desk assigned to ${student.name}` : 'Empty desk'}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleDeskClick();
    }
  }}
>
```

---

## 15. Future Considerations (Out of Scope)

These features are explicitly **not** in the initial scope but documented for future reference:

- Cloud sync / user accounts
- Sharing charts with other teachers
- Student photos
- Seating history / undo-redo
- Print multiple charts at once
- Import student lists from CSV
- Collaborative editing

---

## Appendix A: UI Mockups

### Main Chart Editor Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Class    Period 1 Math - Fall Arrangement            │
├─────────────────────────────────────────────────────────────────┤
│  [Template ▼]  [Randomize]  [Export ▼]                          │
├─────────────────────────────────────────────────────────────────┤
│                                              │ Unassigned (3)   │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │                  │
│   │Alice│ │ Bob │ │Carol│ │ Dan │ │     │   │ ┌──────────────┐ │
│   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │ │   Emma       │ │
│                                              │ └──────────────┘ │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │ ┌──────────────┐ │
│   │Frank│ │Grace│ │Henry│ │ Ivy │ │ Jay │   │ │   Kevin      │ │
│   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │ └──────────────┘ │
│                                              │ ┌──────────────┐ │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │ │   Lisa       │ │
│   │     │ │     │ │     │ │     │ │     │   │ └──────────────┘ │
│   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │                  │
│                                              │                  │
│                    [FRONT OF ROOM]           │                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sidebar Class List

```
┌──────────────────────┐
│  SEATING CHARTS      │
│  [+ New Class]       │
├──────────────────────┤
│  ▸ Period 1 Math     │
│  ▾ Period 2 Science  │
│    • Fall Layout     │
│    • Lab Groups      │
│  ▸ Homeroom 202      │
│  ▸ Period 4 English  │
└──────────────────────┘
```

---

## Appendix B: Template Previews

### Traditional Rows (5x6)
```
□ □ □ □ □
□ □ □ □ □
□ □ □ □ □
□ □ □ □ □
□ □ □ □ □
□ □ □ □ □
```

### Groups of 4
```
□□   □□   □□
□□   □□   □□

□□   □□   □□
□□   □□   □□
```

### U-Shape
```
□ □ □ □ □ □ □
□           □
□           □
□           □
□ □ □ □ □ □ □
```

### Partner Pairs
```
□□  □□  □□
□□  □□  □□
□□  □□  □□
□□  □□  □□
```

### Seminar Circle
```
    □ □ □
  □       □
  □       □
  □       □
    □ □ □
```
