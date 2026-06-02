import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClassAwardModal } from '../components/points/ClassAwardModal';
import { MultiAwardModal } from '../components/points/MultiAwardModal';
import { ThemeProvider } from '../contexts/ThemeContext';
import { BatchAwardError } from '../hooks/useBatchAward';
import type { Behavior, Student, StudentPoints } from '../types';

// G5 (BATCH atomicity): pins the batch-award MODAL failure/success seam closed by
// SPEC cluster #2. The orchestrator (useBatchAward) now THROWS on any failure
// (SPEC Constraints: "MUST throw on any failure"), making the modals' existing
// catch -> no-sound / no-close / surface-error path reachable. These tests pin:
//   CAP-4 (SPEC §Capabilities) — a fully successful batch plays the category sound
//          and closes silently; no error appears.
//   CAP-2 (SPEC §Capabilities, failure-handling.md §3) — a failed batch is surfaced
//          loud: the modal stays open, plays NO sound, and shows the named error
//          message the orchestrator throws in a BatchAwardError.
// Mocks the modal's three hook seams (useBatchAward / useSoundEffects / useBehaviors)
// so the catch/sound/close branch is exercised directly without a supabase chain —
// useBehaviors returns app-shaped Behavior rows so BehaviorPicker renders selectable
// buttons. The REAL BatchAwardError is imported (not re-mocked) so the surfaced
// `.message` is the production error string the modal reads via `err.message`.

const mockPlayPositive = vi.hoisted(() => vi.fn());
const mockPlayNegative = vi.hoisted(() => vi.fn());
const mockAwardClass = vi.hoisted(() => vi.fn());
const mockAwardSubset = vi.hoisted(() => vi.fn());

// One positive + one negative behavior so BehaviorPicker renders both sections and
// the success test can pick a cue and the negative-variant test can fire the other.
const positiveBehavior: Behavior = {
  id: 'pos-1',
  name: 'Helping others',
  points: 2,
  icon: '🤝',
  category: 'positive',
  isCustom: false,
  createdAt: 1746057600000,
};

const negativeBehavior: Behavior = {
  id: 'neg-1',
  name: 'Disruption',
  points: -3,
  icon: '🚫',
  category: 'negative',
  isCustom: false,
  createdAt: 1746057600000,
};

// useBatchAward.ts loads the real supabase client at module init (via
// useTransactions -> ../lib/supabase), and the importOriginal() of useBatchAward
// below evaluates that real module. supabase.ts THROWS "Missing Supabase environment
// variables" when no creds are present — exactly CI's Unit Tests step (no `fnox exec`,
// no .env.test in the checkout). The modal's data path is fully driven through the
// mocked useBatchAward hook, so a bare client stub keeps the import graph loading
// without creds. Mirrors AwardPointsModal.test.tsx.
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() },
}));

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

vi.mock('../hooks/useBehaviors', () => ({
  useBehaviors: () => ({ data: [positiveBehavior, negativeBehavior] }),
}));

// Keep the REAL BatchAwardError (so the thrown error's `.message` is the production
// string the modal surfaces); only the awardClass/awardSubset callbacks are spies the
// test drives to resolve (CAP-4) or reject (CAP-2).
vi.mock('../hooks/useBatchAward', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useBatchAward')>();
  return {
    ...actual,
    useBatchAward: () => ({
      awardClass: mockAwardClass,
      awardSubset: mockAwardSubset,
    }),
  };
});

const classPoints: StudentPoints = {
  total: 84,
  positiveTotal: 100,
  negativeTotal: -16,
  today: 8,
  thisWeek: 24,
};

const selectedStudents: Student[] = [
  {
    id: 'stu-1',
    name: 'Bo',
    avatarColor: undefined,
    pointTotal: 12,
    positiveTotal: 14,
    negativeTotal: -2,
    todayTotal: 1,
    thisWeekTotal: 4,
  },
  {
    id: 'stu-2',
    name: 'Ada',
    avatarColor: undefined,
    pointTotal: 20,
    positiveTotal: 22,
    negativeTotal: -2,
    todayTotal: 2,
    thisWeekTotal: 6,
  },
];

// The named per-row failure message the orchestrator throws (failure-handling.md §3:
// "Couldn't award points — {name} {is|are} no longer in this class. No points were
// awarded."). The modal surfaces `err.message` verbatim, so the assertion pins the
// exact string the teacher sees.
const FAILURE_MESSAGE =
  'Couldn’t award points — Bo is no longer in this class. No points were awarded.';

