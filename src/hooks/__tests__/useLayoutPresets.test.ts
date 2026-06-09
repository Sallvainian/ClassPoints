import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useLayoutPresets } from '../useLayoutPresets';
// ?raw (typed string via vite/client) — the hook's source text, for the CAP-2
// module-level no-realtime check. node:fs is unavailable under tsconfig.app.json.
import useLayoutPresetsSource from '../useLayoutPresets.ts?raw';
import type {
  DbLayoutPreset,
  LayoutPreset,
  LayoutPresetData,
  SeatingChart,
} from '../../types/seatingChart';

// Guards the #11 migration contract (spec-tanstack-11-layout-presets): thin useQuery
// + two plain mutations behind the legacy 6-key wrapper, realtime DELETED (kernel
// CAP-2), and onSettled RETURNING the invalidate promise so mutateAsync resolves
// only after the list refetch — that is what makes the save→list-refreshed
// assertions below deterministic (no waitFor needed after act).
const mocks = vi.hoisted(() => ({
  // Terminal of the read chain: from().select('*').order('name', { ascending: true }).
  listResult:
    vi.fn<
      (
        column: string,
        opts: { ascending: boolean }
      ) => Promise<{ data: DbLayoutPreset[] | null; error: Error | null }>
    >(),
  // Terminal of the insert chain: from().insert(payload).select().single().
  insertSingle: vi.fn<() => Promise<{ data: DbLayoutPreset | null; error: Error | null }>>(),
  insertPayload: vi.fn<(payload: unknown) => void>(),
  // Terminal of the delete chain: from().delete().eq('id', presetId).
  deleteEq: vi.fn<(column: string, id: string) => Promise<{ error: Error | null }>>(),
  getUser: vi.fn<() => Promise<{ data: { user: { id: string } | null } }>>(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: mocks.listResult })),
      insert: vi.fn((payload: unknown) => {
        mocks.insertPayload(payload);
        return { select: vi.fn(() => ({ single: mocks.insertSingle })) };
      }),
      delete: vi.fn(() => ({ eq: mocks.deleteEq })),
    })),
  },
}));

const USER_ID = 'user-1';

const emptyLayoutData: LayoutPresetData = {
  groups: [],
  roomElements: [],
  settings: { snapEnabled: true, gridSize: 20, canvasWidth: 1200, canvasHeight: 800 },
};

