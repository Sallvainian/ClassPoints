import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
// Self-hosted fonts (offline first paint — no Google CDN). Weights mirror the
// removed fonts.googleapis.com URL exactly: Instrument Serif 400 + italic,
// Geist 400/500/600, JetBrains Mono 500. JS imports (not @import in index.css)
// so Vite's own CSS pipeline rebases and emits the woff2 assets — Tailwind
// v4's @import resolver would inline them with broken relative URLs. Family
// names match the `--font-*` stacks in index.css @theme ('Instrument Serif' /
// 'Geist' / 'JetBrains Mono') — do NOT swap in @fontsource/geist-sans, which
// declares 'Geist Sans' and would silently fall back to system fonts.
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';
import App from './App';
import { DevtoolsGate } from './components/DevtoolsGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <DevtoolsGate />
    </QueryClientProvider>
  </StrictMode>
);
