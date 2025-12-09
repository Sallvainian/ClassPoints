import type { StudentPoints } from '../../types';

interface ClassPointsBoxProps {
  classPoints: StudentPoints;
  studentCount: number;
  onClick: () => void;
}

export function ClassPointsBox({ classPoints, studentCount, onClick }: ClassPointsBoxProps) {
  const { total, positiveTotal, negativeTotal, today, thisWeek } = classPoints;

  return (
    <button
      onClick={onClick}
      className="w-full bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🏫</div>
          <div>
            <h3 className="text-lg font-bold">Class Total</h3>
            <p className="text-white/80 text-sm">
              {studentCount} student{studentCount !== 1 ? 's' : ''} • Click to award all
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold">
            {total >= 0 ? '+' : ''}{total}
          </div>
          <div className="text-sm flex gap-3 justify-end">
            <span className="text-emerald-300">+{positiveTotal}</span>
            <span className="text-red-300">{negativeTotal}</span>
          </div>
          <div className="text-white/70 text-xs mt-1">
            Today: {today >= 0 ? '+' : ''}{today} • Week: {thisWeek >= 0 ? '+' : ''}{thisWeek}
          </div>
        </div>
      </div>
    </button>
  );
}
