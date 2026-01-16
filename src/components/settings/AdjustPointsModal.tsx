import { useState, useEffect } from 'react';
import { Button, Input, Modal } from '../ui';

interface Student {
  id: string;
  name: string;
  pointTotal: number;
}

interface AdjustPointsModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (studentId: string, targetPoints: number, note?: string) => Promise<void>;
}

export function AdjustPointsModal({ student, isOpen, onClose, onConfirm }: AdjustPointsModalProps) {
  const [targetPoints, setTargetPoints] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or student changes
  useEffect(() => {
    if (isOpen && student) {
      setTargetPoints(String(student.pointTotal));
      setNote('');
      setError(null);
    }
  }, [isOpen, student?.id, student?.pointTotal]);

  if (!student) return null;

  const currentPoints = student.pointTotal;
  const parsedTarget = parseInt(targetPoints, 10);
  const isValidNumber = !isNaN(parsedTarget);
  const delta = isValidNumber ? parsedTarget - currentPoints : 0;
  const hasChange = isValidNumber && delta !== 0;

  const handleConfirm = async () => {
    if (!hasChange) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onConfirm(student.id, parsedTarget, note || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust points');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasChange && !saving) {
      handleConfirm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Set Points for ${student.name}`}>
      <div className="space-y-4">
        {/* Current Points Display */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">Current Points</p>
          <p className="text-2xl font-bold text-gray-900">{currentPoints}</p>
        </div>

        {/* Target Points Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Points</label>
          <Input
            type="number"
            value={targetPoints}
            onChange={(e) => setTargetPoints(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-lg"
          />
        </div>

        {/* Delta Preview */}
        {isValidNumber && (
          <div
            className={`text-sm font-medium ${
              delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            {delta === 0 ? (
              'No change'
            ) : (
              <>
                Change: {delta > 0 ? '+' : ''}
                {delta} points
              </>
            )}
          </div>
        )}

        {/* Optional Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Correction for missed points"
          />
        </div>

        {/* Error Display */}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!hasChange || saving}>
            {saving ? 'Saving...' : 'Apply'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
