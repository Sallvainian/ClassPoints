import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { DashboardView } from '../components/dashboard/DashboardView';
import { useStudents } from '../hooks/useStudents';
import { AppProvider } from '../contexts/AppContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { queryKeys } from '../lib/queryKeys';
import type { StudentWithPoints, ClassroomWithCount } from '../types/transforms';
import type { Behavior } from '../types';
import type { PointTransaction as DbPointTransaction } from '../types/database';

// ── IO-5 / Finding A regression guard ────────────────────────────────────────
// Invariant guarded: exactly ONE useStudents(activeClassroomId) mount per dashboard
// screen (Finding A — App.tsx:89-107 XOR ternary + AwardPointsModal.tsx:70-74 reading
// from its prop). Originally this guarded a correctness bug: useStudents did a
// NON-idempotent local decrement on each point_transactions DELETE event, so two
// mounts → two DELETE handlers → durable double-decrement of today/week totals. #23
// replaced that local-delta with idempotent invalidate-and-refetch and removed the
// point_transactions DELETE subscription from useStudents entirely. A 2nd mount is now
// duplicate-channel / duplicate-RPC waste rather than a correctness double-decrement —
// but the single-mount invariant is still worth guarding.
//
// The invariant is expressed as a *bijective* counter: every supabase.channel()
// .on('postgres_changes', config, handler) registers a record; removeChannel marks
// it inactive (so the count is StrictMode/remount-safe). After #23 the unique
// signature of a useStudents mount is its { table: 'students' } subscription —
// useTransactions watches point_transactions (useTransactions.ts:56), and
// useClassrooms no longer subscribes (resolved deferred #4) — so net-active
// students-table subs == live useStudents mounts.

interface ChannelRecord {
  config: { table?: string; event?: string } | null;
  handler: ((payload: unknown) => void) | null;
  active: boolean;
}

const realtime = vi.hoisted(() => ({ records: [] as ChannelRecord[] }));

function studentsSubscriptions(): ChannelRecord[] {
  return realtime.records.filter((r) => r.active && r.config?.table === 'students');
}

vi.mock('../lib/supabase', () => {
  // Caches are pre-seeded with staleTime Infinity, so queryFns should not run;
  // this permissive stub only prevents a crash if one ever does.
  const queryStub = () => {
    const chain: Record<string, unknown> = {};
    const ret = () => chain;
    Object.assign(chain, {
      select: ret,
      eq: ret,
      order: ret,
      insert: ret,
      update: ret,
      delete: ret,
      single: () => Promise.resolve({ data: null, error: null }),
      then: (onFulfilled: (v: { data: never[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled),
    });
    return chain;
  };
  return {
    supabase: {
      from: vi.fn(() => queryStub()),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      channel: vi.fn(() => {
        const record: ChannelRecord = { config: null, handler: null, active: true };
        realtime.records.push(record);
        const channel: Record<string, unknown> = {};
        Object.assign(channel, {
          on: (
            _type: string,
            config: { table?: string; event?: string },
            handler: (payload: unknown) => void
          ) => {
            record.config = config;
            record.handler = handler;
            return channel;
          },
          subscribe: (cb?: (status: string) => void) => {
            cb?.('SUBSCRIBED');
            return channel;
          },
          __record: record,
        });
        return channel;
      }),
      removeChannel: vi.fn((channel: { __record?: ChannelRecord }) => {
        if (channel?.__record) channel.__record.active = false;
      }),
    },
  };
});

// Sound is orthogonal to the mount invariant — stub the context so the dashboard
// subtree (SoundSettingsModal + the modals' useSoundEffects) renders without
// SoundProvider/AuthProvider, leaving only useStudents real.
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

function makeStudent(overrides: Partial<StudentWithPoints> = {}): StudentWithPoints {
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
    ...overrides,
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

function makeClient(): QueryClient {
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
  qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);
  qc.setQueryData<Behavior[]>(queryKeys.behaviors.all, behaviors);
  return qc;
}

function renderDashboard(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <AppProvider>
          <DashboardView onOpenSettings={() => {}} />
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Single useStudents mount per dashboard screen (IO-5 / Finding A)', () => {
  beforeEach(() => {
    realtime.records.length = 0;
    // setup.ts clears localStorage in its own beforeEach (runs first); seed the
    // active classroom afterwards so AppProvider hydrates it on mount.
    window.localStorage.setItem('app:activeClassroomId', CLASSROOM_ID);
  });

  it('[P0][IO-5] DashboardView opens exactly one students-table subscription', async () => {
    renderDashboard(makeClient());

    // Reaches the main render (the student card, not the loading state).
    expect(await screen.findByRole('button', { name: /Aaliyah/i })).toBeInTheDocument();

    await waitFor(() => expect(studentsSubscriptions()).toHaveLength(1));
  });

  it('[P0][IO-5] opening the AwardPointsModal does NOT add a second useStudents mount', async () => {
    renderDashboard(makeClient());

    const card = await screen.findByRole('button', { name: /Aaliyah/i });
    await waitFor(() => expect(studentsSubscriptions()).toHaveLength(1));

    await userEvent.click(card);
    // Modal is open (reads totals from the prop, per Finding A — no new mount).
    expect(
      await screen.findByRole('dialog', { name: /Award points to Aaliyah/i })
    ).toBeInTheDocument();

    expect(studentsSubscriptions()).toHaveLength(1);
  });

  it('[P0][IO-5] control: the counter detects a second useStudents mount (guard is not vacuous)', async () => {
    const qc = makeClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children);

    renderHook(
      () => {
        useStudents(CLASSROOM_ID);
        useStudents(CLASSROOM_ID);
      },
      { wrapper }
    );

    await waitFor(() => expect(studentsSubscriptions()).toHaveLength(2));
  });
});
