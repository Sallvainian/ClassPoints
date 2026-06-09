import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import type { Json } from '../types/database';
import type {
  LayoutPreset,
  LayoutPresetData,
  SeatingChart,
  DbLayoutPreset,
} from '../types/seatingChart';
import { dbToLayoutPreset } from '../types/seatingChart';

interface UseLayoutPresetsReturn {
  presets: LayoutPreset[];
  loading: boolean;
  error: Error | null;
  savePreset: (name: string, chart: SeatingChart) => Promise<LayoutPreset | null>;
  deletePreset: (presetId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

interface SavePresetInput {
  name: string;
  chart: SeatingChart;
}

function useSaveLayoutPreset() {
  const qc = useQueryClient();
  return useMutation<LayoutPreset, Error, SavePresetInput>({
    mutationFn: async ({ name, chart }) => {
      // Extract layout data (positions only, no student assignments)
      const layoutData: LayoutPresetData = {
        groups: chart.groups.map((g) => ({
          letter: g.letter,
          x: g.x,
          y: g.y,
          rotation: g.rotation,
        })),
        roomElements: chart.roomElements.map((e) => ({
          type: e.type,
          label: e.label,
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
          rotation: e.rotation,
        })),
        settings: {
          snapEnabled: chart.snapEnabled,
          gridSize: chart.gridSize,
          canvasWidth: chart.canvasWidth,
          canvasHeight: chart.canvasHeight,
        },
      };

      // Get current user ID for RLS
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('layout_presets')
        .insert({
          name,
          user_id: user.id,
          layout_data: layoutData as unknown as Json,
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      return dbToLayoutPreset(data as DbLayoutPreset);
    },
    // RETURNING the invalidate promise makes mutateAsync await the list refetch,
    // so callers observe the refreshed (server-sorted) list on settle.
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.layoutPresets.all }),
  });
}

function useDeleteLayoutPreset() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (presetId) => {
      const { error: deleteError } = await supabase
        .from('layout_presets')
        .delete()
        .eq('id', presetId);

      if (deleteError) throw new Error(deleteError.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.layoutPresets.all }),
  });
}

export function useLayoutPresets(): UseLayoutPresetsReturn {
  const query = useQuery<LayoutPreset[], Error>({
    queryKey: queryKeys.layoutPresets.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('layout_presets')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => dbToLayoutPreset(p as DbLayoutPreset));
    },
  });

  const saveMutation = useSaveLayoutPreset();
  const deleteMutation = useDeleteLayoutPreset();

  const { mutateAsync: saveAsync } = saveMutation;
  const { mutateAsync: deleteAsync } = deleteMutation;
  const { refetch: refetchQuery } = query;

  // Wrappers preserve the legacy result contract (null / boolean instead of throw)
  // so the sole consumer (SeatingChartView) is untouched.
  const savePreset = useCallback(
    async (name: string, chart: SeatingChart): Promise<LayoutPreset | null> => {
      try {
        return await saveAsync({ name, chart });
      } catch {
        return null;
      }
    },
    [saveAsync]
  );

  const deletePreset = useCallback(
    async (presetId: string): Promise<boolean> => {
      try {
        await deleteAsync(presetId);
        return true;
      } catch {
        return false;
      }
    },
    [deleteAsync]
  );

  const refetch = useCallback(async (): Promise<void> => {
    await refetchQuery();
  }, [refetchQuery]);

  return {
    presets: query.data ?? [],
    loading: query.isPending,
    error: query.error ?? saveMutation.error ?? deleteMutation.error,
    savePreset,
    deletePreset,
    refetch,
  };
}