function dbPreset(overrides: Partial<DbLayoutPreset> = {}): DbLayoutPreset {
  return {
    id: 'preset-1',
    user_id: USER_ID,
    name: 'Alpha',
    layout_data: emptyLayoutData,
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeChart(): SeatingChart {
  return {
    id: 'chart-1',
    classroomId: 'class-1',
    name: 'Period 1',
    snapEnabled: true,
    gridSize: 20,
    canvasWidth: 1200,
    canvasHeight: 800,
    groups: [
      {
        id: 'group-1',
        letter: 'A',
        x: 100,
        y: 120,
        rotation: 90,
        seats: [{ id: 'seat-1', positionInGroup: 1, studentId: 'stu-1' }],
      },
    ],
    roomElements: [
      {
        id: 'el-1',
        type: 'teacher_desk',
        label: 'Desk',
        x: 10,
        y: 20,
        width: 120,
        height: 60,
        rotation: 0,
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

// What savePreset must extract from the chart: positions only — no ids, no
// student assignments (seat-1/stu-1 must NOT leak into the payload).
const expectedLayoutData: LayoutPresetData = {
  groups: [{ letter: 'A', x: 100, y: 120, rotation: 90 }],
  roomElements: [
    { type: 'teacher_desk', label: 'Desk', x: 10, y: 20, width: 120, height: 60, rotation: 0 },
  ],
  settings: { snapEnabled: true, gridSize: 20, canvasWidth: 1200, canvasHeight: 800 },
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

describe('useLayoutPresets', () => {
  beforeEach(() => {
    mocks.listResult.mockReset();
    mocks.insertSingle.mockReset();
    mocks.insertPayload.mockReset();
    mocks.deleteEq.mockReset();
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it('[P1][CAP-1] lists presets name-sorted (server-side order) in app shape', async () => {
    mocks.listResult.mockResolvedValue({
      data: [
        dbPreset({ id: 'preset-1', name: 'Alpha' }),
        dbPreset({ id: 'preset-2', name: 'Beta' }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useLayoutPresets(), { wrapper: makeWrapper(makeClient()) });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Sorting is server-side: the queryFn must request name-ascending order
    // (no hand-sort in a cache patch — the refetch re-sorts).
    expect(mocks.listResult).toHaveBeenCalledWith('name', { ascending: true });
    expect(result.current.presets.map((p) => p.name)).toEqual(['Alpha', 'Beta']);
    // dbToLayoutPreset transform: user_id -> userId, created_at -> createdAt (ms epoch).
    expect(result.current.presets[0]).toMatchObject({
      id: 'preset-1',
      userId: USER_ID,
      name: 'Alpha',
      createdAt: new Date('2026-05-01T00:00:00.000Z').getTime(),
    });
    expect(result.current.error).toBeNull();
  });

  it('[P1][CAP-1] savePreset inserts user_id + extracted layout_data, invalidates, and returns the preset', async () => {
    const existing = dbPreset({ id: 'preset-2', name: 'Bravo' });
    const inserted = dbPreset({ id: 'preset-9', name: 'Alpha' });
    let resolveRefetch!: (v: { data: DbLayoutPreset[] | null; error: Error | null }) => void;
    mocks.listResult
      .mockResolvedValueOnce({ data: [existing], error: null }) // initial mount
      // Post-settle refetch — resolved MANUALLY below so the test can observe
      // savePreset still pending while the refetch is in flight.
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefetch = resolve;
          })
      );
    mocks.insertSingle.mockResolvedValue({ data: inserted, error: null });

    const { result } = renderHook(() => useLayoutPresets(), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(result.current.presets).toHaveLength(1));

    let saved: LayoutPreset | null | undefined;
    let savePromise!: Promise<unknown>;
    act(() => {
      savePromise = result.current.savePreset('Alpha', makeChart()).then((p) => {
        saved = p;
      });
    });

    // The insert settled and the invalidate refetch is in flight (2nd list call)...
    await waitFor(() => expect(mocks.listResult).toHaveBeenCalledTimes(2));
    expect(mocks.insertPayload).toHaveBeenCalledWith({
      name: 'Alpha',
      user_id: USER_ID,
      layout_data: expectedLayoutData,
    });
    // ...yet savePreset has NOT settled: onSettled RETURNS the invalidateQueries
    // promise and mutateAsync awaits it. A block-bodied onSettled without `return`
    // would have settled here already (one-round-trip stale window) — this is the
    // determinism pin the spec mandates, unreachable by grep.
    expect(saved).toBeUndefined();

    resolveRefetch({ data: [inserted, existing], error: null }); // server re-sorts by name
    await act(async () => {
      await savePromise;
    });

    expect(saved).toMatchObject({ id: 'preset-9', name: 'Alpha', userId: USER_ID });
    await waitFor(() =>
      expect(result.current.presets.map((p) => p.name)).toEqual(['Alpha', 'Bravo'])
    );
  });

  it('[P1][CAP-1] savePreset returns null on insert error and sets error; list unchanged', async () => {
    mocks.listResult.mockResolvedValue({ data: [dbPreset()], error: null });
    mocks.insertSingle.mockResolvedValue({ data: null, error: new Error('insert failed') });

    const { result } = renderHook(() => useLayoutPresets(), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(result.current.presets).toHaveLength(1));

    let saved: LayoutPreset | null = null;
    await act(async () => {
      saved = await result.current.savePreset('Alpha', makeChart());
    });

    expect(saved).toBeNull();
    await waitFor(() => expect(result.current.error?.message).toBe('insert failed'));
    expect(result.current.presets.map((p) => p.name)).toEqual(['Alpha']);
  });

  it('[P1][CAP-1] savePreset returns null when signed out and never attempts the insert', async () => {
    mocks.listResult.mockResolvedValue({ data: [], error: null });
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useLayoutPresets(), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let saved: LayoutPreset | null = null;
    await act(async () => {
      saved = await result.current.savePreset('Alpha', makeChart());
    });

    expect(saved).toBeNull();
    expect(mocks.insertPayload).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error?.message).toBe('Not authenticated'));
  });

  it('[P1][CAP-1] deletePreset deletes the row, invalidates, and returns true; false on error', async () => {
    const alpha = dbPreset({ id: 'preset-1', name: 'Alpha' });
    const bravo = dbPreset({ id: 'preset-2', name: 'Bravo' });
    mocks.listResult
      .mockResolvedValueOnce({ data: [alpha, bravo], error: null }) // initial mount
      .mockResolvedValue({ data: [alpha], error: null }); // post-settle refetch
    mocks.deleteEq.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useLayoutPresets(), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(result.current.presets).toHaveLength(2));

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deletePreset('preset-2');
    });

    expect(deleted).toBe(true);
    expect(mocks.deleteEq).toHaveBeenCalledWith('id', 'preset-2');
    // Settle-invalidate refetched: the deleted preset is gone from the list.
    expect(mocks.listResult).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.presets.map((p) => p.id)).toEqual(['preset-1']));

    mocks.deleteEq.mockResolvedValue({ error: new Error('delete failed') });
    await act(async () => {
      deleted = await result.current.deletePreset('preset-1');
    });

    expect(deleted).toBe(false);
    await waitFor(() => expect(result.current.error?.message).toBe('delete failed'));
  });

  it('[P1][CAP-2] module-level: no useRealtimeSubscription import or layout_presets subscription remains', () => {
    expect(useLayoutPresetsSource).not.toMatch(/useRealtimeSubscription/);
    // \s* + quote class keep these regexes from matching THEMSELVES under the
    // spec's repo-wide literal grep for a layout_presets table subscription
    // (must stay 0 in src); the quote class also catches "..."/`...` evasions.
    expect(useLayoutPresetsSource).not.toMatch(/table:\s*["'`]layout_presets["'`]/);
    expect(useLayoutPresetsSource).not.toMatch(/postgres_changes/);
    expect(useLayoutPresetsSource).not.toMatch(/\.channel\(/);
  });

  it('[P1][CAP-1] surfaces a list query error: error set, presets empty, loading ends false', async () => {
    mocks.listResult.mockResolvedValue({ data: null, error: new Error('fetch failed') });

    const { result } = renderHook(() => useLayoutPresets(), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('fetch failed');
    expect(result.current.presets).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
