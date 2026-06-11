import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AwardPointsModal } from '../components/points/AwardPointsModal';
import { ThemeProvider } from '../contexts/ThemeContext';
import type { Student } from '../types';
import type {
  Behavior as DbBehavior,
  PointTransaction as DbPointTransaction,
} from '../types/database';

// Closes IO-1: no component test exercised the migrated AwardPointsModal wiring
// (useBehaviors + useAwardPoints + studentPoints read from the prop) or the award
// sound. Uses the REAL useBehaviors + useAwardPoints (supabase mocked at the
// boundary) so the migrated wiring itself is under test; only the sound layer is
// stubbed so the assertion can observe which cue fired.
const mockPlayPositive = vi.hoisted(() => vi.fn());
const mockPlayNegative = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());

const behaviorRows: DbBehavior[] = [
  {
    id: 'pos-1',
    name: 'Helping others',
    points: 2,
    icon: '🤝',
    category: 'positive',
    is_custom: false,
    created_at: '2026-05-01T00:00:00.000Z',
    user_id: null,
  },
  {
    id: 'neg-1',
    name: 'Disruption',
    points: -3,
    icon: '🚫',
    category: 'negative',
    is_custom: false,
    created_at: '2026-05-01T00:00:00.000Z',
    user_id: null,
  },
];

vi.mock('../hooks/useSoundEffects', () => ({
  useSoundEffects: () => ({
    playPositive: mockPlayPositive,
    playNegative: mockPlayNegative,
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    isEnabled: true,
    volume: 50,
    isReady: true,
  }),
}));

// The query/mutation hooks unwrap results via unwrap() from this module, so the
// factory spreads the REAL exports and overrides only the client. Env is stubbed
// BEFORE importOriginal — src/lib/supabase.ts throws at eval without creds (CI's
// Unit Tests step runs credless).
vi.mock('../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../lib/supabase')>();
  // Table-aware chain: behaviors SELECT -> behaviorRows; point_transactions
  // INSERT...single -> a real row; any other read -> []. channel is a bare spy so
  // the test can assert the modal opens ZERO realtime subscriptions (Finding A).
  function chainFor(table: string) {
    let op: 'read' | 'insert' = 'read';
    const result = () => {
      if (table === 'behaviors') return { data: behaviorRows, error: null };
      if (table === 'point_transactions' && op === 'insert') {
        const row: DbPointTransaction = {
          id: 'real-tx-1',
          student_id: 'stu-1',
          classroom_id: 'class-1',
          behavior_id: 'pos-1',
          behavior_name: 'Helping others',
          behavior_icon: '🤝',
          points: 2,
          note: null,
          batch_id: null,
          batch_kind: null,
          created_at: '2026-05-01T00:00:00.000Z',
        };
        return { data: row, error: null };
      }
      return { data: [], error: null };
    };
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      select: () => chain,
      insert: (payload: unknown) => {
        op = 'insert';
        mockInsert(payload);
        return chain;
      },
      update: () => chain,
      delete: () => chain,
      eq: () => chain,
      order: () => chain,
      single: () => Promise.resolve(result()),
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result()).then(onFulfilled),
    });
    return chain;
  }
  return {
    ...actual,
    supabase: {
      from: vi.fn((table: string) => chainFor(table)),
      channel: mockChannel,
      removeChannel: vi.fn(),
    },
  };
});

const student: Student = {
  id: 'stu-1',
  name: 'Ada',
  avatarColor: undefined,
  pointTotal: 42,
  positiveTotal: 50,
  negativeTotal: -8,
  todayTotal: 4,
  thisWeekTotal: 12,
};

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={makeClient()}>
      <ThemeProvider>
        <AwardPointsModal isOpen onClose={onClose} student={student} classroomId="class-1" />
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { onClose };
}

describe('AwardPointsModal — Phase 4 migrated wiring (IO-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P1][IO-1] reads the student total from the prop and opens no useStudents subscription', async () => {
    renderModal();

    // studentPoints(student).total === student.pointTotal, displayed as "+42".
    expect(await screen.findByText('+42')).toBeInTheDocument();
    // Finding A: the modal does not mount useStudents, so it never opens a
    // realtime channel (the duplicate point_transactions DELETE sub it used to).
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('[P1][IO-1] renders behaviors from useBehaviors and awards + plays the positive cue', async () => {
    const { onClose } = renderModal();

    const posButton = await screen.findByRole('button', { name: /Helping others/i });
    await userEvent.click(posButton);

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: 'stu-1',
        classroom_id: 'class-1',
        behavior_id: 'pos-1',
        points: 2,
      })
    );
    expect(mockPlayPositive).toHaveBeenCalledTimes(1);
    expect(mockPlayNegative).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('[P1][IO-1] plays the negative cue when a negative behavior is selected', async () => {
    renderModal();

    const negButton = await screen.findByRole('button', { name: /Disruption/i });
    await userEvent.click(negButton);

    await waitFor(() => expect(mockPlayNegative).toHaveBeenCalledTimes(1));
    expect(mockPlayPositive).not.toHaveBeenCalled();
  });
});
