# 7. Drag-and-Drop Implementation

## DnD Setup

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

## Randomize Algorithm

```typescript
// src/utils/randomize.ts

export function randomizeAssignments(students: Student[], desks: Desk[]): Assignment[] {
  const availableDesks = desks.filter((d) => !d.isRemoved).map((d) => d.id);

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
