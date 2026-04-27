import type { StudentPoints } from '../../types';

interface ClassPointsBoxProps {
  classPoints: StudentPoints;
  onClick: () => void;
}

export function ClassPointsBox({ classPoints, onClick }: ClassPointsBoxProps) {
  const { total, positiveTotal, negativeTotal, today, thisWeek } = classPoints;
  const isPositive = total >= 0;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-surface-2 border border-hairline rounded-2xl p-5 transition-[border-color,transform,box-shadow] duration-200 hover:border-accent-500/40 hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-3xl lg:text-4xl tracking-[-0.02em] text-ink-strong leading-[1.05]">
            Class total
          </h3>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            Tap to award the whole class →
          </p>
        </div>

        <div className="text-right shrink-0">
          <div
            className={`font-mono tabular-nums text-3xl font-medium tracking-[-0.02em] ${
              isPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isPositive ? '+' : ''}
            {total}
          </div>
          <div className="mt-1 font-mono text-[11px] tabular-nums text-ink-muted flex gap-1.5 justify-end">
            <span className="text-emerald-600/80 dark:text-emerald-400/80">+{positiveTotal}</span>
            <span className="text-ink-muted/40">/</span>
            <span className="text-red-600/80 dark:text-red-400/80">{negativeTotal}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        <span>
          Today{' '}
          <span className="tabular-nums normal-case text-ink-mid">
            {today >= 0 ? '+' : ''}
            {today}
          </span>
        </span>
        <span>
          This week{' '}
          <span className="tabular-nums normal-case text-ink-mid">
            {thisWeek >= 0 ? '+' : ''}
            {thisWeek}
          </span>
        </span>
      </div>
    </button>
  );
}
