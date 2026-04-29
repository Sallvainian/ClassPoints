import { useEffect, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import type { Behavior, StudentPoints } from '../../types';
import { useApp } from '../../contexts/useApp';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { ERROR_MESSAGES } from '../../utils/errorMessages';
import { BehaviorPicker } from '../behaviors/BehaviorPicker';
import { Dialog } from '../ui';

interface ClassAwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  classroomName: string;
  studentCount: number;
  classPoints: StudentPoints;
}

export function ClassAwardModal({
  isOpen,
  onClose,
  classroomId,
  classroomName,
  studentCount,
  classPoints,
}: ClassAwardModalProps) {
  const { behaviors, awardClassPoints } = useApp();
  const { playPositive, playNegative } = useSoundEffects();
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setAwardError(null);
      setIsAwarding(false);
    }
  }, [isOpen]);

  const handleBehaviorSelect = useCallback(
    async (behavior: Behavior) => {
      if (isAwarding) return;

      setIsAwarding(true);
      setAwardError(null);

      try {
        await awardClassPoints(classroomId, behavior.id);
        if (behavior.category === 'positive') {
          playPositive();
        } else {
          playNegative();
        }
        onClose();
      } catch (err) {
        console.error('Failed to award class points:', err);
        setAwardError(err instanceof Error ? err.message : ERROR_MESSAGES.AWARD_CLASS);
        setIsAwarding(false);
      }
    },
    [classroomId, isAwarding, awardClassPoints, playPositive, playNegative, onClose]
  );

  if (!isOpen) return null;

  const isPositive = classPoints.total >= 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`Award points to entire class: ${classroomName}`}
      maxWidth="max-w-lg"
    >
      {/* Header */}
      <div className="relative px-6 pt-6 pb-5 border-b border-hairline">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
          Award entire class
        </p>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent-500/10 text-accent-700 dark:text-accent-400 flex items-center justify-center text-2xl">
            ◎
          </div>
          <div>
            <h2 className="font-display text-2xl tracking-[-0.01em] text-ink-strong leading-tight">
              {classroomName}
            </h2>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {studentCount} student{studentCount !== 1 ? 's' : ''} ·{' '}
              <span
                className={`tabular-nums font-semibold ${
                  isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isPositive ? '+' : ''}
                {classPoints.total}
              </span>{' '}
              total
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-accent-500/5 border-b border-hairline px-6 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-700 dark:text-accent-400 text-center">
          Points awarded to all {studentCount} students at once
        </p>
      </div>

      {/* Error */}
      {awardError && (
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200/40 dark:border-red-900/40 px-6 py-3">
          <p className="text-xs text-red-700 dark:text-red-300 text-center">{awardError}</p>
        </div>
      )}

      {/* Body */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {isAwarding ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-hairline border-t-accent-500 mb-3" />
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
              Awarding points...
            </p>
          </div>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-4 text-center">
              Select a behavior for the whole class
            </p>
            <BehaviorPicker behaviors={behaviors} onSelect={handleBehaviorSelect} />
          </>
        )}
      </div>
    </Dialog>
  );
}
