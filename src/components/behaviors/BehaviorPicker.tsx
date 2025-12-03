import { useMemo } from 'react';
import type { Behavior } from '../../types';
import { BehaviorButton } from './BehaviorButton';

interface BehaviorPickerProps {
  behaviors: Behavior[];
  onSelect: (behavior: Behavior) => void;
}

export function BehaviorPicker({ behaviors, onSelect }: BehaviorPickerProps) {
  // Separate positive and negative behaviors
  const { positive, negative } = useMemo(() => {
    const positive = behaviors.filter((b) => b.category === 'positive');
    const negative = behaviors.filter((b) => b.category === 'negative');
    return { positive, negative };
  }, [behaviors]);

  return (
    <div className="space-y-6">
      {/* Positive Behaviors */}
      {positive.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Positive
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {positive.map((behavior) => (
              <BehaviorButton
                key={behavior.id}
                behavior={behavior}
                onClick={() => onSelect(behavior)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Negative Behaviors */}
      {negative.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Needs Work
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {negative.map((behavior) => (
              <BehaviorButton
                key={behavior.id}
                behavior={behavior}
                onClick={() => onSelect(behavior)}
              />
            ))}
          </div>
        </div>
      )}

      {behaviors.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          No behaviors configured. Add some in settings.
        </p>
      )}
    </div>
  );
}
