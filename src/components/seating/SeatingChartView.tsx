import { useState, useCallback } from 'react';
import type { Student } from '../../types';
import { useSeatingChart } from '../../hooks/useSeatingChart';
import { useLayoutPresets } from '../../hooks/useLayoutPresets';
import { EmptyChartPrompt } from './EmptyChartPrompt';
import { SeatingChartCanvas } from './SeatingChartCanvas';
import { SeatingChartEditor } from './SeatingChartEditor';
import { Button } from '../ui/Button';

interface SeatingChartViewProps {
  classroomId: string;
  students: Student[];
  onClickStudent: (student: Student) => void;
}

export function SeatingChartView({ classroomId, students, onClickStudent }: SeatingChartViewProps) {
  const {
    chart,
    loading,
    error,
    createChart,
    addGroup,
    moveGroup,
    deleteGroup,
    rotateGroup,
    assignStudent,
    unassignStudent,
    swapStudents,
    randomizeAssignments,
    addRoomElement,
    moveRoomElement,
    resizeRoomElement,
    deleteRoomElement,
    rotateRoomElement,
    updateSettings,
  } = useSeatingChart(classroomId);

  const { presets, savePreset } = useLayoutPresets();
  const [isEditing, setIsEditing] = useState(false);

  const handleCreateChart = useCallback(async () => {
    await createChart();
    setIsEditing(true);
  }, [createChart]);

  const handleOpenEditor = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSavePreset = useCallback(
    async (name: string) => {
      if (chart) {
        await savePreset(name, chart);
      }
    },
    [chart, savePreset]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-600">
        <p>Error loading seating chart: {error.message}</p>
      </div>
    );
  }

  // No chart exists - show empty prompt
  if (!chart) {
    return <EmptyChartPrompt onCreateChart={handleCreateChart} hasPresets={presets.length > 0} />;
  }

  // Editor mode
  if (isEditing) {
    return (
      <SeatingChartEditor
        chart={chart}
        students={students}
        onClose={handleCloseEditor}
        onAddGroup={addGroup}
        onMoveGroup={moveGroup}
        onDeleteGroup={deleteGroup}
        onRotateGroup={rotateGroup}
        onAssignStudent={assignStudent}
        onUnassignStudent={unassignStudent}
        onSwapStudents={swapStudents}
        onRandomize={() => randomizeAssignments(students)}
        onAddRoomElement={addRoomElement}
        onMoveRoomElement={moveRoomElement}
        onResizeRoomElement={resizeRoomElement}
        onDeleteRoomElement={deleteRoomElement}
        onRotateRoomElement={rotateRoomElement}
        onUpdateSettings={updateSettings}
        onSavePreset={handleSavePreset}
      />
    );
  }

  // View mode - show seating chart with edit button
  return (
    <div className="p-4">
      {/* Header with edit button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">{chart.name}</h2>
        <Button onClick={handleOpenEditor} variant="secondary" size="sm">
          Edit Seating Chart
        </Button>
      </div>

      {/* Seating chart canvas */}
      <SeatingChartCanvas chart={chart} students={students} onClickStudent={onClickStudent} />
    </div>
  );
}
