/**
 * SoundContext - Sound settings provider with Supabase sync
 *
 * Manages user sound preferences and preloads audio buffers for
 * instant playback. Settings sync across devices via Supabase.
 */

// Extend Window interface for Safari's prefixed AudioContext
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { UserSoundSettings, UpdateUserSoundSettings } from '../types/database';
import {
  type SoundId,
  SOUND_DEFINITIONS,
  DEFAULT_POSITIVE_SOUND,
  DEFAULT_NEGATIVE_SOUND,
  ALL_SOUND_IDS,
  synthesizeSound,
} from '../assets/sounds';
import { SoundContext, type SoundSettings, type SoundContextValue } from './useSoundContext';

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.7,
  positiveSound: DEFAULT_POSITIVE_SOUND,
  negativeSound: DEFAULT_NEGATIVE_SOUND,
  customPositiveUrl: null,
  customNegativeUrl: null,
};

export function SoundProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AudioContext guard ref (read only in the lazy-init guard and interaction handler)
  const audioContextRef = useRef<AudioContext | null>(null);
  // Audio readiness is an all-or-nothing invariant: when `ready` is true, both
  // `context` and `buffers` are populated. Keeping them in one state object makes
  // that invariant explicit and the transition atomic. Exposed via state (not
  // refs) so consumers re-render when audio becomes ready.
  const [audioState, setAudioState] = useState<{
    context: AudioContext | null;
    buffers: Map<SoundId, AudioBuffer>;
    ready: boolean;
  }>(() => ({ context: null, buffers: new Map(), ready: false }));

  // Initialize AudioContext and preload sounds
  const initializeAudio = useCallback(() => {
    if (audioContextRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
      }
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Synthesize all sounds into a fresh map, then commit via state
      const buffers = new Map<SoundId, AudioBuffer>();
      for (const [id, definition] of Object.entries(SOUND_DEFINITIONS)) {
        buffers.set(id as SoundId, synthesizeSound(ctx, definition));
      }

      setAudioState({ context: ctx, buffers, ready: true });
    } catch (err) {
      console.warn('Failed to initialize audio:', err);
      setError('Audio initialization failed');
    }
  }, []);

  // Initialize audio on first user interaction (for autoplay policy)
  useEffect(() => {
    const handleInteraction = () => {
      initializeAudio();
      // Resume suspended context if needed
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch((err) => {
          console.warn('Failed to resume audio context:', err);
        });
      }
    };

    // Try to init immediately (works if user already interacted)
    initializeAudio();

    // Also listen for interaction to handle autoplay restrictions
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [initializeAudio]);

  // Load settings from Supabase when user is available
  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('user_sound_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          // PGRST116 = no rows found - this is OK, use defaults
          if (fetchError.code === 'PGRST116') {
            setSettings(DEFAULT_SETTINGS);
          } else {
            throw fetchError;
          }
        } else if (data) {
          setSettings(mapDbToSettings(data));
        }
      } catch (err) {
        console.error('Failed to load sound settings:', err);
        setError('Failed to load sound settings');
        // Use defaults on error
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Update settings (saves to Supabase)
  const updateSettings = useCallback(
    async (updates: Partial<SoundSettings>) => {
      if (!user) return;

      setError(null); // Clear previous errors
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);

      try {
        const dbUpdates = mapSettingsToDb(newSettings, user.id);

        // Upsert settings
        const { error: upsertError } = await supabase
          .from('user_sound_settings')
          .upsert(dbUpdates, { onConflict: 'user_id' });

        if (upsertError) throw upsertError;
      } catch (err) {
        console.error('Failed to save sound settings:', err);
        setError('Failed to save settings');
        // Revert on error
        setSettings(settings);
      }
    },
    [user, settings]
  );

  const value: SoundContextValue = {
    settings,
    isLoading,
    error,
    updateSettings,
    audioContext: audioState.context,
    soundBuffers: audioState.buffers,
    isAudioReady: audioState.ready,
  };

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

// Type guard for validating SoundId from database
function isValidSoundId(value: string): value is SoundId {
  return ALL_SOUND_IDS.includes(value as SoundId);
}

// Map database row to frontend settings with validation
function mapDbToSettings(data: UserSoundSettings): SoundSettings {
  return {
    enabled: data.enabled,
    volume: data.volume,
    positiveSound: isValidSoundId(data.positive_sound)
      ? data.positive_sound
      : DEFAULT_POSITIVE_SOUND,
    negativeSound: isValidSoundId(data.negative_sound)
      ? data.negative_sound
      : DEFAULT_NEGATIVE_SOUND,
    customPositiveUrl: data.custom_positive_url,
    customNegativeUrl: data.custom_negative_url,
  };
}

// Map frontend settings to database format
function mapSettingsToDb(
  settings: SoundSettings,
  userId: string
): UpdateUserSoundSettings & { user_id: string } {
  return {
    user_id: userId,
    enabled: settings.enabled,
    volume: settings.volume,
    positive_sound: settings.positiveSound,
    negative_sound: settings.negativeSound,
    custom_positive_url: settings.customPositiveUrl,
    custom_negative_url: settings.customNegativeUrl,
  };
}
