import { Button } from '../ui/Button';

interface EmptyChartPromptProps {
  onCreateChart: () => void;
  onImportPreset?: () => void;
  hasPresets?: boolean;
}

export function EmptyChartPrompt({
  onCreateChart,
  onImportPreset,
  hasPresets = false,
}: EmptyChartPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-zinc-500 p-8">
      {/* Desk illustration */}
      <div className="text-7xl mb-6 opacity-80">
        <span role="img" aria-label="desk">
          🪑
        </span>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-2">
        No Seating Chart Yet
      </h2>

      <p className="text-center mb-6 max-w-md text-gray-600 dark:text-zinc-400">
        Create a seating arrangement to see students at their desk positions. You can arrange tables
        in groups and assign students to seats.
      </p>

      <Button onClick={onCreateChart} variant="primary" size="lg">
        Create Seating Chart
      </Button>

      {hasPresets && onImportPreset && (
        <button
          onClick={onImportPreset}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:underline"
        >
          or import from a saved preset
        </button>
      )}
    </div>
  );
}
