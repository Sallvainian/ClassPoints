/**
 * useSoundEffects - Hook for playing sound effects
 *
 * Provides functions to play positive/negative sounds with volume control.
 * Handles browser autoplay restrictions gracefully.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useSoundContext } from '../contexts/SoundContext';
import type { SoundId } from '../assets/sounds';
import { loadAudioFromUrl } from '../utils/validateAudioUrl';

interface UseSoundEffectsOptions {
  /** Enable test mode - logs instead of playing (for E2E tests) */
  testMode?: boolean;
}

interface UseSoundEffectsReturn {
  /** Play positive behavior sound */
  playPositive: () => void;
  /** Play negative behavior sound */
  playNegative: () => void;
  /** Set volume (0-100 percentage) */
  setVolume: (percent: number) => void;
  /** Toggle mute on/off */
  toggleMute: () => void;
  /** Current settings */
  isEnabled: boolean;
  volume: number;
  /** Whether audio system is ready */
  isReady: boolean;
}

export function useSoundEffects(
  options: UseSoundEffectsOptions = {}
): UseSoundEffectsReturn {
  const { testMode = false } = options;
  const { settings, updateSettings, audioContext, soundBuffers, isAudioReady } =
    useSoundContext();

  // Cache for custom URL audio buffers
  const customBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const [customBuffersLoading, setCustomBuffersLoading] = useState(false);

  // Load custom URL sounds when settings change
  useEffect(() => {
    if (!audioContext || !isAudioReady) return;

    const loadCustomSounds = async () => {
      setCustomBuffersLoading(true);

      const urlsToLoad: string[] = [];

      if (settings.customPositiveUrl) {
        urlsToLoad.push(settings.customPositiveUrl);
      }

      if (settings.customNegativeUrl) {
        urlsToLoad.push(settings.customNegativeUrl);
      }

      for (const url of urlsToLoad) {
        // Skip if already cached
        if (customBuffersRef.current.has(url)) continue;

        const buffer = await loadAudioFromUrl(audioContext, url);
        if (buffer) {
          customBuffersRef.current.set(url, buffer);
        } else {
          // Log failure - custom sound will fall back to built-in
          console.error(`Failed to load custom sound: ${url}`);
        }
      }

      setCustomBuffersLoading(false);
    };

    loadCustomSounds();
  }, [
    audioContext,
    isAudioReady,
    settings.customPositiveUrl,
    settings.customNegativeUrl,
  ]);

  // FIX: Use plain functions instead of useCallback to avoid stale closures
  // The soundBuffers Map reference is stable but its contents change after initialization
  // Using useCallback captured the empty Map before it was populated

  function getBuffer(soundId: SoundId, customUrl: string | null): AudioBuffer | null {
    // Try custom URL first
    if (customUrl) {
      const customBuffer = customBuffersRef.current.get(customUrl);
      if (customBuffer) return customBuffer;
      // Fall through to default if custom not loaded
    }

    // Use built-in sound - access soundBuffers directly (not via closure)
    return soundBuffers.get(soundId) ?? null;
  }

  function playBuffer(buffer: AudioBuffer) {
    if (!audioContext || !buffer) return;

    try {
      // Resume context if suspended (autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch((err) => {
          console.warn('Failed to resume audio context:', err);
        });
      }

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = settings.volume;
      gainNode.connect(audioContext.destination);

      // Create and play source
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(0);
    } catch (err) {
      // Distinguish between autoplay restrictions and real errors
      const isAutoplayRestriction =
        err instanceof DOMException && err.name === 'NotAllowedError';

      if (isAutoplayRestriction) {
        // Browser autoplay policy - will work after user interaction
        console.warn('Sound blocked by autoplay policy - will work after user interaction');
      } else {
        // Real playback error
        console.error('Sound playback failed:', err);
      }
    }
  }

  function playPositive() {
    if (!settings.enabled) return;
    if (testMode) return;

    // Play the user's selected positive sound (Christmas sounds available as options)
    const buffer = getBuffer(settings.positiveSound, settings.customPositiveUrl);
    if (buffer) {
      playBuffer(buffer);
    }
  }

  function playNegative() {
    if (!settings.enabled) return;
    if (testMode) return;

    // Play the user's selected negative sound (Christmas sounds available as options)
    const buffer = getBuffer(settings.negativeSound, settings.customNegativeUrl);
    if (buffer) {
      playBuffer(buffer);
    }
  }

  const setVolume = useCallback(
    (percent: number) => {
      // Convert 0-100 percentage to 0.0-1.0
      const volume = Math.max(0, Math.min(100, percent)) / 100;
      updateSettings({ volume });
    },
    [updateSettings]
  );

  const toggleMute = useCallback(() => {
    updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  return {
    playPositive,
    playNegative,
    setVolume,
    toggleMute,
    isEnabled: settings.enabled,
    volume: settings.volume * 100, // Return as percentage
    isReady: isAudioReady && !customBuffersLoading,
  };
}
