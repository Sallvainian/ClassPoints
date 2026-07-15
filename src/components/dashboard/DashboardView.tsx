import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';
import type { Student, PointTransaction } from '../../types';
import type { CardSize } from '../../hooks/useDisplaySettings';
import { useApp } from '../../contexts/useApp';
import { useActiveClassroom } from '../../hooks/useAppClassrooms';
import { useUndoTransaction, useUndoBatchTransaction } from '../../hooks/useTransactions';
import { useUndoableAction, UNDO_WINDOW_MS } from '../../hooks/useUndoableAction';
import { useFailedBatches } from '../../hooks/useFailedBatches';
import { classroomTransactions } from '../../utils/pointSelectors';
import { mergeFailedIntoFeed } from '../../utils/activityFeed';
import { useDisplaySettings } from '../../hooks/useDisplaySettings';
import { ERROR_MESSAGES } from '../../utils/errorMessages';
import { StudentGrid } from '../students/StudentGrid';
import { AwardPointsModal } from '../points/AwardPointsModal';
import { ClassAwardModal } from '../points/ClassAwardModal';
import { ClassPointsBox } from '../points/ClassPointsBox';
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

// Padding added to the undo-expiry timeout so the wall clock is strictly PAST
// `timestamp + UNDO_WINDOW_MS` when the one-shot fires (the window comparison in
// getRecentUndoableAction is strict; a boundary-exact fire would re-derive
// non-null). The counter-dep on the timer effect is the backstop either way.
const UNDO_EXPIRY_EPSILON_MS = 25;

