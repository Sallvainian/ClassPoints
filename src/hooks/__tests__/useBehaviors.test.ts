import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useBehaviors } from '../useBehaviors';
import type { Behavior as DbBehavior } from '../../types/database';

// Closes the IO-1 sub-gap: useBehaviors (the migrated behaviors query the award
// modals consume) had no dedicated unit test. Mirrors the thin-query mock shape
// used across the suite — behaviors do not subscribe to realtime, so only the
// from().select().order().order() read chain needs stubbing.
const mockBehaviorsResult = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: DbBehavior[] | null; error: Error | null }>>()
);

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          order: mockBehaviorsResult,
        })),
      })),
    })),
  },
}));

function dbBehavior(overrides: Partial<DbBehavior> = {}): DbBehavior {
  return {
    id: 'beh-1',
    name: 'Behavior',
    points: 1,
    icon: '⭐',
    category: 'positive',
    is_custom: false,
    created_at: '2026-05-01T00:00:00.000Z',
    user_id: null,
    ...overrides,
  };
}

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useBehaviors', () => {
  beforeEach(() => {
    mockBehaviorsResult.mockReset();
  });

  it('[P1][IO-1] returns behaviors sorted by category asc then points desc, in app shape', async () => {
    mockBehaviorsResult.mockResolvedValue({
      data: [
        dbBehavior({ id: 'pos-low', category: 'positive', points: 1 }),
        dbBehavior({ id: 'neg', category: 'negative', points: -3 }),
        dbBehavior({ id: 'pos-high', category: 'positive', points: 5 }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useBehaviors(), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // negative < positive (localeCompare), then points descending within a category.
    expect(result.current.data?.map((b) => b.id)).toEqual(['neg', 'pos-high', 'pos-low']);
    // dbToBehavior transform: is_custom -> isCustom, created_at -> createdAt (ms epoch).
    expect(result.current.data?.[0]).toMatchObject({
      id: 'neg',
      category: 'negative',
      isCustom: false,
      createdAt: new Date('2026-05-01T00:00:00.000Z').getTime(),
    });
  });

  it('[P1][IO-1] surfaces a query error', async () => {
    mockBehaviorsResult.mockResolvedValue({ data: null, error: new Error('boom') });

    const { result } = renderHook(() => useBehaviors(), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('boom');
  });
});
