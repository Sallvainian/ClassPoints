import { memo, useCallback } from 'react';
import type { Student } from '../../types';
import type { CardSize } from '../../hooks/useDisplaySettings';
import { getAvatarColorForName } from '../../utils';
import { useAvatarColor } from '../../hooks';

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
    avatar: 'w-11 h-11 text-base',
    padding: 'p-3',
    name: 'text-xs',
    points: 'text-base',
    today: 'text-[10px]',
    badge: 'text-[9px] px-1.5 py-0',
    gap: 'mt-2',
  },
  medium: {
    avatar: 'w-16 h-16 text-xl',
    padding: 'p-4',
    name: 'text-sm',
    points: 'text-xl',
    today: 'text-[11px]',
    badge: 'text-[10px] px-1.5 py-0',
    gap: 'mt-3',
  },
  large: {
    avatar: 'w-20 h-20 text-2xl',
    padding: 'p-5',
    name: 'text-base',
    points: 'text-2xl',
    today: 'text-xs',
    badge: 'text-[11px] px-2 py-0.5',
    gap: 'mt-4',
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
  const isPositive = student.pointTotal >= 0;
  const pointsColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
  const rawColor = student.avatarColor || getAvatarColorForName(student.name);
  const { bg: bgColor, textClass: avatarTextColor } = useAvatarColor(rawColor);

  // Dual-mode: presence of onSelect → selectable; absence → opens award modal
  const isSelectable = !!onSelect;

  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(student.id);
    } else {
      onClickStudent(student);
    }
  }, [onSelect, onClickStudent, student]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const ariaRole = isSelectable ? 'checkbox' : undefined;
  const ariaChecked = isSelectable ? isSelected : undefined;

  // Tile state: selected wins over normal hover; normal hover gets accent border lift.
  const tileBorder = isSelected
    ? 'border-accent-500 ring-2 ring-accent-500/30'
    : 'border-hairline hover:border-accent-500/40';

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={ariaRole}
      aria-checked={ariaChecked}
      aria-label={`${student.name}, ${student.pointTotal} points${
        isSelectable ? (isSelected ? ', selected' : ', not selected') : ''
      }`}
      className={`group relative flex flex-col items-center w-full ${config.padding} bg-surface-2 border ${tileBorder} rounded-2xl transition-[border-color,transform,box-shadow,background-color] duration-150 hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1`}
    >
      {/* Corner point badges — only when totals enabled and not in selection mode */}
      {showPointTotals && !isSelectable && (
        <>
          <span
            className={`absolute top-1.5 left-1.5 ${config.badge} rounded-full font-mono tabular-nums font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}
          >
            +{student.positiveTotal}
          </span>
          <span
            className={`absolute top-1.5 right-1.5 ${config.badge} rounded-full font-mono tabular-nums font-medium bg-red-500/10 text-red-700 dark:text-red-400`}
          >
            {student.negativeTotal}
          </span>
        </>
      )}

      {/* Avatar */}
      <div
        className={`${config.avatar} rounded-full flex items-center justify-center ${avatarTextColor} font-semibold shadow-inner`}
        style={{ backgroundColor: bgColor }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span
        className={`${config.gap} ${config.name} font-display tracking-[-0.005em] text-ink-strong text-center truncate w-full leading-tight`}
      >
        {student.name}
      </span>

      {/* Points */}
      <span
        className={`mt-1 ${config.points} font-mono tabular-nums font-medium tracking-[-0.02em] ${pointsColor}`}
      >
        {isPositive ? '+' : ''}
        {student.pointTotal}
      </span>

      {/* Today's delta */}
      {student.todayTotal !== 0 && (
        <span
          className={`mt-0.5 ${config.today} font-mono tabular-nums tracking-[0.02em] text-ink-muted`}
        >
          {student.todayTotal >= 0 ? '+' : ''}
          {student.todayTotal} today
        </span>
      )}

      {/* Selection check pip — bottom-right when selected (cleaner than full-row checkbox) */}
      {isSelectable && isSelected && (
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-500 text-white shadow-[0_2px_6px_rgba(168,70,45,0.3)]"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
    </button>
  );
}

export const StudentPointCard = memo(StudentPointCardComponent);
