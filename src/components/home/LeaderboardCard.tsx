import { useState, useEffect, useMemo, memo, useRef, useCallback } from 'react';
import { getAvatarColorForName, needsDarkText } from '../../utils';

type LeaderboardCategory =
  | 'overall'
  | 'todayStars'
  | 'classChampions'
  | 'thisWeek'
  | 'bestBehaved'
  | 'risingStars';

interface LeaderboardStudent {
  id: string;
  name: string;
  avatarColor?: string;
  pointTotal: number;
  positiveTotal: number;
  negativeTotal: number;
  todayTotal: number;
  thisWeekTotal: number;
}

interface LeaderboardClassroom {
  id: string;
  name: string;
  students: LeaderboardStudent[];
}

interface LeaderboardCardProps {
  students: LeaderboardStudent[];
  classrooms: LeaderboardClassroom[];
}

const CATEGORY_ORDER: LeaderboardCategory[] = [
  'overall',
  'todayStars',
  'classChampions',
  'thisWeek',
  'bestBehaved',
  'risingStars',
];

const CATEGORY_CONFIG: Record<LeaderboardCategory, { title: string; icon: string }> = {
  overall: { title: 'Top Points Overall', icon: '🏆' },
  todayStars: { title: "Today's Stars", icon: '⭐' },
  classChampions: { title: 'Class Champions', icon: '👑' },
  thisWeek: { title: 'This Week Leaders', icon: '📈' },
  bestBehaved: { title: 'Best Behaved', icon: '😇' },
  risingStars: { title: 'Rising Stars', icon: '🚀' },
};

const MILESTONES = [1, 5, 10, 25, 50, 69, 75, 100];

interface LeaderboardEntry {
  student: LeaderboardStudent;
  value: number | string;
  subtitle?: string;
}

function LeaderboardCardComponent({ students, classrooms }: LeaderboardCardProps) {
  const [activeCategory, setActiveCategory] = useState<LeaderboardCategory>('overall');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Rotate to next category
  const rotateCategory = useCallback(() => {
    setActiveCategory((current) => {
      const currentIndex = CATEGORY_ORDER.indexOf(current);
      return CATEGORY_ORDER[(currentIndex + 1) % CATEGORY_ORDER.length];
    });
  }, []);

  // Start/restart the auto-rotation interval
  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(rotateCategory, 7000);
  }, [rotateCategory]);

  // Handle manual category selection (resets timer)
  const handleCategorySelect = useCallback(
    (category: LeaderboardCategory) => {
      setActiveCategory(category);
      startInterval();
    },
    [startInterval]
  );

  // Auto-rotate through categories every 7 seconds
  useEffect(() => {
    startInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startInterval]);

  // Calculate leaderboard entries based on active category
  const entries = useMemo((): LeaderboardEntry[] => {
    switch (activeCategory) {
      case 'overall':
        return [...students]
          .sort((a, b) => b.pointTotal - a.pointTotal)
          .slice(0, 5)
          .map((student) => ({
            student,
            value: student.pointTotal,
          }));

      case 'todayStars':
        return [...students]
          .filter((s) => s.todayTotal > 0)
          .sort((a, b) => b.todayTotal - a.todayTotal)
          .slice(0, 5)
          .map((student) => ({
            student,
            value: student.todayTotal,
            subtitle: 'today',
          }));

      case 'classChampions': {
        const champions: LeaderboardEntry[] = [];
        for (const classroom of classrooms) {
          const champion = [...classroom.students].sort((a, b) => b.pointTotal - a.pointTotal)[0];
          if (champion) {
            champions.push({
              student: champion,
              value: champion.pointTotal,
              subtitle: classroom.name,
            });
          }
        }
        return champions.slice(0, 5);
      }

      case 'thisWeek':
        return [...students]
          .filter((s) => s.thisWeekTotal > 0)
          .sort((a, b) => b.thisWeekTotal - a.thisWeekTotal)
          .slice(0, 5)
          .map((student) => ({
            student,
            value: student.thisWeekTotal,
            subtitle: 'this week',
          }));

      case 'bestBehaved': {
        return [...students]
          .filter((s) => s.positiveTotal > 0)
          .map((student) => {
            const negAbs = Math.abs(student.negativeTotal ?? 0);
            const divisor = Math.max(1, Number.isFinite(negAbs) ? negAbs : 0);
            const ratio = student.positiveTotal / divisor;
            return { student, ratio };
          })
          .sort((a, b) => b.ratio - a.ratio)
          .slice(0, 5)
          .map(({ student, ratio }) => ({
            student,
            value: ratio === Infinity || !Number.isFinite(ratio) ? '∞' : ratio.toFixed(1),
            subtitle: 'ratio',
          }));
      }

      case 'risingStars':
        return [...students]
          .filter((s) => MILESTONES.includes(s.pointTotal))
          .sort((a, b) => b.pointTotal - a.pointTotal)
          .slice(0, 5)
          .map((student) => ({
            student,
            value: `${student.pointTotal} pts`,
            subtitle: 'milestone reached!',
          }));
    }
  }, [activeCategory, students, classrooms]);

  const config = CATEGORY_CONFIG[activeCategory];
  const hasEntries = entries.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{config.icon}</span>
        <h3 className="text-lg font-bold text-gray-800">{config.title}</h3>
      </div>

      {/* Leaderboard entries */}
      <div className="flex-1 space-y-2">
        {hasEntries ? (
          entries.map((entry, index) => (
            <LeaderboardRow key={entry.student.id} rank={index + 1} entry={entry} />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            {activeCategory === 'todayStars'
              ? 'No points awarded today yet'
              : activeCategory === 'risingStars'
                ? 'No milestone achievers yet'
                : 'Add students to see the leaderboard'}
          </div>
        )}
      </div>

      {/* Category indicator dots */}
      <div className="flex justify-center gap-1.5 mt-4 pt-3 border-t border-gray-100">
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            onClick={() => handleCategorySelect(category)}
            className={`w-2 h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              category === activeCategory
                ? 'bg-blue-500 scale-125'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={CATEGORY_CONFIG[category].title}
          />
        ))}
      </div>
    </div>
  );
}

interface LeaderboardRowProps {
  rank: number;
  entry: LeaderboardEntry;
}

const LeaderboardRow = memo(function LeaderboardRow({ rank, entry }: LeaderboardRowProps) {
  const { student, value, subtitle } = entry;
  const bgColor = student.avatarColor || getAvatarColorForName(student.name);
  const textColor = needsDarkText(bgColor) ? 'text-gray-800' : 'text-white';

  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      {/* Rank */}
      <div className="w-6 text-center">
        {rankEmoji ? (
          <span className="text-lg">{rankEmoji}</span>
        ) : (
          <span className="text-sm text-gray-500 font-medium">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${textColor} font-bold text-sm shadow-inner`}
        style={{ backgroundColor: bgColor }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{student.name}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      {/* Value */}
      <div className="text-right">
        <span
          className={`font-bold ${
            typeof value === 'number' && value >= 0 ? 'text-emerald-600' : 'text-gray-700'
          }`}
        >
          {typeof value === 'number' ? (value >= 0 ? '+' : '') : ''}
          {value}
        </span>
      </div>
    </div>
  );
});

export const LeaderboardCard = memo(LeaderboardCardComponent);
