import { memo } from 'react';
import type { RoomElement } from '../../types/seatingChart';

interface RoomElementDisplayProps {
  element: RoomElement;
  isSelected?: boolean;
  onSelect?: () => void;
  onRotate?: () => void;
  isEditing?: boolean;
  skipRotation?: boolean;
}

function RoomElementDisplayComponent({
  element,
  isSelected = false,
  onSelect,
  onRotate,
  isEditing = false,
  skipRotation = false,
}: RoomElementDisplayProps) {
  const style: React.CSSProperties = {
    width: element.width,
    height: element.height,
    transform: skipRotation ? undefined : `rotate(${element.rotation}deg)`,
  };

  // Element type styling
  const typeStyles: Record<string, string> = {
    teacher_desk: 'bg-amber-100 border-amber-500 text-amber-800',
    door: 'bg-green-100 border-green-500 text-green-800',
    window: 'bg-sky-100 border-sky-500 text-sky-800',
    countertop: 'bg-stone-200 border-stone-500 text-stone-800',
    sink: 'bg-blue-200 border-blue-500 text-blue-800',
  };

  const defaultLabels: Record<string, string> = {
    teacher_desk: 'Teacher',
    door: 'Door',
    window: 'Window',
    countertop: 'Counter',
    sink: 'Sink',
  };

  return (
    <div
      className={`
        rounded border-2 flex items-center justify-center select-none
        transition-colors
        ${isSelected ? 'ring-2 ring-blue-300' : ''}
        ${typeStyles[element.type] || 'bg-gray-100 border-gray-400'}
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
        {element.label || defaultLabels[element.type] || element.type}
      </span>
    </div>
  );
}

export const RoomElementDisplay = memo(RoomElementDisplayComponent);
