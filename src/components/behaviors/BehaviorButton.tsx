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
          ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100'
          : 'bg-red-50 border-red-200 hover:border-red-400 hover:bg-red-100'
      }`}
    >
      {/* Icon */}
      <span className="text-3xl mb-1">{behavior.icon}</span>

      {/* Name */}
      <span className="text-xs font-medium text-gray-700 text-center line-clamp-2">
        {behavior.name}
      </span>

      {/* Points */}
      <span
        className={`text-sm font-bold mt-1 ${
          isPositive ? 'text-emerald-600' : 'text-red-600'
        }`}
      >
        {behavior.points > 0 ? '+' : ''}{behavior.points}
      </span>
    </button>
  );
}
