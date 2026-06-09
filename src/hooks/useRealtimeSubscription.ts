import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type RealtimeConnectionStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

interface UseRealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  table: string;
  schema?: string;
  event?: PostgresChangeEvent;
  filter?: string;
  /**
   * Single callback receiving the full postgres_changes payload. Optional —
   * status-only subscriptions (just `onStatusChange`/`onReconnect`) are legitimate.
   */
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
  /** Fires on every subscription status transition (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED). */
  onStatusChange?: (status: RealtimeConnectionStatus, err?: Error) => void;
  /**
   * Fires when the subscription recovers from a disconnect — i.e. transitions back to
   * SUBSCRIBED after CHANNEL_ERROR, TIMED_OUT, or CLOSED. Wire this to a refetch of the
   * table's state so realtime events that arrived while offline aren't silently missed.
   */
  onReconnect?: () => void;
}

/**
 * Hook to subscribe to Supabase Realtime postgres_changes.
 * Uses refs for callbacks to avoid stale closures.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>({
  table,
  schema = 'public',
  event = '*',
  filter,
  onChange,
  enabled = true,
  onStatusChange,
  onReconnect,
}: UseRealtimeSubscriptionOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Keep callbacks fresh via refs so we don't re-subscribe on every render
  const onChangeRef = useRef(onChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const onReconnectRef = useRef(onReconnect);
  const previousStatusRef = useRef<RealtimeConnectionStatus | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onStatusChangeRef.current = onStatusChange;
    onReconnectRef.current = onReconnect;
  }, [onChange, onStatusChange, onReconnect]);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      previousStatusRef.current = null;
      return;
    }

    // Filter/table may have changed — tear down and rebuild
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Use a UUID, not Date.now(): under StrictMode dev double-mount,
    // cleanup → remount runs in the same microtask (and same millisecond), so
    // Date.now() collides. supabase.channel(topic) returns the EXISTING channel
    // for a matching topic, and the second .on('postgres_changes', …) on a
    // joining channel throws. Per-mount UUID guarantees a fresh channel.
    const channelName = `${table}-changes-${filter || 'all'}-${crypto.randomUUID()}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const filterConfig: {
      event: PostgresChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = { event, schema, table };

    if (filter) {
      filterConfig.filter = filter;
    }

    // Supabase's .on() signature is over-strict; cast to loosen.
    (
      channel as unknown as {
        on: (
          event: string,
          config: typeof filterConfig,
          callback: (payload: RealtimePostgresChangesPayload<T>) => void
        ) => typeof channel;
      }
    )
      .on('postgres_changes', filterConfig, (payload: RealtimePostgresChangesPayload<T>) => {
        onChangeRef.current?.(payload);
      })
      .subscribe((status: string, err?: Error) => {
        const typed = status as RealtimeConnectionStatus;
        onStatusChangeRef.current?.(typed, err);

        const prev = previousStatusRef.current;
        if (
          typed === 'SUBSCRIBED' &&
          (prev === 'CHANNEL_ERROR' || prev === 'TIMED_OUT' || prev === 'CLOSED')
        ) {
          onReconnectRef.current?.();
        }

        previousStatusRef.current = typed;
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      previousStatusRef.current = null;
    };
  }, [table, schema, event, filter, enabled]);
}
