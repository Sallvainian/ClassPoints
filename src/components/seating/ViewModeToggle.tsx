import type { ViewMode } from '../../types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onSetViewMode }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-950 rounded-lg p-0.5">
      <button
        onClick={() => onSetViewMode('alphabetical')}
        className={`
          px-2 py-1 text-xs font-medium rounded-md transition-colors
          ${
            viewMode === 'alphabetical'
              ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
          }
        `}
        title="Alphabetical view - students sorted by name"
      >
        ABC
      </button>
      <button
        onClick={() => onSetViewMode('seating')}
        className={`
          px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1
          ${
            viewMode === 'seating'
              ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900'
          }
        `}
        title="Seating chart view - students at their desk positions"
      >
        <span>🪑</span>
        <span>Seating</span>
      </button>
    </div>
  );
}
