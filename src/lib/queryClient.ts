import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      networkMode: 'online',
      // Load-bearing for the Phases 1–3 adapter bridge (ref-stable query data →
      // ref-stable adapter output). v5 default-on; explicit here to prevent silent
      // regressions if the default changes. Do not override per-hook.
      structuralSharing: true,
    },
    mutations: {
      retry: 0,
      networkMode: 'online',
    },
  },
});
