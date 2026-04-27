import { useMemo } from 'react';
import type { Student } from '../../types';
import type { CardSize } from '../../hooks/useDisplaySettings';
import { StudentPointCard } from './StudentPointCard';

interface StudentGridProps {
  students: Student[];
  /** Called when a student card is clicked (normal mode). Receives the student object. */
  onStudentClick: (student: Student) => void;
  size?: CardSize;
  showPointTotals?: boolean;
  selectedStudentIds?: Set<string>;
  /** If provided, enables selection mode. Handler receives studentId. */
  onStudentSelect?: (studentId: string) => void;
}

const GRID_COLUMNS = {
  small: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10',
  medium: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  large: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

const GAP_SIZES = {
  small: 'gap-2',
  medium: 'gap-3',
  large: 'gap-4',
};

export function StudentGrid({
  students,
  onStudentClick,
  size = 'medium',
  showPointTotals = false,
  selectedStudentIds = new Set(),
  onStudentSelect,
}: StudentGridProps) {
  // Sort students alphabetically
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [students]);

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
          Empty roster
        </p>
        <p className="font-display text-3xl tracking-[-0.01em] text-ink-strong leading-tight">
          No students yet.
        </p>
        <p className="mt-2 text-sm text-ink-mid max-w-sm">
          Add students from settings to start tracking points.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid ${GRID_COLUMNS[size]} ${GAP_SIZES[size]} px-4 pb-4`}>
      {sortedStudents.map((student) => (
        <StudentPointCard
          key={student.id}
          student={student}
          // Pass handler reference directly - no closure needed
          // StudentPointCard will call onClickStudent(student) internally
          onClickStudent={onStudentClick}
          size={size}
          showPointTotals={showPointTotals}
          isSelected={selectedStudentIds.has(student.id)}
          // Pass handler reference directly - StudentPointCard calls onSelect(student.id)
          onSelect={onStudentSelect}
        />
      ))}
    </div>
  );
}
