import type { StudentPoints } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

interface ClassPointsBoxProps {
  classPoints: StudentPoints;
  studentCount: number;
  onClick: () => void;
}

export function ClassPointsBox({ classPoints, studentCount, onClick }: ClassPointsBoxProps) {
  const { total, positiveTotal, negativeTotal, today, thisWeek } = classPoints;
  const { isChristmas } = useTheme();

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-white rounded-xl p-4 shadow-lg transition-all text-left relative overflow-hidden
        hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]
        ${isChristmas
          ? 'bg-gradient-to-r from-red-600 via-red-500 to-green-600'
          : 'bg-linear-to-r from-indigo-500 to-purple-600'
        }
      `}
    >
      {/* Gift ribbon overlay for Christmas */}
      {isChristmas && (
        <>
          {/* Vertical ribbon */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 opacity-80" />
          {/* Horizontal ribbon */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-4 bg-gradient-to-b from-yellow-400 via-yellow-300 to-yellow-400 opacity-80" />
          {/* Bow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl z-10 animate-ornament-swing">
            🎀
          </div>
        </>
      )}

      <div className="flex items-center justify-between relative z-20">
        <div className="flex items-center gap-3">
          <div className={`text-4xl ${isChristmas ? 'animate-unwrap' : ''}`}>
            {isChristmas ? '🎁' : '🏫'}
          </div>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              {isChristmas ? 'Class Gift Box' : 'Class Total'}
              {isChristmas && <span className="text-sm animate-star-sparkle">✨</span>}
            </h3>
            <p className="text-white/80 text-sm">
              {studentCount} student{studentCount !== 1 ? 's' : ''} • Click to award all
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-3xl font-bold ${isChristmas ? 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : ''}`}>
            {total >= 0 ? '+' : ''}{total}
          </div>
          <div className={`text-sm flex gap-3 justify-end ${isChristmas ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''}`}>
            <span className={isChristmas ? 'text-white font-semibold' : 'text-emerald-300'}>
              +{positiveTotal}
            </span>
            <span className={isChristmas ? 'text-white/90 font-semibold' : 'text-red-300'}>{negativeTotal}</span>
          </div>
          <div className={`text-xs mt-1 ${isChristmas ? 'text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]' : 'text-white/70'}`}>
            Today: {today >= 0 ? '+' : ''}{today} • Week: {thisWeek >= 0 ? '+' : ''}{thisWeek}
          </div>
        </div>
      </div>
    </button>
  );
}
