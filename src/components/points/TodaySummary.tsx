import { useMemo } from 'react';
import type { PointTransaction, Student } from '../../types';

interface TodaySummaryProps {
  transactions: PointTransaction[];
  students: Student[];
  limit?: number;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function TodaySummary({ transactions, students, limit = 10 }: TodaySummaryProps) {
  // Get student name by ID
  const getStudentName = (studentId: string): string => {
    const student = students.find((s) => s.id === studentId);
    return student?.name || 'Unknown';
  };

  // Get recent transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }, [transactions, limit]);

  if (recentTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">📝</div>
        <p className="text-sm">No activity yet today</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentTransactions.map((transaction) => {
        const isPositive = transaction.points > 0;
        return (
          <div
            key={transaction.id}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              isPositive ? 'bg-emerald-50' : 'bg-red-50'
            }`}
          >
            {/* Icon */}
            <span className="text-xl">{transaction.behaviorIcon}</span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getStudentName(transaction.studentId)}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {transaction.behaviorName}
              </p>
            </div>

            {/* Points & Time */}
            <div className="text-right">
              <span
                className={`font-bold ${
                  isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {isPositive ? '+' : ''}{transaction.points}
              </span>
              <p className="text-xs text-gray-400">
                {formatRelativeTime(transaction.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
