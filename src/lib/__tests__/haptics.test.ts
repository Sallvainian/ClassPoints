/**
 * hapticAwardSuccess / hapticAwardNegative — the award haptics (called
 * component-level in the three award modals, inside the same positive/negative
 * branches as the sound calls). The contract: strict no-op on web, distinct
 * Success/Warning notifications on native (eyes-free valence), and bridge
 * rejections swallowed (feedback must never break the award flow). No env
 * stub — haptics.ts doesn't import ../lib/supabase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNative = vi.hoisted(() => ({ value: false }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNative.value },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: { notification: vi.fn(async () => {}) },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));

import { Haptics } from '@capacitor/haptics';
import { hapticAwardNegative, hapticAwardSuccess } from '../haptics';

const mockedHaptics = vi.mocked(Haptics);

beforeEach(() => {
  isNative.value = false;
  vi.clearAllMocks();
});

describe('award haptics', () => {
  it('are a no-op on web (Haptics never called)', () => {
    hapticAwardSuccess();
    hapticAwardNegative();
    expect(mockedHaptics.notification).not.toHaveBeenCalled();
  });

  it('fires a Success notification for a positive award on native', () => {
    isNative.value = true;
    hapticAwardSuccess();
    expect(mockedHaptics.notification).toHaveBeenCalledExactlyOnceWith({ type: 'SUCCESS' });
  });

  it('fires a Warning notification for a deduction on native', () => {
    isNative.value = true;
    hapticAwardNegative();
    expect(mockedHaptics.notification).toHaveBeenCalledExactlyOnceWith({ type: 'WARNING' });
  });

  it('swallows bridge rejections', async () => {
    isNative.value = true;
    mockedHaptics.notification.mockRejectedValueOnce(new Error('no bridge'));
    hapticAwardSuccess();
    // Drain the rejection's microtask — an unhandled rejection would fail the
    // test run via Vitest's global handler.
    await new Promise((r) => setTimeout(r, 0));
  });
});
