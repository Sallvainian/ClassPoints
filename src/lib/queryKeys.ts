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
    // Phase 3: keyed payload merges students-table columns + get_student_time_totals RPC
    // results in `useStudents.queryFn`. The prior `timeTotalsByClassroom` separate-key
    // shape was never used at a call site and is dropped — time totals live inside the
    // `byClassroom` cache and are preserved across realtime UPDATE via merge-on-update.
    byClassroom: (classroomId: string | null) => ['students', classroomId] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (classroomId: string) => ['transactions', 'list', classroomId] as const,
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
