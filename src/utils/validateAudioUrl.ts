/**
 * Validate custom audio URL for security and compatibility
 */

export interface AudioUrlValidation {
  valid: boolean;
  error?: string;
}

// Allowed audio MIME types
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/x-m4a',
];

// URL validation regex (basic format check)
const URL_REGEX = /^https:\/\/[^\s<>"{}|\\^`[\]]+$/i;

/**
 * Validate a custom audio URL
 *
 * Security checks:
 * - Must be HTTPS
 * - Must be valid URL format (prevents XSS)
 * - Content-Type must be audio/*
 * - 3-second timeout for HEAD request
 *
 * @param url - URL to validate
 * @returns Validation result
 */
export async function validateAudioUrl(url: string): Promise<AudioUrlValidation> {
  // Check URL format
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Must be HTTPS (prevents mixed content and MITM)
  if (!url.startsWith('https://')) {
    return { valid: false, error: 'URL must use HTTPS' };
  }

  // Basic format validation (prevents XSS via javascript: or data: URLs)
  if (!URL_REGEX.test(url)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check Content-Type with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { valid: false, error: `URL returned ${response.status}` };
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';

    // Check if content type is audio
    const isAudio =
      contentType.startsWith('audio/') ||
      ALLOWED_AUDIO_TYPES.some((type) => contentType.includes(type));

    if (!isAudio) {
      return { valid: false, error: 'URL does not point to an audio file' };
    }

    return { valid: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { valid: false, error: 'URL validation timed out' };
      }
      return { valid: false, error: `Failed to validate URL: ${err.message}` };
    }
    return { valid: false, error: 'Failed to validate URL' };
  }
}

/**
 * Load audio from URL into AudioBuffer
 *
 * @param audioContext - Web Audio API context
 * @param url - Audio file URL
 * @param timeout - Timeout in milliseconds (default 3000)
 * @returns AudioBuffer or null on failure
 */
export async function loadAudioFromUrl(
  audioContext: AudioContext,
  url: string,
  timeout = 3000
): Promise<AudioBuffer | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Failed to load audio from ${url}: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return audioBuffer;
  } catch (err) {
    console.warn(`Failed to load audio from ${url}:`, err);
    return null;
  }
}