export function DashboardView({ onOpenSettings }: DashboardViewProps) {
  const { activeClassroomId } = useApp();
  const {
    activeClassroom,
    isLoading: classroomLoading,
    error: classroomError,
  } = useActiveClassroom(activeClassroomId);
  const failedBatches = useFailedBatches(activeClassroomId);
  // Single transactions-query mount for the whole dashboard (deferred #22):
  // useUndoableAction exposes its already-mounted query; the feed, the
  // failed-batches merge, and the loading/error gates below all read this one
  // observer — no direct second mount here.
  const { getRecentUndoableAction, transactionsQuery } = useUndoableAction(activeClassroomId);
  const undoTransactionMutation = useUndoTransaction();
  const undoBatchTransactionMutation = useUndoBatchTransaction();

  const loading = classroomLoading || transactionsQuery.isLoading;
  const error = classroomError || transactionsQuery.error;

  const { settings, setCardSize, toggleShowPointTotals, setViewMode } = useDisplaySettings();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [isClassAwardModalOpen, setIsClassAwardModalOpen] = useState(false);
  const [isMultiAwardModalOpen, setIsMultiAwardModalOpen] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const [operationError, setOperationError] = useState<string | null>(null);
  const handleDismissError = useCallback(() => setOperationError(null), []);

  // Derived undoable action.
  // `getRecentUndoableAction` is a useCallback over the TanStack-cached
  // transactions/students (via useUndoableAction), so it updates immediately
  // when they change — no setTimeout dance needed in close handlers. The
  // wall-clock expiry is event-driven (deferred #6): a single self-rescheduling
  // one-shot timeout (effect below) bumps `expiryBump` when the window ends, so
  // the toast disappears with ZERO idle re-renders — no 1s interval. ACCEPTED
  // trade-off: TodaySummary's relative-time labels no longer refresh at 1Hz
  // while idle; they update on the next data-driven render. `dismissedTxnRef`
  // hides the toast for one render after the user presses undo, in case the
  // cache update lags.
  const [expiryBump, setExpiryBump] = useState(0);
  const dismissedTxnRef = useRef<string | null>(null);
  const undoableAction = useMemo(() => {
    void expiryBump;
    const action = getRecentUndoableAction();
    // dismissedTxnRef intentionally read here to hide the toast for one render
    // after undo until the cache update propagates (see comment above). Promoting
    // it to state would change the post-undo re-render timing.
    // eslint-disable-next-line react-hooks/refs
    if (action && action.transactionId === dismissedTxnRef.current) return null;
    return action;
  }, [getRecentUndoableAction, expiryBump]);

  // Identity key for the derived action. DELIBERATELY not UndoToast's
  // `batchId ?? timestamp` key: appending `timestamp` makes the optimistic→real
  // `created_at` swap reschedule promptly even under a stable `batchId`; the
  // `expiryBump` dep is the backstop either way. `action.timestamp` is already
  // epoch ms — no re-parsing.
  const actionExpiryKey = undoableAction
    ? `${undoableAction.batchId ?? undoableAction.transactionId ?? ''}:${undoableAction.timestamp}`
    : null;
  const actionTimestamp = undoableAction?.timestamp ?? null;

  // Self-rescheduling one-shot expiry timer (deferred #6). Depends on BOTH the
  // action identity key AND `expiryBump`: the callback only bumps the counter
  // (async setState — no synchronous setState in the effect body), the re-run
  // re-derives, and if the derivation is somehow still non-null (boundary-exact
  // fire; timestamp moved later under a stable key) it reschedules against the
  // CURRENT remaining window — never a stuck toast. `actionTimestamp` is a pure
  // component of `actionExpiryKey` (the key changes whenever it does), listed
  // only to satisfy exhaustive-deps. Timeout-schedule + cleanup per the
  // ErrorToast precedent.
  useEffect(() => {
    // !Number.isFinite: corrupt created_at parses to NaN — schedule nothing
    // (the derivation's strict window check already resolves NaN to null).
    if (actionExpiryKey === null || actionTimestamp === null || !Number.isFinite(actionTimestamp))
      return;
    // Upper clamp: a cached `created_at` far in the FUTURE (extreme cross-device
    // clock skew) would otherwise schedule a huge timeout — and past 2^31-1 ms
    // setTimeout overflows to an IMMEDIATE fire, whose re-run derives non-null
    // and reschedules → busy loop. Clamped, the timer re-fires at most once per
    // window under skew (bounded, self-terminating).
    const remainingMs = Math.min(
      UNDO_WINDOW_MS + UNDO_EXPIRY_EPSILON_MS,
      Math.max(0, actionTimestamp + UNDO_WINDOW_MS - Date.now()) + UNDO_EXPIRY_EPSILON_MS
    );
    const id = setTimeout(() => {
      setExpiryBump((n) => (n + 1) % 1_000_000);
    }, remainingMs);
    return () => clearTimeout(id);
  }, [actionExpiryKey, actionTimestamp, expiryBump]);

  const selectedStudents = useMemo(() => {
    if (!activeClassroom) return [];
    return activeClassroom.students.filter((s) => selectedStudentIds.has(s.id));
  }, [activeClassroom, selectedStudentIds]);

  const handleStudentClick = useCallback((student: Student) => {
    setSelectedStudent(student);
    setIsAwardModalOpen(true);
  }, []);

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
  };

  const handleCloseClassModal = () => {
    setIsClassAwardModalOpen(false);
  };

  const handleCloseMultiModal = () => {
    setIsMultiAwardModalOpen(false);
    handleExitSelectionMode();
  };

  const handleUndo = useCallback(
    async (transactionId: string) => {
      const actionToUndo = undoableAction;
      if (!actionToUndo) return;

      try {
        if (actionToUndo.isBatch && actionToUndo.batchId) {
          await undoBatchTransactionMutation.mutateAsync({ batchId: actionToUndo.batchId });
        } else {
          await undoTransactionMutation.mutateAsync(transactionId);
        }
        // Hide the toast immediately; the next derivation pass will see
        // either a different recent action or null once the cache catches up.
        dismissedTxnRef.current = actionToUndo.transactionId;
        setExpiryBump((n) => (n + 1) % 1_000_000);
      } catch (err) {
        console.error('Failed to undo transaction:', err);
        setOperationError(ERROR_MESSAGES.UNDO);
      }
    },
    [undoTransactionMutation, undoBatchTransactionMutation, undoableAction]
  );

  const transactions: PointTransaction[] = useMemo(() => {
    if (!activeClassroom) return [];
    const dbRows = transactionsQuery.data ?? [];
    const dbTransactions = classroomTransactions(dbRows, activeClassroom.id, 20);
    const real: PointTransaction[] = dbTransactions.map((t) => ({
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
    // CAP-3 synthetic failed-batch entries + CAP-6 late-confirm suppression are
    // handled by mergeFailedIntoFeed (see its doc comment for the contract).
    return mergeFailedIntoFeed(real, failedBatches, dbRows);
  }, [activeClassroom, transactionsQuery.data, failedBatches]);

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
        <div className="px-4 md:px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4">
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
              <h1 className="font-display text-2xl md:text-3xl lg:text-4xl tracking-[-0.02em] leading-[1.05] text-ink-strong truncate">
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
                <span className="hidden sm:inline font-mono uppercase tracking-[0.14em]">
                  Settings
                </span>
              </button>
            </div>
          </div>

          {/* Control strip */}
          <div className="mt-3 md:mt-4 flex items-center gap-1.5 md:gap-2 flex-wrap">
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
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden flex">
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden bg-surface-1 ${
            showActivity ? 'border-r border-hairline' : ''
          }`}
        >
          {settings.viewMode === 'alphabetical' ? (
            <div className="pt-4">
              {studentCount > 0 && totalReady && (
                <div className="px-4 pb-4">
                  <ClassPointsBox
                    classPoints={{
                      total: totalPoints,
                      positiveTotal: activeClassroom.positiveTotal ?? 0,
                      negativeTotal: activeClassroom.negativeTotal ?? 0,
                      today: todayPoints,
                      thisWeek: activeClassroom.thisWeekTotal ?? 0,
                    }}
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
          /* Phone: full-area overlay over the grid; >=md: the classic side panel. */
          <aside className="absolute inset-0 z-10 md:static md:inset-auto md:z-auto md:w-80 bg-surface-2 overflow-y-auto p-5 max-md:animate-fade-in">
            <header className="mb-4 flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                  Activity · today
                </p>
                <h2 className="mt-1 font-display text-2xl tracking-[-0.01em] text-ink-strong">
                  Recent
                </h2>
              </div>
              <button
                onClick={() => setShowActivity(false)}
                className="md:hidden p-2 -mr-2 rounded-[10px] text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
                aria-label="Close activity"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
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
