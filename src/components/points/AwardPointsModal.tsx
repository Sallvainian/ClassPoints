import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Student, Behavior } from '../../types';
import { useApp } from '../../contexts/useApp';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { useAvatarColor } from '../../hooks';
import { getAvatarColorForName } from '../../utils';
import { ERROR_MESSAGES } from '../../utils/errorMessages';
import { BehaviorPicker } from '../behaviors/BehaviorPicker';
import { Dialog } from '../ui';

interface AwardPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  classroomId: string;
}

export function AwardPointsModal({ isOpen, onClose, student, classroomId }: AwardPointsModalProps) {
  const { behaviors, awardPoints, getStudentPoints } = useApp();
  const { playPositive, playNegative } = useSoundEffects();
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Reset error when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAwardError(null);
      setIsAwarding(false);
    }
  }, [isOpen]);

  const handleBehaviorSelect = useCallback(
    async (behavior: Behavior) => {
      if (!student || isAwarding) return;

      setIsAwarding(true);
      setAwardError(null);

      try {
        await awardPoints(classroomId, student.id, behavior.id);
        if (behavior.category === 'positive') {
          playPositive();
        } else {
          playNegative();
        }
        onClose();
      } catch (err) {
        setAwardError(err instanceof Error ? err.message : ERROR_MESSAGES.AWARD_POINTS);
        setIsAwarding(false);
      }
    },
    [classroomId, student, isAwarding, awardPoints, playPositive, playNegative, onClose]
  );

  const rawColor = student ? student.avatarColor || getAvatarColorForName(student.name) : '#6b7280';
  const { bg: avatarBg, textClass: avatarTextClass } = useAvatarColor(rawColor);

  if (!isOpen || !student) return null;

  const points = getStudentPoints(student.id);
  const isPositive = points.total >= 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`Award points to ${student.name}`}
      maxWidth="max-w-lg"
    >
      {/* Header — student card */}
      <div className="relative px-6 pt-6 pb-5 border-b border-hairline">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
          Award points
        </p>

        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold shadow-inner ${avatarTextClass}`}
            style={{ backgroundColor: avatarBg }}
          >
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-display text-2xl tracking-[-0.01em] text-ink-strong leading-tight">
              {student.name}
            </h2>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              <span
                className={`tabular-nums font-semibold ${
                  isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isPositive ? '+' : ''}
                {points.total}
              </span>{' '}
              total
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {awardError && (
          <div className="px-3 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs mb-4">
            {awardError}
          </div>
        )}

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
              Select a behavior to award points
            </p>
            <BehaviorPicker behaviors={behaviors} onSelect={handleBehaviorSelect} />
          </>
        )}
      </div>
    </Dialog>
  );
}
