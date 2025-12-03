import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Student, PointTransaction } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { StudentGrid } from '../students/StudentGrid';
import { AwardPointsModal } from '../points/AwardPointsModal';
import { ClassAwardModal } from '../points/ClassAwardModal';
import { ClassPointsBox } from '../points/ClassPointsBox';
import { UndoToast } from '../points/UndoToast';
import { TodaySummary } from '../points/TodaySummary';
import { Button } from '../ui/Button';

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
    loading,
    error,
  } = useApp();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [isClassAwardModalOpen, setIsClassAwardModalOpen] = useState(false);
  const [undoableAction, setUndoableAction] = useState(getRecentUndoableAction());
  const [showActivity, setShowActivity] = useState(false);

  // Refresh undoable action periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 1000);

    return () => clearInterval(interval);
  }, [getRecentUndoableAction]);

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setIsAwardModalOpen(true);
  };

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

  const handleUndo = useCallback(async (transactionId: string) => {
    try {
      await undoTransaction(transactionId);
      setUndoableAction(null);
    } catch (err) {
      console.error('Failed to undo transaction:', err);
    }
  }, [undoTransaction]);

  // Get transactions - must be called before any early returns to maintain hooks order
  const dbTransactions = activeClassroom
    ? getClassroomTransactions(activeClassroom.id, 20)
    : [];

  // Map database transactions to app format for TodaySummary
  // This useMemo must be called unconditionally (before early returns)
  const transactions: PointTransaction[] = useMemo(() => {
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
  }, [dbTransactions]);

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
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{activeClassroom.name}</h1>
          <p className="text-sm text-gray-500">
            {activeClassroom.students.length} student{activeClassroom.students.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showActivity ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowActivity(!showActivity)}
          >
            {showActivity ? 'Hide' : 'Show'} Activity
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            ⚙️ Settings
          </Button>
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
                classPoints={getClassPoints(activeClassroom.id)}
                studentCount={activeClassroom.students.length}
                onClick={() => setIsClassAwardModalOpen(true)}
              />
            </div>
          )}

          <StudentGrid
            students={activeClassroom.students}
            onStudentClick={handleStudentClick}
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

      {/* Award Points Modal */}
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
        classPoints={getClassPoints(activeClassroom.id)}
      />

      {/* Undo Toast */}
      <UndoToast action={undoableAction} onUndo={handleUndo} />
    </div>
  );
}
