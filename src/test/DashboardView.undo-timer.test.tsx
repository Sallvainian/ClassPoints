import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Profiler } from 'react';
import { DashboardView } from '../components/dashboard/DashboardView';
import { UNDO_WINDOW_MS } from '../hooks/useUndoableAction';
import { AppProvider } from '../contexts/AppContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { queryKeys } from '../lib/queryKeys';
import type { StudentWithPoints, ClassroomWithCount } from '../types/transforms';
import type { Behavior } from '../types';
import type { PointTransaction as DbPointTransaction } from '../types/database';

// ── Deferred #6 regression guard ─────────────────────────────────────────────
// Pins the event-driven undo-window expiry in DashboardView: a single
// self-rescheduling one-shot timeout replaces the old 1Hz tick interval. The
// REAL useUndoableAction hook runs against seeded caches (do NOT mock it — the
// loading/error gates read `.isLoading`/`.error` off its exposed query).
//
// Fake-timer rules (spec-6-22): real-timer restore in afterEach, advancement via
// `await act(async () => vi.advanceTimersByTimeAsync(...))`, and NO `waitFor`
// while fake timers are installed (it polls real timers and hangs). Microtasks
// stay REAL (`toFake` excludes them) so React/TanStack scheduling works.
//
// Observables (render/derivation counting + timer bookkeeping, not internal
// spies):
// - Profiler commit counting over the DashboardView subtree. UndoToast's own
//   100ms progress interval goes quiescent once its 5s auto-hide elapses
//   (setTimeLeft clamps at 0 → state-equal bailout, no commits), so commits in
//   the 5s→10s stretch can only come from dashboard-level churn — the old 1Hz
//   tick would commit ~once per second there.
// - `vi.getTimerCount()`: after the window the one-shot has fired, the action
//   derived null, nothing was rescheduled, and UndoToast's timers were cleaned
//   up via its null actionKey → exactly zero pending timers. A stuck-toast
//   regression (derivation still non-null) would keep rescheduling instead.

// The query hooks unwrap results via unwrap() from this module, so the factory
// spreads the REAL exports and overrides only the client. Env is stubbed BEFORE
// importOriginal — src/lib/supabase.ts throws at eval without creds (CI's Unit
// Tests step runs credless).
vi.mock('../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../lib/supabase')>();
  // Caches are pre-seeded with staleTime Infinity, so queryFns only run when a
  // mutation's onSettled invalidates them (the undo-press test). MUTATION
  // chains (insert/update/delete) resolve so `mutateAsync` settles; bare SELECT
  // chains (queryFn refetches) HANG forever — deliberately: the seeded caches
  // must stay untouched so the post-undo null derivation can ONLY come from
  // dismissedTxnRef + the expiryBump bump, not from a refetch wiping the data.
  // (A pending refetch leaves data in place, isLoading false, error null — the
  // dashboard gates don't change.)
  const queryStub = () => {
    let isMutation = false;
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    const mut = () => {
      isMutation = true;
      return chain;
    };
    Object.assign(chain, {
      select: ret,
      eq: ret,
      order: ret,
      insert: mut,
      update: mut,
      delete: mut,
      single: () => Promise.resolve({ data: null, error: null }),
      then: (onFulfilled: (v: { data: never[]; error: null }) => unknown) =>
        isMutation
          ? Promise.resolve({ data: [], error: null }).then(onFulfilled)
          : new Promise<{ data: never[]; error: null }>(() => {}).then(onFulfilled),
    });
    return chain;
  };
  return {
    ...actual,
    supabase: {
      from: vi.fn(() => queryStub()),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      channel: vi.fn(() => {
        const channel: Record<string, unknown> = {};
        Object.assign(channel, {
          on: () => channel,
          subscribe: (cb?: (status: string) => void) => {
            cb?.('SUBSCRIBED');
            return channel;
          },
        });
        return channel;
      }),
      removeChannel: vi.fn(),
    },
  };
});

// Sound is orthogonal to the timer behavior — stub the context so the dashboard
// subtree renders without SoundProvider/AuthProvider.
vi.mock('../contexts/useSoundContext', () => ({
  useSoundContext: () => ({
    settings: {
      enabled: true,
      volume: 0.5,
      positiveSound: 'chime',
      negativeSound: 'buzz',
      customPositiveUrl: null,
      customNegativeUrl: null,
    },
    updateSettings: vi.fn(),
    audioContext: null,
    soundBuffers: new Map(),
    isAudioReady: false,
  }),
}));

const CLASSROOM_ID = 'class-1';
const STUDENT_ID = 'stu-1';

// UndoToast's own display duration (its default `duration` prop — DashboardView
// passes none). The toast auto-hides at 5s even though the action stays
// undoable for the full 10s window; past 5s its progress interval is quiescent.
const TOAST_DISPLAY_MS = 5_000;

function makeStudent(): StudentWithPoints {
  return {
    id: STUDENT_ID,
    classroom_id: CLASSROOM_ID,
    name: 'Aaliyah',
    avatar_color: null,
    created_at: '2026-05-01T00:00:00.000Z',
    point_total: 5,
    positive_total: 5,
    negative_total: 0,
    today_total: 5,
    this_week_total: 5,
  };
}

