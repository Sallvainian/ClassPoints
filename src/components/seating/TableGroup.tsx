import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Student } from '../../types';
import type { SeatingGroup, SeatAssignment } from '../../types/seatingChart';
import { getGroupColor } from '../../types/seatingChart';
import { SeatCard } from './SeatCard';

interface TableGroupProps {
  group: SeatingGroup;
  students: Map<string, Student>;
  onClickStudent?: (student: Student) => void;
  onClickEmptySeat?: (seatId: string) => void;
  isSelected?: boolean;
  onSelect?: () => void;
  isEditing?: boolean;
}

interface DroppableSeatProps {
  seat: SeatAssignment;
  student: Student | null;
  onClickStudent?: (student: Student) => void;
  onClickEmpty?: () => void;
}

function DroppableSeat({ seat, student, onClickStudent, onClickEmpty }: DroppableSeatProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `seat-${seat.id}`,
    data: { type: 'seat', seatId: seat.id },
  });

  return (
    <div ref={setNodeRef} className="w-[80px] h-[70px]">
      <SeatCard
        student={student}
        onClickStudent={onClickStudent}
        onClickEmpty={onClickEmpty}
        isDropTarget={isOver}
      />
    </div>
  );
}

function TableGroupComponent({
  group,
  students,
  onClickStudent,
  onClickEmptySeat,
  isSelected = false,
  onSelect,
  isEditing = false,
}: TableGroupProps) {
  const bgColor = getGroupColor(group.letter);

  // Get students for each seat position
  const getStudentForSeat = (seat: SeatAssignment): Student | null => {
    if (!seat.studentId) return null;
    return students.get(seat.studentId) || null;
  };

  // Sort seats by position
  const sortedSeats = [...group.seats].sort((a, b) => a.positionInGroup - b.positionInGroup);
  const [seat1, seat2, seat3, seat4] = sortedSeats;

  const groupStyle: React.CSSProperties = {
    transform: `rotate(${group.rotation}deg)`,
  };

  return (
    <div
      className={`
        relative flex flex-col items-center
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''}
      `}
      onClick={(e) => {
        if (isEditing && onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      style={groupStyle}
    >
      {/* Letter badge */}
      <div
        className={`
          absolute -top-3 left-1/2 -translate-x-1/2 z-10
          w-7 h-7 rounded-full flex items-center justify-center
          text-white font-bold text-sm shadow-md
          ${bgColor}
        `}
      >
        {group.letter}
      </div>

      {/* Table group container */}
      <div className="pt-4 flex flex-col gap-1">
        {/* Top row (seats 1 and 2) - Table 1 */}
        <div className="flex gap-1">
          {seat1 && (
            <DroppableSeat
              seat={seat1}
              student={getStudentForSeat(seat1)}
              onClickStudent={onClickStudent}
              onClickEmpty={() => onClickEmptySeat?.(seat1.id)}
            />
          )}
          {seat2 && (
            <DroppableSeat
              seat={seat2}
              student={getStudentForSeat(seat2)}
              onClickStudent={onClickStudent}
              onClickEmpty={() => onClickEmptySeat?.(seat2.id)}
            />
          )}
        </div>

        {/* Table divider */}
        <div className="h-1 bg-gray-300 rounded mx-2" />

        {/* Bottom row (seats 3 and 4) - Table 2 */}
        <div className="flex gap-1">
          {seat3 && (
            <DroppableSeat
              seat={seat3}
              student={getStudentForSeat(seat3)}
              onClickStudent={onClickStudent}
              onClickEmpty={() => onClickEmptySeat?.(seat3.id)}
            />
          )}
          {seat4 && (
            <DroppableSeat
              seat={seat4}
              student={getStudentForSeat(seat4)}
              onClickStudent={onClickStudent}
              onClickEmpty={() => onClickEmptySeat?.(seat4.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const TableGroup = memo(TableGroupComponent);
