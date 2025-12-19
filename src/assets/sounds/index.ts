/**
 * Sound Effects - Web Audio API synthesized tones
 *
 * These sounds are generated programmatically using Web Audio API,
 * providing zero-latency playback with no external file dependencies.
 *
 * Positive sounds: Bright, ascending tones for celebrating good behavior
 * Negative sounds: Gentle, descending tones for behavior correction
 */

// Category-aware sound ID types for type-safe validation
export type PositiveSoundId = 'chime' | 'bell' | 'sparkle' | 'jingle-bells' | 'sleigh-bells';
export type NegativeSoundId = 'soft-buzz' | 'low-tone' | 'gentle-womp' | 'coal-thud' | 'winter-wind';
export type SoundId = PositiveSoundId | NegativeSoundId;

export type SoundCategory = 'positive' | 'negative';

// Runtime validation arrays (must match type definitions)
export const POSITIVE_SOUND_IDS: readonly PositiveSoundId[] = [
  'chime',
  'bell',
  'sparkle',
  'jingle-bells',
  'sleigh-bells',
] as const;
export const NEGATIVE_SOUND_IDS: readonly NegativeSoundId[] = [
  'soft-buzz',
  'low-tone',
  'gentle-womp',
  'coal-thud',
  'winter-wind',
] as const;
export const ALL_SOUND_IDS: readonly SoundId[] = [
  ...POSITIVE_SOUND_IDS,
  ...NEGATIVE_SOUND_IDS,
] as const;

export interface SoundDefinition {
  id: SoundId;
  name: string;
  category: SoundCategory;
  description: string;
  /** Frequency pattern for synthesis */
  frequencies: number[];
  /** Duration in seconds */
  duration: number;
  /** Wave type for oscillator */
  waveType: OscillatorType;
}

export const SOUND_DEFINITIONS: Record<SoundId, SoundDefinition> = {
  // Positive sounds - bright, celebratory
  chime: {
    id: 'chime',
    name: 'Chime',
    category: 'positive',
    description: 'Classic ascending chime',
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5 - C major chord ascending
    duration: 0.4,
    waveType: 'sine',
  },
  bell: {
    id: 'bell',
    name: 'Bell',
    category: 'positive',
    description: 'Clear bell tone',
    frequencies: [880, 1108.73], // A5, C#6 - bright interval
    duration: 0.5,
    waveType: 'sine',
  },
  sparkle: {
    id: 'sparkle',
    name: 'Sparkle',
    category: 'positive',
    description: 'Magical sparkle effect',
    frequencies: [1318.51, 1567.98, 2093.00], // E6, G6, C7 - high sparkle
    duration: 0.35,
    waveType: 'sine',
  },
  // Christmas positive sounds
  'jingle-bells': {
    id: 'jingle-bells',
    name: 'Jingle Bells',
    category: 'positive',
    description: 'Festive jingle bell melody',
    // Classic "Jingle Bells" melody: E-E-E, E-E-E, E-G-C-D-E
    frequencies: [659.25, 659.25, 659.25, 659.25, 659.25, 659.25, 659.25, 783.99, 523.25, 587.33, 659.25],
    duration: 0.9,
    waveType: 'triangle', // Bell-like overtones
  },
  'sleigh-bells': {
    id: 'sleigh-bells',
    name: 'Sleigh Bells',
    category: 'positive',
    description: 'Sparkling sleigh bells shimmer',
    // Quick alternating high notes like bells jingling
    frequencies: [2093, 2637, 2093, 2637, 2093, 2637, 2349, 2793],
    duration: 0.5,
    waveType: 'sine',
  },
  // Negative sounds - gentle, corrective
  'soft-buzz': {
    id: 'soft-buzz',
    name: 'Soft Buzz',
    category: 'negative',
    description: 'Gentle buzz notification',
    frequencies: [220, 196], // A3, G3 - descending
    duration: 0.3,
    waveType: 'triangle',
  },
  'low-tone': {
    id: 'low-tone',
    name: 'Low Tone',
    category: 'negative',
    description: 'Subdued low tone',
    frequencies: [196, 174.61], // G3, F3 - gentle descent
    duration: 0.35,
    waveType: 'sine',
  },
  'gentle-womp': {
    id: 'gentle-womp',
    name: 'Gentle Womp',
    category: 'negative',
    description: 'Soft womp sound',
    frequencies: [329.63, 261.63, 220], // E4, C4, A3 - descending thirds
    duration: 0.4,
    waveType: 'triangle',
  },
  // Christmas negative sounds
  'coal-thud': {
    id: 'coal-thud',
    name: 'Coal Thud',
    category: 'negative',
    description: 'Heavy lump of coal dropping',
    // Low impact thud - starts with attack then drops
    frequencies: [150, 100, 65],
    duration: 0.3,
    waveType: 'triangle', // Softer thud
  },
  'winter-wind': {
    id: 'winter-wind',
    name: 'Winter Wind',
    category: 'negative',
    description: 'Cold winter breeze whoosh',
    // Descending whoosh like cold wind
    frequencies: [400, 350, 300, 250, 200, 150],
    duration: 0.6,
    waveType: 'sawtooth', // Breathy/airy quality
  },
};

