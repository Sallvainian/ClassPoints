import { useMemo, memo } from 'react';
import { getAvatarColorForName, needsDarkText } from '../../utils';
import {
  getOverallLeaders,
  getTodayStars,
  getClassChampions,
  getThisWeekLeaders,
  getBestBehaved,
  getRisingStars,
  type LeaderboardEntry,
} from '../../utils/leaderboardCalculations';
import { useRotatingCategory } from '../../hooks';
import type { AppStudent, AppClassroom } from '../../contexts/HybridAppContext';

type LeaderboardCategory =
  | 'overall'
  | 'todayStars'
  | 'classChampions'
  | 'thisWeek'
  | 'bestBehaved'
  | 'risingStars';

interface LeaderboardCardProps {
  students: AppStudent[];
  classrooms: AppClassroom[];
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

function getEmptyMessage(category: LeaderboardCategory): string {
  switch (category) {
    case 'todayStars':
      return 'No points awarded today yet';
    case 'risingStars':
      return 'No milestone achievers yet';
    default:
      return 'Add students to see the leaderboard';
  }
}

function LeaderboardCardComponent({ students, classrooms }: LeaderboardCardProps) {
  const { activeCategory, selectCategory } = useRotatingCategory({
    categories: CATEGORY_ORDER,
    intervalMs: 7000,
  });

  // Calculate leaderboard entries based on active category
  const entries = useMemo((): LeaderboardEntry[] => {
    switch (activeCategory) {
      case 'overall':
        return getOverallLeaders(students);
      case 'todayStars':
        return getTodayStars(students);
      case 'classChampions':
        return getClassChampions(classrooms);
      case 'thisWeek':
        return getThisWeekLeaders(students);
      case 'bestBehaved':
        return getBestBehaved(students);
      case 'risingStars':
        return getRisingStars(students);
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
            {getEmptyMessage(activeCategory)}
          </div>
        )}
      </div>

      {/* Category indicator dots */}
      <div className="flex justify-center gap-1.5 mt-4 pt-3 border-t border-gray-100">
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            onClick={() => selectCategory(category)}
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
