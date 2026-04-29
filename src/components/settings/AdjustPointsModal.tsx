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

  useEffect(() => {
    if (isOpen && student) {
      setTargetPoints(String(student.pointTotal));
      setNote('');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, student?.id]);

  if (!student) return null;

  const currentPoints = student.pointTotal;
  const parsedTarget = parseInt(targetPoints, 10);
  const MAX_POINTS = 99999;
  const MIN_POINTS = -99999;
  const isValidNumber =
    !isNaN(parsedTarget) &&
    isFinite(parsedTarget) &&
    parsedTarget >= MIN_POINTS &&
    parsedTarget <= MAX_POINTS;
  const delta = isValidNumber ? parsedTarget - currentPoints : 0;
  const hasChange = isValidNumber && delta !== 0;
  const currentIsPositive = currentPoints >= 0;

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
    <Modal isOpen={isOpen} onClose={onClose} title={`Set points · ${student.name}`}>
      <div className="space-y-5">
        {/* Current */}
        <div className="rounded-[10px] border border-hairline bg-surface-1 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1">
            Current
          </p>
          <p
            className={`font-mono tabular-nums text-2xl font-medium tracking-[-0.02em] ${
              currentIsPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {currentIsPositive ? '+' : ''}
            {currentPoints}
          </p>
        </div>

        {/* Target */}
        <Input
          label="New points"
          type="number"
          value={targetPoints}
          onChange={(e) => setTargetPoints(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        {/* Delta preview */}
        {isValidNumber && (
          <div
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-mono tabular-nums text-xs font-semibold ${
              delta > 0
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : delta < 0
                  ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                  : 'bg-surface-3 text-ink-muted'
            }`}
          >
            <span className="font-mono uppercase tracking-[0.14em] text-[10px] not-italic">Δ</span>
            {delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta}`}
          </div>
        )}

        <Input
          label="Reason (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Correction for missed points"
        />

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!hasChange || saving}>
            {saving ? 'Saving…' : 'Apply'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
