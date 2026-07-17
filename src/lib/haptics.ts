import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

// Award haptics, called component-level in the three award modals inside the
// same positive/negative branches as the sound calls (playPositive /
// playNegative) — but independent of them: haptics fire even when the teacher
// has sounds disabled. The valence split matters for eyes-free use: iOS plays
// distinct patterns for Success vs Warning, so a teacher can feel a deduction
// without looking. No-op on web; bridge errors are swallowed — feedback must
// never break the award flow.

/** Success tap when a positive award lands. */
export function hapticAwardSuccess(): void {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

/** Warning tap when a point deduction lands. */
export function hapticAwardNegative(): void {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
}
