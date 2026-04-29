import { createContext, useContext } from 'react';
import type { SoundId } from '../assets/sounds';

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  positiveSound: SoundId;
  negativeSound: SoundId;
  customPositiveUrl: string | null;
  customNegativeUrl: string | null;
}

export interface SoundContextValue {
  settings: SoundSettings;
  isLoading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<SoundSettings>) => Promise<void>;
  audioContext: AudioContext | null;
  soundBuffers: Map<SoundId, AudioBuffer>;
  isAudioReady: boolean;
}

export const SoundContext = createContext<SoundContextValue | null>(null);

export function useSoundContext() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSoundContext must be used within SoundProvider');
  }
  return context;
}
