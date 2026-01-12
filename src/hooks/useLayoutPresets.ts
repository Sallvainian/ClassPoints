import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
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

export function useLayoutPresets(): UseLayoutPresetsReturn {
  const [presets, setPresets] = useState<LayoutPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('layout_presets')
        .select('*')
        .order('name', { ascending: true });

      if (queryError) {
        throw new Error(queryError.message);
      }

      const layoutPresets = (data || []).map((p) => dbToLayoutPreset(p as DbLayoutPreset));
      setPresets(layoutPresets);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch presets'));
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  // Real-time subscription
  useRealtimeSubscription<DbLayoutPreset>({
    table: 'layout_presets',
    onInsert: (preset) => {
      setPresets((prev) => {
        if (prev.some((p) => p.id === preset.id)) return prev;
        const newPreset = dbToLayoutPreset(preset);
        return [...prev, newPreset].sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    onUpdate: (preset) => {
      setPresets((prev) =>
        prev
          .map((p) => (p.id === preset.id ? dbToLayoutPreset(preset) : p))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    onDelete: ({ id }) => {
      setPresets((prev) => prev.filter((p) => p.id !== id));
    },
  });

  // Save current chart layout as a preset
  const savePreset = useCallback(
    async (name: string, chart: SeatingChart): Promise<LayoutPreset | null> => {
      try {
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

        const newPreset = dbToLayoutPreset(data as DbLayoutPreset);

        setPresets((prev) => {
          if (prev.some((p) => p.id === newPreset.id)) return prev;
          return [...prev, newPreset].sort((a, b) => a.name.localeCompare(b.name));
        });

        return newPreset;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to save preset'));
        return null;
      }
    },
    []
  );

  // Delete a preset
  const deletePreset = useCallback(async (presetId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('layout_presets')
        .delete()
        .eq('id', presetId);

      if (deleteError) throw new Error(deleteError.message);

      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete preset'));
      return false;
    }
  }, []);

  return {
    presets,
    loading,
    error,
    savePreset,
    deletePreset,
    refetch: fetchPresets,
  };
}
