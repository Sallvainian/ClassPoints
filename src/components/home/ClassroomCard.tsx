import { memo, useCallback } from 'react';

interface ClassroomCardClassroom {
  id: string;
  name: string;
  students: { id: string; name: string }[];
  pointTotal?: number;
  positiveTotal?: number;
  negativeTotal?: number;
}

interface ClassroomCardProps {
  classroom: ClassroomCardClassroom;
  onClick: (classroomId: string) => void;
}

function ClassroomCardComponent({ classroom, onClick }: ClassroomCardProps) {
  const handleClick = useCallback(() => {
    onClick(classroom.id);
  }, [onClick, classroom.id]);

  const pointTotal = classroom.pointTotal ?? 0;
  const positiveTotal = classroom.positiveTotal ?? 0;
  const negativeTotal = classroom.negativeTotal ?? 0;
  const studentCount = classroom.students.length;

  return (
    <button
      onClick={handleClick}
      className="w-full bg-linear-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">📚</div>
          <div>
            <h3 className="text-lg font-bold">{classroom.name}</h3>
            <p className="text-white/80 text-sm">
              {studentCount} student{studentCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold">
            {pointTotal >= 0 ? '+' : ''}
            {pointTotal}
          </div>
          <div className="text-sm flex gap-2 justify-end">
            <span className="text-emerald-300">+{positiveTotal}</span>
            <span className="text-red-300">{negativeTotal}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export const ClassroomCard = memo(ClassroomCardComponent);
