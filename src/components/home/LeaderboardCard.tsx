import { useMemo, memo } from 'react';
import { getAvatarColorForName } from '../../utils';
import {
  getOverallLeaders,
  getTodayStars,
  getClassChampions,
  getThisWeekLeaders,
  getBestBehaved,
  getRisingStars,
  type LeaderboardEntry,
} from '../../utils/leaderboardCalculations';
import { useAvatarColor, useRotatingCategory } from '../../hooks';
import type { AppStudent, AppClassroom } from '../../types';

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
    <div className="bg-surface-2 border border-hairline rounded-2xl p-5 h-full flex flex-col">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Leaderboard
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xl leading-none" aria-hidden="true">
            {config.icon}
          </span>
          <h2 className="font-display text-xl tracking-[-0.01em] text-ink-strong">
            {config.title}
          </h2>
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 mt-4 space-y-1">
        {hasEntries ? (
          entries.map((entry, index) => (
            <LeaderboardRow key={entry.student.id} rank={index + 1} entry={entry} />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-ink-muted">
            {getEmptyMessage(activeCategory)}
          </div>
        )}
      </div>

      {/* Category indicator dots */}
      <div className="flex justify-center gap-1 mt-4 pt-4 border-t border-hairline">
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            onClick={() => selectCategory(category)}
            aria-label={CATEGORY_CONFIG[category].title}
            className="p-2 flex items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-2"
          >
            <span
              className={`h-[3px] rounded-full transition-all ${
                category === activeCategory
                  ? 'w-5 bg-accent-500'
                  : 'w-2 bg-hairline-strong hover:bg-ink-muted/50'
              }`}
            />
          </button>
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
  const rawColor = student.avatarColor || getAvatarColorForName(student.name);
  const { bg: bgColor, textClass: textColor } = useAvatarColor(rawColor);

  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-3 transition-colors">
      {/* Rank */}
      <div className="w-6 text-center">
        {rankEmoji ? (
          <span className="text-base">{rankEmoji}</span>
        ) : (
          <span className="font-mono text-xs text-ink-muted tabular-nums">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center ${textColor} font-semibold text-xs shadow-inner`}
        style={{ backgroundColor: bgColor }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-strong truncate leading-tight">{student.name}</p>
        {subtitle && (
          <p className="font-mono text-[10px] tracking-[0.04em] text-ink-muted truncate leading-tight mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Value */}
      <div className="text-right">
        <span
          className={`font-mono tabular-nums text-sm font-semibold ${
            typeof value === 'number' && value >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-ink-strong'
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
