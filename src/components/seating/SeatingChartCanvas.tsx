import { useMemo } from 'react';
import type { Student } from '../../types';
import type { SeatingChart } from '../../types/seatingChart';
import { TableGroup } from './TableGroup';
import { RoomElementDisplay } from './RoomElementDisplay';

interface SeatingChartCanvasProps {
  chart: SeatingChart;
  students: Student[];
  onClickStudent: (student: Student) => void;
  hideRoomElements?: boolean;
  showPointBreakdown?: boolean;
}

export function SeatingChartCanvas({
  chart,
  students,
  onClickStudent,
  hideRoomElements = false,
  showPointBreakdown = false,
}: SeatingChartCanvasProps) {
  // Create a map of student ID to student for quick lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Get unassigned students
  const assignedStudentIds = useMemo(() => {
    const ids = new Set<string>();
    chart.groups.forEach((g) => {
      g.seats.forEach((s) => {
        if (s.studentId) ids.add(s.studentId);
      });
    });
    return ids;
  }, [chart.groups]);

  const unassignedStudents = useMemo(() => {
    return students.filter((s) => !assignedStudentIds.has(s.id));
  }, [students, assignedStudentIds]);

  return (
    <div className="flex flex-col gap-4">
      {/* Canvas - use outline instead of border to avoid affecting content area */}
      <div
        className="relative outline outline-2 outline-gray-200 rounded-lg bg-white"
        style={{
          width: chart.canvasWidth,
          height: chart.canvasHeight,
          backgroundImage: chart.snapEnabled
            ? `
              linear-gradient(to right, #f5f5f5 1px, transparent 1px),
              linear-gradient(to bottom, #f5f5f5 1px, transparent 1px)
            `
            : undefined,
          backgroundSize: chart.snapEnabled ? `${chart.gridSize}px ${chart.gridSize}px` : undefined,
        }}
      >
        {/* Table Groups */}
        {chart.groups.map((group) => (
          <div
            key={group.id}
            className="absolute"
            style={{
              left: group.x,
              top: group.y,
            }}
          >
            <TableGroup
              group={group}
              students={studentMap}
              onClickStudent={onClickStudent}
              showPointBreakdown={showPointBreakdown}
            />
          </div>
        ))}

        {/* Room Elements */}
        {!hideRoomElements &&
          chart.roomElements.map((element) => {
            const grid = chart.gridSize;
            const rot = ((element.rotation % 360) + 360) % 360;

            const is90 = rot === 90;
            const is180 = rot === 180;
            const is270 = rot === 270;

            // Snap helper - everything should be integer grid multiples
            const snap = (v: number) => Math.round(v / grid) * grid;
            const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

            // Snap width/height to grid
            const w = snap(element.width);
            const h = snap(element.height);

            // Bounding box size after rotation (for right angles)
            const boxW = is90 || is270 ? h : w;
            const boxH = is90 || is270 ? w : h;

            const maxLeft = chart.canvasWidth - boxW;
            const maxTop = chart.canvasHeight - boxH;

            // Snap then clamp x/y
            const left = snap(clamp(element.x, 0, maxLeft));
            const top = snap(clamp(element.y, 0, maxTop));

            // Keep rotated content inside wrapper (origin top-left)
            const translate = is90
              ? `translate(${h}px, 0)`
              : is180
                ? `translate(${w}px, ${h}px)`
                : is270
                  ? `translate(0, ${w}px)`
                  : 'translate(0, 0)';

            return (
              <div
                key={element.id}
                className="absolute z-10"
                style={{ left, top, width: boxW, height: boxH }}
              >
                <div
                  style={{
                    width: w,
                    height: h,
                    transformOrigin: 'top left',
                    transform: `${translate} rotate(${rot}deg)`,
                  }}
                >
                  <RoomElementDisplay element={element} skipRotation />
                </div>
              </div>
            );
          })}
      </div>
      {/* Front of room label - positioned outside canvas so it doesn't overlap elements */}
      <div
        className="text-center text-sm text-gray-400 py-1 border-t border-gray-200 -mt-px"
        style={{ width: chart.canvasWidth }}
      >
        FRONT OF ROOM
      </div>

      {/* Unassigned Students */}
      {unassignedStudents.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Unassigned Students ({unassignedStudents.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {unassignedStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => onClickStudent(student)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: student.avatarColor || '#6B7280' }}
                >
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700">{student.name.split(' ')[0]}</span>
                <span
                  className={`text-xs font-medium ${student.pointTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {student.pointTotal >= 0 ? '+' : ''}
                  {student.pointTotal}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
