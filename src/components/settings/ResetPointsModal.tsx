import { useState, useEffect } from 'react';
import { Button, Input, Modal } from '../ui';

interface Classroom {
  id: string;
  name: string;
  students: { id: string }[];
}

interface ResetPointsModalProps {
  classroom: Classroom | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (classroomId: string) => Promise<void>;
}

export function ResetPointsModal({ classroom, isOpen, onClose, onConfirm }: ResetPointsModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset confirmation text when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
      setError(null);
    }
  }, [isOpen, classroom?.id]);

  if (!classroom) return null;

  const isMatch = confirmationText === classroom.name;
  const studentCount = classroom.students.length;

  const handleConfirm = async () => {
    if (!isMatch) return;

    setSaving(true);
    setError(null);

    try {
      await onConfirm(classroom.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset points');
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isMatch && !saving) {
      handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset All Points?">
      <div className="space-y-4">
        {/* Warning message */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <strong>Warning:</strong> This will permanently delete all point history for{' '}
            <strong>"{classroom.name}"</strong>:
          </p>
          <ul className="text-sm text-amber-700 mt-2 ml-4 list-disc">
            <li>
              All {studentCount} student{studentCount !== 1 ? 's' : ''} will have 0 points
            </li>
            <li>All transaction history will be deleted</li>
            <li>Student roster will be preserved</li>
          </ul>
          <p className="text-sm text-amber-800 mt-2 font-medium">This action cannot be undone.</p>
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

        {/* Error Display */}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!isMatch || saving}>
            {saving ? 'Resetting...' : 'Reset All Points'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
