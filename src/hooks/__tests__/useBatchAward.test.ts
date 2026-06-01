import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useBatchAward } from '../useBatchAward';
import { queryKeys } from '../../lib/queryKeys';
import * as batchKindStore from '../../lib/batchKindStore';
import type { StudentWithPoints } from '../../types/transforms';
import type { Behavior } from '../../types';

// useBatchAward fans out over the cached roster by calling useAwardPoints per
// student. Mock the mutation so nothing hits Supabase; the hook reads the roster
// from the seeded query cache via qc.getQueryData (no second subscription).
const mockMutateAsync = vi.fn();
vi.mock('../useTransactions', () => ({
  useAwardPoints: () => ({ mutateAsync: mockMutateAsync }),
}));

const CLASSROOM_ID = 'classroom-1';

const BEHAVIOR: Behavior = {
  id: 'b1',
  name: 'On Task',
  points: 1,
  icon: '📚',
  category: 'positive',
  isCustom: false,
  createdAt: 0,
};

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function student(over: Partial<StudentWithPoints> = {}): StudentWithPoints {
  return {
    id: 's1',
    classroom_id: CLASSROOM_ID,
    name: 'Ada',
    avatar_color: null,
    point_total: 0,
    positive_total: 0,
    negative_total: 0,
    today_total: 0,
    this_week_total: 0,
    created_at: new Date().toISOString(),
    ...over,
  } as StudentWithPoints;
}

function seedRoster(qc: QueryClient, students: StudentWithPoints[]) {
  qc.setQueryData(queryKeys.students.byClassroom(CLASSROOM_ID), students);
}

describe('useBatchAward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchKindStore.clear();
    mockMutateAsync.mockImplementation((input: { studentId: string; batchId: string }) =>
      Promise.resolve({ id: `tx-${input.studentId}`, batch_id: input.batchId })
    );
  });

  afterEach(() => batchKindStore.clear());

  it('awardClass fans out over the full roster under one shared batchId and tags "class"', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2', name: 'Bo' })]);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR);

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    const batchIds = mockMutateAsync.mock.calls.map((c) => c[0].batchId);
    expect(new Set(batchIds).size).toBe(1); // single shared batch_id for the cluster
    expect(txns).toHaveLength(2);
    expect(batchKindStore.get(batchIds[0])).toBe('class');
  });

  it('awardClass with an empty roster awards nothing and tags nothing (no leak)', async () => {
    const qc = makeClient();
    seedRoster(qc, []);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR);

    expect(txns).toEqual([]);
    expect(mockMutateAsync).not.toHaveBeenCalled(); // guard returns before tagging
  });

  it('awardSubset awards only the selected ids and tags "subset"', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2' }), student({ id: 's3' })]);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardSubset(['s1', 's3'], BEHAVIOR, 'note');

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync.mock.calls.map((c) => c[0].studentId).sort()).toEqual(['s1', 's3']);
    expect(txns).toHaveLength(2);
    expect(batchKindStore.get(mockMutateAsync.mock.calls[0][0].batchId)).toBe('subset');
  });

  it('awardSubset with no valid ids awards nothing', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' })]);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    expect(await result.current.awardSubset(['ghost'], BEHAVIOR)).toEqual([]);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('silently filters a per-student failure but keeps the successes', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2' })]);
    mockMutateAsync.mockImplementation((input: { studentId: string; batchId: string }) =>
      input.studentId === 's2'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ id: 'tx-s1', batch_id: input.batchId })
    );
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR);

    expect(txns).toHaveLength(1); // the rejected s2 row is filtered to null and dropped
    errSpy.mockRestore();
  });

  it('forgets the batch tag when every award fails (no batchKindStore leak)', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' })]);
    mockMutateAsync.mockRejectedValue(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR);

    expect(txns).toEqual([]);
    const batchId = mockMutateAsync.mock.calls[0][0].batchId;
    expect(batchKindStore.get(batchId)).toBeUndefined(); // tagged then forgotten
    errSpy.mockRestore();
  });
});