export const POSITIVE_SOUNDS = Object.values(SOUND_DEFINITIONS).filter(
  (s) => s.category === 'positive'
);

export const NEGATIVE_SOUNDS = Object.values(SOUND_DEFINITIONS).filter(
  (s) => s.category === 'negative'
);

export const DEFAULT_POSITIVE_SOUND: SoundId = 'chime';
export const DEFAULT_NEGATIVE_SOUND: SoundId = 'soft-buzz';

/**
 * Synthesize a sound using Web Audio API
 * Returns an AudioBuffer that can be played instantly
 */
export function synthesizeSound(
  audioContext: AudioContext,
  definition: SoundDefinition
): AudioBuffer {
  const { frequencies, duration, waveType } = definition;
  const sampleRate = audioContext.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const noteLength = length / frequencies.length;

  // FIX: Use phase accumulation to prevent discontinuities when frequency changes
  let currentPhase = 0;

  for (let i = 0; i < length; i++) {
    const noteIndex = Math.min(Math.floor(i / noteLength), frequencies.length - 1);
    const frequency = frequencies[noteIndex];

    // FIX: Calculate phase increment for this sample step (prevents clicks/pops)
    const phaseIncrement = (2 * Math.PI * frequency) / sampleRate;
    currentPhase += phaseIncrement;

    // Generate waveform based on type using accumulated phase
    let sample: number;

    switch (waveType) {
      case 'triangle':
        sample = (2 / Math.PI) * Math.asin(Math.sin(currentPhase));
        break;
      case 'square':
        sample = Math.sin(currentPhase) >= 0 ? 0.5 : -0.5;
        break;
      case 'sawtooth':
        sample = 2 * ((currentPhase / (2 * Math.PI)) % 1) - 1;
        break;
      case 'sine':
      default:
        sample = Math.sin(currentPhase);
    }

    // Apply envelope (attack-decay) for smooth sound
    const attackTime = 0.01 * sampleRate;
    const decayStart = length - 0.1 * sampleRate;

    let envelope = 1;
    if (i < attackTime) {
      envelope = i / attackTime; // Attack
    } else if (i > decayStart) {
      envelope = (length - i) / (length - decayStart); // Decay
    }

    // Also apply inter-note envelope for smooth transitions
    const notePosition = i % noteLength;
    const noteAttack = noteLength * 0.05;
    const noteDecay = noteLength * 0.2;

    if (notePosition < noteAttack) {
      envelope *= notePosition / noteAttack;
    } else if (notePosition > noteLength - noteDecay) {
      envelope *= (noteLength - notePosition) / noteDecay;
    }

    data[i] = sample * envelope * 0.4; // 0.4 amplitude to prevent clipping
  }

  return buffer;
}
