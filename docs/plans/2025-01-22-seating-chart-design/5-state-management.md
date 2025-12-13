# 5. State Management

## Context Structure

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

## Custom Hooks

```typescript
// src/hooks/usePersistedState.ts
function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T) => void];

// src/hooks/useChart.ts
function useChart(
  classId: string,
  chartId: string
): {
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
