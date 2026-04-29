/**
 * SoundSettingsModal — modal wrapper for SoundSettings.
 * Includes a trigger button rendered in the dashboard header.
 */

import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { SoundSettings } from './SoundSettings';
import { useSoundContext } from '../../contexts/useSoundContext';
import { Dialog } from '../ui';

export function SoundSettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { settings } = useSoundContext();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
        title={settings.enabled ? 'Sound settings (on)' : 'Sound settings (muted)'}
        aria-label="Sound settings"
      >
        {settings.enabled ? (
          <Volume2 className="w-4 h-4" strokeWidth={1.75} />
        ) : (
          <VolumeX className="w-4 h-4" strokeWidth={1.75} />
        )}
      </button>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        ariaLabel="Sound settings"
        maxWidth="max-w-md"
      >
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <SoundSettings onClose={() => setIsOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}
