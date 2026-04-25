// Single source of truth for TanStack Query keys. Callers MUST import from here;
// never construct query keys inline at call sites. Invalidation uses the same
// builders so read and write paths cannot drift.

export const queryKeys = {
  classrooms: {
    all: ['classrooms'] as const,
    detail: (id: string) => ['classrooms', 'detail', id] as const,
  },
  students: {
    all: ['students'] as const,
    byClassroom: (classroomId: string | null) => ['students', classroomId] as const,
    timeTotalsByClassroom: (classroomId: string | null) =>
      ['students', classroomId, 'timeTotals'] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (classroomId: string) => ['transactions', 'list', classroomId] as const,
    student: (studentId: string) => ['transactions', 'student', studentId] as const,
  },
  behaviors: {
    all: ['behaviors'] as const,
  },
  layoutPresets: {
    all: ['layoutPresets'] as const,
  },
  seatingChart: {
    all: ['seatingChart'] as const,
    metaByClassroom: (classroomId: string | null) => ['seatingChart', 'meta', classroomId] as const,
    groupsByChart: (chartId: string | null) => ['seatingChart', 'groups', chartId] as const,
    roomElementsByChart: (chartId: string | null) =>
      ['seatingChart', 'roomElements', chartId] as const,
  },
} as const;
