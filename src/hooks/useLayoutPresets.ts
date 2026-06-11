import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import type { Json } from '../types/database';
import type { LayoutPreset, LayoutPresetData, SeatingChart } from '../types/seatingChart';
import {
  dbToLayoutPreset,
  layoutPresetDataSchema,
  LayoutPresetValidationError,
} from '../types/seatingChart';

// Once-per-session warn dedupe for corrupt presets (CAP-3 safe-failure).
// Module-level on purpose: refetches and remounts must not re-warn.
// NOT dev-gated — prod corruption is exactly when the breadcrumb matters.
const warnedInvalidPresetIds = new Set<string>();

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

      // Orphan prevention (#15): a NaN/Infinity coordinate JSON-serializes to
      // null and would fail the read-side schema only AFTER persisting — an
      // invisible, UI-undeletable row. Parse with the SAME schema BEFORE the
      // insert so zero rows are written; the throw follows the existing
      // wrapper contract (savePreset → null, error set).
      const layoutParse = layoutPresetDataSchema.safeParse(layoutData);
      if (!layoutParse.success) {
        // Same named error as the read/return paths (unified taxonomy).
        // No row id exists yet — sentinel id + the requested preset name.
        throw new LayoutPresetValidationError('(pre-insert)', name, layoutParse.error);
      }

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
          // The VALIDATED object — what is persisted is exactly what the
          // schema passed (unknown-key stripping applies to writes too).
          layout_data: layoutParse.data as unknown as Json,
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      // Validates the returned row's layout_data through the same schema
      // (named throw on failure). The pre-insert parse rules out CLIENT-side
      // garbage orphans; a server-side rewrite of layout_data between insert
      // and return (no such trigger exists today) could still throw here.
      // Only layout_data is schema-checked — id/name/created_at pass through.
      return dbToLayoutPreset(data);
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
      // Per-row safe-failure (CAP-3): a corrupt layout_data row is FILTERED
      // (valid presets still render, no query error) and warned once per
      // preset id per session. Anything other than the named validation
      // error still throws.
      const presets: LayoutPreset[] = [];
      for (const row of data ?? []) {
        try {
          presets.push(dbToLayoutPreset(row));
        } catch (err) {
          // instanceof + name fallback: under Vite HMR / duplicated module
          // instances class identity can differ, and one corrupt row must
          // never error the whole list.
          const isValidationError =
            err instanceof LayoutPresetValidationError ||
            (err as Error | null)?.name === 'LayoutPresetValidationError';
          if (!isValidationError) throw err;
          const invalid = err as LayoutPresetValidationError;
          if (!warnedInvalidPresetIds.has(invalid.presetId)) {
            warnedInvalidPresetIds.add(invalid.presetId);
            // invalid.message already embeds id + name + the prettified
            // issue summary — log it once, in one coherent line.
            console.warn(`[layout-presets] dropped invalid preset: ${invalid.message}`);
          }
        }
      }
      return presets;
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
