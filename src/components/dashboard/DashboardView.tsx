import { useState, useEffect } from 'react';
import type { Student } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { StudentGrid } from '../students/StudentGrid';
import { AwardPointsModal } from '../points/AwardPointsModal';
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
    getRecentUndoableAction,
    undoTransaction,
  } = useApp();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
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

  const handleUndo = (transactionId: string) => {
    undoTransaction(transactionId);
    setUndoableAction(null);
  };

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

  const transactions = getClassroomTransactions(activeClassroom.id, 20);

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

      {/* Undo Toast */}
      <UndoToast action={undoableAction} onUndo={handleUndo} />
    </div>
  );
}
