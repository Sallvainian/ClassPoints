import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * Success tap when an award lands. Called component-level in the three award
 * modals, beside (not inside) the sound calls: haptics fire even when the
 * teacher has sounds disabled. No-op on web; bridge errors are swallowed —
 * feedback must never break the award flow.
 */
export function hapticAwardSuccess(): void {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
