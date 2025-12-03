# Seating Chart Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React SPA for educators to create, manage, and export classroom seating charts with drag-and-drop student assignment.

**Architecture:** Client-side React app with Context API for state management, @dnd-kit for drag-and-drop, localStorage for persistence, and html2canvas for image export. Template-based layouts with light customization (add/remove desks).

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, @dnd-kit/core, html2canvas, Vitest, React Testing Library

---

## Phase 1: Project Scaffolding

### Task 1.1: Initialize Vite + React + TypeScript Project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

**Step 1: Create Vite project**

Run:
```bash
cd /home/sallvain/dev/work/Seating-Chart
npm create vite@latest . -- --template react-ts
```

Expected: Project scaffolded with React + TypeScript

**Step 2: Install dependencies**

Run:
```bash
npm install
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities uuid html2canvas
npm install -D tailwindcss postcss autoprefixer @types/uuid vitest @testing-library/react @testing-library/jest-dom jsdom
```

Expected: All dependencies installed

**Step 3: Initialize Tailwind CSS**

Run:
```bash
npx tailwindcss init -p
```

Expected: `tailwind.config.js` and `postcss.config.js` created

**Step 4: Configure Tailwind**

Modify `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 5: Add Tailwind directives**

Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@media print {
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

  .no-print {
    display: none !important;
  }
}
```

**Step 6: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

**Step 7: Verify setup**

Run:
```bash
npm run dev
```

Expected: Vite dev server starts at http://localhost:5173

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: initialize Vite + React + TypeScript + Tailwind project"
```

---

### Task 1.2: Create Type Definitions

**Files:**
- Create: `src/types/index.ts`

**Step 1: Write types file**

Create `src/types/index.ts`:
```typescript
export interface Student {
  id: string;
  name: string;
}

export interface Desk {
  id: string;
  row: number;
  col: number;
  isRemoved: boolean;
}

export interface Assignment {
  deskId: string;
  studentId: string | null;
}

export interface SeatingChart {
  id: string;
  name: string;
  templateId: string;
  desks: Desk[];
  assignments: Assignment[];
  createdAt: number;
  updatedAt: number;
}

export interface Class {
  id: string;
  name: string;
  students: Student[];
  charts: SeatingChart[];
  createdAt: number;
  updatedAt: number;
}

export interface TemplateDesk {
  row: number;
  col: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  desks: TemplateDesk[];
}

