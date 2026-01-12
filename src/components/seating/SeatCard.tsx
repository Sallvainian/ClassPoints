import { memo } from 'react';
import type { Student } from '../../types';
import { getAvatarColorForName, needsDarkText } from '../../utils';

interface SeatCardProps {
  student: Student | null;
  onClickStudent?: (student: Student) => void;
  onClickEmpty?: () => void;
  isDropTarget?: boolean;
  isDragging?: boolean;
}

function SeatCardComponent({
  student,
  onClickStudent,
  onClickEmpty,
  isDropTarget = false,
  isDragging = false,
}: SeatCardProps) {
  if (!student) {
    // Empty seat
    return (
      <button
        onClick={onClickEmpty}
        className={`
          w-full h-full min-h-[60px] min-w-[70px]
          border-2 border-dashed rounded-lg
          flex items-center justify-center
          transition-colors cursor-pointer
          ${
            isDropTarget
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
        `}
        title="Empty seat - drag a student here"
      >
        <span className="text-gray-400 text-xl">+</span>
      </button>
    );
  }

  // Student card
  const bgColor = student.avatarColor || getAvatarColorForName(student.name);
  const avatarTextColor = needsDarkText(bgColor) ? 'text-gray-800' : 'text-white';
  const pointsColor = student.pointTotal >= 0 ? 'text-emerald-600' : 'text-red-600';

  // Get first name only for compact display
  const firstName = student.name.split(' ')[0];

  return (
    <button
      onClick={() => onClickStudent?.(student)}
      className={`
        w-full h-full min-h-[60px] min-w-[70px]
        bg-white rounded-lg shadow-sm border
        flex flex-col items-center justify-center p-1
        transition-all cursor-pointer
        hover:shadow-md hover:border-blue-200
        ${isDropTarget ? 'border-blue-500 border-2' : 'border-gray-200'}
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${avatarTextColor} font-bold text-sm shadow-inner`}
        style={{ backgroundColor: bgColor }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span className="text-[10px] font-medium text-gray-800 text-center truncate w-full mt-0.5">
        {firstName}
      </span>

      {/* Points */}
      <span className={`text-xs font-bold ${pointsColor}`}>
        {student.pointTotal >= 0 ? '+' : ''}
        {student.pointTotal}
      </span>
    </button>
  );
}

export const SeatCard = memo(SeatCardComponent);
