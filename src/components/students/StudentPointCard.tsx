import { memo, useCallback } from 'react';
import type { Student } from '../../types';
import type { CardSize } from '../../hooks/useDisplaySettings';
import { getAvatarColorForName, needsDarkText } from '../../utils';

interface StudentPointCardProps {
  student: Student;
  /** Called when card is clicked in normal mode. Receives the student object. */
  onClickStudent: (student: Student) => void;
  size?: CardSize;
  showPointTotals?: boolean;
  isSelected?: boolean;
  /** If provided, card becomes selectable. Handler receives studentId. */
  onSelect?: (studentId: string) => void;
}

const SIZE_CONFIG = {
  small: {
    avatar: 'w-10 h-10 text-lg',
    padding: 'p-2',
    name: 'text-xs',
    points: 'text-lg',
    today: 'text-[10px]',
    badge: 'text-[9px] px-1 py-0.5',
    gap: 'mb-1',
  },
  medium: {
    avatar: 'w-16 h-16 text-2xl',
    padding: 'p-4',
    name: 'text-sm',
    points: 'text-xl',
    today: 'text-xs',
    badge: 'text-[10px] px-1.5 py-0.5',
    gap: 'mb-2',
  },
  large: {
    avatar: 'w-20 h-20 text-3xl',
    padding: 'p-6',
    name: 'text-base',
    points: 'text-2xl',
    today: 'text-sm',
    badge: 'text-xs px-2 py-1',
    gap: 'mb-3',
  },
};

function StudentPointCardComponent({
  student,
  onClickStudent,
  size = 'medium',
  showPointTotals = false,
  isSelected = false,
  onSelect,
}: StudentPointCardProps) {
  const config = SIZE_CONFIG[size];
  const pointsColor = student.pointTotal >= 0 ? 'text-emerald-600' : 'text-red-600';
  const bgColor = student.avatarColor || getAvatarColorForName(student.name);
  const avatarTextColor = needsDarkText(bgColor) ? 'text-gray-800' : 'text-white';

  // Derive selectable state from presence of onSelect handler
  const isSelectable = !!onSelect;

  const handleClick = useCallback(() => {
    if (onSelect) {
      // Selection mode: call onSelect with student ID
      onSelect(student.id);
    } else {
      // Normal mode: open award modal with student object
      onClickStudent(student);
    }
  }, [onSelect, onClickStudent, student]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // Determine ARIA role and state based on mode
  const ariaRole = isSelectable ? 'checkbox' : undefined;
  const ariaChecked = isSelectable ? isSelected : undefined;

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={ariaRole}
      aria-checked={ariaChecked}
      aria-label={`${student.name}, ${student.pointTotal} points${isSelectable ? (isSelected ? ', selected' : ', not selected') : ''}`}
      className={`
        relative flex flex-col items-center ${config.padding} bg-white rounded-xl shadow-sm border
        hover:shadow-md transition-all duration-200 cursor-pointer w-full
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${isSelected
          ? 'border-blue-500 border-2 bg-blue-50'
          : 'border-gray-100 hover:border-blue-200'
        }
      `}
    >

      {/* Point totals badges - only show when not in selection mode */}
      {showPointTotals && !isSelectable && (
        <>
          {/* Positive points - top left */}
          <div
            className={`absolute top-1 left-1 bg-emerald-100 text-emerald-700 ${config.badge} rounded-full font-medium`}
          >
            +{student.positiveTotal}
          </div>
          {/* Negative points - top right */}
          <div
            className={`absolute top-1 right-1 bg-red-100 text-red-700 ${config.badge} rounded-full font-medium`}
          >
            {student.negativeTotal}
          </div>
        </>
      )}

      {/* Avatar */}
      <div
        className={`${config.avatar} rounded-full flex items-center justify-center ${avatarTextColor} font-bold ${config.gap} shadow-inner`}
        style={{ backgroundColor: bgColor }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span className={`${config.name} font-medium text-gray-800 text-center truncate w-full`}>
        {student.name}
      </span>

      {/* Points */}
      <span className={`${config.points} font-bold mt-1 ${pointsColor}`}>
        {student.pointTotal >= 0 ? '+' : ''}{student.pointTotal}
      </span>

      {/* Today's points (small) */}
      {student.todayTotal !== 0 && (
        <span className={`${config.today} text-gray-500 mt-0.5`}>
          Today: {student.todayTotal >= 0 ? '+' : ''}{student.todayTotal}
        </span>
      )}

      {/* Selection checkbox indicator - bottom center (visual only, button handles interaction) */}
      {isSelectable && (
        <div
          aria-hidden="true"
          className={`
            mt-2 w-5 h-5 rounded border-2 flex items-center justify-center
            transition-colors duration-150 pointer-events-none
            ${isSelected
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-white border-gray-300'
            }
          `}
        >
          {isSelected && (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      )}
    </button>
  );
}

// Memoize to prevent unnecessary re-renders when parent state changes
export const StudentPointCard = memo(StudentPointCardComponent);
