import { useMemo } from 'react';
import type { Behavior } from '../../types';
import { BehaviorButton } from './BehaviorButton';

interface BehaviorPickerProps {
  behaviors: Behavior[];
  onSelect: (behavior: Behavior) => void;
}

export function BehaviorPicker({ behaviors, onSelect }: BehaviorPickerProps) {
  const { positive, negative } = useMemo(() => {
    const positive = behaviors.filter((b) => b.category === 'positive');
    const negative = behaviors.filter((b) => b.category === 'negative');
    return { positive, negative };
  }, [behaviors]);

  return (
    <div className="space-y-6">
      {positive.length > 0 && (
        <section>
          <header className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Positive · {positive.length}
            </h3>
          </header>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {positive.map((behavior) => (
              <BehaviorButton
                key={behavior.id}
                behavior={behavior}
                onClick={() => onSelect(behavior)}
              />
            ))}
          </div>
        </section>
      )}

      {negative.length > 0 && (
        <section>
          <header className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-700 dark:text-red-400">
              Needs work · {negative.length}
            </h3>
          </header>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {negative.map((behavior) => (
              <BehaviorButton
                key={behavior.id}
                behavior={behavior}
                onClick={() => onSelect(behavior)}
              />
            ))}
          </div>
        </section>
      )}

      {behaviors.length === 0 && (
        <div className="text-center py-12 px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
            Empty
          </p>
          <p className="text-sm text-ink-mid">No behaviors configured. Add some in settings.</p>
        </div>
      )}
    </div>
  );
}
