import { memo, useCallback } from 'react';
import type { AppClassroom } from '../../types';

interface ClassroomCardProps {
  classroom: AppClassroom;
  onClick: (classroomId: string) => void;
}

function ClassroomCardComponent({ classroom, onClick }: ClassroomCardProps) {
  const handleClick = useCallback(() => {
    onClick(classroom.id);
  }, [onClick, classroom.id]);

  const pointTotal = classroom.pointTotal ?? 0;
  const positiveTotal = classroom.positiveTotal ?? 0;
  const negativeTotal = classroom.negativeTotal ?? 0;
  const studentCount = classroom.students.length;
  const isPositive = pointTotal >= 0;

  return (
    <button
      onClick={handleClick}
      className="group relative w-full text-left bg-surface-2 border border-hairline rounded-2xl p-5 transition-[border-color,transform,box-shadow] duration-200 hover:border-accent-500/40 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-15px_rgba(193,87,58,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 overflow-hidden"
    >
      {/* corner accent reveal */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-20 h-20 bg-accent-500/0 group-hover:bg-accent-500/8 transition-colors blur-2xl rounded-full -translate-y-1/2 translate-x-1/2"
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Classroom
          </p>
          <h3 className="mt-1 font-display text-2xl leading-tight tracking-[-0.01em] text-ink-strong truncate">
            {classroom.name}
          </h3>
          <p className="mt-1 text-xs text-ink-mid">
            {studentCount} student{studentCount !== 1 ? 's' : ''}
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
            {pointTotal}
          </div>
          <div className="mt-1 font-mono text-[11px] tabular-nums text-ink-muted flex gap-1.5 justify-end">
            <span className="text-emerald-600/80 dark:text-emerald-400/80">+{positiveTotal}</span>
            <span className="text-ink-muted/40">/</span>
            <span className="text-red-600/80 dark:text-red-400/80">{negativeTotal}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-hairline flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          Open
        </span>
        <span className="font-mono text-[10px] tracking-[0.16em] text-accent-600 group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </div>
    </button>
  );
}

export const ClassroomCard = memo(ClassroomCardComponent);