function makeBatchError(): BatchAwardError {
  return new BatchAwardError(FAILURE_MESSAGE, {
    classification: 'per-row',
    batchId: 'batch-1',
    failedStudentNames: ['Bo'],
  });
}

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderClassModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={makeClient()}>
      <ThemeProvider>
        <ClassAwardModal
          isOpen
          onClose={onClose}
          classroomId="class-1"
          classroomName="Room 12"
          studentCount={2}
          classPoints={classPoints}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { onClose };
}

function renderMultiModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={makeClient()}>
      <ThemeProvider>
        <MultiAwardModal
          isOpen
          onClose={onClose}
          selectedStudents={selectedStudents}
          classroomId="class-1"
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { onClose };
}

describe('ClassAwardModal — batch atomicity surface (G5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P2][BATCH.05-UNIT-01] CAP-4: a successful class award plays the positive cue and closes silently', async () => {
    // CAP-4 (SPEC §Capabilities): every row commits -> sound + close, no error.
    mockAwardClass.mockResolvedValue([]);
    const { onClose } = renderClassModal();

    const posButton = await screen.findByRole('button', { name: /Helping others/i });
    await userEvent.click(posButton);

    await waitFor(() => expect(mockAwardClass).toHaveBeenCalledTimes(1));
    expect(mockAwardClass).toHaveBeenCalledWith(positiveBehavior);
    expect(mockPlayPositive).toHaveBeenCalledTimes(1);
    expect(mockPlayNegative).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('[P2][BATCH.05-UNIT-02] CAP-4: a successful negative class award plays the negative cue and closes', async () => {
    // CAP-4 (SPEC §Capabilities): category sound mirrors behavior.category.
    mockAwardClass.mockResolvedValue([]);
    const { onClose } = renderClassModal();

    const negButton = await screen.findByRole('button', { name: /Disruption/i });
    await userEvent.click(negButton);

    await waitFor(() => expect(mockPlayNegative).toHaveBeenCalledTimes(1));
    expect(mockPlayPositive).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('[P2][BATCH.05-UNIT-03] CAP-2: a failed class award surfaces the named error, plays no sound, and stays open', async () => {
    // CAP-2 (SPEC §Capabilities; failure-handling.md §3): throw -> error shown,
    // no sound, no close (modal stays open for the teacher to retry).
    mockAwardClass.mockRejectedValue(makeBatchError());
    const { onClose } = renderClassModal();

    const posButton = await screen.findByRole('button', { name: /Helping others/i });
    await userEvent.click(posButton);

    expect(await screen.findByText(FAILURE_MESSAGE)).toBeInTheDocument();
    expect(mockPlayPositive).not.toHaveBeenCalled();
    expect(mockPlayNegative).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('MultiAwardModal — batch atomicity surface (G5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P2][BATCH.05-UNIT-04] CAP-4: a successful subset award plays the positive cue and closes silently', async () => {
    // CAP-4 (SPEC §Capabilities): every row commits -> sound + close, no error.
    mockAwardSubset.mockResolvedValue([]);
    const { onClose } = renderMultiModal();

    const posButton = await screen.findByRole('button', { name: /Helping others/i });
    await userEvent.click(posButton);

    await waitFor(() => expect(mockAwardSubset).toHaveBeenCalledTimes(1));
    // awardSubset(studentIds, behavior, note) — ids derive from selectedStudents.
    expect(mockAwardSubset).toHaveBeenCalledWith(
      ['stu-1', 'stu-2'],
      positiveBehavior,
      'Multi-select award (2 students)'
    );
    expect(mockPlayPositive).toHaveBeenCalledTimes(1);
    expect(mockPlayNegative).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('[P2][BATCH.05-UNIT-05] CAP-4: a successful negative subset award plays the negative cue and closes', async () => {
    // CAP-4 (SPEC §Capabilities): category sound mirrors behavior.category.
    mockAwardSubset.mockResolvedValue([]);
    const { onClose } = renderMultiModal();

    const negButton = await screen.findByRole('button', { name: /Disruption/i });
    await userEvent.click(negButton);

    await waitFor(() => expect(mockPlayNegative).toHaveBeenCalledTimes(1));
    expect(mockPlayPositive).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('[P2][BATCH.05-UNIT-06] CAP-2: a failed subset award surfaces the named error, plays no sound, and stays open', async () => {
    // CAP-2 (SPEC §Capabilities; failure-handling.md §3): throw -> error shown,
    // no sound, no close (modal stays open for the teacher to retry).
    mockAwardSubset.mockRejectedValue(makeBatchError());
    const { onClose } = renderMultiModal();

    const posButton = await screen.findByRole('button', { name: /Helping others/i });
    await userEvent.click(posButton);

    expect(await screen.findByText(FAILURE_MESSAGE)).toBeInTheDocument();
    expect(mockPlayPositive).not.toHaveBeenCalled();
    expect(mockPlayNegative).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
