import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useAddBehavior, useBehaviors } from '../useBehaviors';
import { isPostgrestError } from '../../lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type { Behavior as DbBehavior } from '../../types/database';

// Closes the IO-1 sub-gap: useBehaviors (the migrated behaviors query the award
// modals consume) had no dedicated unit test. Mirrors the thin-query mock shape
// used across the suite — behaviors do not subscribe to realtime, so only the
// from().select().order().order() read chain (plus the insert chain for the
// CAP-3 hydration pin below) needs stubbing.
const mockBehaviorsResult = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: DbBehavior[] | null; error: Error | null }>>()
);
const mockInsertSingle = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: DbBehavior | null; error: unknown }>>()
);

// The hooks import unwrap() from this module, so the factory spreads the REAL
// exports (production unwrap/isPostgrestError stay under test) and overrides only
// the client. Env is stubbed BEFORE importOriginal — src/lib/supabase.ts throws
// at eval without creds (CI's Unit Tests step runs credless).
vi.mock('../../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            order: mockBehaviorsResult,
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockInsertSingle,
          })),
        })),
      })),
    },
  };
});

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
    mockInsertSingle.mockReset();
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

  // CAP-3 end-to-end discrimination + instanceof-compat pin: postgrest-js's
  // non-throwOnError path produces PLAIN-OBJECT error literals (not Error
  // instances). A migrated mutation must reject with a value that (a) satisfies
  // isPostgrestError with `.code` readable — SoundContext-style discrimination —
  // AND (b) is `instanceof Error`, which is what keeps the five modal catch
  // sites (`err instanceof Error ? err.message : fallback`) rendering the real
  // message instead of the fallback.
  it('[P0][CAP-3] hydrates a plain-object PostgREST failure into a real PostgrestError through a migrated mutation', async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint',
        details: 'Key (name)=(Helping) already exists.',
        hint: '',
        code: '23505',
      },
    });

    const { result } = renderHook(() => useAddBehavior(), { wrapper: makeWrapper(makeClient()) });

    let caught: unknown;
    await act(async () => {
      caught = await result.current
        .mutateAsync({ name: 'Helping', points: 1, icon: '🤝', category: 'positive' })
        .catch((e: unknown) => e);
    });

    expect(isPostgrestError(caught)).toBe(true);
    expect(caught instanceof Error).toBe(true); // modal `instanceof Error` compat
    // Asserted on a cast (not inside an `if (isPostgrestError(...))` block) so a
    // guard regression can't silently skip these — all assertions stay live.
    expect((caught as PostgrestError).code).toBe('23505');
    expect((caught as PostgrestError).message).toBe(
      'duplicate key value violates unique constraint'
    );
  });
});
