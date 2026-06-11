import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PostgrestError } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useBatchAward } from '../useBatchAward';
import { queryKeys } from '../../lib/queryKeys';
import * as batchKindStore from '../../lib/batchKindStore';
import * as failedBatchStore from '../../lib/failedBatchStore';
import type { StudentWithPoints } from '../../types/transforms';
import type { Behavior } from '../../types';

// useBatchAward fires ONE atomic bulk insert via useAwardPointsBatch. Mock that
// mutation so nothing hits Supabase; the hook reads the roster from the seeded
// query cache (no second subscription). On failure the hook runs §3 recovery
// re-queries against `supabase` — mock the `.from(...).select('id').eq(...)` chain.
const { mockMutateAsync, eqMock } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock('../useTransactions', () => ({
  useAwardPointsBatch: () => ({ mutateAsync: mockMutateAsync }),
}));

// Recovery reads chain `.from(t).select('id').eq(c, v).abortSignal(sig)`; the
// terminal `.abortSignal` is the awaited thenable, so eqMock resolves there.
// classifyAndRecover discriminates via isPostgrestError() from this module, so the
// factory spreads the REAL exports (production guard stays under test) and overrides
// only the client. Env is stubbed BEFORE importOriginal — src/lib/supabase.ts throws
// at eval without creds (CI's Unit Tests step runs credless).
vi.mock('../../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: { from: () => ({ select: () => ({ eq: () => ({ abortSignal: eqMock }) }) }) },
  };
});

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

// A server-reached failure: PostgrestError carries a SQLSTATE `.code`. A real
// instance — exactly what the migrated mutationFn now rejects with (unwrap()
// hydrates plain literals / rethrows instances), and what the real
// isPostgrestError guard classifies as server-reached.
function pgError(code: string, message = 'postgrest error') {
  return new PostgrestError({ message, details: '', hint: '', code });
}

