# 3. Data Model

## TypeScript Interfaces

```typescript
// src/types/index.ts

export interface Class {
  id: string; // UUID v4
  name: string; // "Period 1 Math", "Homeroom 202"
  students: Student[];
  charts: SeatingChart[];
  createdAt: number; // Unix timestamp
  updatedAt: number;
}

export interface Student {
  id: string; // UUID v4
  name: string; // Display name
}

export interface SeatingChart {
  id: string;
  name: string; // "Fall Arrangement", "Group Work"
  templateId: string; // Reference to base template
  desks: Desk[]; // Current desk configuration
  assignments: Assignment[];
  createdAt: number;
  updatedAt: number;
}

export interface Desk {
  id: string;
  row: number; // Grid row position
  col: number; // Grid column position
  isRemoved: boolean; // Soft delete for customization
}

export interface Assignment {
  deskId: string;
  studentId: string | null; // null = empty seat
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
  version: number; // Schema version for migrations
  classes: Class[];
  lastActiveClassId: string | null;
}
```

## localStorage Structure

```
Key: "seating-chart-data"
Value: JSON.stringify(AppState)
```

---
