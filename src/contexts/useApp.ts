import { createContext, useContext } from 'react';

export interface AppContextValue {
  // UI/session state only. Server data, mutation wrappers, selectors, and the
  // undo-window machinery were dissolved in Phase 4 — consumers call the direct
  // TanStack hooks (useStudents/useClassrooms/useTransactions/useBehaviors and
  // their mutations) plus the thin camelCase wrapper useAppClassrooms instead.
  // Only the active-classroom selection survives here.
  activeClassroomId: string | null;
  setActiveClassroom: (id: string | null) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
