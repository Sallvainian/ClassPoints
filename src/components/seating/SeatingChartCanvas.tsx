import { useMemo } from 'react';
import type { Student } from '../../types';
import type { SeatingChart } from '../../types/seatingChart';
import { TableGroup } from './TableGroup';
import { RoomElementDisplay } from './RoomElementDisplay';

interface SeatingChartCanvasProps {
  chart: SeatingChart;
  students: Student[];
  onClickStudent: (student: Student) => void;
}

export function SeatingChartCanvas({ chart, students, onClickStudent }: SeatingChartCanvasProps) {
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
      {/* Canvas */}
      <div
        className="relative border-2 border-gray-200 rounded-lg bg-white overflow-auto"
        style={{
          width: '100%',
          maxWidth: chart.canvasWidth,
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
            <TableGroup group={group} students={studentMap} onClickStudent={onClickStudent} />
          </div>
        ))}

        {/* Room Elements */}
        {chart.roomElements.map((element) => (
          <div
            key={element.id}
            className="absolute"
            style={{
              left: element.x,
              top: element.y,
            }}
          >
            <RoomElementDisplay element={element} />
          </div>
        ))}

        {/* Front of room label */}
        <div className="absolute bottom-0 left-0 right-0 text-center text-sm text-gray-400 py-2 border-t border-gray-100">
          FRONT OF ROOM
        </div>
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