export interface AppState {
  version: number;
  classes: Class[];
  lastActiveClassId: string | null;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 1.3: Create Template Definitions

**Files:**
- Create: `src/templates/index.ts`
- Create: `src/templates/generators.ts`

**Step 1: Write template generators**

Create `src/templates/generators.ts`:
```typescript
import type { TemplateDesk } from '../types';

export function generateGrid(rows: number, cols: number): TemplateDesk[] {
  const desks: TemplateDesk[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      desks.push({ row, col });
    }
  }
  return desks;
}

export function generateGroupsOf4(rows: number, cols: number): TemplateDesk[] {
  const desks: TemplateDesk[] = [];
  // Create 2x2 clusters with gaps
  for (let clusterRow = 0; clusterRow < Math.floor(rows / 3); clusterRow++) {
    for (let clusterCol = 0; clusterCol < Math.floor(cols / 3); clusterCol++) {
      const baseRow = clusterRow * 3;
      const baseCol = clusterCol * 3;
      desks.push({ row: baseRow, col: baseCol });
      desks.push({ row: baseRow, col: baseCol + 1 });
      desks.push({ row: baseRow + 1, col: baseCol });
      desks.push({ row: baseRow + 1, col: baseCol + 1 });
    }
  }
  return desks;
}

export function generateUShape(rows: number, cols: number): TemplateDesk[] {
  const desks: TemplateDesk[] = [];
  // Top row
  for (let col = 0; col < cols; col++) {
    desks.push({ row: 0, col });
  }
  // Left and right columns (excluding corners)
  for (let row = 1; row < rows - 1; row++) {
    desks.push({ row, col: 0 });
    desks.push({ row, col: cols - 1 });
  }
  // Bottom row
  for (let col = 0; col < cols; col++) {
    desks.push({ row: rows - 1, col });
  }
  return desks;
}

export function generatePairs(rows: number, cols: number): TemplateDesk[] {
  const desks: TemplateDesk[] = [];
  for (let row = 0; row < rows; row++) {
    for (let pairCol = 0; pairCol < Math.floor(cols / 3); pairCol++) {
      const baseCol = pairCol * 3;
      desks.push({ row, col: baseCol });
      desks.push({ row, col: baseCol + 1 });
    }
  }
  return desks;
}

export function generateCircle(size: number): TemplateDesk[] {
  const desks: TemplateDesk[] = [];
  const center = Math.floor(size / 2);
  const radius = center - 0.5;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const distance = Math.sqrt(
        Math.pow(row - center, 2) + Math.pow(col - center, 2)
      );
      // Only add desks on the perimeter
      if (Math.abs(distance - radius) < 1) {
        desks.push({ row, col });
      }
    }
  }
  return desks;
}
```

**Step 2: Write template definitions**

Create `src/templates/index.ts`:
```typescript
import type { Template } from '../types';
import {
  generateGrid,
  generateGroupsOf4,
  generateUShape,
  generatePairs,
  generateCircle,
} from './generators';

export const TEMPLATES: Template[] = [
  {
    id: 'traditional-rows',
    name: 'Traditional Rows',
    description: 'Classic classroom layout with rows facing forward',
    rows: 6,
    cols: 5,
    desks: generateGrid(6, 5),
  },
  {
    id: 'groups-of-4',
    name: 'Groups of 4',
    description: 'Clustered desks for group work',
    rows: 6,
    cols: 6,
    desks: generateGroupsOf4(6, 6),
  },
  {
    id: 'u-shape',
    name: 'U-Shape',
    description: 'Desks arranged in U for discussions',
    rows: 5,
    cols: 7,
    desks: generateUShape(5, 7),
  },
  {
    id: 'pairs',
    name: 'Partner Pairs',
    description: 'Two-desk columns for pair work',
    rows: 6,
    cols: 6,
    desks: generatePairs(6, 6),
  },
  {
    id: 'seminar',
    name: 'Seminar Circle',
    description: 'Circular arrangement for discussions',
    rows: 7,
    cols: 7,
    desks: generateCircle(7),
  },
];

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
```

**Step 3: Commit**

```bash
git add src/templates/
git commit -m "feat: add seating layout templates with generators"
```

---

## Phase 2: State Management & Persistence

### Task 2.1: Create localStorage Persistence Hook

**Files:**
- Create: `src/hooks/usePersistedState.ts`
- Create: `src/utils/migrations.ts`
- Test: `src/hooks/__tests__/usePersistedState.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/__tests__/usePersistedState.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePersistedState } from '../usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns default state when localStorage is empty', () => {
    const { result } = renderHook(() => usePersistedState());

    expect(result.current.state.version).toBe(1);
    expect(result.current.state.classes).toEqual([]);
    expect(result.current.state.lastActiveClassId).toBeNull();
  });

  it('persists state changes to localStorage', async () => {
    const { result } = renderHook(() => usePersistedState());

    act(() => {
      result.current.setState({
        ...result.current.state,
        lastActiveClassId: 'test-id',
      });
    });

    // Wait for debounced save
    await new Promise((r) => setTimeout(r, 350));

    const stored = localStorage.getItem('seating-chart-data');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).lastActiveClassId).toBe('test-id');
  });

  it('loads existing state from localStorage', () => {
    const existingState = {
      version: 1,
      classes: [{ id: 'c1', name: 'Test Class', students: [], charts: [], createdAt: 0, updatedAt: 0 }],
      lastActiveClassId: 'c1',
    };
    localStorage.setItem('seating-chart-data', JSON.stringify(existingState));

    const { result } = renderHook(() => usePersistedState());

    expect(result.current.state.classes).toHaveLength(1);
    expect(result.current.state.classes[0].name).toBe('Test Class');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run src/hooks/__tests__/usePersistedState.test.ts
```

Expected: FAIL - module not found

**Step 3: Write migrations utility**

Create `src/utils/migrations.ts`:
```typescript
import type { AppState } from '../types';

const CURRENT_VERSION = 1;

export const DEFAULT_STATE: AppState = {
  version: CURRENT_VERSION,
  classes: [],
  lastActiveClassId: null,
};

export function migrateState(state: unknown): AppState {
  if (!state || typeof state !== 'object') {
    return DEFAULT_STATE;
  }

  const version = (state as Record<string, unknown>).version;

  if (typeof version !== 'number') {
    return DEFAULT_STATE;
  }

  // Future migrations would go here
  // if (version < 2) state = migrateV1toV2(state);

  return state as AppState;
}
```

**Step 4: Write the hook implementation**

Create `src/hooks/usePersistedState.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';
import type { AppState } from '../types';
import { DEFAULT_STATE, migrateState } from '../utils/migrations';

const STORAGE_KEY = 'seating-chart-data';
const DEBOUNCE_MS = 300;

export function usePersistedState() {
  const [state, setStateInternal] = useState<AppState>(() => {
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
          console.error('localStorage quota exceeded');
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [state]);

  const setState = useCallback((newState: AppState) => {
    setStateInternal(newState);
  }, []);

  return { state, setState };
}
```

**Step 5: Run test to verify it passes**

Run:
```bash
npx vitest run src/hooks/__tests__/usePersistedState.test.ts
```

Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/hooks/ src/utils/
git commit -m "feat: add localStorage persistence hook with migrations"
```

---

### Task 2.2: Create App Context

**Files:**
- Create: `src/contexts/AppContext.tsx`
- Test: `src/contexts/__tests__/AppContext.test.tsx`

**Step 1: Write the failing test**

Create `src/contexts/__tests__/AppContext.test.tsx`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppProvider, useApp } from '../AppContext';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a new class', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.createClass('Period 1');
    });

    expect(result.current.classes).toHaveLength(1);
    expect(result.current.classes[0].name).toBe('Period 1');
  });

  it('adds a student to a class', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.createClass('Period 1');
    });

    const classId = result.current.classes[0].id;

    act(() => {
      result.current.addStudent(classId, 'Alice');
    });

    expect(result.current.classes[0].students).toHaveLength(1);
    expect(result.current.classes[0].students[0].name).toBe('Alice');
  });

  it('creates a seating chart for a class', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.createClass('Period 1');
    });

    const classId = result.current.classes[0].id;

    act(() => {
      result.current.createChart(classId, 'Fall Layout', 'traditional-rows');
    });

    expect(result.current.classes[0].charts).toHaveLength(1);
    expect(result.current.classes[0].charts[0].name).toBe('Fall Layout');
    expect(result.current.classes[0].charts[0].desks.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run src/contexts/__tests__/AppContext.test.tsx
```

Expected: FAIL - module not found

**Step 3: Write the context implementation**

Create `src/contexts/AppContext.tsx`:
```typescript
import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Class, Student, SeatingChart, Desk, Assignment } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { getTemplateById } from '../templates';

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

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { state, setState } = usePersistedState();

  const updateState = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setState(updater(state));
    },
    [state, setState]
  );

  // Class operations
  const createClass = useCallback(
    (name: string): Class => {
      const now = Date.now();
      const newClass: Class = {
        id: uuidv4(),
        name,
        students: [],
        charts: [],
        createdAt: now,
        updatedAt: now,
      };

      updateState((prev) => ({
        ...prev,
        classes: [...prev.classes, newClass],
        lastActiveClassId: newClass.id,
      }));

      return newClass;
    },
    [updateState]
  );

  const updateClass = useCallback(
    (id: string, updates: Partial<Class>) => {
      updateState((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
        ),
      }));
    },
    [updateState]
  );

  const deleteClass = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        classes: prev.classes.filter((c) => c.id !== id),
        lastActiveClassId:
          prev.lastActiveClassId === id ? null : prev.lastActiveClassId,
      }));
    },
    [updateState]
  );

  const setActiveClass = useCallback(
    (id: string | null) => {
      updateState((prev) => ({
        ...prev,
        lastActiveClassId: id,
      }));
    },
    [updateState]
  );

  // Student operations
  const addStudent = useCallback(
    (classId: string, name: string): Student => {
      const student: Student = {
        id: uuidv4(),
        name,
      };

      updateState((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? { ...c, students: [...c.students, student], updatedAt: Date.now() }
            : c
        ),
      }));

      return student;
    },
    [updateState]
  );

  const updateStudent = useCallback(
    (classId: string, studentId: string, name: string) => {
      updateState((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? {
                ...c,
                students: c.students.map((s) =>
                  s.id === studentId ? { ...s, name } : s
                ),
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
    },
    [updateState]
  );

  const removeStudent = useCallback(
    (classId: string, studentId: string) => {
      updateState((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? {
                ...c,
                students: c.students.filter((s) => s.id !== studentId),
                // Also remove from all chart assignments
                charts: c.charts.map((chart) => ({
                  ...chart,
                  assignments: chart.assignments.map((a) =>
                    a.studentId === studentId ? { ...a, studentId: null } : a
                  ),
                })),
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
    },
    [updateState]
  );

  // Chart operations
  const createChart = useCallback(
    (classId: string, name: string, templateId: string): SeatingChart => {
      const template = getTemplateById(templateId);
      if (!template) throw new Error(`Template not found: ${templateId}`);

      const now = Date.now();
      const desks: Desk[] = template.desks.map((td, index) => ({
        id: uuidv4(),
        row: td.row,
        col: td.col,
        isRemoved: false,
      }));

      const assignments: Assignment[] = desks.map((d) => ({
        deskId: d.id,
        studentId: null,
      }));

      const chart: SeatingChart = {
        id: uuidv4(),
        name,
        templateId,
        desks,
        assignments,
        createdAt: now,
        updatedAt: now,
      };

      updateState((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? { ...c, charts: [...c.charts, chart], updatedAt: Date.now() }
            : c
        ),
      }));

      return chart;
    },
    [updateState]
  );

  const updateChart = useCallback(
    (classId: string, chartId: string, updates: Partial<SeatingChart>) => {
      updateState((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? {
                ...c,
                charts: c.charts.map((ch) =>
                  ch.id === chartId
                    ? { ...ch, ...updates, updatedAt: Date.now() }
                    : ch
                ),
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
    },
    [updateState]
  );

  const deleteChart = useCallback(
    (classId: string, chartId: string) => {
      updateState((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? {
                ...c,
                charts: c.charts.filter((ch) => ch.id !== chartId),
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
    },
    [updateState]
  );

  const activeClass = state.classes.find(
    (c) => c.id === state.lastActiveClassId
  ) || null;

  const value: AppContextValue = {
    classes: state.classes,
    activeClassId: state.lastActiveClassId,
    activeClass,
    createClass,
    updateClass,
    deleteClass,
    setActiveClass,
    addStudent,
    updateStudent,
    removeStudent,
    createChart,
    updateChart,
    deleteChart,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run src/contexts/__tests__/AppContext.test.tsx
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/contexts/
git commit -m "feat: add AppContext for state management"
```

---

## Phase 3: Core UI Components

### Task 3.1: Create Basic UI Components

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/index.ts`

**Step 1: Create Button component**

Create `src/components/ui/Button.tsx`:
```typescript
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
};

