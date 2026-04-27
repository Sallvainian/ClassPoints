import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from './Button';

interface ErrorToastProps {
  error: string | null;
  onDismiss: () => void;
  duration?: number; // milliseconds
}

export function ErrorToast({ error, onDismiss, duration = 5000 }: ErrorToastProps) {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const dismissedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (error) {
      dismissedRef.current = false;
      setVisible(true);
      setTimeLeft(duration);

      hideTimerRef.current = setTimeout(() => {
        if (!dismissedRef.current) {
          setVisible(false);
          onDismiss();
        }
      }, duration);

      const interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 100));
      }, 100);

      return () => {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        clearInterval(interval);
      };
    } else {
      setVisible(false);
    }
  }, [error, duration, onDismiss]);

  const handleDismiss = useCallback(() => {
    dismissedRef.current = true;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setVisible(false);
    onDismiss();
  }, [onDismiss]);

  if (!visible || !error) return null;

  const progress = (timeLeft / duration) * 100;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-surface-2 border border-hairline rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] overflow-hidden min-w-[340px]">
        <div className="h-[2px] bg-hairline">
          <div
            className="h-full transition-all duration-100 bg-red-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold"
              aria-hidden="true"
            >
              !
            </span>
            <p className="text-sm font-medium text-ink-strong">{error}</p>
          </div>

          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
