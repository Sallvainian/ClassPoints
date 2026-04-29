import { useEffect, useState } from 'react';
import type { UndoableAction } from '../../types';

interface UndoToastProps {
  action: UndoableAction | null;
  onUndo: (transactionId: string) => void;
  duration?: number; // milliseconds
}

export function UndoToast({ action, onUndo, duration = 5000 }: UndoToastProps) {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Stable dep key — see prior comment in git history. batchId for batches,
  // timestamp for single awards (transactionId flips during optimistic→real swap).
  const actionKey = action?.batchId ?? action?.timestamp ?? null;

  useEffect(() => {
    if (action) {
      setVisible(true);
      setTimeLeft(duration);

      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, duration);

      const interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 100));
      }, 100);

      return () => {
        clearTimeout(hideTimer);
        clearInterval(interval);
      };
    } else {
      setVisible(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionKey, duration]);

  if (!visible || !action) return null;

  const isPositive = action.points > 0;
  const progress = (timeLeft / duration) * 100;

  const handleUndo = () => {
    onUndo(action.transactionId);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
      <div className="min-w-[360px] rounded-xl border border-hairline bg-surface-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] overflow-hidden">
        {/* Progress bar */}
        <div className="h-[2px] bg-hairline">
          <div
            className={`h-full transition-all duration-100 ${
              isPositive ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-md px-2 font-mono tabular-nums text-xs font-semibold ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-500/10 text-red-700 dark:text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {action.points}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-strong truncate leading-tight">
                {action.studentName}
                {action.isBatch && action.isClassWide && action.studentCount && (
                  <span className="text-ink-muted font-normal">
                    {' '}
                    · {action.studentCount} student{action.studentCount === 1 ? '' : 's'}
                  </span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-ink-muted truncate leading-tight">
                {action.behaviorName}
                {action.isBatch ? ' · total' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={handleUndo}
            className="shrink-0 px-3 py-1.5 text-xs font-mono uppercase tracking-[0.14em] rounded-md text-accent-700 dark:text-accent-400 hover:bg-accent-500/10 transition-colors"
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}
