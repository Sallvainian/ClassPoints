import { memo } from 'react';

interface BottomToolbarProps {
  /** Whether selection mode is active */
  selectionMode: boolean;
  /** Number of selected students */
  selectedCount: number;
  /** Total number of students */
  totalStudents: number;
  /** Called when entering selection mode */
  onEnterSelectionMode: () => void;
  /** Called when exiting selection mode */
  onExitSelectionMode: () => void;
  /** Called to select all students */
  onSelectAll: () => void;
  /** Called to award points to selected students */
  onAwardPoints: () => void;
  /** Called to pick a random student */
  onRandomStudent: () => void;
  /** Whether there are students to work with */
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
    <div className="bg-gradient-to-t from-gray-100 to-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-6 py-4 flex items-center justify-center gap-4">
      {selectionMode ? (
        // Selection mode: show selection controls
        <div className="flex items-center gap-3 bg-white rounded-2xl shadow-md px-4 py-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
            <span className="text-lg">👥</span>
            <span className="text-sm font-semibold text-blue-700">
              {selectedCount}/{totalStudents}
            </span>
          </div>
          <button
            onClick={onSelectAll}
            disabled={selectedCount === totalStudents}
            className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
          >
            All
          </button>
          <button
            onClick={onAwardPoints}
            disabled={selectedCount === 0}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
          >
            ⭐ Award
          </button>
          <button
            onClick={onExitSelectionMode}
            className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all hover:scale-105 active:scale-95"
          >
            ✕
          </button>
        </div>
      ) : (
        // Normal mode: show main toolbar buttons
        <div className="flex items-center gap-4">
          <button
            onClick={onEnterSelectionMode}
            className="flex flex-col items-center gap-1.5 w-20 py-3 rounded-2xl bg-white shadow-md hover:shadow-lg text-blue-600 hover:bg-blue-50 transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold tracking-wide">Select</span>
          </button>
          <button
            onClick={onRandomStudent}
            className="flex flex-col items-center gap-1.5 w-20 py-3 rounded-2xl bg-white shadow-md hover:shadow-lg text-purple-600 hover:bg-purple-50 transition-all hover:scale-105 active:scale-95"
          >
            <span className="text-3xl">🎲</span>
            <span className="text-xs font-semibold tracking-wide">Random</span>
          </button>
        </div>
      )}
    </div>
  );
}

export const BottomToolbar = memo(BottomToolbarComponent);
