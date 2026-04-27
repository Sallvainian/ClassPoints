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

  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
    }
  }, [isOpen]);

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
      <div className="space-y-5">
        <div className="rounded-[10px] border border-red-200/60 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/30 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400 mb-2">
            Permanent · cannot be undone
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">
            This will delete the classroom and all of its data:
          </p>
          <ul className="text-xs text-red-700 dark:text-red-300 ml-4 list-disc space-y-0.5">
            <li>
              {studentCount} student{studentCount !== 1 ? 's' : ''}
            </li>
            <li>All point history and transactions</li>
            <li>Seating charts and arrangements</li>
          </ul>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted mb-2">
            Type the classroom name to confirm
          </p>
          <Input
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={classroom.name}
            autoFocus
            className={
              confirmationText.length > 0 && !isMatch
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : confirmationText.length > 0 && isMatch
                  ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                  : ''
            }
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
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
