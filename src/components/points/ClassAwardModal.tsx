import { useEffect, useCallback } from 'react';
import type { Behavior, StudentPoints } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { BehaviorPicker } from '../behaviors/BehaviorPicker';

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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleBehaviorSelect = useCallback(async (behavior: Behavior) => {
    await awardClassPoints(classroomId, behavior.id);
    // Play sound based on behavior category (before closing for celebration moment)
    if (behavior.category === 'positive') {
      playPositive();
    } else {
      playNegative();
    }
    onClose();
  }, [classroomId, awardClassPoints, playPositive, playNegative, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-award-modal-title"
      >
        {/* Header */}
        <div className="bg-linear-to-r from-indigo-500 to-purple-600 text-white p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
            aria-label="Close"
          >
            ×
          </button>

          <div className="flex items-center gap-4">
            {/* Class Icon */}
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl shadow-lg">
              🏫
            </div>

            <div>
              <h2 id="class-award-modal-title" className="text-xl font-bold">
                Award Entire Class
              </h2>
              <p className="text-white/80 text-sm">
                {classroomName} • {studentCount} student{studentCount !== 1 ? 's' : ''}
              </p>
              <p className="text-white/80 text-sm">
                Class Total: <span className="font-semibold">{classPoints.total >= 0 ? '+' : ''}{classPoints.total}</span> points
              </p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3">
          <p className="text-sm text-indigo-700 text-center">
            Points will be awarded to all {studentCount} students at once
          </p>
        </div>

        {/* Behavior Picker */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-gray-600 mb-4 text-center">
            Select a behavior to award to the whole class
          </p>
          <BehaviorPicker behaviors={behaviors} onSelect={handleBehaviorSelect} />
        </div>
      </div>
    </div>
  );
}
