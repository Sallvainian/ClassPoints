import { useState, useCallback, useRef, useEffect } from 'react';
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
  showPointBreakdown?: boolean;
}

export function SeatingChartView({
  classroomId,
  students,
  onClickStudent,
  showPointBreakdown = false,
}: SeatingChartViewProps) {
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
    applyPreset,
  } = useSeatingChart(classroomId);

  const { presets, savePreset, deletePreset } = useLayoutPresets();
  const [isEditing, setIsEditing] = useState(false);
  const [hideRoomElements, setHideRoomElements] = useState(false);
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const ZOOM_STEP = 0.1;
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 1.5;

  // Calculate fit-to-screen scale on mount and resize
  useEffect(() => {
    if (!chart || !containerRef.current) return;

    const updateFitScale = () => {
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      const padding = 32;
      const availableWidth = containerWidth - padding;
      const newFitScale = Math.min(1, availableWidth / chart.canvasWidth);
      setFitScale(newFitScale);
      setScale(newFitScale);
    };

    updateFitScale();
    window.addEventListener('resize', updateFitScale);
    return () => window.removeEventListener('resize', updateFitScale);
  }, [chart]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleFitToScreen = useCallback(() => {
    setScale(fitScale);
  }, [fitScale]);

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
        presets={presets}
        onLoadPreset={applyPreset}
        onDeletePreset={deletePreset}
      />
    );
  }

  // View mode - show seating chart with edit button
  return (
    <div className="p-4" ref={containerRef}>
      {/* Header - chart name */}
      <h2 className="text-lg font-semibold text-gray-800 mb-2">{chart.name}</h2>

      {/* Controls - stacked above chart */}
      <div className="flex items-center gap-2 mb-4">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={handleZoomOut}
            disabled={scale <= MIN_ZOOM}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Zoom out"
          >
            <span className="text-lg font-medium text-gray-600">−</span>
          </button>
          <button
            onClick={handleFitToScreen}
            className="px-2 h-8 text-sm text-gray-600 hover:bg-white rounded-md transition-colors min-w-[4rem]"
            title="Fit to screen"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={scale >= MAX_ZOOM}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Zoom in"
          >
            <span className="text-lg font-medium text-gray-600">+</span>
          </button>
        </div>

        <button
          onClick={() => setHideRoomElements(!hideRoomElements)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            hideRoomElements
              ? 'bg-gray-100 border-gray-300 text-gray-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {hideRoomElements ? 'Show' : 'Hide'} Room Elements
        </button>
        <Button onClick={handleOpenEditor} variant="secondary" size="sm">
          Edit Seating Chart
        </Button>
      </div>

      {/* Seating chart canvas - scaled to fit container */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          height: chart.canvasHeight * scale + 80, // Adjust container height for scaled content
        }}
      >
        <SeatingChartCanvas
          chart={chart}
          students={students}
          onClickStudent={onClickStudent}
          hideRoomElements={hideRoomElements}
          showPointBreakdown={showPointBreakdown}
        />
      </div>
    </div>
  );
}
