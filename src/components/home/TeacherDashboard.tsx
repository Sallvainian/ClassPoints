import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../contexts/useApp';
import { useAppClassrooms, useActiveClassroom } from '../../hooks/useAppClassrooms';
import { useCreateClassroom } from '../../hooks/useClassrooms';
import { useAuth } from '../../contexts/useAuth';
import { ClassroomCard } from './ClassroomCard';
import { LeaderboardCard } from './LeaderboardCard';
import { StatsCard } from './StatsCard';
import { Button } from '../ui';

interface TeacherDashboardProps {
  onSelectClassroom: (classroomId: string) => void;
}

export function TeacherDashboard({ onSelectClassroom }: TeacherDashboardProps) {
  const { activeClassroomId, setActiveClassroom } = useApp();
  const { classrooms, isLoading: loading, error } = useAppClassrooms();
  // The classroom-list hook carries no time totals (no roster threaded), so the
  // home "Points Today" stat reads the active classroom's live today total —
  // reproducing the pre-dissolve behavior where only the active classroom's
  // todayTotal was populated.
  const { activeClassroom } = useActiveClassroom(activeClassroomId);
  const createClassroomMutation = useCreateClassroom();
  const [createError, setCreateError] = useState<string | null>(null);
  const { user } = useAuth();

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Teacher';

  const allStudents = useMemo(() => {
    return classrooms.flatMap((c) => c.students);
  }, [classrooms]);

  const stats = useMemo(() => {
    const totalPoints = classrooms.reduce((sum, c) => sum + (c.pointTotal ?? 0), 0);
    const totalStudents = allStudents.length;
    const todayPoints = activeClassroom?.todayTotal ?? 0;
    return { totalPoints, totalStudents, todayPoints };
  }, [classrooms, allStudents, activeClassroom]);

  const handleClassroomClick = useCallback(
    (classroomId: string) => {
      onSelectClassroom(classroomId);
    },
    [onSelectClassroom]
  );

  const handleCreateClassroom = useCallback(async () => {
    setCreateError(null);
    try {
      const result = await createClassroomMutation.mutateAsync({ name: 'New Classroom' });
      if (!result) {
        setCreateError('Failed to create classroom. Please try again.');
      } else {
        setActiveClassroom(result.id);
      }
    } catch {
      setCreateError('Failed to create classroom. Please try again.');
    }
  }, [createClassroomMutation, setActiveClassroom]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-1">
        <div className="text-center animate-fade-up">
          <div className="mx-auto w-10 h-10 border-2 border-hairline border-t-accent-500 rounded-full animate-spin" />
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-1 p-8">
        <div className="text-center max-w-md animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-600 mb-3">
            ! Error
          </p>
          <h2 className="font-display text-4xl tracking-[-0.01em] text-ink-strong mb-3">
            Unable to load dashboard
          </h2>
          <p className="text-sm text-ink-mid mb-8">
            {error.message || 'Something went wrong. Please try again.'}
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (classrooms.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-1 p-8 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-40" aria-hidden="true" />
        <div className="relative text-center max-w-lg animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-600 mb-4">
            00 / Begin
          </p>
          <h2 className="font-display text-5xl leading-[1.05] tracking-[-0.02em] text-ink-strong mb-4">
            Welcome to ClassPoints!
          </h2>
          <p className="text-base text-ink-mid mb-8 max-w-md mx-auto leading-relaxed">
            Track student behavior and points with ease. Create your first classroom to get started.
          </p>
          <Button onClick={handleCreateClassroom} size="lg">
            + Create Your First Classroom
          </Button>
          {createError && <p className="font-mono text-xs text-red-600 mt-4">{createError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-1">
      {/* No header bar on this view, so the content itself must clear the
          status bar / Dynamic Island (env() is 0 in regular browser tabs). */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-10 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-[calc(1.5rem+env(safe-area-inset-top))] lg:pt-[calc(2.5rem+env(safe-area-inset-top))]">
        {/* Header */}
        <div className="mb-6 md:mb-10 animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted mb-3">
            Today /{' '}
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl leading-[1.05] tracking-[-0.02em] text-ink-strong break-words">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-3 text-base text-ink-mid">
            Here&apos;s how your classes are doing today.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-6 md:mb-8 animate-fade-up [animation-delay:80ms]">
          <StatsCard
            icon="✦"
            label="Total Points"
            value={stats.totalPoints >= 0 ? `+${stats.totalPoints}` : stats.totalPoints}
            tone="positive"
          />
          <StatsCard
            icon="◐"
            label="Total Students"
            value={stats.totalStudents}
            subValue={`across ${classrooms.length} class${classrooms.length !== 1 ? 'es' : ''}`}
            tone="neutral"
          />
          <StatsCard
            icon="↑"
            label="Points Today"
            value={stats.todayPoints >= 0 ? `+${stats.todayPoints}` : stats.todayPoints}
            tone="accent"
          />
        </div>

        {/* Two-column: Leaderboard + Classrooms */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up [animation-delay:160ms]">
          <div className="lg:col-span-1">
            <LeaderboardCard students={allStudents} classrooms={classrooms} />
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-2xl tracking-[-0.01em] text-ink-strong">
                Your Classrooms
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                {classrooms.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {classrooms.map((classroom) => (
                <ClassroomCard
                  key={classroom.id}
                  classroom={classroom}
                  onClick={handleClassroomClick}
                />
              ))}
              {/* Phone only: the sidebar's create button is hidden below md,
                  so give the home grid a create affordance. */}
              <button
                onClick={handleCreateClassroom}
                className="md:hidden rounded-2xl border border-dashed border-hairline-strong p-5 text-left text-ink-mid hover:border-accent-500/50 hover:text-ink-strong transition-colors"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                  + New classroom
                </span>
              </button>
            </div>
            {createError && (
              <p className="md:hidden font-mono text-xs text-red-600 mt-3">{createError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
