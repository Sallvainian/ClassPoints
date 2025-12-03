import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeSubscriptionOptions<T, D = { id: string }> {
  table: string;
  schema?: string;
  event?: PostgresChangeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: D) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to Supabase Realtime postgres_changes
 * Based on official Supabase documentation patterns
 * Uses refs for callbacks to avoid stale closures
 */
export function useRealtimeSubscription<T extends Record<string, any>, D = { id: string }>({
  table,
  schema = 'public',
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSubscriptionOptions<T, D>) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Use refs to always have fresh callbacks without recreating the subscription
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  // Keep refs up to date
  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) return;

    // Prevent duplicate subscriptions
    if (channelRef.current) return;

    const channelName = `${table}-changes-${filter || 'all'}`;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // Build the filter config
    const filterConfig: {
      event: PostgresChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema,
      table,
    };

    if (filter) {
      filterConfig.filter = filter;
    }

    channel
      .on(
        'postgres_changes' as any,
        filterConfig as any,
        (payload: RealtimePostgresChangesPayload<T>) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsertRef.current?.(payload.new as T);
              break;
            case 'UPDATE':
              onUpdateRef.current?.(payload.new as T);
              break;
            case 'DELETE':
              onDeleteRef.current?.(payload.old as D);
              break;
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, event, filter, enabled]);
}

type MultiTableSubscription = {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: { id: string }) => void;
  filter?: string;
};

/**
 * Hook to subscribe to multiple tables at once
 * Uses refs for callbacks to avoid stale closures
 */
export function useMultiTableRealtimeSubscription(
  subscriptions: Array<MultiTableSubscription>,
  enabled = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscriptionsRef = useRef(subscriptions);

  // Keep subscriptions ref up to date
  useEffect(() => {
    subscriptionsRef.current = subscriptions;
  }, [subscriptions]);

  // Build a stable key from table names and filters only
  const subscriptionKey = subscriptions
    .map((s) => `${s.table}:${s.filter || ''}`)
    .join('|');

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    if (channelRef.current) return;

    const channel = supabase.channel('multi-table-changes');
    channelRef.current = channel;

    // Add listeners for each table - use refs for callbacks
    subscriptions.forEach(({ table, filter }, index) => {
      const filterConfig: {
        event: '*';
        schema: string;
        table: string;
        filter?: string;
      } = {
        event: '*',
        schema: 'public',
        table,
      };

      if (filter) {
        filterConfig.filter = filter;
      }

      (channel as any).on('postgres_changes', filterConfig, (payload: any) => {
        // Use refs to get fresh callbacks
        const currentSub = subscriptionsRef.current[index];
        switch (payload.eventType) {
          case 'INSERT':
            currentSub?.onInsert?.(payload.new);
            break;
          case 'UPDATE':
            currentSub?.onUpdate?.(payload.new);
            break;
          case 'DELETE':
            currentSub?.onDelete?.(payload.old as { id: string });
            break;
        }
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Realtime subscribed to multiple tables');
      }
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscriptionKey, enabled]);
}
