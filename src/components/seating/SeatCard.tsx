import { memo } from 'react';
import type { Student } from '../../types';
import { getAvatarColorForName } from '../../utils';
import { useAvatarColor } from '../../hooks';

interface SeatCardProps {
  student: Student | null;
  onClickStudent?: (student: Student) => void;
  onClickEmpty?: () => void;
  onUnassign?: () => void;
  isDropTarget?: boolean;
  isDragging?: boolean;
  isEditing?: boolean;
  showPointBreakdown?: boolean;
}

function SeatCardComponent({
  student,
  onClickStudent,
  onClickEmpty,
  onUnassign: _onUnassign,
  isDropTarget = false,
  isDragging = false,
  isEditing: _isEditing = false,
  showPointBreakdown = false,
}: SeatCardProps) {
  // Reserved for future use
  void _onUnassign;
  void _isEditing;

  // Hooks must run unconditionally — resolve avatar color even when empty.
  const rawColor = student ? student.avatarColor || getAvatarColorForName(student.name) : '#e5e7eb';
  const { bg: bgColor, textClass: avatarTextColor } = useAvatarColor(rawColor);

  if (!student) {
    // Empty seat - fills parent 100x100 container
    return (
      <button
        onClick={onClickEmpty}
        className={`
          w-full h-full
          flex items-center justify-center
          transition-colors cursor-pointer
          ${isDropTarget ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800'}
        `}
        title="Empty seat - drag a student here"
      >
        <span className="text-gray-400 dark:text-zinc-600 text-2xl">+</span>
      </button>
    );
  }
  const pointsColor =
    student.pointTotal >= 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';

  // Get first name only for compact display
  const firstName = student.name.split(' ')[0];

  return (
    <div className="relative w-full h-full group">
      <button
        onClick={() => onClickStudent?.(student)}
        className={`
          w-full h-full
          bg-white dark:bg-zinc-900 rounded-lg shadow-sm border
          flex flex-col items-center justify-center p-1
          transition-all cursor-pointer
          hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900
          ${isDropTarget ? 'border-blue-500 border-2' : 'border-gray-200 dark:border-zinc-800'}
          ${isDragging ? 'opacity-50' : ''}
        `}
      >
        {/* Point totals badges - same as StudentPointCard */}
        {showPointBreakdown && (
          <>
            {/* Positive points - top left */}
            <div className="absolute top-1 left-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[9px] px-1 py-0.5 rounded-full font-medium">
              +{student.positiveTotal}
            </div>
            {/* Negative points - top right */}
            <div className="absolute top-1 right-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[9px] px-1 py-0.5 rounded-full font-medium">
              {student.negativeTotal}
            </div>
          </>
        )}

        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${avatarTextColor} font-bold text-base shadow-inner`}
          style={{ backgroundColor: bgColor }}
        >
          {student.name.charAt(0).toUpperCase()}
        </div>

        {/* Name */}
        <span className="text-xs font-medium text-gray-800 dark:text-zinc-100 text-center truncate w-full mt-1">
          {firstName}
        </span>

        {/* Points */}
        <span className={`text-xs font-bold ${pointsColor}`}>
          {student.pointTotal >= 0 ? '+' : ''}
          {student.pointTotal}
        </span>
      </button>
    </div>
  );
}

export const SeatCard = memo(SeatCardComponent);
