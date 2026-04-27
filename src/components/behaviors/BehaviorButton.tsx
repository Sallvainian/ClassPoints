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
      className={`group flex flex-col items-center justify-between gap-2 p-3 rounded-xl border bg-surface-2 transition-[transform,border-color,background-color] duration-150 hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 ${
        isPositive
          ? 'border-emerald-500/20 hover:border-emerald-500/60 hover:bg-emerald-500/5 focus-visible:ring-emerald-500/40'
          : 'border-red-500/20 hover:border-red-500/60 hover:bg-red-500/5 focus-visible:ring-red-500/40'
      }`}
    >
      <span className="text-2xl leading-none mt-1" aria-hidden="true">
        {behavior.icon}
      </span>

      <span className="text-[13px] font-display tracking-[-0.005em] text-ink-strong text-center leading-tight line-clamp-2">
        {behavior.name}
      </span>

      <span
        className={`font-mono tabular-nums text-sm font-semibold ${
          isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {behavior.points > 0 ? '+' : ''}
        {behavior.points}
      </span>
    </button>
  );
}
