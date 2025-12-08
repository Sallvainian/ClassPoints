/**
 * SoundSettings - UI for configuring sound effect preferences
 */

import { useState } from 'react';
import { useSoundContext } from '../../contexts/SoundContext';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import {
  type SoundId,
  POSITIVE_SOUNDS,
  NEGATIVE_SOUNDS,
} from '../../assets/sounds';
import { validateAudioUrl } from '../../utils/validateAudioUrl';

interface SoundSettingsProps {
  onClose?: () => void;
}

export function SoundSettings({ onClose }: SoundSettingsProps) {
  const { settings, updateSettings, isLoading, error } = useSoundContext();
  const { playPositive, playNegative } = useSoundEffects();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPositiveUrl, setCustomPositiveUrl] = useState(
    settings.customPositiveUrl || ''
  );
  const [customNegativeUrl, setCustomNegativeUrl] = useState(
    settings.customNegativeUrl || ''
  );
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
      // Clear custom URL
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
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 id="sound-settings-title" className="text-lg font-semibold text-gray-900">Sound Settings</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Master Toggle */}
      <div className="flex items-center justify-between py-3 border-b">
        <div>
          <label className="font-medium text-gray-900">Sound Effects</label>
          <p className="text-sm text-gray-500">Play sounds when awarding points</p>
        </div>
        <button
          onClick={() => updateSettings({ enabled: !settings.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
          role="switch"
          aria-checked={settings.enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Volume Slider */}
      <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <label className="block font-medium text-gray-900 mb-2">
          Volume: {Math.round(settings.volume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(settings.volume * 100)}
          onChange={handleVolumeChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Positive Sound Selection */}
      <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <label className="block font-medium text-gray-900 mb-2">
          Positive Behavior Sound
        </label>
        <div className="flex gap-2">
          <select
            value={settings.positiveSound}
            onChange={handlePositiveSoundChange}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {POSITIVE_SOUNDS.map((sound) => (
              <option key={sound.id} value={sound.id}>
                {sound.name} - {sound.description}
              </option>
            ))}
          </select>
          <button
            onClick={playPositive}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            title="Preview sound"
          >
            ▶️
          </button>
        </div>
      </div>

      {/* Negative Sound Selection */}
      <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <label className="block font-medium text-gray-900 mb-2">
          Negative Behavior Sound
        </label>
        <div className="flex gap-2">
          <select
            value={settings.negativeSound}
            onChange={handleNegativeSoundChange}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {NEGATIVE_SOUNDS.map((sound) => (
              <option key={sound.id} value={sound.id}>
                {sound.name} - {sound.description}
              </option>
            ))}
          </select>
          <button
            onClick={playNegative}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            title="Preview sound"
          >
            ▶️
          </button>
        </div>
      </div>

      {/* Advanced Section - Custom URLs */}
      <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <span className="transform transition-transform" style={{
            display: 'inline-block',
            transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>
            ▶
          </span>
          Advanced: Custom Sound URLs
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
            {urlError && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded text-sm">
                {urlError}
              </div>
            )}

            {/* Custom Positive URL */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Custom Positive Sound URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customPositiveUrl}
                  onChange={(e) => setCustomPositiveUrl(e.target.value)}
                  placeholder="https://example.com/sound.mp3"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => handleCustomUrlSave('positive')}
                  disabled={isSavingUrl}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingUrl ? '...' : 'Save'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be HTTPS and an audio file (MP3, WAV, OGG)
              </p>
            </div>

            {/* Custom Negative URL */}
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Custom Negative Sound URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customNegativeUrl}
                  onChange={(e) => setCustomNegativeUrl(e.target.value)}
                  placeholder="https://example.com/sound.mp3"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => handleCustomUrlSave('negative')}
                  disabled={isSavingUrl}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingUrl ? '...' : 'Save'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to use built-in sound
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
