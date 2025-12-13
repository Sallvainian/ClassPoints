import { useEffect, useState, useCallback } from 'react';
import type { Behavior, Student } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { ERROR_MESSAGES } from '../../utils/errorMessages';
import { BehaviorPicker } from '../behaviors/BehaviorPicker';

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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAwarding) onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, isAwarding, onClose]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAwardError(null);
      setIsAwarding(false);
    }
  }, [isOpen]);

  const handleBehaviorSelect = useCallback(async (behavior: Behavior) => {
    if (selectedStudents.length === 0 || isAwarding) return;

    setIsAwarding(true);
    setAwardError(null);

    try {
      // Extract student IDs for the atomic batch operation
      const studentIds = selectedStudents.map((s) => s.id);

      // awardPointsToStudents throws on error with automatic rollback
      await awardPointsToStudents(
        classroomId,
        studentIds,
        behavior.id,
        `Multi-select award (${selectedStudents.length} students)`
      );

      // Play sound once after successful batch award
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
  }, [classroomId, selectedStudents, isAwarding, awardPointsToStudents, playPositive, playNegative, onClose]);

  if (!isOpen || selectedStudents.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isAwarding ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="multi-award-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6">
          {!isAwarding && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
              aria-label="Close"
            >
              ×
            </button>
          )}

          <div className="flex items-center gap-4">
            {/* Multiple avatars indicator */}
            <div className="flex -space-x-2">
              {selectedStudents.slice(0, 3).map((student, i) => (
                <div
                  key={student.id}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-white/20 border-2 border-white/40"
                  style={{ zIndex: 3 - i }}
                >
                  {student.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {selectedStudents.length > 3 && (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-white/30 border-2 border-white/40"
                >
                  +{selectedStudents.length - 3}
                </div>
              )}
            </div>

            <div>
              <h2 id="multi-award-modal-title" className="text-xl font-bold">
                Award Points
              </h2>
              <p className="text-white/80 text-sm">
                {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
        </div>

        {/* Behavior Picker */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {awardError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {awardError}
            </div>
          )}

          {isAwarding ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3" />
              <p className="text-gray-600">Awarding points to {selectedStudents.length} students...</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4 text-center">
                Select a behavior to award to all {selectedStudents.length} selected students
              </p>
              <BehaviorPicker behaviors={behaviors} onSelect={handleBehaviorSelect} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
