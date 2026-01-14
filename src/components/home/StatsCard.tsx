import { memo } from 'react';

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  subValue?: string;
  gradient: string;
}

function StatsCardComponent({ icon, label, value, subValue, gradient }: StatsCardProps) {
  return (
    <div className={`bg-linear-to-r ${gradient} text-white rounded-xl p-4 shadow-md`}>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div>
          <p className="text-white/80 text-sm">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subValue && <p className="text-white/70 text-xs">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

export const StatsCard = memo(StatsCardComponent);
