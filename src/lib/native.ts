import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

// Native-shell integrations (Capacitor). Every function is a no-op on web:
// Capacitor.isNativePlatform() is a synchronous check, and the plugin proxies
// are lazy, so importing this module costs nothing in the browser bundle's
// behavior. Plugin calls are fire-and-forget with swallowed rejections — a
// cosmetic native nicety must never break the app over a bridge hiccup.

/** Match the iOS/Android status-bar text to the app theme. */
export function syncStatusBar(theme: 'light' | 'dark'): void {
  if (!Capacitor.isNativePlatform()) return;
  // Style.Dark = light text on dark backgrounds (the enum names the BACKGROUND
  // the bar sits on, not the text color).
  void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
}

/** Hide the launch splash — call once the first React render has committed. */
export function hideSplash(): void {
  if (!Capacitor.isNativePlatform()) return;
  void SplashScreen.hide().catch(() => {});
}

/**
 * Android hardware/gesture back: non-home views go home; from home the app
 * minimizes (never exits — teachers relaunch instantly from recents). iOS has
 * no back button and never fires this event. Returns a cleanup that removes
 * the listener.
 */
export function registerBackButton(opts: {
  isHome: () => boolean;
  goHome: () => void;
}): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handlePromise = App.addListener('backButton', () => {
    if (opts.isHome()) {
      void App.minimizeApp().catch(() => {});
    } else {
      opts.goHome();
    }
  });
  return () => {
    void handlePromise.then((handle) => handle.remove()).catch(() => {});
  };
}
