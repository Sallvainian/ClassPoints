import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { dbToBehavior } from '../types/transforms';
import type { NewBehavior, UpdateBehavior } from '../types/database';
import type { Behavior } from '../types';

// Sort behaviors by category (ascending) then points (descending)
const sortBehaviors = (behaviors: Behavior[]): Behavior[] =>
  [...behaviors].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return b.points - a.points;
  });

export function useBehaviors(): UseQueryResult<Behavior[], Error> {
  return useQuery<Behavior[], Error>({
    queryKey: queryKeys.behaviors.all,
    queryFn: async () => {
      const data = unwrap(
        await supabase
          .from('behaviors')
          .select('*')
          .order('category', { ascending: true })
          .order('points', { ascending: false })
      );
      return sortBehaviors((data ?? []).map(dbToBehavior));
    },
  });
}

export function useAddBehavior() {
  const qc = useQueryClient();
  return useMutation<Behavior, Error, Omit<NewBehavior, 'id' | 'created_at'>>({
    mutationFn: async (input) => {
      const data = unwrap(await supabase.from('behaviors').insert(input).select().single());
      return dbToBehavior(data);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.behaviors.all }),
  });
}

interface UpdateBehaviorInput {
  id: string;
  updates: UpdateBehavior;
}

export function useUpdateBehavior() {
  const qc = useQueryClient();
  return useMutation<Behavior, Error, UpdateBehaviorInput>({
    mutationFn: async ({ id, updates }) => {
      const data = unwrap(
        await supabase.from('behaviors').update(updates).eq('id', id).select().single()
      );
      return dbToBehavior(data);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.behaviors.all }),
  });
}

export function useDeleteBehavior() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      unwrap(await supabase.from('behaviors').delete().eq('id', id));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.behaviors.all }),
  });
}
