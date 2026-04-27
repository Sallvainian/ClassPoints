import { memo } from 'react';

type Tone = 'positive' | 'neutral' | 'accent';

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  subValue?: string;
  tone?: Tone;
}

const TONE_STYLES: Record<Tone, { ring: string; iconBg: string; iconColor: string }> = {
  positive: {
    ring: 'hover:border-emerald-500/30',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  neutral: {
    ring: 'hover:border-hairline-strong',
    iconBg: 'bg-surface-3',
    iconColor: 'text-ink-mid',
  },
  accent: {
    ring: 'hover:border-accent-500/30',
    iconBg: 'bg-accent-500/10',
    iconColor: 'text-accent-600 dark:text-accent-400',
  },
};

function StatsCardComponent({ icon, label, value, subValue, tone = 'neutral' }: StatsCardProps) {
  const t = TONE_STYLES[tone];
  return (
    <div
      className={`group relative bg-surface-2 border border-hairline rounded-2xl p-5 transition-colors ${t.ring}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            {label}
          </p>
          <p className="mt-2 font-mono tabular-nums text-3xl font-medium tracking-[-0.02em] text-ink-strong">
            {value}
          </p>
          {subValue && <p className="mt-1 text-xs text-ink-muted">{subValue}</p>}
        </div>
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${t.iconBg} ${t.iconColor} font-mono text-base leading-none`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

export const StatsCard = memo(StatsCardComponent);