const sizes = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

**Step 2: Create Input component**

Create `src/components/ui/Input.tsx`:
```typescript
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          error ? 'border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
```

**Step 3: Create Modal component**

Create `src/components/ui/Modal.tsx`:
```typescript
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="text-lg font-semibold mb-4">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
```

**Step 4: Create barrel export**

Create `src/components/ui/index.ts`:
```typescript
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';
```

**Step 5: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add base UI components (Button, Input, Modal)"
```

---

### Task 3.2: Create Layout Components

**Files:**
- Create: `src/components/layout/Layout.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/index.ts`

**Step 1: Create Sidebar component**

Create `src/components/layout/Sidebar.tsx`:
```typescript
import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Button, Input, Modal } from '../ui';

export function Sidebar() {
  const { classes, activeClassId, setActiveClass, createClass, deleteClass } = useApp();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const handleCreateClass = () => {
    if (newClassName.trim()) {
      createClass(newClassName.trim());
      setNewClassName('');
      setIsCreateModalOpen(false);
    }
  };

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">Seating Charts</h1>
      </div>

      <div className="p-4">
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full"
          size="sm"
        >
          + New Class
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        {classes.length === 0 ? (
          <p className="text-sm text-gray-500 px-2">No classes yet</p>
        ) : (
          <ul className="space-y-1">
            {classes.map((cls) => (
              <li key={cls.id}>
                <button
                  onClick={() => setActiveClass(cls.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeClassId === cls.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {cls.name}
                  <span className="text-xs text-gray-500 ml-2">
                    ({cls.students.length} students)
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Class"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateClass();
          }}
        >
          <Input
            label="Class Name"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="e.g., Period 1 Math"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newClassName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </aside>
  );
}
```

**Step 2: Create Layout component**

Create `src/components/layout/Layout.tsx`:
```typescript
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

**Step 3: Create barrel export**

Create `src/components/layout/index.ts`:
```typescript
export { Layout } from './Layout';
export { Sidebar } from './Sidebar';
```

**Step 4: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add Layout and Sidebar components"
```

---

### Task 3.3: Create Class View Components

**Files:**
- Create: `src/components/classes/ClassView.tsx`
- Create: `src/components/classes/StudentList.tsx`
- Create: `src/components/classes/ChartList.tsx`
- Create: `src/components/classes/index.ts`

**Step 1: Create StudentList component**

Create `src/components/classes/StudentList.tsx`:
```typescript
import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Button, Input } from '../ui';

interface StudentListProps {
  classId: string;
}

export function StudentList({ classId }: StudentListProps) {
  const { classes, addStudent, removeStudent, updateStudent } = useApp();
  const [newStudentName, setNewStudentName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const currentClass = classes.find((c) => c.id === classId);
  if (!currentClass) return null;

  const handleAddStudent = () => {
    if (newStudentName.trim()) {
      addStudent(classId, newStudentName.trim());
      setNewStudentName('');
    }
  };

  const startEditing = (studentId: string, name: string) => {
    setEditingId(studentId);
    setEditingName(name);
  };

  const saveEdit = () => {
    if (editingId && editingName.trim()) {
      updateStudent(classId, editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3">
        Students ({currentClass.students.length})
      </h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddStudent();
        }}
        className="flex gap-2 mb-4"
      >
        <Input
          value={newStudentName}
          onChange={(e) => setNewStudentName(e.target.value)}
          placeholder="Student name"
          className="flex-1"
        />
        <Button type="submit" disabled={!newStudentName.trim()} size="sm">
          Add
        </Button>
      </form>

      {currentClass.students.length === 0 ? (
        <p className="text-sm text-gray-500">No students added yet</p>
      ) : (
        <ul className="space-y-2">
          {currentClass.students.map((student) => (
            <li
              key={student.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
            >
              {editingId === student.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit();
                  }}
                  className="flex-1 flex gap-2"
                >
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    className="flex-1"
                  />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="text-gray-900">{student.name}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(student.id, student.name)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStudent(classId, student.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Step 2: Create ChartList component**

Create `src/components/classes/ChartList.tsx`:
```typescript
import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Button, Modal, Input } from '../ui';
import { TEMPLATES } from '../../templates';

interface ChartListProps {
  classId: string;
  onSelectChart: (chartId: string) => void;
}

export function ChartList({ classId, onSelectChart }: ChartListProps) {
  const { classes, createChart, deleteChart } = useApp();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newChartName, setNewChartName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(TEMPLATES[0].id);

  const currentClass = classes.find((c) => c.id === classId);
  if (!currentClass) return null;

  const handleCreateChart = () => {
    if (newChartName.trim()) {
      const chart = createChart(classId, newChartName.trim(), selectedTemplateId);
      setNewChartName('');
      setIsCreateModalOpen(false);
      onSelectChart(chart.id);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          Seating Charts ({currentClass.charts.length})
        </h3>
        <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
          + New Chart
        </Button>
      </div>

      {currentClass.charts.length === 0 ? (
        <p className="text-sm text-gray-500">No charts created yet</p>
      ) : (
        <ul className="space-y-2">
          {currentClass.charts.map((chart) => (
            <li
              key={chart.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
            >
              <button
                onClick={() => onSelectChart(chart.id)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {chart.name}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteChart(classId, chart.id)}
                className="text-red-600 hover:text-red-700"
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Seating Chart"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateChart();
          }}
        >
          <div className="space-y-4">
            <Input
              label="Chart Name"
              value={newChartName}
              onChange={(e) => setNewChartName(e.target.value)}
              placeholder="e.g., Fall Arrangement"
              autoFocus
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Layout Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`p-3 text-left rounded-md border transition-colors ${
                      selectedTemplateId === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-gray-500">
                      {template.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newChartName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

**Step 3: Create ClassView component**

Create `src/components/classes/ClassView.tsx`:
```typescript
import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { StudentList } from './StudentList';
import { ChartList } from './ChartList';
import { Button, Input, Modal } from '../ui';

interface ClassViewProps {
  onEditChart: (classId: string, chartId: string) => void;
}

export function ClassView({ onEditChart }: ClassViewProps) {
  const { activeClass, activeClassId, updateClass, deleteClass, setActiveClass } = useApp();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  if (!activeClass || !activeClassId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a class from the sidebar or create a new one
      </div>
    );
  }

  const handleSaveEdit = () => {
    if (editedName.trim()) {
      updateClass(activeClassId, { name: editedName.trim() });
      setIsEditModalOpen(false);
    }
  };

  const handleDelete = () => {
    deleteClass(activeClassId);
    setActiveClass(null);
    setIsDeleteConfirmOpen(false);
  };

  const openEditModal = () => {
    setEditedName(activeClass.name);
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{activeClass.name}</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={openEditModal}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteConfirmOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <StudentList classId={activeClassId} />
        <ChartList
          classId={activeClassId}
          onSelectChart={(chartId) => onEditChart(activeClassId, chartId)}
        />
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Class"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveEdit();
          }}
        >
          <Input
            label="Class Name"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!editedName.trim()}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Delete Class"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete "{activeClass.name}"? This will also
          delete all students and seating charts in this class. This action
          cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setIsDeleteConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
```

**Step 4: Create barrel export**

Create `src/components/classes/index.ts`:
```typescript
export { ClassView } from './ClassView';
export { StudentList } from './StudentList';
export { ChartList } from './ChartList';
```

**Step 5: Commit**

```bash
git add src/components/classes/
git commit -m "feat: add ClassView with StudentList and ChartList components"
```

---

## Phase 4: Chart Editor & Drag-and-Drop

### Task 4.1: Create useChart Hook

**Files:**
- Create: `src/hooks/useChart.ts`
- Create: `src/utils/randomize.ts`
- Test: `src/utils/__tests__/randomize.test.ts`

**Step 1: Write randomize test**

Create `src/utils/__tests__/randomize.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { randomizeAssignments } from '../randomize';
import type { Student, Desk } from '../../types';

describe('randomizeAssignments', () => {
  const students: Student[] = [
    { id: 's1', name: 'Alice' },
    { id: 's2', name: 'Bob' },
    { id: 's3', name: 'Carol' },
  ];

  const desks: Desk[] = [
    { id: 'd1', row: 0, col: 0, isRemoved: false },
    { id: 'd2', row: 0, col: 1, isRemoved: false },
    { id: 'd3', row: 0, col: 2, isRemoved: false },
    { id: 'd4', row: 1, col: 0, isRemoved: true }, // Removed
  ];

  it('assigns all students to available desks', () => {
    const result = randomizeAssignments(students, desks);

    const assignedStudents = result
      .filter((a) => a.studentId !== null)
      .map((a) => a.studentId);

    expect(assignedStudents).toHaveLength(3);
    expect(new Set(assignedStudents).size).toBe(3); // All unique
  });

  it('excludes removed desks', () => {
    const result = randomizeAssignments(students, desks);

    const removedDeskAssignment = result.find((a) => a.deskId === 'd4');
    expect(removedDeskAssignment).toBeUndefined();
  });

  it('leaves extra desks empty when fewer students', () => {
    const fewStudents = students.slice(0, 1);
    const result = randomizeAssignments(fewStudents, desks);

    const emptyDesks = result.filter((a) => a.studentId === null);
    expect(emptyDesks.length).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run src/utils/__tests__/randomize.test.ts
```

Expected: FAIL - module not found

**Step 3: Write randomize utility**

Create `src/utils/randomize.ts`:
```typescript
import type { Student, Desk, Assignment } from '../types';

export function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function randomizeAssignments(
  students: Student[],
  desks: Desk[]
): Assignment[] {
  const availableDesks = desks.filter((d) => !d.isRemoved);
  const shuffledStudents = fisherYatesShuffle(students);

  return availableDesks.map((desk, index) => ({
    deskId: desk.id,
    studentId: shuffledStudents[index]?.id || null,
  }));
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run src/utils/__tests__/randomize.test.ts
```

Expected: All tests PASS

**Step 5: Create useChart hook**

Create `src/hooks/useChart.ts`:
```typescript
import { useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { randomizeAssignments } from '../utils/randomize';
import type { SeatingChart, Assignment } from '../types';

export function useChart(classId: string, chartId: string) {
  const { classes, updateChart } = useApp();

  const currentClass = useMemo(
    () => classes.find((c) => c.id === classId),
    [classes, classId]
  );

  const chart = useMemo(
    () => currentClass?.charts.find((ch) => ch.id === chartId),
    [currentClass, chartId]
  );

  const students = currentClass?.students || [];

  const assignStudent = useCallback(
    (studentId: string, deskId: string) => {
      if (!chart) return;

      // Remove student from any existing assignment
      const newAssignments: Assignment[] = chart.assignments.map((a) => {
        if (a.studentId === studentId) return { ...a, studentId: null };
        if (a.deskId === deskId) return { ...a, studentId };
        return a;
      });

      updateChart(classId, chartId, { assignments: newAssignments });
    },
    [chart, classId, chartId, updateChart]
  );

  const unassignStudent = useCallback(
    (deskId: string) => {
      if (!chart) return;

      const newAssignments = chart.assignments.map((a) =>
        a.deskId === deskId ? { ...a, studentId: null } : a
      );

      updateChart(classId, chartId, { assignments: newAssignments });
    },
    [chart, classId, chartId, updateChart]
  );

  const swapStudents = useCallback(
    (deskId1: string, deskId2: string) => {
      if (!chart) return;

      const assignment1 = chart.assignments.find((a) => a.deskId === deskId1);
      const assignment2 = chart.assignments.find((a) => a.deskId === deskId2);

      if (!assignment1 || !assignment2) return;

      const newAssignments = chart.assignments.map((a) => {
        if (a.deskId === deskId1) return { ...a, studentId: assignment2.studentId };
        if (a.deskId === deskId2) return { ...a, studentId: assignment1.studentId };
        return a;
      });

      updateChart(classId, chartId, { assignments: newAssignments });
    },
    [chart, classId, chartId, updateChart]
  );

  const randomize = useCallback(() => {
    if (!chart || !currentClass) return;

    const newAssignments = randomizeAssignments(currentClass.students, chart.desks);
    updateChart(classId, chartId, { assignments: newAssignments });
  }, [chart, currentClass, classId, chartId, updateChart]);

  const toggleDeskRemoved = useCallback(
    (deskId: string) => {
      if (!chart) return;

      const newDesks = chart.desks.map((d) =>
        d.id === deskId ? { ...d, isRemoved: !d.isRemoved } : d
      );

      // Also unassign student if removing desk
      const desk = chart.desks.find((d) => d.id === deskId);
      let newAssignments = chart.assignments;
      if (desk && !desk.isRemoved) {
        newAssignments = chart.assignments.map((a) =>
          a.deskId === deskId ? { ...a, studentId: null } : a
        );
      }

      updateChart(classId, chartId, { desks: newDesks, assignments: newAssignments });
    },
    [chart, classId, chartId, updateChart]
  );

  const unassignedStudents = useMemo(() => {
    if (!chart) return [];
    const assignedIds = new Set(
      chart.assignments.filter((a) => a.studentId).map((a) => a.studentId)
    );
    return students.filter((s) => !assignedIds.has(s.id));
  }, [chart, students]);

  return {
    chart,
    students,
    unassignedStudents,
    assignStudent,
    unassignStudent,
    swapStudents,
    randomize,
    toggleDeskRemoved,
  };
}
```

**Step 6: Commit**

```bash
git add src/hooks/useChart.ts src/utils/randomize.ts src/utils/__tests__/
git commit -m "feat: add useChart hook with randomize functionality"
```

---

### Task 4.2: Create Chart Editor Components

**Files:**
- Create: `src/components/charts/DeskGrid.tsx`
- Create: `src/components/charts/Desk.tsx`
- Create: `src/components/charts/StudentCard.tsx`
- Create: `src/components/charts/UnassignedStudents.tsx`
- Create: `src/components/charts/ChartCanvas.tsx`
- Create: `src/components/charts/index.ts`

**Step 1: Create StudentCard component (draggable)**

Create `src/components/charts/StudentCard.tsx`:
```typescript
import { useDraggable } from '@dnd-kit/core';
import type { Student } from '../../types';

interface StudentCardProps {
  student: Student;
  isDragging?: boolean;
}

export function StudentCard({ student, isDragging }: StudentCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: student.id,
    data: { type: 'student', student },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`px-3 py-2 bg-blue-100 text-blue-900 rounded-md cursor-grab text-sm font-medium select-none ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      {student.name}
    </div>
  );
}
```

**Step 2: Create Desk component (droppable)**

Create `src/components/charts/Desk.tsx`:
```typescript
import { useDroppable } from '@dnd-kit/core';
import type { Desk as DeskType, Student, Assignment } from '../../types';

interface DeskProps {
  desk: DeskType;
  assignment: Assignment | undefined;
  student: Student | undefined;
  onToggleRemoved: () => void;
}

export function Desk({ desk, assignment, student, onToggleRemoved }: DeskProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: desk.id,
    data: { type: 'desk', desk },
    disabled: desk.isRemoved,
  });

  if (desk.isRemoved) {
    return (
      <div
        onClick={onToggleRemoved}
        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
        title="Click to restore desk"
      >
        <span className="text-gray-400 text-xs">+</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`w-20 h-20 border-2 rounded-md flex items-center justify-center transition-colors ${
        isOver
          ? 'border-blue-500 bg-blue-50'
          : student
          ? 'border-gray-300 bg-gray-50'
          : 'border-gray-300 bg-white'
      }`}
    >
      {student ? (
        <div className="text-center">
          <div className="text-xs font-medium text-gray-900 truncate px-1">
            {student.name}
          </div>
          <button
            onClick={onToggleRemoved}
            className="text-xs text-gray-400 hover:text-red-500 mt-1"
            title="Remove desk"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-xs text-gray-400">Empty</div>
          <button
            onClick={onToggleRemoved}
            className="text-xs text-gray-400 hover:text-red-500 mt-1"
            title="Remove desk"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create DeskGrid component**

Create `src/components/charts/DeskGrid.tsx`:
```typescript
import { Desk } from './Desk';
import type { SeatingChart, Student } from '../../types';

interface DeskGridProps {
  chart: SeatingChart;
  students: Student[];
  onToggleDeskRemoved: (deskId: string) => void;
}

export function DeskGrid({ chart, students, onToggleDeskRemoved }: DeskGridProps) {
  // Calculate grid dimensions
  const maxRow = Math.max(...chart.desks.map((d) => d.row));
  const maxCol = Math.max(...chart.desks.map((d) => d.col));

  // Create a map for quick desk lookup
  const deskMap = new Map(chart.desks.map((d) => [`${d.row}-${d.col}`, d]));
  const assignmentMap = new Map(chart.assignments.map((a) => [a.deskId, a]));
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const rows = [];
  for (let row = 0; row <= maxRow; row++) {
    const cols = [];
    for (let col = 0; col <= maxCol; col++) {
      const desk = deskMap.get(`${row}-${col}`);
      if (desk) {
        const assignment = assignmentMap.get(desk.id);
        const student = assignment?.studentId
          ? studentMap.get(assignment.studentId)
          : undefined;

        cols.push(
          <Desk
            key={desk.id}
            desk={desk}
            assignment={assignment}
            student={student}
            onToggleRemoved={() => onToggleDeskRemoved(desk.id)}
          />
        );
      } else {
        // Empty cell in grid
        cols.push(<div key={`empty-${row}-${col}`} className="w-20 h-20" />);
      }
    }
    rows.push(
      <div key={row} className="flex gap-2 justify-center">
        {cols}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {rows}
      <div className="text-center text-sm text-gray-500 mt-4 border-t pt-2">
        FRONT OF ROOM
      </div>
    </div>
  );
}
```

**Step 4: Create UnassignedStudents component**

Create `src/components/charts/UnassignedStudents.tsx`:
```typescript
import { StudentCard } from './StudentCard';
import type { Student } from '../../types';

interface UnassignedStudentsProps {
  students: Student[];
}

export function UnassignedStudents({ students }: UnassignedStudentsProps) {
  return (
    <div className="w-48 bg-gray-50 rounded-lg p-4">
      <h3 className="font-medium text-gray-900 mb-3">
        Unassigned ({students.length})
      </h3>
      {students.length === 0 ? (
        <p className="text-sm text-gray-500">All students assigned</p>
      ) : (
        <div className="space-y-2">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Create ChartCanvas component**

Create `src/components/charts/ChartCanvas.tsx`:
```typescript
import { useState } from 'react';
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core';
import { DeskGrid } from './DeskGrid';
import { UnassignedStudents } from './UnassignedStudents';
import { StudentCard } from './StudentCard';
import type { SeatingChart, Student } from '../../types';

interface ChartCanvasProps {
  chart: SeatingChart;
  students: Student[];
  unassignedStudents: Student[];
  onAssign: (studentId: string, deskId: string) => void;
  onUnassign: (deskId: string) => void;
  onSwap: (deskId1: string, deskId2: string) => void;
  onToggleDeskRemoved: (deskId: string) => void;
}

export function ChartCanvas({
  chart,
  students,
  unassignedStudents,
  onAssign,
  onUnassign,
  onSwap,
  onToggleDeskRemoved,
}: ChartCanvasProps) {
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const student = students.find((s) => s.id === active.id);
    setActiveStudent(student || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStudent(null);

    if (!over) {
      // Dropped outside - unassign if was assigned
      const sourceAssignment = chart.assignments.find(
        (a) => a.studentId === active.id
      );
      if (sourceAssignment) {
        onUnassign(sourceAssignment.deskId);
      }
      return;
    }

    const targetDeskId = over.id as string;
    const targetAssignment = chart.assignments.find(
      (a) => a.deskId === targetDeskId
    );
    const sourceAssignment = chart.assignments.find(
      (a) => a.studentId === active.id
    );

    if (targetAssignment?.studentId && sourceAssignment) {
      // Swap students between desks
      onSwap(sourceAssignment.deskId, targetDeskId);
    } else {
      // Assign student to desk
      onAssign(active.id as string, targetDeskId);
    }
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="flex gap-4">
        <div className="flex-1 chart-printable">
          <DeskGrid
            chart={chart}
            students={students}
            onToggleDeskRemoved={onToggleDeskRemoved}
          />
        </div>
        <div className="no-print">
          <UnassignedStudents students={unassignedStudents} />
        </div>
      </div>
      <DragOverlay>
        {activeStudent && <StudentCard student={activeStudent} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
```

**Step 6: Create barrel export**

Create `src/components/charts/index.ts`:
```typescript
export { ChartCanvas } from './ChartCanvas';
export { DeskGrid } from './DeskGrid';
export { Desk } from './Desk';
export { StudentCard } from './StudentCard';
export { UnassignedStudents } from './UnassignedStudents';
```

**Step 7: Commit**

```bash
git add src/components/charts/
git commit -m "feat: add chart editor components with drag-and-drop"
```

---

### Task 4.3: Create Chart Editor View

**Files:**
- Create: `src/components/charts/ChartEditorView.tsx`
- Modify: `src/components/charts/index.ts`

**Step 1: Create ChartEditorView component**

Create `src/components/charts/ChartEditorView.tsx`:
```typescript
import { useRef } from 'react';
import { useChart } from '../../hooks/useChart';
import { useExport } from '../../hooks/useExport';
import { ChartCanvas } from './ChartCanvas';
import { Button } from '../ui';

interface ChartEditorViewProps {
  classId: string;
  chartId: string;
  onBack: () => void;
}

export function ChartEditorView({ classId, chartId, onBack }: ChartEditorViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const {
    chart,
    students,
    unassignedStudents,
    assignStudent,
    unassignStudent,
    swapStudents,
    randomize,
    toggleDeskRemoved,
  } = useChart(classId, chartId);

  const { exportAsImage, printChart } = useExport(chartRef);

  if (!chart) {
    return (
      <div className="p-6">
        <Button onClick={onBack} variant="ghost">
          ← Back
        </Button>
        <p className="mt-4 text-gray-500">Chart not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="ghost" className="no-print">
            ← Back
          </Button>
          <h2 className="text-xl font-bold text-gray-900">{chart.name}</h2>
        </div>
        <div className="flex gap-2 no-print">
          <Button onClick={randomize} variant="secondary">
            Randomize
          </Button>
          <Button onClick={printChart} variant="secondary">
            Print
          </Button>
          <Button onClick={exportAsImage} variant="secondary">
            Download PNG
          </Button>
        </div>
      </div>

      <div ref={chartRef}>
        <ChartCanvas
          chart={chart}
          students={students}
          unassignedStudents={unassignedStudents}
          onAssign={assignStudent}
          onUnassign={unassignStudent}
          onSwap={swapStudents}
          onToggleDeskRemoved={toggleDeskRemoved}
        />
      </div>
    </div>
  );
}
```

**Step 2: Update barrel export**

Modify `src/components/charts/index.ts`:
```typescript
export { ChartCanvas } from './ChartCanvas';
export { ChartEditorView } from './ChartEditorView';
export { DeskGrid } from './DeskGrid';
export { Desk } from './Desk';
export { StudentCard } from './StudentCard';
export { UnassignedStudents } from './UnassignedStudents';
```

**Step 3: Commit**

```bash
git add src/components/charts/
git commit -m "feat: add ChartEditorView with toolbar actions"
```

---

## Phase 5: Export Functionality

### Task 5.1: Create useExport Hook

**Files:**
- Create: `src/hooks/useExport.ts`

**Step 1: Create the export hook**

Create `src/hooks/useExport.ts`:
```typescript
import { useCallback, type RefObject } from 'react';
import html2canvas from 'html2canvas';

export function useExport(chartRef: RefObject<HTMLElement>) {
  const exportAsImage = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      // Find the printable element within the ref
      const printableElement =
        chartRef.current.querySelector('.chart-printable') || chartRef.current;

      const canvas = await html2canvas(printableElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `seating-chart-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export chart. Please try again.');
    }
  }, [chartRef]);

  const printChart = useCallback(() => {
    window.print();
  }, []);

  return { exportAsImage, printChart };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useExport.ts
git commit -m "feat: add useExport hook for print and image export"
```

---

## Phase 6: App Integration

### Task 6.1: Wire Up App Component

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Step 1: Update App.tsx**

Replace `src/App.tsx`:
```typescript
import { useState } from 'react';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/layout';
import { ClassView } from './components/classes';
import { ChartEditorView } from './components/charts';

type View =
  | { type: 'class' }
  | { type: 'chart'; classId: string; chartId: string };

function AppContent() {
  const [view, setView] = useState<View>({ type: 'class' });

  const handleEditChart = (classId: string, chartId: string) => {
    setView({ type: 'chart', classId, chartId });
  };

  const handleBackToClass = () => {
    setView({ type: 'class' });
  };

  return (
    <Layout>
      {view.type === 'class' ? (
        <ClassView onEditChart={handleEditChart} />
      ) : (
        <ChartEditorView
          classId={view.classId}
          chartId={view.chartId}
          onBack={handleBackToClass}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
```

**Step 2: Update main.tsx**

Replace `src/main.tsx`:
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 3: Run the app**

Run:
```bash
npm run dev
```

Expected: App runs at http://localhost:5173 with full functionality

**Step 4: Test manually**

1. Create a class
2. Add students
3. Create a seating chart
4. Drag students to desks
5. Test randomize
6. Test print
7. Test image download

**Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: integrate all components into App"
```

---

## Phase 7: Final Polish

### Task 7.1: Add Index Exports

**Files:**
- Create: `src/hooks/index.ts`
- Create: `src/utils/index.ts`

**Step 1: Create hook exports**

Create `src/hooks/index.ts`:
```typescript
export { usePersistedState } from './usePersistedState';
export { useChart } from './useChart';
export { useExport } from './useExport';
```

**Step 2: Create utils exports**

Create `src/utils/index.ts`:
```typescript
export { migrateState, DEFAULT_STATE } from './migrations';
export { randomizeAssignments, fisherYatesShuffle } from './randomize';
```

**Step 3: Commit**

```bash
git add src/hooks/index.ts src/utils/index.ts
git commit -m "chore: add barrel exports for hooks and utils"
```

---

### Task 7.2: Run All Tests

**Step 1: Run test suite**

Run:
```bash
npm run test
```

or:
```bash
npx vitest run
```

Expected: All tests PASS

**Step 2: Fix any failures**

If tests fail, debug and fix before proceeding.

**Step 3: Commit if any fixes**

```bash
git add -A
git commit -m "fix: resolve test failures"
```

---

### Task 7.3: Production Build Test

**Step 1: Build for production**

Run:
```bash
npm run build
```

Expected: Build completes without errors

**Step 2: Preview production build**

Run:
```bash
npm run preview
```

Expected: App works correctly at http://localhost:4173

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify production build"
```

---

## Summary

**Total Tasks**: 16
**Estimated Time**: 4-6 hours

**Key Files Created**:
- Types: `src/types/index.ts`
- Templates: `src/templates/index.ts`, `src/templates/generators.ts`
- Hooks: `src/hooks/usePersistedState.ts`, `src/hooks/useChart.ts`, `src/hooks/useExport.ts`
- Context: `src/contexts/AppContext.tsx`
- UI Components: `src/components/ui/*`
- Layout: `src/components/layout/*`
- Class Management: `src/components/classes/*`
- Chart Editor: `src/components/charts/*`
- Utils: `src/utils/migrations.ts`, `src/utils/randomize.ts`

**Dependencies**:
- React 18, TypeScript, Vite, Tailwind CSS
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- html2canvas, uuid
- Vitest, @testing-library/react
