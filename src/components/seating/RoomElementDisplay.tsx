import { memo } from 'react';
import type { RoomElement } from '../../types/seatingChart';

interface RoomElementDisplayProps {
  element: RoomElement;
  isSelected?: boolean;
  onSelect?: () => void;
  isEditing?: boolean;
  skipRotation?: boolean;
}

function RoomElementDisplayComponent({
  element,
  isSelected = false,
  onSelect,
  isEditing = false,
  skipRotation = false,
}: RoomElementDisplayProps) {
  const style: React.CSSProperties = {
    width: element.width,
    height: element.height,
    transform: skipRotation ? undefined : `rotate(${element.rotation}deg)`,
  };

  // Element type styling - use outline with negative offset so it stays inside the box
  const typeStyles: Record<string, string> = {
    teacher_desk:
      'bg-amber-100 outline outline-2 -outline-offset-2 outline-amber-500 text-amber-800',
    door: 'bg-green-100 outline outline-2 -outline-offset-2 outline-green-500 text-green-800',
    window: 'bg-sky-100 outline outline-2 -outline-offset-2 outline-sky-500 text-sky-800',
    countertop: 'bg-stone-200 outline outline-2 -outline-offset-2 outline-stone-500 text-stone-800',
    sink: 'bg-blue-200 outline outline-2 -outline-offset-2 outline-blue-500 text-blue-800',
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
        rounded flex items-center justify-center select-none
        transition-colors
        ${isSelected ? 'ring-2 ring-blue-300' : ''}
        ${typeStyles[element.type] || 'bg-gray-100 outline outline-2 -outline-offset-2 outline-gray-400'}
        ${isEditing ? 'cursor-move' : ''}
      `}
      style={style}
      onClick={(e) => {
        if (isEditing && onSelect) {
          e.stopPropagation();
          onSelect();
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
