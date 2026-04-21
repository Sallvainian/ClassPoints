import type { Behavior } from '../../types';

interface BehaviorButtonProps {
  behavior: Behavior;
  onClick: () => void;
}

export function BehaviorButton({ behavior, onClick }: BehaviorButtonProps) {
  const isPositive = behavior.category === 'positive';

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 active:scale-95 ${
        isPositive
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-100 dark:hover:bg-red-900/40'
      }`}
    >
      {/* Icon */}
      <span className="text-3xl mb-1">{behavior.icon}</span>

      {/* Name */}
      <span className="text-xs font-medium text-gray-700 dark:text-zinc-200 text-center line-clamp-2">
        {behavior.name}
      </span>

      {/* Points */}
      <span
        className={`text-sm font-bold mt-1 ${
          isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {behavior.points > 0 ? '+' : ''}
        {behavior.points}
      </span>
    </button>
  );
}
