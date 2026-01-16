import { useState, useEffect } from 'react';
import { Button, Input, Modal } from '../ui';
import type { Classroom } from '../../types';

interface DeleteClassroomModalProps {
  classroom: Classroom | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (classroomId: string) => void;
}

export function DeleteClassroomModal({
  classroom,
  isOpen,
  onClose,
  onConfirm,
}: DeleteClassroomModalProps) {
  const [confirmationText, setConfirmationText] = useState('');

  // Reset confirmation text when modal opens/closes or classroom changes
  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
    }
  }, [isOpen, classroom?.id]);

  if (!classroom) return null;

  const isMatch = confirmationText === classroom.name;
  const studentCount = classroom.students.length;

  const handleConfirm = () => {
    if (isMatch) {
      onConfirm(classroom.id);
      setConfirmationText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isMatch) {
      handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Delete "${classroom.name}"?`}>
      <div className="space-y-4">
        {/* Warning message */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">
            <strong>Warning:</strong> This will permanently delete this classroom and all its data:
          </p>
          <ul className="text-sm text-red-700 mt-2 ml-4 list-disc">
            <li>
              {studentCount} student{studentCount !== 1 ? 's' : ''}
            </li>
            <li>All point history and transactions</li>
            <li>Seating charts and arrangements</li>
          </ul>
          <p className="text-sm text-red-800 mt-2 font-medium">This action cannot be undone.</p>
        </div>

        {/* Confirmation input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="font-bold text-gray-900">"{classroom.name}"</span> to confirm:
          </label>
          <Input
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={classroom.name}
            autoFocus
            className={
              confirmationText.length > 0
                ? isMatch
                  ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                  : 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : ''
            }
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!isMatch}>
            Delete Classroom
          </Button>
        </div>
      </div>
    </Modal>
  );
}
