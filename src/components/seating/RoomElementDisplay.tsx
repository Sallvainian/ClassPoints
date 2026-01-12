import { memo } from 'react';
import type { RoomElement } from '../../types/seatingChart';

interface RoomElementDisplayProps {
  element: RoomElement;
  isSelected?: boolean;
  onSelect?: () => void;
  onRotate?: () => void;
  isEditing?: boolean;
}

function RoomElementDisplayComponent({
  element,
  isSelected = false,
  onSelect,
  onRotate,
  isEditing = false,
}: RoomElementDisplayProps) {
  const isTeacherDesk = element.type === 'teacher_desk';
  const isDoor = element.type === 'door';

  const style: React.CSSProperties = {
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
  };

  return (
    <div
      className={`
        rounded border-2 flex items-center justify-center select-none
        transition-colors
        ${isSelected ? 'ring-2 ring-blue-300' : ''}
        ${
          isTeacherDesk
            ? 'bg-amber-100 border-amber-500 text-amber-800'
            : isDoor
              ? 'bg-green-100 border-green-500 text-green-800'
              : 'bg-gray-100 border-gray-400'
        }
        ${isEditing ? 'cursor-move' : ''}
      `}
      style={style}
      onClick={(e) => {
        if (isEditing && onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onDoubleClick={(e) => {
        if (isEditing && onRotate) {
          e.stopPropagation();
          onRotate();
        }
      }}
    >
      <span className="text-xs font-medium text-center px-1 pointer-events-none">
        {element.label || (isTeacherDesk ? 'Teacher' : 'Door')}
      </span>
    </div>
  );
}

export const RoomElementDisplay = memo(RoomElementDisplayComponent);
