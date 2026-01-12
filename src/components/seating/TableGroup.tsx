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

// Grid-aligned dimensions: 80x80 = 2 grid cells (40px each)
const SEAT_SIZE = 80;

function DroppableSeat({ seat, student, onClickStudent, onClickEmpty }: DroppableSeatProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `seat-${seat.id}`,
    data: { type: 'seat', seatId: seat.id },
  });

  return (
    <div ref={setNodeRef} style={{ width: SEAT_SIZE, height: SEAT_SIZE }}>
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

  // Grid-aligned total: 160x200 (4x5 grid cells)
  // - Badge row: 40px (1 grid cell)
  // - Seats: 80x80 each, 2x2 arrangement = 160x160 (4x4 grid cells)
  // Total: 160 wide x 200 tall
  const GROUP_WIDTH = SEAT_SIZE * 2; // 160px = 4 grid cells
  const GROUP_HEIGHT = 40 + SEAT_SIZE * 2; // 200px = 5 grid cells

  return (
    <div
      className={`
        relative
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''}
      `}
      onClick={(e) => {
        if (isEditing && onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      style={{
        ...groupStyle,
        width: GROUP_WIDTH,
        height: GROUP_HEIGHT,
      }}
    >
      {/* Letter badge - centered in top 40px row */}
      <div
        className={`
          absolute top-1 left-1/2 -translate-x-1/2 z-10
          w-7 h-7 rounded-full flex items-center justify-center
          text-white font-bold text-sm shadow-md
          ${bgColor}
        `}
      >
        {group.letter}
      </div>

      {/* Table group container - starts at 40px from top */}
      <div className="absolute" style={{ top: 40, left: 0, right: 0 }}>
        {/* 2x2 grid of seats */}
        <div className="grid grid-cols-2" style={{ width: GROUP_WIDTH }}>
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

        {/* Table divider between top and bottom rows - centered on 80px grid line */}
        <div
          className="absolute bg-gray-300"
          style={{
            top: SEAT_SIZE - 1,
            left: 0,
            right: 0,
            height: 2,
          }}
        />
      </div>
    </div>
  );
}

export const TableGroup = memo(TableGroupComponent);
