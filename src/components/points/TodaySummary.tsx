import { useMemo } from 'react';
import type { PointTransaction, Student } from '../../types';

interface TodaySummaryProps {
  transactions: PointTransaction[];
  students: Student[];
  limit?: number;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function TodaySummary({ transactions, students, limit = 10 }: TodaySummaryProps) {
  const getStudentName = (studentId: string): string => {
    const student = students.find((s) => s.id === studentId);
    return student?.name || 'Unknown';
  };

  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }, [transactions, limit]);

  if (recentTransactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
          Empty
        </p>
        <p className="text-sm text-ink-mid">No activity yet today</p>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {recentTransactions.map((transaction, index) => {
        const isPositive = transaction.points > 0;
        const isLast = index === recentTransactions.length - 1;
        return (
          <li
            key={transaction.id}
            className={`flex items-start gap-3 py-3 ${isLast ? '' : 'border-b border-hairline'}`}
          >
            {/* Delta column — mono, color-coded */}
            <span
              className={`shrink-0 inline-flex items-center justify-center min-w-[3rem] h-7 rounded-md px-2 font-mono tabular-nums text-xs font-semibold ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-500/10 text-red-700 dark:text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {transaction.points}
            </span>

            {/* Body */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-strong leading-tight truncate">
                {getStudentName(transaction.studentId)}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-mid leading-tight truncate">
                <span aria-hidden="true">{transaction.behaviorIcon} </span>
                {transaction.behaviorName}
              </p>
            </div>

            {/* Time */}
            <span className="shrink-0 font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-0.5">
              {formatRelativeTime(transaction.timestamp)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
