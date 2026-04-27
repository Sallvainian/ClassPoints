import { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { Student, PointTransaction } from '../../types';
import type { CardSize } from '../../hooks/useDisplaySettings';
import { useApp } from '../../contexts/AppContext';
import { useDisplaySettings } from '../../hooks/useDisplaySettings';
import { ERROR_MESSAGES } from '../../utils/errorMessages';
import { StudentGrid } from '../students/StudentGrid';
import { AwardPointsModal } from '../points/AwardPointsModal';
import { ClassAwardModal } from '../points/ClassAwardModal';
import { MultiAwardModal } from '../points/MultiAwardModal';
import { UndoToast } from '../points/UndoToast';
import { TodaySummary } from '../points/TodaySummary';
import { SoundSettingsModal } from '../settings/SoundSettingsModal';
import { Button } from '../ui/Button';
import { ErrorToast } from '../ui/ErrorToast';
import { BottomToolbar } from './BottomToolbar';
import { ViewModeToggle, SeatingChartView } from '../seating';

interface DashboardViewProps {
  onOpenSettings: () => void;
}

const CARD_SIZES: CardSize[] = ['small', 'medium', 'large'];

export function DashboardView({ onOpenSettings }: DashboardViewProps) {
  const {
    activeClassroom,
    getClassroomTransactions,
    getRecentUndoableAction,
    undoTransaction,
    undoBatchTransaction,
    loading,
    error,
  } = useApp();

  const { settings, setCardSize, toggleShowPointTotals, setViewMode } = useDisplaySettings();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [isClassAwardModalOpen, setIsClassAwardModalOpen] = useState(false);
  const [isMultiAwardModalOpen, setIsMultiAwardModalOpen] = useState(false);
  const [undoableAction, setUndoableAction] = useState(getRecentUndoableAction());
  const [showActivity, setShowActivity] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const [operationError, setOperationError] = useState<string | null>(null);
  const handleDismissError = useCallback(() => setOperationError(null), []);

  useEffect(() => {
    const interval = setInterval(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 1000);
    return () => clearInterval(interval);
  }, [getRecentUndoableAction]);

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
    setTimeout(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 100);
  };

  const handleCloseClassModal = () => {
    setIsClassAwardModalOpen(false);
    setTimeout(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 100);
  };

  const handleCloseMultiModal = () => {
    setIsMultiAwardModalOpen(false);
    handleExitSelectionMode();
    setTimeout(() => {
      setUndoableAction(getRecentUndoableAction());
    }, 100);
  };

  const handleUndo = useCallback(
    async (transactionId: string) => {
      const actionToUndo = undoableAction;
      if (!actionToUndo) return;

      try {
        if (actionToUndo.isBatch && actionToUndo.batchId) {
          await undoBatchTransaction(actionToUndo.batchId);
        } else {
          await undoTransaction(transactionId);
        }
        setUndoableAction(null);
      } catch (err) {
        console.error('Failed to undo transaction:', err);
        setOperationError(ERROR_MESSAGES.UNDO);
      }
    },
    [undoTransaction, undoBatchTransaction, undoableAction]
  );

  const transactions: PointTransaction[] = useMemo(() => {
    if (!activeClassroom) return [];
    const dbTransactions = getClassroomTransactions(activeClassroom.id, 20);
    return dbTransactions.map((t) => ({
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

  // ──────────────────────────────────────────────────────────────────────────
  // Loading / error / empty states
  // ──────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-1">
        <div className="text-center">
          <div className="mx-auto w-10 h-10 border-2 border-hairline border-t-accent-500 rounded-full animate-spin" />
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            Loading classroom...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-1 p-8">
        <div className="text-center max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-600 mb-3">
            ! Error
          </p>
          <h2 className="font-display text-4xl tracking-[-0.01em] text-ink-strong mb-3">
            Something went wrong
          </h2>
          <p className="text-sm text-ink-mid mb-6">{error.message}</p>
          <Button onClick={() => window.location.reload()} variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!activeClassroom) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-1 p-8">
        <div className="text-center max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-600 mb-3">
            00 / Begin
          </p>
          <h2 className="font-display text-4xl tracking-[-0.01em] text-ink-strong mb-3">
            Welcome to ClassPoints!
          </h2>
          <p className="text-sm text-ink-mid mb-8">
            Create a classroom to start tracking student behavior and awarding points.
          </p>
          <Button onClick={onOpenSettings} variant="primary" size="lg">
            Create Your First Classroom
          </Button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Main render
  // ──────────────────────────────────────────────────────────────────────────
  const studentCount = activeClassroom.students.length;
  const totalPoints = activeClassroom.pointTotal ?? 0;
  const todayPoints = activeClassroom.todayTotal ?? 0;
  const totalReady = !Number.isNaN(activeClassroom.pointTotal);
  const todayReady = !Number.isNaN(activeClassroom.todayTotal);

  return (
    <div className="h-full flex flex-col bg-surface-1 text-ink-strong">
      {/* Header */}
      <header className="bg-surface-2 border-b border-hairline">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1.5">
                Classroom · {studentCount} student{studentCount !== 1 ? 's' : ''}
                {totalReady && (
                  <>
                    {' · '}
                    <span
                      className={`tabular-nums font-semibold ${
                        totalPoints >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {totalPoints >= 0 ? '+' : ''}
                      {totalPoints}
                    </span>{' '}
                    total
                  </>
                )}
                {todayReady && todayPoints !== 0 && (
                  <>
                    {' · '}
                    <span
                      className={`tabular-nums ${
                        todayPoints >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {todayPoints >= 0 ? '+' : ''}
                      {todayPoints}
                    </span>{' '}
                    today
                  </>
                )}
              </p>
              <h1 className="font-display text-3xl lg:text-4xl tracking-[-0.02em] leading-[1.05] text-ink-strong truncate">
                {activeClassroom.name}
              </h1>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <SoundSettingsModal />
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
                aria-label="Classroom settings"
              >
                <SettingsIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span className="font-mono uppercase tracking-[0.14em]">Settings</span>
              </button>
            </div>
          </div>

          {/* Control strip */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {/* Card size segmented */}
            <div className="inline-flex items-center rounded-[10px] border border-hairline bg-surface-1 p-0.5">
              {CARD_SIZES.map((size) => {
                const active = settings.cardSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => setCardSize(size)}
                    className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.12em] rounded-md transition-colors ${
                      active
                        ? 'bg-surface-2 text-ink-strong shadow-sm'
                        : 'text-ink-muted hover:text-ink-strong'
                    }`}
                    title={`${size.charAt(0).toUpperCase() + size.slice(1)} cards`}
                  >
                    {size.charAt(0).toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Point totals toggle */}
            <button
              onClick={toggleShowPointTotals}
              className={`px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.12em] rounded-[10px] border transition-colors ${
                settings.showPointTotals
                  ? 'border-accent-500/40 bg-accent-500/10 text-accent-700 dark:text-accent-400'
                  : 'border-hairline bg-surface-1 text-ink-muted hover:text-ink-strong hover:border-hairline-strong'
              }`}
              title="Show positive/negative point totals"
            >
              +/−
            </button>

            {/* Activity toggle */}
            <button
              onClick={() => setShowActivity(!showActivity)}
              className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.12em] rounded-[10px] border transition-colors ${
                showActivity
                  ? 'border-accent-500/40 bg-accent-500/10 text-accent-700 dark:text-accent-400'
                  : 'border-hairline bg-surface-1 text-ink-muted hover:text-ink-strong hover:border-hairline-strong'
              }`}
            >
              Activity
            </button>

            {/* View mode */}
            <ViewModeToggle viewMode={settings.viewMode} onSetViewMode={setViewMode} />

            {/* Class total chip — clickable; only in alphabetical view */}
            {settings.viewMode === 'alphabetical' && studentCount > 0 && totalReady && (
              <button
                onClick={() => setIsClassAwardModalOpen(true)}
                className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-hairline bg-surface-1 hover:border-accent-500/40 hover:bg-accent-500/5 transition-colors"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Class total
                </span>
                <span
                  className={`font-mono tabular-nums text-sm font-semibold ${
                    totalPoints >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {totalPoints >= 0 ? '+' : ''}
                  {totalPoints}
                </span>
                <span className="font-mono text-[10px] tracking-[0.16em] text-accent-600">→</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        <div
          className={`flex-1 overflow-y-auto bg-surface-1 ${
            showActivity ? 'border-r border-hairline' : ''
          }`}
        >
          {settings.viewMode === 'alphabetical' ? (
            <div className="pt-4">
              <StudentGrid
                students={activeClassroom.students}
                onStudentClick={handleStudentClick}
                size={settings.cardSize}
                showPointTotals={settings.showPointTotals}
                selectedStudentIds={selectedStudentIds}
                onStudentSelect={selectionMode ? handleStudentSelect : undefined}
              />
            </div>
          ) : (
            <SeatingChartView
              classroomId={activeClassroom.id}
              students={activeClassroom.students}
              onClickStudent={handleStudentClick}
              showPointBreakdown={settings.showPointTotals}
            />
          )}
        </div>

        {showActivity && (
          <aside className="w-80 bg-surface-2 overflow-y-auto p-5">
            <header className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                Activity · today
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-[-0.01em] text-ink-strong">
                Recent
              </h2>
            </header>
            <TodaySummary
              transactions={transactions}
              students={activeClassroom.students}
              limit={15}
            />
          </aside>
        )}
      </div>

      <BottomToolbar
        selectionMode={selectionMode}
        selectedCount={selectedStudentIds.size}
        totalStudents={studentCount}
        onEnterSelectionMode={handleEnterSelectionMode}
        onExitSelectionMode={handleExitSelectionMode}
        onSelectAll={handleSelectAll}
        onAwardPoints={() => setIsMultiAwardModalOpen(true)}
        onRandomStudent={handleRandomStudent}
        hasStudents={studentCount > 0}
      />

      <AwardPointsModal
        isOpen={isAwardModalOpen}
        onClose={handleCloseModal}
        student={selectedStudent}
        classroomId={activeClassroom.id}
      />

      <ClassAwardModal
        isOpen={isClassAwardModalOpen}
        onClose={handleCloseClassModal}
        classroomId={activeClassroom.id}
        classroomName={activeClassroom.name}
        studentCount={studentCount}
        classPoints={{
          total: totalPoints,
          positiveTotal: activeClassroom.positiveTotal ?? 0,
          negativeTotal: activeClassroom.negativeTotal ?? 0,
          today: todayPoints,
          thisWeek: activeClassroom.thisWeekTotal ?? 0,
        }}
      />

      <MultiAwardModal
        isOpen={isMultiAwardModalOpen}
        onClose={handleCloseMultiModal}
        selectedStudents={selectedStudents}
        classroomId={activeClassroom.id}
      />

      <UndoToast action={undoableAction} onUndo={handleUndo} />

      <ErrorToast error={operationError} onDismiss={handleDismissError} />
    </div>
  );
}
