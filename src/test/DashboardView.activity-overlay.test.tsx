import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardView } from '../components/dashboard/DashboardView';
import { AppProvider } from '../contexts/AppContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { queryKeys } from '../lib/queryKeys';
import type { StudentWithPoints, ClassroomWithCount } from '../types/transforms';
import type { Behavior } from '../types';
import type { PointTransaction as DbPointTransaction } from '../types/database';

// ── Mobile activity-overlay regression ───────────────────────────────────────
// Pins the phone behavior of the Activity panel: below md it is a full-area
// overlay (`absolute inset-0 z-10`) over the student grid with an md:hidden
// close button; at md+ the same aside is the classic in-flow side panel
// (`md:static md:w-80`). jsdom cannot evaluate media queries — we assert the
// class strings plus the close-button behavior (aside unmounts).
//
// Harness reuses the DashboardView.undo-timer.test.tsx approach: REAL hooks
// against pre-seeded TanStack caches (staleTime Infinity → queryFns never run),
// real timers (no timer behavior under test here).

// The query hooks unwrap results via unwrap() from this module, so the factory
// spreads the REAL exports and overrides only the client. Env is stubbed BEFORE
// importOriginal — src/lib/supabase.ts throws at eval without creds (CI's Unit
// Tests step runs credless).
vi.mock('../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../lib/supabase')>();
  // Caches are pre-seeded with staleTime Infinity and this test runs no
  // mutations, so nothing should ever hit the client — SELECT chains hang
  // (never-resolving) so an unexpected refetch can't wipe the seeded data.
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
        new Promise<{ data: never[]; error: null }>(() => {}).then(onFulfilled),
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

// Sound is orthogonal to the overlay — stub the context so the dashboard
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
  // No transactions: keeps UndoToast out of the tree (no undo timers to manage).
  qc.setQueryData<DbPointTransaction[]>(queryKeys.transactions.list(CLASSROOM_ID), []);
  qc.setQueryData<Behavior[]>(queryKeys.behaviors.all, behaviors);
  return qc;
}

function renderDashboard() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <ThemeProvider>
        <AppProvider>
          <DashboardView onOpenSettings={() => {}} />
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function activityAside(container: HTMLElement): HTMLElement | null {
  return container.querySelector('aside');
}

describe('DashboardView activity panel — phone overlay / desktop side panel', () => {
  beforeEach(() => {
    // setup.ts clears localStorage in its own beforeEach (runs first); seed the
    // active classroom afterwards so AppProvider hydrates it on mount.
    window.localStorage.setItem('app:activeClassroomId', CLASSROOM_ID);
  });

  it('toggling Activity on mounts the aside as a phone overlay that reverts to md:w-80 side panel', async () => {
    const { container } = renderDashboard();

    // Off by default.
    expect(activityAside(container)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }));

    const aside = activityAside(container);
    expect(aside).not.toBeNull();
    // Phone: full-area overlay above the grid…
    expect(aside).toHaveClass('absolute');
    expect(aside).toHaveClass('inset-0');
    expect(aside).toHaveClass('z-10');
    // …desktop: the classic in-flow 20rem side panel.
    expect(aside).toHaveClass('md:static');
    expect(aside).toHaveClass('md:inset-auto');
    expect(aside).toHaveClass('md:w-80');
    // Panel content actually rendered.
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeInTheDocument();
  });

  it('the Close activity button is phone-only (md:hidden) and unmounts the aside', async () => {
    const { container } = renderDashboard();

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(activityAside(container)).not.toBeNull();

    const closeButton = screen.getByRole('button', { name: 'Close activity' });
    // Desktop keeps the Activity toggle as the only dismissal — the close
    // button exists for the phone overlay, which covers that toggle.
    expect(closeButton).toHaveClass('md:hidden');

    await userEvent.click(closeButton);
    expect(activityAside(container)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close activity' })).not.toBeInTheDocument();
  });
});
