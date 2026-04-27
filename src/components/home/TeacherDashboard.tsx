import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ClassroomCard } from './ClassroomCard';
import { LeaderboardCard } from './LeaderboardCard';
import { StatsCard } from './StatsCard';
import { Button } from '../ui';

interface TeacherDashboardProps {
  onSelectClassroom: (classroomId: string) => void;
}

export function TeacherDashboard({ onSelectClassroom }: TeacherDashboardProps) {
  const { classrooms, createClassroom, loading, error } = useApp();
  const [createError, setCreateError] = useState<string | null>(null);
  const { user } = useAuth();

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Teacher';

  const allStudents = useMemo(() => {
    return classrooms.flatMap((c) => c.students);
  }, [classrooms]);

  const stats = useMemo(() => {
    const totalPoints = classrooms.reduce((sum, c) => sum + (c.pointTotal ?? 0), 0);
    const totalStudents = allStudents.length;
    const todayPoints = classrooms.reduce((sum, c) => sum + (c.todayTotal ?? 0), 0);
    return { totalPoints, totalStudents, todayPoints };
  }, [classrooms, allStudents]);

  const handleClassroomClick = useCallback(
    (classroomId: string) => {
      onSelectClassroom(classroomId);
    },
    [onSelectClassroom]
  );

  const handleCreateClassroom = useCallback(async () => {
    setCreateError(null);
    try {
      const result = await createClassroom('New Classroom');
      if (!result) {
        setCreateError('Failed to create classroom. Please try again.');
      }
    } catch {
      setCreateError('Failed to create classroom. Please try again.');
    }
  }, [createClassroom]);

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
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        {/* Header */}
        <div className="mb-10 animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted mb-3">
            Today /{' '}
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <h1 className="font-display text-4xl lg:text-5xl leading-[1.05] tracking-[-0.02em] text-ink-strong">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-3 text-base text-ink-mid">
            Here&apos;s how your classes are doing today.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 animate-fade-up [animation-delay:80ms]">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
