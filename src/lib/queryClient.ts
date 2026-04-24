import { QueryClient } from '@tanstack/react-query';

// Defaults rationale documented in docs/adr/ADR-005-queryclient-defaults.md.
// Key choices:
//   refetchOnWindowFocus: false — Phase 2 optimistic mutations race their
//     onSettled invalidation refetch against a focus refetch; the later
//     response wins. Killing focus refetch removes the race; realtime covers
//     the cross-tab-sync gap for tables that have a realtime channel.
//   gcTime: 10 min — active teacher workflow keeps queries mounted longer
//     than the 5-minute default; a gcTime eviction during use triggers a
//     full isPending flash on the next read (the loading-bounce surface
//     Amelia flagged in pre-mortem attack #5).
//   staleTime: 30 s — deliberate; background data refreshes without
//     hammering Supabase during rapid per-student point awards.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
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
