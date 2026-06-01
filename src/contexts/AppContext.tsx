import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AppContext, type AppContextValue } from './useApp';

const ACTIVE_CLASSROOM_STORAGE_KEY = 'app:activeClassroomId';

// Phase 4 dissolved the server-data facade: classrooms/students/behaviors/
// transactions, the ~20 mutation wrappers, the point/transaction selectors, the
// undo-window machinery, and the camelCase `mapped*` bridges all moved to direct
// TanStack hooks + thin wrapper hooks/utils (useAppClassrooms, useUndoableAction,
// useBatchAward, pointSelectors, batchKindStore). AppProvider
// now holds only the active-classroom selection — genuine UI/session state.
export function AppProvider({ children }: { children: ReactNode }) {
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACTIVE_CLASSROOM_STORAGE_KEY);
  });

  const setActiveClassroom = useCallback((id: string | null) => {
    setActiveClassroomId(id);
    if (id) {
      window.localStorage.setItem(ACTIVE_CLASSROOM_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_CLASSROOM_STORAGE_KEY);
    }
  }, []);

  const value: AppContextValue = useMemo(
    () => ({ activeClassroomId, setActiveClassroom }),
    [activeClassroomId, setActiveClassroom]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
