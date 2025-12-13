# 4. Component Architecture

## Component Tree

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

## Key Components

### ChartCanvas

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

### Desk

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

### StudentCard

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
