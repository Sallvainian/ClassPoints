/**
 * Unit tests for sound effects feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { SoundProvider, useSoundContext } from '../contexts/SoundContext';
import { useSoundEffects } from '../hooks/useSoundEffects';
import {
  SOUND_DEFINITIONS,
  POSITIVE_SOUNDS,
  NEGATIVE_SOUNDS,
  synthesizeSound,
} from '../assets/sounds';

// Mock AuthContext - must be before SoundContext import
// vi.mock is hoisted, so we can't use external variables
vi.mock('../contexts/AuthContext', () => {
  // All mock data must be defined inside the factory
  const mockAuthContextValue = {
    user: { id: 'test-user-id' },
    session: { access_token: 'test-token' },
    loading: false,
    error: null,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    clearError: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createContext: createCtx } = require('react');
  const MockAuthContext = createCtx(mockAuthContextValue);
  return {
    AuthContext: MockAuthContext,
    useAuth: vi.fn().mockReturnValue(mockAuthContextValue),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
  };
});

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  sampleRate = 44100;
  destination = {};

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: vi.fn(),
    };
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

// Set up global AudioContext mock
beforeEach(() => {
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.stubGlobal('webkitAudioContext', MockAudioContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sound Definitions', () => {
  it('should have 6 sound definitions (3 positive, 3 negative)', () => {
    expect(Object.keys(SOUND_DEFINITIONS)).toHaveLength(6);
    expect(POSITIVE_SOUNDS).toHaveLength(3);
    expect(NEGATIVE_SOUNDS).toHaveLength(3);
  });

  it('should have correct structure for each sound', () => {
    POSITIVE_SOUNDS.forEach((sound) => {
      expect(sound).toHaveProperty('id');
      expect(sound).toHaveProperty('name');
      expect(sound).toHaveProperty('description');
      expect(sound).toHaveProperty('category', 'positive');
    });

    NEGATIVE_SOUNDS.forEach((sound) => {
      expect(sound).toHaveProperty('id');
      expect(sound).toHaveProperty('name');
      expect(sound).toHaveProperty('description');
      expect(sound).toHaveProperty('category', 'negative');
    });
  });

  it('should synthesize sounds without error', () => {
    const audioContext = new MockAudioContext() as unknown as AudioContext;

    Object.values(SOUND_DEFINITIONS).forEach((definition) => {
      expect(() => synthesizeSound(audioContext, definition)).not.toThrow();
    });
  });
});

describe('useSoundContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(SoundProvider, null, children);

  it('should provide default settings', async () => {
    const { result } = renderHook(() => useSoundContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.enabled).toBe(true);
      expect(result.current.settings.volume).toBe(0.7);
      expect(result.current.settings.positiveSound).toBe('chime');
      expect(result.current.settings.negativeSound).toBe('soft-buzz');
    });
  });

  it('should allow updating settings', async () => {
    const { result } = renderHook(() => useSoundContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateSettings({ volume: 0.5 });
    });

    expect(result.current.settings.volume).toBe(0.5);
  });

  it('should provide audioContext and soundBuffers', async () => {
    const { result } = renderHook(() => useSoundContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.audioContext).toBeDefined();
      expect(result.current.soundBuffers).toBeDefined();
      expect(result.current.soundBuffers instanceof Map).toBe(true);
    });
  });
});

describe('useSoundEffects', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(SoundProvider, null, children);

  it('should provide playPositive and playNegative functions', async () => {
    const { result } = renderHook(() => useSoundEffects(), { wrapper });

    await waitFor(() => {
      expect(typeof result.current.playPositive).toBe('function');
      expect(typeof result.current.playNegative).toBe('function');
    });
  });

  it('should provide volume controls', async () => {
    const { result } = renderHook(() => useSoundEffects(), { wrapper });

    await waitFor(() => {
      expect(typeof result.current.setVolume).toBe('function');
      expect(typeof result.current.toggleMute).toBe('function');
      expect(typeof result.current.volume).toBe('number');
    });
  });

  it('should log in test mode instead of playing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { result } = renderHook(() => useSoundEffects({ testMode: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    act(() => {
      result.current.playPositive();
    });

    expect(consoleSpy).toHaveBeenCalledWith('[SoundEffects:TEST] playPositive called');

    act(() => {
      result.current.playNegative();
    });

    expect(consoleSpy).toHaveBeenCalledWith('[SoundEffects:TEST] playNegative called');

    consoleSpy.mockRestore();
  });

  it('should not play when disabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { result } = renderHook(() => useSoundEffects({ testMode: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    // Disable sounds
    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isEnabled).toBe(false);

    // Clear any previous calls
    consoleSpy.mockClear();

    // Try to play - should not log since disabled
    act(() => {
      result.current.playPositive();
    });

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should return volume as percentage (0-100)', async () => {
    const { result } = renderHook(() => useSoundEffects(), { wrapper });

    await waitFor(() => {
      // Default volume is 0.7, so percentage should be 70
      expect(result.current.volume).toBe(70);
    });
  });

  it('should clamp volume to valid range', async () => {
    const { result } = renderHook(() => useSoundEffects(), { wrapper });

    await waitFor(() => {
      expect(result.current.volume).toBeDefined();
    });

    // Set volume above max
    act(() => {
      result.current.setVolume(150);
    });
    expect(result.current.volume).toBe(100);

    // Set volume below min
    act(() => {
      result.current.setVolume(-50);
    });
    expect(result.current.volume).toBe(0);
  });
});

describe('validateAudioUrl', () => {
  // Import dynamically to avoid module resolution issues in tests
  it('should validate HTTPS URLs', async () => {
    const { validateAudioUrl } = await import('../utils/validateAudioUrl');

    // HTTP should fail
    const httpResult = await validateAudioUrl('http://example.com/sound.mp3');
    expect(httpResult.valid).toBe(false);
    expect(httpResult.error).toContain('HTTPS');
  });

  it('should validate audio file extensions', async () => {
    const { validateAudioUrl } = await import('../utils/validateAudioUrl');

    // Mock fetch to simulate a server response with wrong content type
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'text/plain' : null),
      },
    }) as unknown as typeof fetch;

    // Non-audio content type should fail
    const txtResult = await validateAudioUrl('https://example.com/file.txt');
    expect(txtResult.valid).toBe(false);
    expect(txtResult.error).toContain('audio');
  });

  it('should accept valid audio URLs', async () => {
    const { validateAudioUrl } = await import('../utils/validateAudioUrl');

    // Mock fetch for valid audio
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'audio/mpeg' : null),
      },
    }) as unknown as typeof fetch;

    const result = await validateAudioUrl('https://example.com/sound.mp3');
    expect(result.valid).toBe(true);
  });
});
