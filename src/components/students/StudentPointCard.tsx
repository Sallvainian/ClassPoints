import type { Student } from '../../types';
import { getAvatarColorForName } from '../../utils';

interface StudentPointCardProps {
  student: Student;
  onClick: () => void;
}

export function StudentPointCard({ student, onClick }: StudentPointCardProps) {
  const pointsColor = student.pointTotal >= 0 ? 'text-emerald-600' : 'text-red-600';
  const bgColor = student.avatarColor || getAvatarColorForName(student.name);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer w-full"
    >
      {/* Avatar */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 shadow-inner"
        style={{ backgroundColor: bgColor }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span className="text-sm font-medium text-gray-800 text-center truncate w-full">
        {student.name}
      </span>

      {/* Points */}
      <span className={`text-xl font-bold mt-1 ${pointsColor}`}>
        {student.pointTotal >= 0 ? '+' : ''}{student.pointTotal}
      </span>

      {/* Today's points (small) */}
      {student.todayTotal !== 0 && (
        <span className="text-xs text-gray-500 mt-0.5">
          Today: {student.todayTotal >= 0 ? '+' : ''}{student.todayTotal}
        </span>
      )}
    </button>
  );
}
