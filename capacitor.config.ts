import type { CapacitorConfig } from '@capacitor/cli';

// CAP_SERVER_URL points the native WebView at a LAN Vite dev server for live
// reload (e.g. CAP_SERVER_URL=http://192.168.0.175:5173 npx cap sync ios).
// Unset = production config: the app loads the bundled dist/ assets.
const config: CapacitorConfig = {
  appId: 'com.frankcottone.classpoints',
  appName: 'ClassPoints',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // main.tsx hides the splash after the first React render commits, so
      // the native launch image covers the WebView's white flash.
      launchAutoHide: false,
      // --color-surface-1 (light page bg) from src/index.css.
      backgroundColor: '#f7f5f1',
    },
  },
  ...(process.env.CAP_SERVER_URL
    ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } }
    : {}),
};

export default config;
