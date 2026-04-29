import { memo } from 'react';
import { SquareCheck, Dice5, Sparkles, X } from 'lucide-react';

interface BottomToolbarProps {
  selectionMode: boolean;
  selectedCount: number;
  totalStudents: number;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onSelectAll: () => void;
  onAwardPoints: () => void;
  onRandomStudent: () => void;
  hasStudents: boolean;
}

function BottomToolbarComponent({
  selectionMode,
  selectedCount,
  totalStudents,
  onEnterSelectionMode,
  onExitSelectionMode,
  onSelectAll,
  onAwardPoints,
  onRandomStudent,
  hasStudents,
}: BottomToolbarProps) {
  if (!hasStudents) return null;

  return (
    <div className="border-t border-hairline bg-surface-2 px-6 py-4 flex items-center justify-center">
      {selectionMode ? (
        <div className="inline-flex items-center gap-1 rounded-2xl border border-hairline bg-surface-1 p-1 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.15)]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent-500/10">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-700 dark:text-accent-400"
              aria-hidden="true"
            >
              Selected
            </span>
            <span className="font-mono tabular-nums text-sm font-semibold text-accent-700 dark:text-accent-400">
              {selectedCount}/{totalStudents}
            </span>
          </div>
          <button
            onClick={onSelectAll}
            disabled={selectedCount === totalStudents}
            className="px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] rounded-xl text-ink-mid hover:bg-surface-3 hover:text-ink-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            All
          </button>
          <button
            onClick={onAwardPoints}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-accent-500 text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_2px_8px_rgba(168,70,45,0.3)] hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            Award
          </button>
          <button
            onClick={onExitSelectionMode}
            aria-label="Exit selection mode"
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1 rounded-2xl border border-hairline bg-surface-1 p-1 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.15)]">
          <button
            onClick={onEnterSelectionMode}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-ink-strong hover:bg-surface-3 transition-colors"
          >
            <SquareCheck className="w-4 h-4 text-accent-600" strokeWidth={1.75} />
            <span className="text-sm font-medium">Select</span>
          </button>
          <span className="w-px h-5 bg-hairline" aria-hidden="true" />
          <button
            onClick={onRandomStudent}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-ink-strong hover:bg-surface-3 transition-colors"
          >
            <Dice5 className="w-4 h-4 text-accent-600" strokeWidth={1.75} />
            <span className="text-sm font-medium">Random</span>
          </button>
        </div>
      )}
    </div>
  );
}

export const BottomToolbar = memo(BottomToolbarComponent);
