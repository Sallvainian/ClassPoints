import { useEffect, useState } from 'react';
import type { UndoableAction } from '../../types';
import { Button } from '../ui/Button';

interface UndoToastProps {
  action: UndoableAction | null;
  onUndo: (transactionId: string) => void;
  duration?: number; // milliseconds
}

export function UndoToast({ action, onUndo, duration = 5000 }: UndoToastProps) {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (action) {
      setVisible(true);
      setTimeLeft(duration);

      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, duration);

      // Countdown timer for progress bar
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
  }, [action, duration]);

  if (!visible || !action) return null;

  const isPositive = action.points > 0;
  const progress = (timeLeft / duration) * 100;

  const handleUndo = () => {
    onUndo(action.transactionId);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden min-w-[320px]">
        {/* Progress bar */}
        <div className="h-1 bg-gray-700">
          <div
            className={`h-full transition-all duration-100 ${
              isPositive ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isPositive ? '✨' : '😔'}</span>
            <div>
              <p className="text-sm font-medium">
                {action.studentName}
              </p>
              <p className="text-xs text-gray-400">
                {action.behaviorName} ({action.points > 0 ? '+' : ''}{action.points})
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            className="text-white hover:bg-gray-700"
          >
            Undo
          </Button>
        </div>
      </div>
    </div>
  );
}
