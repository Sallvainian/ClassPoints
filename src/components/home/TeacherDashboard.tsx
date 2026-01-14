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

  // Aggregate all students across all classrooms
  const allStudents = useMemo(() => {
    return classrooms.flatMap((c) => c.students);
  }, [classrooms]);

  // Calculate aggregate statistics
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

  // Loading state - show spinner while data loads
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-pulse">⏳</div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state - failed to load data
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to load dashboard</h2>
          <p className="text-gray-600 mb-6">
            {error.message || 'Something went wrong. Please try again.'}
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  // Empty state - no classrooms
  if (classrooms.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to ClassPoints!</h2>
          <p className="text-gray-600 mb-6">
            Track student behavior and points with ease. Create your first classroom to get started.
          </p>
          <Button onClick={handleCreateClassroom} size="lg">
            + Create Your First Classroom
          </Button>
          {createError && <p className="text-red-500 text-sm mt-4">{createError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Welcome back, {displayName}!</h1>
        <p className="text-gray-600">Here&apos;s how your classes are doing today.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatsCard
          icon="🎯"
          label="Total Points"
          value={stats.totalPoints >= 0 ? `+${stats.totalPoints}` : stats.totalPoints}
          gradient="from-emerald-500 to-teal-600"
        />
        <StatsCard
          icon="👥"
          label="Total Students"
          value={stats.totalStudents}
          subValue={`across ${classrooms.length} class${classrooms.length !== 1 ? 'es' : ''}`}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatsCard
          icon="📅"
          label="Points Today"
          value={stats.todayPoints >= 0 ? `+${stats.todayPoints}` : stats.todayPoints}
          gradient="from-purple-500 to-pink-600"
        />
      </div>

      {/* Two-column layout: Leaderboard + Classrooms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard - takes 1 column */}
        <div className="lg:col-span-1">
          <LeaderboardCard students={allStudents} classrooms={classrooms} />
        </div>

        {/* Classrooms Grid - takes 2 columns */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Your Classrooms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  );
}
