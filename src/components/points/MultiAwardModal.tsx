import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Behavior, Student } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { ERROR_MESSAGES } from '../../utils/errorMessages';
import { BehaviorPicker } from '../behaviors/BehaviorPicker';
import { Dialog } from '../ui';

interface MultiAwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: Student[];
  classroomId: string;
}

export function MultiAwardModal({
  isOpen,
  onClose,
  selectedStudents,
  classroomId,
}: MultiAwardModalProps) {
  const { behaviors, awardPointsToStudents } = useApp();
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
      if (selectedStudents.length === 0 || isAwarding) return;

      setIsAwarding(true);
      setAwardError(null);

      try {
        const studentIds = selectedStudents.map((s) => s.id);
        await awardPointsToStudents(
          classroomId,
          studentIds,
          behavior.id,
          `Multi-select award (${selectedStudents.length} students)`
        );

        if (behavior.category === 'positive') {
          playPositive();
        } else {
          playNegative();
        }

        onClose();
      } catch (err) {
        console.error('Failed to award points to students:', err);
        setAwardError(err instanceof Error ? err.message : ERROR_MESSAGES.AWARD_STUDENTS);
        setIsAwarding(false);
      }
    },
    [
      classroomId,
      selectedStudents,
      isAwarding,
      awardPointsToStudents,
      playPositive,
      playNegative,
      onClose,
    ]
  );

  if (!isOpen || selectedStudents.length === 0) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isAwarding ? () => undefined : onClose}
      ariaLabel={`Award points to ${selectedStudents.length} selected students`}
      maxWidth="max-w-lg"
    >
      {/* Header */}
      <div className="relative px-6 pt-6 pb-5 border-b border-hairline">
        {!isAwarding && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
          Award points · multi-select
        </p>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {selectedStudents.slice(0, 3).map((student, i) => (
              <div
                key={student.id}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-accent-500/15 text-accent-700 dark:text-accent-400 border-2 border-surface-2"
                style={{ zIndex: 3 - i }}
              >
                {student.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {selectedStudents.length > 3 && (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs font-semibold bg-surface-3 text-ink-mid border-2 border-surface-2">
                +{selectedStudents.length - 3}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display text-2xl tracking-[-0.01em] text-ink-strong leading-tight">
              {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">selected</p>
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
              Awarding to {selectedStudents.length} students...
            </p>
          </div>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-4 text-center">
              Select a behavior for all {selectedStudents.length} students
            </p>
            <BehaviorPicker behaviors={behaviors} onSelect={handleBehaviorSelect} />
          </>
        )}
      </div>
    </Dialog>
  );
}
