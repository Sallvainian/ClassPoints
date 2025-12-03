import { useMemo } from 'react';
import type { Student } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { StudentPointCard } from './StudentPointCard';

interface StudentGridProps {
  students: Student[];
  onStudentClick: (student: Student) => void;
}

export function StudentGrid({ students, onStudentClick }: StudentGridProps) {
  const { getStudentPoints } = useApp();

  // Sort students alphabetically
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [students]);

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <div className="text-6xl mb-4">👨‍🎓</div>
        <p className="text-lg font-medium">No students yet</p>
        <p className="text-sm mt-1">Add students in the settings to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {sortedStudents.map((student) => (
        <StudentPointCard
          key={student.id}
          student={student}
          points={getStudentPoints(student.id)}
          onClick={() => onStudentClick(student)}
        />
      ))}
    </div>
  );
}
