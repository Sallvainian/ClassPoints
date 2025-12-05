/**
 * SoundSettingsModal - Modal wrapper for sound settings
 *
 * Includes a trigger button (🔊 icon) that opens the modal.
 */

import { useState, useEffect } from 'react';
import { SoundSettings } from './SoundSettings';
import { useSoundContext } from '../../contexts/SoundContext';

export function SoundSettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { settings } = useSoundContext();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
        title={settings.enabled ? 'Sound settings (on)' : 'Sound settings (muted)'}
        aria-label="Sound settings"
      >
        {settings.enabled ? '🔊' : '🔇'}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Content */}
          <div
            className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sound-settings-title"
          >
            <SoundSettings onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
