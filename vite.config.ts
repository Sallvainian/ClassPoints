import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Native builds lock the viewport: a WKWebView app must never pinch/focus-zoom
// its own UI. The web deployment keeps user zoom (accessibility).
function capacitorViewportLock(): Plugin {
  return {
    name: 'capacitor-viewport-lock',
    transformIndexHtml(html) {
      return html.replace(
        'initial-scale=1.0, viewport-fit=cover',
        'initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'capacitor' ? [capacitorViewportLock()] : [])],
  // The web app deploys to GitHub Pages under /ClassPoints/; the Capacitor
  // WebView serves dist/ from its own root, so native builds need a relative
  // base (`vite build --mode capacitor`, see the cap:build script).
  base: mode === 'capacitor' ? './' : '/ClassPoints/',
  server: {
    host: true,
  },
}));
