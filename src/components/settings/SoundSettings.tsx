/**
 * SoundSettings — UI for configuring sound effect preferences
 */

import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { useSoundContext } from '../../contexts/useSoundContext';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { type SoundId, POSITIVE_SOUNDS, NEGATIVE_SOUNDS } from '../../assets/sounds';
import { validateAudioUrl } from '../../utils/validateAudioUrl';

interface SoundSettingsProps {
  onClose?: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
      {children}
    </p>
  );
}

const selectClass =
  'flex-1 px-3 py-2 text-sm rounded-[10px] border border-hairline bg-surface-1 text-ink-strong focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-colors';

export function SoundSettings({ onClose }: SoundSettingsProps) {
  const { settings, updateSettings, isLoading, error } = useSoundContext();
  const { playPositive, playNegative } = useSoundEffects();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPositiveUrl, setCustomPositiveUrl] = useState(settings.customPositiveUrl || '');
  const [customNegativeUrl, setCustomNegativeUrl] = useState(settings.customNegativeUrl || '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseInt(e.target.value, 10);
    updateSettings({ volume: percent / 100 });
  };

  const handlePositiveSoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ positiveSound: e.target.value as SoundId });
  };

  const handleNegativeSoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ negativeSound: e.target.value as SoundId });
  };

  const handleCustomUrlSave = async (type: 'positive' | 'negative') => {
    const url = type === 'positive' ? customPositiveUrl : customNegativeUrl;

    if (!url.trim()) {
      if (type === 'positive') {
        await updateSettings({ customPositiveUrl: null });
      } else {
        await updateSettings({ customNegativeUrl: null });
      }
      setUrlError(null);
      return;
    }

    setIsSavingUrl(true);
    setUrlError(null);

    const validation = await validateAudioUrl(url);

    if (!validation.valid) {
      setUrlError(validation.error || 'Invalid URL');
      setIsSavingUrl(false);
      return;
    }

    if (type === 'positive') {
      await updateSettings({ customPositiveUrl: url });
    } else {
      await updateSettings({ customNegativeUrl: url });
    }

    setIsSavingUrl(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-hairline border-t-accent-500" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1">
            Audio
          </p>
          <h2
            id="sound-settings-title"
            className="font-display text-2xl tracking-[-0.01em] text-ink-strong"
          >
            Sound effects
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-mid hover:bg-surface-3 hover:text-ink-strong transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </header>

      {error && (
        <div className="px-3 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40">
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Master toggle */}
      <div className="flex items-center justify-between py-3 border-b border-hairline">
        <div>
          <p className="text-sm font-medium text-ink-strong">Sound effects</p>
          <p className="mt-0.5 text-xs text-ink-mid">Play sounds when awarding points</p>
        </div>
        <button
          onClick={() => updateSettings({ enabled: !settings.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.enabled ? 'bg-accent-500' : 'bg-hairline-strong'
          }`}
          role="switch"
          aria-checked={settings.enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Volume */}
      <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>Volume</SectionLabel>
          <span className="font-mono tabular-nums text-xs text-ink-mid">
            {Math.round(settings.volume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(settings.volume * 100)}
          onChange={handleVolumeChange}
          className="w-full h-1.5 bg-hairline rounded-full appearance-none cursor-pointer accent-accent-500"
        />
      </div>

      {/* Positive sound */}
      <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <SectionLabel>Positive · sound</SectionLabel>
        <div className="flex gap-2">
          <select
            value={settings.positiveSound}
            onChange={handlePositiveSoundChange}
            className={selectClass}
          >
            {POSITIVE_SOUNDS.map((sound) => (
              <option key={sound.id} value={sound.id}>
                {sound.name} — {sound.description}
              </option>
            ))}
          </select>
          <button
            onClick={playPositive}
            className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            title="Preview"
            aria-label="Preview positive sound"
          >
            <Play className="w-3.5 h-3.5" strokeWidth={2} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Negative sound */}
      <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <SectionLabel>Needs work · sound</SectionLabel>
        <div className="flex gap-2">
          <select
            value={settings.negativeSound}
            onChange={handleNegativeSoundChange}
            className={selectClass}
          >
            {NEGATIVE_SOUNDS.map((sound) => (
              <option key={sound.id} value={sound.id}>
                {sound.name} — {sound.description}
              </option>
            ))}
          </select>
          <button
            onClick={playNegative}
            className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 transition-colors"
            title="Preview"
            aria-label="Preview negative sound"
          >
            <Play className="w-3.5 h-3.5" strokeWidth={2} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Advanced */}
      <div className={`pt-2 ${settings.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mid hover:text-ink-strong transition-colors"
        >
          <span
            className="inline-block transition-transform text-[9px]"
            style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
          Custom URLs
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-5 pl-4 border-l border-hairline">
            {urlError && (
              <div className="px-3 py-2 rounded-[10px] bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                <p className="text-xs text-amber-700 dark:text-amber-300">{urlError}</p>
              </div>
            )}

            <div>
              <SectionLabel>Custom positive URL</SectionLabel>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customPositiveUrl}
                  onChange={(e) => setCustomPositiveUrl(e.target.value)}
                  placeholder="https://example.com/sound.mp3"
                  className={selectClass}
                />
                <button
                  onClick={() => handleCustomUrlSave('positive')}
                  disabled={isSavingUrl}
                  className="px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] rounded-[10px] bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
                >
                  {isSavingUrl ? '…' : 'Save'}
                </button>
              </div>
              <p className="mt-1.5 font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                HTTPS · MP3 / WAV / OGG only
              </p>
            </div>

            <div>
              <SectionLabel>Custom needs-work URL</SectionLabel>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customNegativeUrl}
                  onChange={(e) => setCustomNegativeUrl(e.target.value)}
                  placeholder="https://example.com/sound.mp3"
                  className={selectClass}
                />
                <button
                  onClick={() => handleCustomUrlSave('negative')}
                  disabled={isSavingUrl}
                  className="px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] rounded-[10px] bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
                >
                  {isSavingUrl ? '…' : 'Save'}
                </button>
              </div>
              <p className="mt-1.5 font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                Leave empty to use built-in
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