function makeClassroom(): ClassroomWithCount {
  return {
    id: CLASSROOM_ID,
    name: 'Room 1',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    user_id: 'user-1',
    student_count: 1,
    point_total: 5,
    positive_total: 5,
    negative_total: 0,
    student_summaries: [
      {
        id: STUDENT_ID,
        name: 'Aaliyah',
        avatar_color: null,
        point_total: 5,
        positive_total: 5,
        negative_total: 0,
        today_total: 5,
        this_week_total: 5,
      },
    ],
  };
}

const behaviors: Behavior[] = [
  {
    id: 'beh-pos',
    name: 'Helping',
    points: 2,
    icon: '🤝',
    category: 'positive',
    isCustom: false,
    createdAt: 0,
  },
];

function makeTxn(over: Partial<DbPointTransaction> = {}): DbPointTransaction {
  return {
    id: 'txn-1',
    student_id: STUDENT_ID,
    classroom_id: CLASSROOM_ID,
    behavior_id: 'beh-pos',
    behavior_name: 'Helping',
    behavior_icon: '🤝',
    points: 2,
    note: null,
    batch_id: null,
    created_at: new Date(Date.now()).toISOString(),
    ...over,
  } as DbPointTransaction;
}

function makeClient(transactions: DbPointTransaction[]): QueryClient {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  qc.setQueryData<ClassroomWithCount[]>(queryKeys.classrooms.all, [makeClassroom()]);
  qc.setQueryData<StudentWithPoints[]>(queryKeys.students.byClassroom(CLASSROOM_ID), [
    makeStudent(),
  ]);
  qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), transactions);
  qc.setQueryData<Behavior[]>(queryKeys.behaviors.all, behaviors);
  return qc;
}

const commits = { count: 0 };