describe('useBatchAward', () => {
  beforeEach(() => {
    batchKindStore.clear();
    failedBatchStore.clear();
    mockMutateAsync.mockReset();
    // Default: the bulk insert succeeds, returning one row per targeted id.
    mockMutateAsync.mockImplementation((input: { studentIds: string[]; batchId: string }) =>
      Promise.resolve(input.studentIds.map((id) => ({ id: `tx-${id}`, batch_id: input.batchId })))
    );
    eqMock.mockReset();
    eqMock.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    batchKindStore.clear();
    failedBatchStore.clear();
  });

  // ── Success / guard paths ────────────────────────────────────────────────

  it('awardClass fires one atomic batch over the full roster and tags "class"', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2', name: 'Bo' })]);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR);

    expect(mockMutateAsync).toHaveBeenCalledTimes(1); // ONE bulk insert, not N
    const input = mockMutateAsync.mock.calls[0][0];
    expect(input.studentIds).toEqual(['s1', 's2']);
    expect(txns).toHaveLength(2);
    expect(batchKindStore.get(input.batchId)).toBe('class');
  });

  it('awardClass with an empty roster awards nothing and tags nothing (no leak)', async () => {
    const qc = makeClient();
    seedRoster(qc, []);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR);

    expect(txns).toEqual([]);
    expect(mockMutateAsync).not.toHaveBeenCalled(); // guard returns before tagging
  });

  it('awardSubset awards only the selected ids in one batch and tags "subset"', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2' }), student({ id: 's3' })]);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardSubset(['s1', 's3'], BEHAVIOR, 'note');

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const input = mockMutateAsync.mock.calls[0][0];
    expect([...input.studentIds].sort()).toEqual(['s1', 's3']);
    expect(txns).toHaveLength(2);
    expect(batchKindStore.get(input.batchId)).toBe('subset');
  });

  it('awardSubset with no valid ids awards nothing', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' })]);
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    expect(await result.current.awardSubset(['ghost'], BEHAVIOR)).toEqual([]);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // ── Failure paths (rewritten from the old silent-filter assertions) ───────

  it('awardClass rejects all-or-nothing on a batch failure — no partial list returned', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2', name: 'Bo' })]);
    mockMutateAsync.mockRejectedValue(pgError('23503', 'foreign key violation'));
    eqMock.mockResolvedValueOnce({ data: [{ id: 's1' }], error: null }); // fresh roster: s2 gone
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await expect(result.current.awardClass(BEHAVIOR)).rejects.toThrow();
  });

  it('forgets the batch tag when the batch fails (no batchKindStore leak)', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' })]);
    mockMutateAsync.mockRejectedValue(pgError('42501', 'rls denied'));
    eqMock.mockResolvedValueOnce({ data: [{ id: 's1' }], error: null }); // s1 still present → ambient
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await expect(result.current.awardClass(BEHAVIOR)).rejects.toThrow();
    const batchId = mockMutateAsync.mock.calls[0][0].batchId;
    expect(batchKindStore.get(batchId)).toBeUndefined(); // tagged then forgotten
  });

  // ── §3 recovery (net-new coverage) ───────────────────────────────────────

  it('names the concurrently-deleted student via the fresh roster diff (per-row)', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1', name: 'Ada' }), student({ id: 's2', name: 'Bo' })]);
    mockMutateAsync.mockRejectedValue(pgError('23503'));
    eqMock.mockResolvedValueOnce({ data: [{ id: 's1' }], error: null }); // s2 deleted remotely
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await expect(result.current.awardClass(BEHAVIOR)).rejects.toThrow(/Bo/);
    const notices = failedBatchStore.getByClassroom(CLASSROOM_ID);
    expect(notices).toHaveLength(1);
    expect(notices[0].classification).toBe('per-row');
    expect(notices[0].failedStudentNames).toEqual(['Bo']);
  });

  it('classifies an ambient server failure as "the batch" (no false student name)', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1', name: 'Ada' })]);
    mockMutateAsync.mockRejectedValue(pgError('42501'));
    eqMock.mockResolvedValueOnce({ data: [{ id: 's1' }], error: null }); // all present → ambient
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await expect(result.current.awardClass(BEHAVIOR)).rejects.toThrow(/class/);
    const notices = failedBatchStore.getByClassroom(CLASSROOM_ID);
    expect(notices[0].classification).toBe('ambient');
    expect(notices[0].failedStudentNames).toBeUndefined();
  });

  it('suppresses a lost-ack failure as success when the rows actually committed (CAP-6)', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2' })]);
    mockMutateAsync.mockRejectedValue(new TypeError('Failed to fetch')); // network-class, no .code
    eqMock.mockResolvedValueOnce({ data: [{ id: 'tx-1' }, { id: 'tx-2' }], error: null }); // batch present
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR); // does NOT throw
    expect(txns).toEqual([]);
    const batchId = mockMutateAsync.mock.calls[0][0].batchId;
    expect(batchKindStore.get(batchId)).toBe('class'); // tag kept — undo may apply
    expect(failedBatchStore.getByClassroom(CLASSROOM_ID)).toHaveLength(0); // not recorded as failure
  });

  it("classifies a hydrated code:'' PostgrestError as network-class (pins the `code !== ''` clause)", async () => {
    // unwrap() hydrates postgrest-js's fetch-failure / non-JSON-body literals
    // into a real PostgrestError with `code: ''`. isPostgrestError(err) is TRUE
    // for it, so ONLY the `&& err.code !== ''` clause keeps it network-class.
    // Load-bearing pin: delete that clause and serverReached flips true → the
    // roster-diff branch reads tx ids as roster ids → per-row throw → this test
    // fails. (The TypeError-based CAP-6 test above fails isPostgrestError
    // entirely and would NOT catch that regression.)
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' }), student({ id: 's2' })]);
    mockMutateAsync.mockRejectedValue(
      new PostgrestError({ message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' })
    );
    eqMock.mockResolvedValueOnce({ data: [{ id: 'tx-1' }, { id: 'tx-2' }], error: null }); // batch present
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    const txns = await result.current.awardClass(BEHAVIOR); // lost-ack recovery ran → suppressed as success
    expect(txns).toEqual([]);
    const batchId = mockMutateAsync.mock.calls[0][0].batchId;
    expect(batchKindStore.get(batchId)).toBe('class'); // tag kept — undo may apply
    expect(failedBatchStore.getByClassroom(CLASSROOM_ID)).toHaveLength(0); // not recorded as failure
  });

  it('reports "could not confirm" when the recovery re-query also fails (indeterminate)', async () => {
    const qc = makeClient();
    seedRoster(qc, [student({ id: 's1' })]);
    mockMutateAsync.mockRejectedValue(new TypeError('Failed to fetch')); // network-class
    eqMock.mockResolvedValueOnce({ data: null, error: { message: 'still offline' } }); // recovery read fails
    const { result } = renderHook(() => useBatchAward(CLASSROOM_ID), { wrapper: makeWrapper(qc) });

    await expect(result.current.awardClass(BEHAVIOR)).rejects.toThrow(/confirm/);
    const notices = failedBatchStore.getByClassroom(CLASSROOM_ID);
    expect(notices[0].classification).toBe('indeterminate');
  });
});
