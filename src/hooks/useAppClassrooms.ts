import { useMemo } from 'react';
import { useStudents } from './useStudents';
import { useClassrooms } from './useClassrooms';
import { dbClassroomToApp, dbStudentToApp } from '../types/transforms';
import type { AppClassroom } from '../types';

// Thin, transitional camelCase wrappers over the proven TanStack classroom/student
// hooks. Relocated from AppContext's `mappedClassrooms` (:589-631) and
// `activeClassroom` (:649-662) bridges. Removed by the casing-normalization
// follow-up that converts the caches directly.

export function useAppClassrooms(): {
  classrooms: AppClassroom[];
  isLoading: boolean;
  error: Error | null;
} {
  const query = useClassrooms();
  const classrooms = useMemo(
    // No active-classroom roster is threaded here, so classroom-level
    // today/week aggregates stay `undefined` (consumers `?? 0`). The active
    // classroom's live time totals are reproduced by `useActiveClassroom`.
    () => (query.data ?? []).map((c) => dbClassroomToApp(c)),
    [query.data]
  );
  return { classrooms, isLoading: query.isPending, error: query.error };
}

// Reproduces AppContext's `activeClassroom` derivation: resolve the active row,
// compute its today/week totals from the live roster, then swap the live
// students into `.students` (preserving the distinct `length === 0 ||` guard
// from the original swap at AppContext.tsx:653-654).
export function useActiveClassroom(activeClassroomId: string | null): {
  activeClassroom: AppClassroom | null;
  isLoading: boolean;
  error: Error | null;
} {
  const classroomsQuery = useClassrooms();
  const studentsQuery = useStudents(activeClassroomId);

  const activeClassroom = useMemo<AppClassroom | null>(() => {
    const rows = classroomsQuery.data ?? [];
    const row = rows.find((c) => c.id === activeClassroomId);
    if (!row) return null;

    const liveStudents = studentsQuery.data ?? [];
    const classroom = dbClassroomToApp(row, liveStudents);

    const studentsMatchClassroom =
      liveStudents.length === 0 || liveStudents[0]?.classroom_id === activeClassroomId;
    const actualStudents = studentsMatchClassroom ? liveStudents.map(dbStudentToApp) : [];

    return { ...classroom, students: actualStudents };
  }, [classroomsQuery.data, activeClassroomId, studentsQuery.data]);

  return {
    activeClassroom,
    isLoading: classroomsQuery.isPending || studentsQuery.isLoading,
    error: classroomsQuery.error || studentsQuery.error,
  };
}
