import { useEffect } from 'react';
import type { Student, Behavior } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { BehaviorPicker } from '../behaviors/BehaviorPicker';

interface AwardPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  classroomId: string;
}

export function AwardPointsModal({
  isOpen,
  onClose,
  student,
  classroomId,
}: AwardPointsModalProps) {
  const { behaviors, awardPoints, getStudentPoints } = useApp();

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

  if (!isOpen || !student) return null;

  const points = getStudentPoints(student.id);

  const handleBehaviorSelect = (behavior: Behavior) => {
    awardPoints(classroomId, student.id, behavior.id);
    onClose();
  };

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
        aria-labelledby="award-modal-title"
      >
        {/* Header with Student Info */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
            aria-label="Close"
          >
            ×
          </button>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg"
              style={{ backgroundColor: student.avatarColor || '#94a3b8' }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <h2 id="award-modal-title" className="text-xl font-bold">
                {student.name}
              </h2>
              <p className="text-white/80 text-sm">
                Total: <span className="font-semibold">{points.total >= 0 ? '+' : ''}{points.total}</span> points
              </p>
            </div>
          </div>
        </div>

        {/* Behavior Picker */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-gray-600 mb-4 text-center">
            Select a behavior to award points
          </p>
          <BehaviorPicker behaviors={behaviors} onSelect={handleBehaviorSelect} />
        </div>
      </div>
    </div>
  );
}
