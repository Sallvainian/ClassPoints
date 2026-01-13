import { memo } from 'react';
import type { Student } from '../../types';
import { getAvatarColorForName, needsDarkText } from '../../utils';

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
  if (!student) {
    // Empty seat - fills parent 100x100 container
    return (
      <button
        onClick={onClickEmpty}
        className={`
          w-full h-full
          flex items-center justify-center
          transition-colors cursor-pointer
          ${isDropTarget ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'}
        `}
        title="Empty seat - drag a student here"
      >
        <span className="text-gray-400 text-2xl">+</span>
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
    <div className="relative w-full h-full group">
      <button
        onClick={() => onClickStudent?.(student)}
        className={`
          w-full h-full
          bg-white rounded-lg shadow-sm border
          flex flex-col items-center justify-center p-1
          transition-all cursor-pointer
          hover:shadow-md hover:border-blue-200
          ${isDropTarget ? 'border-blue-500 border-2' : 'border-gray-200'}
          ${isDragging ? 'opacity-50' : ''}
        `}
      >
        {/* Point totals badges - same as StudentPointCard */}
        {showPointBreakdown && (
          <>
            {/* Positive points - top left */}
            <div className="absolute top-1 left-1 bg-emerald-100 text-emerald-700 text-[9px] px-1 py-0.5 rounded-full font-medium">
              +{student.positiveTotal}
            </div>
            {/* Negative points - top right */}
            <div className="absolute top-1 right-1 bg-red-100 text-red-700 text-[9px] px-1 py-0.5 rounded-full font-medium">
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
        <span className="text-xs font-medium text-gray-800 text-center truncate w-full mt-1">
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