function renderDashboard(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <AppProvider>
          <Profiler
            id="dashboard"
            onRender={() => {
              commits.count += 1;
            }}
          >
            <DashboardView onOpenSettings={() => {}} />
          </Profiler>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function undoButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: /undo/i });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('DashboardView event-driven undo-window expiry (deferred #6)', () => {
  beforeEach(() => {
    // Microtasks stay real (no 'queueMicrotask'/nextTick in toFake): React and
    // TanStack scheduling must keep working between timer advances.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    commits.count = 0;
    // setup.ts clears localStorage in its own beforeEach (runs first); seed the
    // active classroom afterwards so AppProvider hydrates it on mount.
    window.localStorage.setItem('app:activeClassroomId', CLASSROOM_ID);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[P0][#6] expires the action after the window with zero idle re-renders (no 1s cadence)', async () => {
    renderDashboard(makeClient([makeTxn()]));
    expect(undoButton()).toBeInTheDocument();

    // Pass the toast's own 5s auto-hide; from here on, its 100ms progress
    // interval is state-equal (timeLeft clamped at 0). Absorb the interval's
    // ONE-TIME post-bailout render (React renders once more on the first
    // same-value setState, then eagerly bails forever — UndoToast internals,
    // out of scope here) before marking the idle baseline.
    await advance(TOAST_DISPLAY_MS + 200);
    expect(undoButton()).not.toBeInTheDocument();
    await advance(1_000); // t ≈ 6.2s — absorbs the one-time bailout commit
    const idleStartCommits = commits.count;

    // Idle stretch still INSIDE the undo window (t≈6.2s → t≈9.7s), advanced in
    // per-second act steps so each second's updates flush separately: the
    // removed 1Hz tick was a REAL state change every second and would commit
    // once per step here. The event-driven timer commits zero.
    for (let i = 0; i < 3; i++) {
      await advance(1_000);
    }
    await advance(500);
    expect(commits.count).toBe(idleStartCommits);
    // The one-shot expiry timeout (and the toast's quiescent interval) are
    // still pending — the window has not elapsed yet.
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Cross the window boundary (+ε): the one-shot fires, the derivation goes
    // null, nothing is rescheduled, and UndoToast's null actionKey cleanup
    // clears its own timers → no pending timers at all.
    await advance(600); // t ≈ 10.3s > UNDO_WINDOW_MS + ε
    expect(undoButton()).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    // The expiry itself costs at most the single bump re-render (2 commits
    // covers a boundary-exact refire — never a 1s cadence).
    expect(commits.count - idleStartCommits).toBeLessThanOrEqual(2);
  });

  it('[P0][#6] a re-award inside the window replaces the schedule with the new action window', async () => {
    const first = makeTxn({ id: 'txn-1' });
    const qc = makeClient([first]);
    renderDashboard(qc);
    expect(undoButton()).toBeInTheDocument();

    // t=6s: first toast already auto-hid; first action expires at ~10.025s.
    await advance(6_000);
    expect(undoButton()).not.toBeInTheDocument();

    // Re-award NOW: new transaction → new identity key → old timeout cleared,
    // a fresh one-shot targets t ≈ 16.025s. TanStack delivers cache
    // notifications via setTimeout(0) (notifyManager defaultScheduler), so a
    // tiny advance is needed to flush the notify under fake timers.
    await act(async () => {
      qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), [
        makeTxn({ id: 'txn-2', created_at: new Date(Date.now()).toISOString() }),
        first,
      ]);
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(undoButton()).toBeInTheDocument();

    // Cross the FIRST action's original expiry (t≈10.2s): the new action is
    // still derived (toast still in its display window) and the rescheduled
    // one-shot is still pending — the stale schedule did not kill it.
    await advance(4_200);
    expect(undoButton()).toBeInTheDocument();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Cross the SECOND action's expiry (t≈16.2s): fired, derived null, done.
    await advance(UNDO_WINDOW_MS - 4_000);
    expect(undoButton()).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[P0][#6] a stale action on mount derives null and schedules nothing', async () => {
    renderDashboard(
      makeClient([
        makeTxn({ created_at: new Date(Date.now() - UNDO_WINDOW_MS - 1_000).toISOString() }),
      ])
    );
    expect(undoButton()).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[P0][#6] a far-future timestamp (clock skew) gets a CLAMPED timeout — bounded refire, no busy loop', async () => {
    // Extreme cross-device clock skew: a cached created_at 30 days AHEAD. The
    // strict window check keeps it derived (now − ts is negative), so an
    // unclamped schedule would target ~30 days out — and a setTimeout delay
    // past 2^31-1 ms overflows to an IMMEDIATE fire → derive non-null →
    // reschedule → busy loop. The clamp caps the delay at UNDO_WINDOW_MS + ε:
    // at most one refire per window, bounded and self-terminating.
    renderDashboard(
      makeClient([
        makeTxn({ created_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString() }),
      ])
    );
    expect(undoButton()).toBeInTheDocument(); // skewed action still derives

    // Absorb the toast's own display window + its one-time bailout commit
    // (same baseline dance as the expiry test).
    await advance(TOAST_DISPLAY_MS + 200);
    await advance(1_000);
    const idleStartCommits = commits.count;
    const idleTimers = vi.getTimerCount();
    expect(idleTimers).toBeGreaterThan(0); // the clamped one-shot is pending

    // Idle stretch BEFORE the clamped deadline (t≈6.2s → t≈9.2s), in
    // per-second act steps: the clamp scheduled the fire for window+ε
    // (t≈10.025s), so nothing fires here. An UNCLAMPED >2^31-1ms delay
    // overflows to an immediate fire (fake timers emulate this) and would
    // commit once per step — this is the assertion that detects the clamp.
    for (let i = 0; i < 3; i++) {
      await advance(1_000);
    }
    expect(commits.count).toBe(idleStartCommits);

    // Cross the clamped deadline: the one-shot fires ONCE, re-derives
    // non-null under skew, and reschedules one new clamped one-shot —
    // bounded, self-terminating, no busy loop.
    await advance(2_000); // t≈11.2s > UNDO_WINDOW_MS + ε
    expect(commits.count - idleStartCommits).toBeGreaterThanOrEqual(1); // it DID fire (clamped)
    expect(commits.count - idleStartCommits).toBeLessThanOrEqual(2); // no busy loop
    expect(vi.getTimerCount()).toBeLessThanOrEqual(idleTimers); // rescheduled, not accumulated
    expect(undoButton()).not.toBeInTheDocument(); // stable actionKey — toast not resurrected
  });

  it('[P0][#6] pressing Undo hides the toast immediately and cancels the pending expiry timer', async () => {
    renderDashboard(makeClient([makeTxn()]));
    expect(undoButton()).toBeInTheDocument();
    expect(vi.getTimerCount()).toBeGreaterThan(0); // expiry one-shot pending

    // Click Undo (fireEvent — user-event's internal delays deadlock under fake
    // timers). handleUndo awaits the stubbed delete mutation, then sets
    // dismissedTxnRef and bumps expiryBump — the old setTick path, swapped.
    await act(async () => {
      fireEvent.click(undoButton()!);
    });
    expect(undoButton()).not.toBeInTheDocument(); // hidden on the very next commit

    // Flush TanStack's setTimeout(0) notifications. The onSettled refetches
    // hang by design (see the mock), so the still-in-window transaction is
    // STILL in the cache — the derivation returns null ONLY because
    // dismissedTxnRef suppresses it on the bump's re-render. That null
    // actionExpiryKey cancels the expiry one-shot AND (via UndoToast's null
    // actionKey) its hide/progress timers: nothing left pending. Without the
    // bump, the expiry one-shot and the toast interval would both survive.
    await advance(50);
    expect(undoButton()).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[P0][#6] unmount mid-window clears the pending expiry timeout', async () => {
    const { unmount } = renderDashboard(makeClient([makeTxn()]));
    expect(undoButton()).toBeInTheDocument();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Precedent: useRotatingCategory.test.ts cleanup-on-unmount spy.
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    // Stronger than the spy alone: NOTHING in the tree leaks a timer.
    expect(vi.getTimerCount()).toBe(0);
    clearTimeoutSpy.mockRestore();
  });
});
