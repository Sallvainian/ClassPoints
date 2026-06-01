import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useActiveClassroom } from '../useAppClassrooms';

// Closes IO-6 (the no-active-classroom no-hang guard dropped in the dissolve).
// `useActiveClassroom(null)` must leave the classroom-scoped student query
// disabled and resolve loading:false — never block boot on a classroom that
// doesn't exist. useStudents(null) is `enabled: false`, so no realtime channel
// is opened; that absence is what proves the scoped query stays disabled.
const mockChannel = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => {
  // Permissive thenable chain: classrooms/students reads resolve to empty data so
  // the always-on classrooms query settles (isPending -> false).
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    Object.assign(chain, {
      select: ret,
      eq: ret,
      order: ret,
      then: (onFulfilled: (v: { data: never[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled),
    });
    return chain;
  };
  return {
    supabase: {
      from: vi.fn(() => makeChain()),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      channel: mockChannel,
      removeChannel: vi.fn(),
    },
  };
});

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useActiveClassroom(null) — no active classroom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P2][IO-6] resolves loading:false with a null classroom (no boot hang)', async () => {
    const { result } = renderHook(() => useActiveClassroom(null), {
      wrapper: makeWrapper(makeClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeClassroom).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('[P2][IO-6] never opens a realtime subscription when there is no active classroom', async () => {
    const { result } = renderHook(() => useActiveClassroom(null), {
      wrapper: makeWrapper(makeClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // useStudents(null) is disabled; a regression that drops the `enabled` guard
    // would subscribe here.
    expect(mockChannel).not.toHaveBeenCalled();
  });
});
