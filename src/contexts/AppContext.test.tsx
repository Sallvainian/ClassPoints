import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';

const mocks = vi.hoisted(() => ({
  useClassrooms: vi.fn(),
  useStudents: vi.fn(),
  useBehaviors: vi.fn(),
  useTransactions: vi.fn(),
  mutation: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({ not: vi.fn() })),
      insert: vi.fn(),
    })),
  },
}));

vi.mock('../hooks/useClassrooms', () => ({
  useClassrooms: () => mocks.useClassrooms(),
  useCreateClassroom: mocks.mutation,
  useUpdateClassroom: mocks.mutation,
  useDeleteClassroom: mocks.mutation,
}));

vi.mock('../hooks/useStudents', () => ({
  useStudents: (classroomId: string | null) => mocks.useStudents(classroomId),
  useAddStudent: mocks.mutation,
  useAddStudents: mocks.mutation,
  useUpdateStudent: mocks.mutation,
  useRemoveStudent: mocks.mutation,
}));

vi.mock('../hooks/useBehaviors', () => ({
  useBehaviors: () => mocks.useBehaviors(),
  useAddBehavior: mocks.mutation,
  useUpdateBehavior: mocks.mutation,
  useDeleteBehavior: mocks.mutation,
}));

vi.mock('../hooks/useTransactions', () => ({
  AdjustNoOpError: class AdjustNoOpError extends Error {},
  useTransactions: (classroomId: string | null) => mocks.useTransactions(classroomId),
  useAwardPoints: mocks.mutation,
  useUndoTransaction: mocks.mutation,
  useUndoBatchTransaction: mocks.mutation,
  useClearStudentPoints: mocks.mutation,
  useResetClassroomPoints: mocks.mutation,
  useAdjustStudentPoints: mocks.mutation,
}));

function queryResult({
  data = [],
  isPending = false,
  isLoading = false,
  error = null,
}: {
  data?: unknown[];
  isPending?: boolean;
  isLoading?: boolean;
  error?: Error | null;
} = {}) {
  return {
    data,
    isPending,
    isLoading,
    error,
    refetch: vi.fn(),
  };
}

function Probe() {
  const { activeClassroomId, loading } = useApp();
  return (
    <div>
      <div data-testid="active-classroom">{activeClassroomId ?? 'none'}</div>
      <div data-testid="loading">{String(loading)}</div>
    </div>
  );
}

describe('AppProvider loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useClassrooms.mockReturnValue(queryResult());
    mocks.useBehaviors.mockReturnValue(queryResult());
    mocks.useStudents.mockReturnValue(queryResult({ isPending: true, isLoading: false }));
    mocks.useTransactions.mockReturnValue(queryResult({ isPending: true, isLoading: false }));
  });

  it('does not block the home dashboard on disabled classroom-scoped queries', () => {
    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    expect(mocks.useStudents).toHaveBeenCalledWith(null);
    expect(mocks.useTransactions).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('active-classroom')).toHaveTextContent('none');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('still reports loading while active classroom-scoped queries fetch', () => {
    window.localStorage.setItem('app:activeClassroomId', 'classroom-1');
    mocks.useStudents.mockReturnValue(queryResult({ isPending: true, isLoading: true }));

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    expect(mocks.useStudents).toHaveBeenCalledWith('classroom-1');
    expect(screen.getByTestId('active-classroom')).toHaveTextContent('classroom-1');
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });
});
