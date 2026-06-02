import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TodaySummary } from '../components/points/TodaySummary';
import type { PointTransaction, Student } from '../types';

// G3:TodaySummary — pins CAP-3 (a failed batch is visible in the activity feed as a
// distinct "failed" entry) and CAP-4 (a fully successful award renders exactly as
// before). TodaySummary is purely presentational (it imports only useMemo + types and
// reads no context), so it renders directly with no QueryClient/Theme provider and there
// is no supabase boundary to mock. The transaction.failed render branch under test lives
// at TodaySummary.tsx:54-77.

const students: Student[] = [
  {
    id: 'stu-ada',
    name: 'Ada Lovelace',
    avatarColor: undefined,
    pointTotal: 12,
    positiveTotal: 14,
    negativeTotal: -2,
    todayTotal: 3,
    thisWeekTotal: 9,
  },
  {
    id: 'stu-grace',
    name: 'Grace Hopper',
    avatarColor: undefined,
    pointTotal: 8,
    positiveTotal: 10,
    negativeTotal: -2,
    todayTotal: -3,
    thisWeekTotal: 5,
  },
];

// Build a complete PointTransaction. The failed branch never reads `points`, but the
// type requires it, so a value is always supplied to keep `npm run typecheck` green.
function makeTransaction(overrides: Partial<PointTransaction>): PointTransaction {
  return {
    id: 'tx-base',
    studentId: 'stu-ada',
    classroomId: 'class-1',
    behaviorId: 'beh-1',
    behaviorName: 'Helping others',
    behaviorIcon: '🤝',
    points: 2,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('TodaySummary — failed-batch activity feed (CAP-3 / CAP-4)', () => {
  it('[P1][BATCH.07-UNIT-01] renders a failed entry as a distinct FAILED badge with no point delta', () => {
    // CAP-3 (SPEC.md): after a failed batch, TodaySummary shows a distinct "failed"
    // entry — the Failed badge (aria-label "Award failed"), the "Award failed" body
    // text, and the behavior name/icon — and NO signed point delta (failure-handling.md
    // §4: an atomic failed batch writes zero rows, so it must not look like an award).
    const failed = makeTransaction({
      id: 'tx-failed',
      failed: true,
      behaviorName: 'Helping others',
      behaviorIcon: '🤝',
      timestamp: Date.now(),
    });

    render(<TodaySummary transactions={[failed]} students={students} />);

    // Badge is reachable by aria-label and carries the literal text "Failed".
    const badge = screen.getByLabelText('Award failed');
    expect(badge).toHaveTextContent('Failed');

    // Scope the remaining assertions to the failed <li> row.
    const row = badge.closest('li');
    expect(row).not.toBeNull();
    const failedRow = within(row as HTMLElement);

    // Body line "Award failed" (the <p>), distinct from the badge's "Failed".
    expect(failedRow.getByText('Award failed')).toBeInTheDocument();
    // The snapshot behavior name + icon still render in the failed row.
    expect(failedRow.getByText('Helping others')).toBeInTheDocument();
    expect(failedRow.getByText('🤝')).toBeInTheDocument();

    // No signed point delta in the failed row (the failed branch emits a FAILED badge,
    // never a +N / -N chip).
    expect(failedRow.queryByText(/^[+-]?\d+$/)).toBeNull();
  });

  it('[P1][BATCH.07-UNIT-02] renders a successful award with the student name and a signed delta (regression)', () => {
    // CAP-4 (SPEC.md): a fully successful award renders exactly as today. A positive
    // transaction shows a "+N" chip and the student NAME resolved from the `students`
    // prop (PointTransaction carries no name field, so a rendered name can only come
    // from getStudentName(studentId) — TodaySummary.tsx:26-29). A negative transaction
    // renders the raw negative number with no leading "+".
    const positive = makeTransaction({
      id: 'tx-pos',
      studentId: 'stu-ada',
      points: 2,
      timestamp: Date.now(),
    });
    const negative = makeTransaction({
      id: 'tx-neg',
      studentId: 'stu-grace',
      behaviorName: 'Disruption',
      behaviorIcon: '🚫',
      points: -3,
      timestamp: Date.now() - 60_000,
    });

    render(<TodaySummary transactions={[positive, negative]} students={students} />);

    // Positive row: student name from prop lookup + "+2" delta.
    const posRow = within(screen.getByText('Ada Lovelace').closest('li') as HTMLElement);
    expect(posRow.getByText('+2')).toBeInTheDocument();

    // Negative row: student name from prop lookup + raw "-3" (no leading "+").
    const negRow = within(screen.getByText('Grace Hopper').closest('li') as HTMLElement);
    expect(negRow.getByText('-3')).toBeInTheDocument();
    expect(negRow.queryByText('+-3')).toBeNull();
  });

  it('[P1][BATCH.07-UNIT-03] renders a mixed feed timestamp-desc and honors limit', () => {
    // CAP-3 + CAP-4 together: a failed entry and a real award coexist in one feed; rows
    // are sorted timestamp-desc and capped to `limit` (TodaySummary.tsx:31-33). With
    // limit=2 over 3 transactions, the two newest render (failed + positive) and the
    // oldest (negative) is dropped.
    const now = Date.now();
    const failed = makeTransaction({
      id: 'tx-failed',
      failed: true,
      behaviorName: 'Helping others',
      behaviorIcon: '🤝',
      timestamp: now, // newest
    });
    const positive = makeTransaction({
      id: 'tx-pos',
      studentId: 'stu-ada',
      points: 2,
      timestamp: now - 60_000, // middle
    });
    const oldNegative = makeTransaction({
      id: 'tx-old',
      studentId: 'stu-grace',
      behaviorName: 'Disruption',
      behaviorIcon: '🚫',
      points: -3,
      timestamp: now - 3_600_000, // oldest — should be sliced off by limit=2
    });

    render(
      <TodaySummary transactions={[positive, oldNegative, failed]} students={students} limit={2} />
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    // Newest first: the failed entry, then the positive award.
    expect(within(rows[0]).getByLabelText('Award failed')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(rows[1]).getByText('+2')).toBeInTheDocument();

    // The oldest (negative) entry was sliced off by the limit.
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    expect(screen.queryByText('-3')).toBeNull();
  });

  it('[P1][BATCH.07-UNIT-04] renders the empty state when there are no transactions', () => {
    // Guard (TodaySummary.tsx:35-44): an empty feed renders the "No activity yet today"
    // empty state and no list rows — the baseline the failed/success branches build on.
    render(<TodaySummary transactions={[]} students={students} />);

    expect(screen.getByText('No activity yet today')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
