import type { CapacitorConfig } from '@capacitor/cli';

// CAP_SERVER_URL points the native WebView at a LAN Vite dev server for live
// reload (e.g. CAP_SERVER_URL=http://192.168.0.175:5173 npx cap sync ios).
// Unset = production config: the app loads the bundled dist/ assets.
const config: CapacitorConfig = {
  appId: 'com.frankcottone.classpoints',
  appName: 'ClassPoints',
  webDir: 'dist',
  ...(process.env.CAP_SERVER_URL
    ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } }
    : {}),
};

export default config;
