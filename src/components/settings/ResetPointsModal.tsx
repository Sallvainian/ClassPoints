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

  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
      setError(null);
    }
  }, [isOpen]);

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
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isMatch && !saving) {
      handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset all points?">
      <div className="space-y-5">
        <div className="rounded-[10px] border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/30 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400 mb-2">
            Permanent · cannot be undone
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
            This deletes the point history for{' '}
            <span className="font-medium">"{classroom.name}"</span>:
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 ml-4 list-disc space-y-0.5">
            <li>
              All {studentCount} student{studentCount !== 1 ? 's' : ''} reset to 0
            </li>
            <li>All transactions deleted</li>
            <li>Roster preserved</li>
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

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!isMatch || saving}>
            {saving ? 'Resetting…' : 'Reset all points'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
