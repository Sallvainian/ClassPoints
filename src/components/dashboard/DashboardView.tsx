import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Student, PointTransaction } from '../../types';
import type { CardSize } from '../../hooks/useDisplaySettings';
import { useApp } from '../../contexts/AppContext';
import { useDisplaySettings } from '../../hooks/useDisplaySettings';
import { StudentGrid } from '../students/StudentGrid';
import { AwardPointsModal } from '../points/AwardPointsModal';
import { ClassAwardModal } from '../points/ClassAwardModal';
import { MultiAwardModal } from '../points/MultiAwardModal';
import { ClassPointsBox } from '../points/ClassPointsBox';
import { UndoToast } from '../points/UndoToast';
import { TodaySummary } from '../points/TodaySummary';
import { SoundSettingsModal } from '../settings/SoundSettingsModal';
import { Button } from '../ui/Button';
import { ErrorToast } from '../ui/ErrorToast';
import { BottomToolbar } from './BottomToolbar';

interface DashboardViewProps {
  onOpenSettings: () => void;
}

export function DashboardView({ onOpenSettings }: DashboardViewProps) {
  const {
    activeClassroom,
    getClassroomTransactions,
    getClassPoints,
    getRecentUndoableAction,
    undoTransaction,
    undoBatchTransaction,
    loading,
    error,
  } = useApp();

  // Display settings
  const { settings, setCardSize, toggleShowPointTotals } = useDisplaySettings();

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [isClassAwardModalOpen, setIsClassAwardModalOpen] = useState(false);
  const [isMultiAwardModalOpen, setIsMultiAwardModalOpen] = useState(false);
  const [undoableAction, setUndoableAction] = useState(getRecentUndoableAction());
  const [showActivity, setShowActivity] = useState(false);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Operation error state (for undo failures, etc.)
  const [operationError, setOperationError] = useState<string | null>(null);

  // Refresh undoable action periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 1000);

    return () => clearInterval(interval);
  }, [getRecentUndoableAction]);

  // Get selected students as array for MultiAwardModal
  const selectedStudents = useMemo(() => {
    if (!activeClassroom) return [];
    return activeClassroom.students.filter((s) => selectedStudentIds.has(s.id));
  }, [activeClassroom, selectedStudentIds]);

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setIsAwardModalOpen(true);
  };

  const handleStudentSelect = useCallback((studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedStudentIds(new Set());
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedStudentIds(new Set());
  };

  const handleSelectAll = () => {
    if (!activeClassroom) return;
    setSelectedStudentIds(new Set(activeClassroom.students.map((s) => s.id)));
  };

  const handleRandomStudent = useCallback(() => {
    if (!activeClassroom || activeClassroom.students.length === 0) return;
    const randomIndex = Math.floor(Math.random() * activeClassroom.students.length);
    const randomStudent = activeClassroom.students[randomIndex];
    setSelectedStudent(randomStudent);
    setIsAwardModalOpen(true);
  }, [activeClassroom]);

  const handleCloseModal = () => {
    setIsAwardModalOpen(false);
    setSelectedStudent(null);
    // Refresh undoable action after awarding
    setTimeout(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 100);
  };

  const handleCloseClassModal = () => {
    setIsClassAwardModalOpen(false);
    // Refresh undoable action after awarding
    setTimeout(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 100);
  };

  const handleCloseMultiModal = () => {
    setIsMultiAwardModalOpen(false);
    // Exit selection mode after successful award
    handleExitSelectionMode();
    // Refresh undoable action after awarding
    setTimeout(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 100);
  };

  const handleUndo = useCallback(async (transactionId: string) => {
    try {
      // Check if this is a batch undo (class-wide award)
      if (undoableAction?.isBatch && undoableAction.batchId) {
        await undoBatchTransaction(undoableAction.batchId);
      } else {
        await undoTransaction(transactionId);
      }
      setUndoableAction(null);
    } catch (err) {
      console.error('Failed to undo transaction:', err);
      setOperationError('Failed to undo. Please try again.');
    }
  }, [undoTransaction, undoBatchTransaction, undoableAction]);

  // Map database transactions to app format for TodaySummary
  // This useMemo must be called unconditionally (before early returns)
  const transactions: PointTransaction[] = useMemo(() => {
    if (!activeClassroom) return [];
    const dbTransactions = getClassroomTransactions(activeClassroom.id, 20);
    return dbTransactions.map(t => ({
      id: t.id,
      studentId: t.student_id,
      classroomId: t.classroom_id,
      behaviorId: t.behavior_id || '',
      behaviorName: t.behavior_name,
      behaviorIcon: t.behavior_icon,
      points: t.points,
      timestamp: new Date(t.created_at).getTime(),
      note: t.note || undefined,
    }));
  }, [activeClassroom, getClassroomTransactions]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600">Loading your classroom...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-center text-red-600 mb-4 max-w-md">{error.message}</p>
        <Button onClick={() => window.location.reload()} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  if (!activeClassroom) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <div className="text-8xl mb-6">🎓</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to ClassPoints!</h2>
        <p className="text-center mb-6 max-w-md">
          Create a classroom to start tracking student behavior and awarding points.
        </p>
        <Button onClick={onOpenSettings} variant="primary" size="lg">
          Create Your First Classroom
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        {/* Top row: Classroom name and core actions */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{activeClassroom.name}</h1>
            <p className="text-sm text-gray-500">
              {activeClassroom.students.length} student{activeClassroom.students.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SoundSettingsModal />
            <Button variant="ghost" size="sm" onClick={onOpenSettings}>
              ⚙️ Settings
            </Button>
          </div>
        </div>

        {/* Bottom row: Display controls and selection */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Left side: Display controls */}
          <div className="flex items-center gap-3">
            {/* Card size toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {(['small', 'medium', 'large'] as CardSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setCardSize(size)}
                  className={`
                    px-2 py-1 text-xs font-medium rounded-md transition-colors
                    ${settings.cardSize === size
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                  title={`${size.charAt(0).toUpperCase() + size.slice(1)} cards`}
                >
                  {size.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>

            {/* Point totals toggle */}
            <button
              onClick={toggleShowPointTotals}
              className={`
                px-2 py-1 text-xs font-medium rounded-lg transition-colors
                ${settings.showPointTotals
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                }
              `}
              title="Show positive/negative point totals"
            >
              +/-
            </button>

            {/* Activity toggle */}
            <button
              onClick={() => setShowActivity(!showActivity)}
              className={`
                px-2 py-1 text-xs font-medium rounded-lg transition-colors
                ${showActivity
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Activity
            </button>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Student Grid */}
        <div className={`flex-1 overflow-y-auto bg-gray-50 ${showActivity ? 'border-r' : ''}`}>
          {/* Class Points Box */}
          {activeClassroom.students.length > 0 && (
            <div className="p-4 pb-0">
              <ClassPointsBox
                classPoints={getClassPoints(
                  activeClassroom.id,
                  activeClassroom.students.map((s) => s.id)
                )}
                studentCount={activeClassroom.students.length}
                onClick={() => setIsClassAwardModalOpen(true)}
              />
            </div>
          )}

          <StudentGrid
            students={activeClassroom.students}
            onStudentClick={handleStudentClick}
            size={settings.cardSize}
            showPointTotals={settings.showPointTotals}
            selectedStudentIds={selectedStudentIds}
            // Only pass onStudentSelect when in selection mode - this enables selection behavior
            onStudentSelect={selectionMode ? handleStudentSelect : undefined}
          />
        </div>

        {/* Activity Sidebar */}
        {showActivity && (
          <div className="w-80 bg-white overflow-y-auto p-4">
            <h2 className="font-semibold text-gray-800 mb-4">Recent Activity</h2>
            <TodaySummary
              transactions={transactions}
              students={activeClassroom.students}
              limit={15}
            />
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <BottomToolbar
        selectionMode={selectionMode}
        selectedCount={selectedStudentIds.size}
        totalStudents={activeClassroom.students.length}
        onEnterSelectionMode={handleEnterSelectionMode}
        onExitSelectionMode={handleExitSelectionMode}
        onSelectAll={handleSelectAll}
        onAwardPoints={() => setIsMultiAwardModalOpen(true)}
        onRandomStudent={handleRandomStudent}
        hasStudents={activeClassroom.students.length > 0}
      />

      {/* Award Points Modal (single student) */}
      <AwardPointsModal
        isOpen={isAwardModalOpen}
        onClose={handleCloseModal}
        student={selectedStudent}
        classroomId={activeClassroom.id}
      />

      {/* Class Award Modal */}
      <ClassAwardModal
        isOpen={isClassAwardModalOpen}
        onClose={handleCloseClassModal}
        classroomId={activeClassroom.id}
        classroomName={activeClassroom.name}
        studentCount={activeClassroom.students.length}
        classPoints={getClassPoints(
          activeClassroom.id,
          activeClassroom.students.map((s) => s.id)
        )}
      />

      {/* Multi Award Modal (selected students) */}
      <MultiAwardModal
        isOpen={isMultiAwardModalOpen}
        onClose={handleCloseMultiModal}
        selectedStudents={selectedStudents}
        classroomId={activeClassroom.id}
      />

      {/* Undo Toast */}
      <UndoToast action={undoableAction} onUndo={handleUndo} />

      {/* Error Toast */}
      <ErrorToast error={operationError} onDismiss={() => setOperationError(null)} />
    </div>
  );
}
