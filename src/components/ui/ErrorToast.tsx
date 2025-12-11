import { useEffect, useState } from 'react';
import { Button } from './Button';

interface ErrorToastProps {
  error: string | null;
  onDismiss: () => void;
  duration?: number; // milliseconds
}

export function ErrorToast({ error, onDismiss, duration = 5000 }: ErrorToastProps) {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (error) {
      setVisible(true);
      setTimeLeft(duration);

      const hideTimer = setTimeout(() => {
        setVisible(false);
        onDismiss();
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
  }, [error, duration, onDismiss]);

  if (!visible || !error) return null;

  const progress = (timeLeft / duration) * 100;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss();
  };

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-red-600 text-white rounded-xl shadow-2xl overflow-hidden min-w-[320px]">
        {/* Progress bar */}
        <div className="h-1 bg-red-800">
          <div
            className="h-full transition-all duration-100 bg-red-400"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm font-medium">{error}</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-white hover:bg-red-700"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
