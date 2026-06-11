import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import type { Student } from '../types';
import type { Json, UpdateSeatingChart } from '../types/database';
import type {
  SeatingChart,
  SeatingGroup,
  RoomElement,
  RoomElementType,
  DbSeatingSeat,
  LayoutPreset,
} from '../types/seatingChart';
import {
  dbToSeatingChart,
  dbToSeatingGroup,
  dbToRoomElement,
  getNextGroupLetter,
  DEFAULT_SEATING_CHART_SETTINGS,
} from '../types/seatingChart';

interface UseSeatingChartReturn {
  chart: SeatingChart | null;
  loading: boolean;
  /** Query (load) failures only — drives the View's full-screen error branch. */
  error: Error | null;
  /** First non-null mutation error — drives a dismissible toast; the chart stays visible. */
  actionError: Error | null;
  clearActionError: () => void;

  // Chart operations
  createChart: (name?: string) => Promise<SeatingChart | null>;
  updateSettings: (
    settings: Partial<{
      name: string;
      snapEnabled: boolean;
      gridSize: number;
      canvasWidth: number;
      canvasHeight: number;
    }>
  ) => Promise<void>;
  deleteChart: () => Promise<boolean>;

  // Group operations
  addGroup: (x: number, y: number) => Promise<SeatingGroup | null>;
  moveGroup: (groupId: string, x: number, y: number) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<boolean>;
  rotateGroup: (groupId: string) => Promise<void>;

  // Student assignment
  assignStudent: (studentId: string, seatId: string) => Promise<void>;
  unassignStudent: (seatId: string) => Promise<void>;
  swapStudents: (seatId1: string, seatId2: string) => Promise<void>;
  randomizeAssignments: (students: Student[]) => Promise<void>;

  // Room elements
  addRoomElement: (type: RoomElementType, x: number, y: number) => Promise<RoomElement | null>;
  moveRoomElement: (id: string, x: number, y: number) => Promise<void>;
  resizeRoomElement: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number
  ) => Promise<void>;
  deleteRoomElement: (id: string) => Promise<boolean>;
  rotateRoomElement: (id: string) => Promise<void>;

  // Computed
  unassignedStudents: (allStudents: Student[]) => Student[];
  assignedStudentIds: Set<string>;

  // Presets
  applyPreset: (preset: LayoutPreset) => Promise<void>;

  // Refetch
  refetch: () => Promise<void>;
}

// camelCase settings patch — applied to the meta cache in onSuccess and mapped
// to the snake_case UpdateSeatingChart for the DB write.
type SeatingChartSettingsPatch = Partial<{
  name: string;
  snapEnabled: boolean;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
}>;

// Rollback contexts for the optimistic mutations (ADR-005 §4(a): snapshots are
// null-guarded in onError; §4(e): snapshots come from qc.getQueryData, never the
// component closure).
interface GroupsContext {
  previousGroups: SeatingGroup[] | undefined;
}

interface RoomElementsContext {
  previousRoomElements: RoomElement[] | undefined;
}

// Seating-chart server state lives in 3 per-table caches (meta / groups+seats /
// room_elements) keyed by queryKeys.seatingChart.*. The hook assembles them back
// into the SeatingChart blob consumers already use. Seating is a non-realtime
// domain (ADR-005 §6, CAP-4): freshness comes from onSettled invalidation only.
export function useSeatingChart(classroomId: string | null): UseSeatingChartReturn {
  const qc = useQueryClient();

  const metaQuery = useQuery<SeatingChart | null, Error>({
    queryKey: queryKeys.seatingChart.metaByClassroom(classroomId),
    enabled: !!classroomId,
    queryFn: async () => {
      if (!classroomId) return null;

      const data = unwrap(
        await supabase
          .from('seating_charts')
          .select('*')
          .eq('classroom_id', classroomId)
          .maybeSingle()
      );
      if (!data) return null;

      // Meta row only — groups/roomElements live in their own caches and are
      // composed into the blob by the useMemo below.
      return dbToSeatingChart(data, [], []);
    },
  });

  const chartId = metaQuery.data?.id ?? null;

  const groupsQuery = useQuery<SeatingGroup[], Error>({
    queryKey: queryKeys.seatingChart.groupsByChart(chartId),
    enabled: !!chartId,
    queryFn: async () => {
      if (!chartId) return [];

      const groupsData = unwrap(
        await supabase
          .from('seating_groups')
          .select('*')
          .eq('seating_chart_id', chartId)
          .order('letter', { ascending: true })
      );

      const groupIds = (groupsData ?? []).map((g) => g.id);
      let seatsData: DbSeatingSeat[] = [];
      if (groupIds.length > 0) {
        const seats = unwrap(
          await supabase
            .from('seating_seats')
            .select('*')
            .in('seating_group_id', groupIds)
            .order('position_in_group', { ascending: true })
        );
        seatsData = seats ?? [];
      }

      return (groupsData ?? []).map((g) => dbToSeatingGroup(g, seatsData));
    },
  });

  const roomElementsQuery = useQuery<RoomElement[], Error>({
    queryKey: queryKeys.seatingChart.roomElementsByChart(chartId),
    enabled: !!chartId,
    queryFn: async () => {
      if (!chartId) return [];

      const data = unwrap(
        await supabase.from('room_elements').select('*').eq('seating_chart_id', chartId)
      );
      return (data ?? []).map((e) => dbToRoomElement(e));
    },
  });

  // Blob assembly. structuralSharing (ADR-005 §1) keeps each cache entry
  // ref-stable, so group/element prop identities only change when their own
  // table data changes. Assemble only when ALL THREE caches are populated: a
  // child query that failed its initial load must not fabricate an
  // empty-groups/elements chart — the View's full-screen branch gates on
  // `error && !chart`, so a fabricated blob would mask the load failure.
  const chart = useMemo<SeatingChart | null>(() => {
    const meta = metaQuery.data;
    const groups = groupsQuery.data;
    const roomElements = roomElementsQuery.data;
    if (!meta || !groups || !roomElements) return null;
    return { ...meta, groups, roomElements };
  }, [metaQuery.data, groupsQuery.data, roomElementsQuery.data]);

  // .isLoading (= isPending && isFetching) on all three, NOT .isPending: every
  // query here is enabled-gated (meta on classroomId, children on chartId), and
  // a disabled query reports isPending: true / isFetching: false forever — with
  // .isPending a null classroomId (or a classroom with no chart) would pin the
  // spinner and never reach the chart=null → EmptyChartPrompt branch.
  const loading = metaQuery.isLoading || groupsQuery.isLoading || roomElementsQuery.isLoading;

  // Query (load) errors only — mutation failures surface via actionError below.
  const error = metaQuery.error ?? groupsQuery.error ?? roomElementsQuery.error ?? null;

  // ============================================
  // Chart operations
  // ============================================

  const createChartMutation = useMutation<SeatingChart, Error, string>({
    mutationFn: async (name) => {
      if (!classroomId) throw new Error('No classroom selected');

      const data = unwrap(
        await supabase
          .from('seating_charts')
          .insert({
            classroom_id: classroomId,
            name,
            snap_enabled: DEFAULT_SEATING_CHART_SETTINGS.snapEnabled,
            grid_size: DEFAULT_SEATING_CHART_SETTINGS.gridSize,
            canvas_width: DEFAULT_SEATING_CHART_SETTINGS.canvasWidth,
            canvas_height: DEFAULT_SEATING_CHART_SETTINGS.canvasHeight,
          })
          .select()
          .single()
      );
      return dbToSeatingChart(data, [], []);
    },
    // Seed all 3 caches synchronously (matches the old synchronous state write)
    // so the new chart renders without flashing EmptyChartPrompt before the
    // editor opens. Keys derive from the RETURNED row (newChart.classroomId),
    // not the closure classroomId, so a stale closure can't seed a foreign key.
    onSuccess: (newChart) => {
      // Cancel in-flight seating refetches before patching: a refetch dispatched
      // before this mutation committed would resolve with pre-mutation rows and
      // clobber the patch until the onSettled refetch converges. (The optimistic
      // mutations get the same protection from cancelQueries in onMutate.)
      void qc.cancelQueries({ queryKey: queryKeys.seatingChart.all });
      qc.setQueryData<SeatingGroup[]>(queryKeys.seatingChart.groupsByChart(newChart.id), []);
      qc.setQueryData<RoomElement[]>(queryKeys.seatingChart.roomElementsByChart(newChart.id), []);
      qc.setQueryData<SeatingChart | null>(
        queryKeys.seatingChart.metaByClassroom(newChart.classroomId),
        newChart
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.seatingChart.all }),
  });

  // mutateAsync is identity-stable; depending on it (not the whole mutation
  // result object) keeps each wrapper's identity from churning on mutation
  // state flips. Same pattern for every wrapper below.
  const { mutateAsync: createChartAsync } = createChartMutation;
  const createChart = useCallback(
    async (name = 'Seating Chart'): Promise<SeatingChart | null> => {
      if (!classroomId) return null;
      try {
        return await createChartAsync(name);
      } catch {
        // Surfaced via actionError; contract returns null on failure.
        return null;
      }
    },
    [classroomId, createChartAsync]
  );

  const updateSettingsMutation = useMutation<
    void,
    Error,
    {
      chartId: string;
      classroomId: string;
      updates: UpdateSeatingChart;
      settings: SeatingChartSettingsPatch;
    }
  >({
    mutationFn: async ({ chartId: id, updates }) => {
      unwrap(await supabase.from('seating_charts').update(updates).eq('id', id));
    },
    // Post-write patch reproducing the old `{ ...prev, ...settings }` state write:
    // invalidate-only would bounce the snap toggle / grid inputs for a refetch
    // RTT (the control flips back until the refetch lands).
    onSuccess: (_data, vars) => {
      void qc.cancelQueries({ queryKey: queryKeys.seatingChart.metaByClassroom(vars.classroomId) });
      qc.setQueryData<SeatingChart | null>(
        queryKeys.seatingChart.metaByClassroom(vars.classroomId),
        (prev) => (prev ? { ...prev, ...vars.settings } : prev)
      );
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.metaByClassroom(vars.classroomId) }),
  });

  const { mutateAsync: updateSettingsAsync } = updateSettingsMutation;
  const updateSettings = useCallback(
    async (settings: SeatingChartSettingsPatch) => {
      if (!chart) return;

      const updates: UpdateSeatingChart = {};
      if (settings.name !== undefined) updates.name = settings.name;
      if (settings.snapEnabled !== undefined) updates.snap_enabled = settings.snapEnabled;
      if (settings.gridSize !== undefined) updates.grid_size = settings.gridSize;
      if (settings.canvasWidth !== undefined) updates.canvas_width = settings.canvasWidth;
      if (settings.canvasHeight !== undefined) updates.canvas_height = settings.canvasHeight;

      try {
        await updateSettingsAsync({
          chartId: chart.id,
          classroomId: chart.classroomId,
          updates,
          settings,
        });
      } catch {
        // Surfaced via actionError.
      }
    },
    [chart, updateSettingsAsync]
  );

  const deleteChartMutation = useMutation<void, Error, { chartId: string; classroomId: string }>({
    mutationFn: async ({ chartId: id }) => {
      unwrap(await supabase.from('seating_charts').delete().eq('id', id));
    },
    // Post-write patch reproducing the old chart-to-null state write: the chart disappears
    // immediately instead of after the refetch RTT.
    onSuccess: (_data, vars) => {
      void qc.cancelQueries({ queryKey: queryKeys.seatingChart.metaByClassroom(vars.classroomId) });
      qc.setQueryData<SeatingChart | null>(
        queryKeys.seatingChart.metaByClassroom(vars.classroomId),
        null
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.seatingChart.all }),
  });

  const { mutateAsync: deleteChartAsync } = deleteChartMutation;
  const deleteChart = useCallback(async (): Promise<boolean> => {
    if (!chart) return false;
    try {
      await deleteChartAsync({ chartId: chart.id, classroomId: chart.classroomId });
      return true;
    } catch {
      // Surfaced via actionError.
      return false;
    }
  }, [chart, deleteChartAsync]);

  // ============================================
  // Group operations
  // ============================================

  const addGroupMutation = useMutation<
    SeatingGroup,
    Error,
    { chartId: string; letter: string; x: number; y: number }
  >({
    mutationFn: async ({ chartId: id, letter, x, y }) => {
      const data = unwrap(
        await supabase
          .from('seating_groups')
          .insert({
            seating_chart_id: id,
            letter,
            position_x: x,
            position_y: y,
            rotation: 0,
          })
          .select()
          .single()
      );

      // Seats are auto-created by trigger, fetch them. Deliberately NOT
      // unwrap(): the seat fetch is non-fatal — the group degrades to empty
      // seats on a transient failure and self-heals on the next refetch.
      const { data: seatsData } = await supabase
        .from('seating_seats')
        .select('*')
        .eq('seating_group_id', data.id)
        .order('position_in_group', { ascending: true });

      return dbToSeatingGroup(data, seatsData ?? []);
    },
    // Post-write append reproducing the old `[...groups, newGroup]` state write:
    // the new table shows up immediately, not one refetch RTT later.
    onSuccess: (newGroup, vars) => {
      void qc.cancelQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) });
      qc.setQueryData<SeatingGroup[]>(queryKeys.seatingChart.groupsByChart(vars.chartId), (prev) =>
        prev ? [...prev, newGroup] : [newGroup]
      );
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: addGroupAsync } = addGroupMutation;
  const addGroup = useCallback(
    async (x: number, y: number): Promise<SeatingGroup | null> => {
      if (!chart) return null;

      const letter = getNextGroupLetter(chart.groups);

      // Table group size is 160x160 (2x2 seats at 80px each)
      const GROUP_SIZE = 160;

      // Snap then clamp - snap when writing state, not just rendering
      const snap = (v: number) => Math.round(v / chart.gridSize) * chart.gridSize;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
      const clampedX = snap(clamp(x, 0, chart.canvasWidth - GROUP_SIZE));
      const clampedY = snap(clamp(y, 0, chart.canvasHeight - GROUP_SIZE));

      try {
        return await addGroupAsync({
          chartId: chart.id,
          letter,
          x: clampedX,
          y: clampedY,
        });
      } catch {
        // Surfaced via actionError.
        return null;
      }
    },
    [chart, addGroupAsync]
  );

  const moveGroupMutation = useMutation<
    void,
    Error,
    { chartId: string; groupId: string; x: number; y: number },
    GroupsContext
  >({
    mutationFn: async ({ groupId, x, y }) => {
      unwrap(
        await supabase
          .from('seating_groups')
          .update({ position_x: x, position_y: y })
          .eq('id', groupId)
      );
    },
    // Synchronous onMutate (no awaits before the patch): the Editor's drag-end
    // reconciliation must see the committed position on drop, otherwise the
    // pre-drag props win for a frame and the item snaps back (flicker).
    onMutate: ({ chartId: id, groupId, x, y }) => {
      const key = queryKeys.seatingChart.groupsByChart(id);
      void qc.cancelQueries({ queryKey: key });
      const previousGroups = qc.getQueryData<SeatingGroup[]>(key);
      qc.setQueryData<SeatingGroup[]>(key, (prev) =>
        prev ? prev.map((g) => (g.id === groupId ? { ...g, x, y } : g)) : prev
      );
      return { previousGroups };
    },
    onError: (_err, vars, context) => {
      if (context?.previousGroups !== undefined) {
        qc.setQueryData(queryKeys.seatingChart.groupsByChart(vars.chartId), context.previousGroups);
      }
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: moveGroupAsync } = moveGroupMutation;
  const moveGroup = useCallback(
    async (groupId: string, x: number, y: number) => {
      if (!chart) return;

      const group = chart.groups.find((g) => g.id === groupId);
      if (!group) return;

      // Table group size is 160x160 (2x2 seats at 80px each)
      const GROUP_SIZE = 160;

      // Snap then clamp - snap when writing state, not just rendering
      const snap = (v: number) => Math.round(v / chart.gridSize) * chart.gridSize;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
      const clampedX = snap(clamp(x, 0, chart.canvasWidth - GROUP_SIZE));
      const clampedY = snap(clamp(y, 0, chart.canvasHeight - GROUP_SIZE));

      try {
        await moveGroupAsync({
          chartId: chart.id,
          groupId,
          x: clampedX,
          y: clampedY,
        });
      } catch {
        // Rolled back in onError; surfaced via actionError.
      }
    },
    [chart, moveGroupAsync]
  );

  const deleteGroupMutation = useMutation<void, Error, { chartId: string; groupId: string }>({
    mutationFn: async ({ groupId }) => {
      unwrap(await supabase.from('seating_groups').delete().eq('id', groupId));
    },
    // Post-write filter reproducing the old `groups.filter(...)` state write.
    onSuccess: (_data, vars) => {
      void qc.cancelQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) });
      qc.setQueryData<SeatingGroup[]>(queryKeys.seatingChart.groupsByChart(vars.chartId), (prev) =>
        prev ? prev.filter((g) => g.id !== vars.groupId) : prev
      );
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: deleteGroupAsync } = deleteGroupMutation;
  const deleteGroup = useCallback(
    async (groupId: string): Promise<boolean> => {
      if (!chart) return false;
      try {
        await deleteGroupAsync({ chartId: chart.id, groupId });
        return true;
      } catch {
        // Surfaced via actionError.
        return false;
      }
    },
    [chart, deleteGroupAsync]
  );

  const rotateGroupMutation = useMutation<
    void,
    Error,
    { chartId: string; groupId: string; rotation: number }
  >({
    mutationFn: async ({ groupId, rotation }) => {
      unwrap(await supabase.from('seating_groups').update({ rotation }).eq('id', groupId));
    },
    // Post-write patch reproducing the old rotation state write:
    // invalidate-only loses a turn on rapid clicks (the second click would
    // compute from a stale cache during the refetch gap).
    onSuccess: (_data, vars) => {
      void qc.cancelQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) });
      qc.setQueryData<SeatingGroup[]>(queryKeys.seatingChart.groupsByChart(vars.chartId), (prev) =>
        prev
          ? prev.map((g) => (g.id === vars.groupId ? { ...g, rotation: vars.rotation } : g))
          : prev
      );
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: rotateGroupAsync } = rotateGroupMutation;
  const rotateGroup = useCallback(
    async (groupId: string) => {
      if (!chart) return;

      const group = chart.groups.find((g) => g.id === groupId);
      if (!group) return;

      const newRotation = (group.rotation + 90) % 360;

      try {
        await rotateGroupAsync({
          chartId: chart.id,
          groupId,
          rotation: newRotation,
        });
      } catch {
        // Surfaced via actionError.
      }
    },
    [chart, rotateGroupAsync]
  );

  // ============================================
  // Student assignment
  // ============================================

  const assignStudentMutation = useMutation<
    void,
    Error,
    { chartId: string; studentId: string; seatId: string; currentSeatId: string | null },
    GroupsContext
  >({
    // Single-transaction RPC (deferred #27): clear-then-set commits atomically;
    // the server clears by student + chart scope, so `currentSeatId` is a dead
    // input kept only to leave the mutation input type and wrapper untouched.
    // Errors flow through the unwrap helper, so `.code`/`details` survive.
    mutationFn: async ({ chartId: id, studentId, seatId }) => {
      unwrap(
        await supabase.rpc('seating_assign_student', {
          p_chart_id: id,
          p_seat_id: seatId,
          p_student_id: studentId,
        })
      );
    },
    // Synchronous patch for instant feedback (see moveGroup's onMutate note).
    onMutate: ({ chartId: id, studentId, seatId }) => {
      const key = queryKeys.seatingChart.groupsByChart(id);
      void qc.cancelQueries({ queryKey: key });
      const previousGroups = qc.getQueryData<SeatingGroup[]>(key);
      qc.setQueryData<SeatingGroup[]>(key, (prev) =>
        prev
          ? prev.map((g) => ({
              ...g,
              seats: g.seats.map((s) => {
                if (s.id === seatId) return { ...s, studentId };
                if (s.studentId === studentId) return { ...s, studentId: null };
                return s;
              }),
            }))
          : prev
      );
      return { previousGroups };
    },
    onError: (_err, vars, context) => {
      if (context?.previousGroups !== undefined) {
        qc.setQueryData(queryKeys.seatingChart.groupsByChart(vars.chartId), context.previousGroups);
      }
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: assignStudentAsync } = assignStudentMutation;
  const assignStudent = useCallback(
    async (studentId: string, seatId: string) => {
      if (!chart) return;

      // Find current seat to clear
      const currentSeat = chart.groups
        .flatMap((g) => g.seats)
        .find((s) => s.studentId === studentId);

      // Guard: if student is already in this seat, no-op
      if (currentSeat?.id === seatId) return;

      try {
        await assignStudentAsync({
          chartId: chart.id,
          studentId,
          seatId,
          currentSeatId: currentSeat?.id ?? null,
        });
      } catch {
        // Rolled back in onError; surfaced via actionError.
      }
    },
    [chart, assignStudentAsync]
  );

  const unassignStudentMutation = useMutation<
    void,
    Error,
    { chartId: string; seatId: string },
    GroupsContext
  >({
    mutationFn: async ({ seatId }) => {
      unwrap(await supabase.from('seating_seats').update({ student_id: null }).eq('id', seatId));
    },
    onMutate: ({ chartId: id, seatId }) => {
      const key = queryKeys.seatingChart.groupsByChart(id);
      void qc.cancelQueries({ queryKey: key });
      const previousGroups = qc.getQueryData<SeatingGroup[]>(key);
      qc.setQueryData<SeatingGroup[]>(key, (prev) =>
        prev
          ? prev.map((g) => ({
              ...g,
              seats: g.seats.map((s) => (s.id === seatId ? { ...s, studentId: null } : s)),
            }))
          : prev
      );
      return { previousGroups };
    },
    onError: (_err, vars, context) => {
      if (context?.previousGroups !== undefined) {
        qc.setQueryData(queryKeys.seatingChart.groupsByChart(vars.chartId), context.previousGroups);
      }
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: unassignStudentAsync } = unassignStudentMutation;
  const unassignStudent = useCallback(
    async (seatId: string) => {
      if (!chart) return;
      try {
        await unassignStudentAsync({ chartId: chart.id, seatId });
      } catch {
        // Rolled back in onError; surfaced via actionError.
      }
    },
    [chart, unassignStudentAsync]
  );

  const swapStudentsMutation = useMutation<
    void,
    Error,
    {
      chartId: string;
      seatId1: string;
      seatId2: string;
      student1Id: string | null;
      student2Id: string | null;
    },
    GroupsContext
  >({
    // Single-transaction RPC (deferred #27): the server reads both occupants
    // under FOR UPDATE and swaps atomically — no half-swap. `student1Id` /
    // `student2Id` are NOT sent (server reads truth) but stay in the input
    // type because onMutate's optimistic patch reads them.
    mutationFn: async ({ seatId1, seatId2 }) => {
      unwrap(
        await supabase.rpc('seating_swap_students', {
          p_seat_id_1: seatId1,
          p_seat_id_2: seatId2,
        })
      );
    },
    onMutate: ({ chartId: id, seatId1, seatId2, student1Id, student2Id }) => {
      const key = queryKeys.seatingChart.groupsByChart(id);
      void qc.cancelQueries({ queryKey: key });
      const previousGroups = qc.getQueryData<SeatingGroup[]>(key);
      qc.setQueryData<SeatingGroup[]>(key, (prev) =>
        prev
          ? prev.map((g) => ({
              ...g,
              seats: g.seats.map((s) => {
                if (s.id === seatId1) return { ...s, studentId: student2Id };
                if (s.id === seatId2) return { ...s, studentId: student1Id };
                return s;
              }),
            }))
          : prev
      );
      return { previousGroups };
    },
    onError: (_err, vars, context) => {
      if (context?.previousGroups !== undefined) {
        qc.setQueryData(queryKeys.seatingChart.groupsByChart(vars.chartId), context.previousGroups);
      }
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: swapStudentsAsync } = swapStudentsMutation;
  const swapStudents = useCallback(
    async (seatId1: string, seatId2: string) => {
      if (!chart) return;

      const allSeats = chart.groups.flatMap((g) => g.seats);
      const seat1 = allSeats.find((s) => s.id === seatId1);
      const seat2 = allSeats.find((s) => s.id === seatId2);

      if (!seat1 || !seat2) return;

      try {
        await swapStudentsAsync({
          chartId: chart.id,
          seatId1,
          seatId2,
          student1Id: seat1.studentId,
          student2Id: seat2.studentId,
        });
      } catch {
        // Rolled back in onError; surfaced via actionError.
      }
    },
    [chart, swapStudentsAsync]
  );

  const randomizeMutation = useMutation<
    void,
    Error,
    { chartId: string; seatIds: string[]; assignments: { seatId: string; studentId: string }[] },
    GroupsContext
  >({
    // Single-transaction RPC (deferred #27): clear-all + apply commit
    // atomically — no partial assignment. Wire format is snake_case keys
    // matching the server recordset ({seatId, studentId} → {seat_id,
    // student_id}). The server clears ALL chart seats itself, so `seatIds` is
    // a dead input kept only to leave the input type and wrapper untouched.
    mutationFn: async ({ chartId: id, assignments }) => {
      unwrap(
        await supabase.rpc('seating_randomize', {
          p_chart_id: id,
          p_assignments: assignments.map(({ seatId, studentId }) => ({
            seat_id: seatId,
            student_id: studentId,
          })),
        })
      );
    },
    onMutate: ({ chartId: id, assignments }) => {
      const key = queryKeys.seatingChart.groupsByChart(id);
      void qc.cancelQueries({ queryKey: key });
      const previousGroups = qc.getQueryData<SeatingGroup[]>(key);
      const assignmentBySeat = new Map(assignments.map((a) => [a.seatId, a.studentId]));
      qc.setQueryData<SeatingGroup[]>(key, (prev) =>
        prev
          ? prev.map((g) => ({
              ...g,
              seats: g.seats.map((s) => ({
                ...s,
                studentId: assignmentBySeat.get(s.id) ?? null,
              })),
            }))
          : prev
      );
      return { previousGroups };
    },
    onError: (_err, vars, context) => {
      if (context?.previousGroups !== undefined) {
        qc.setQueryData(queryKeys.seatingChart.groupsByChart(vars.chartId), context.previousGroups);
      }
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.groupsByChart(vars.chartId) }),
  });

  const { mutateAsync: randomizeAsync } = randomizeMutation;
  const randomizeAssignments = useCallback(
    async (students: Student[]) => {
      if (!chart) return;

      // Validate input
      if (!students || students.length === 0) return;

      // Get all available seats
      const allSeats = chart.groups.flatMap((g) => g.seats);
      if (allSeats.length === 0) return;

      // Shuffle students (Fisher-Yates)
      const shuffled = [...students];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const assignments: { seatId: string; studentId: string }[] = [];
      for (let i = 0; i < Math.min(shuffled.length, allSeats.length); i++) {
        assignments.push({ seatId: allSeats[i].id, studentId: shuffled[i].id });
      }

      try {
        await randomizeAsync({
          chartId: chart.id,
          seatIds: allSeats.map((s) => s.id),
          assignments,
        });
      } catch {
        // Rolled back in onError; surfaced via actionError.
      }
    },
    [chart, randomizeAsync]
  );

  // ============================================
  // Room elements
  // ============================================

  const addRoomElementMutation = useMutation<
    RoomElement,
    Error,
    {
      chartId: string;
      type: RoomElementType;
      label: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  >({
    mutationFn: async ({ chartId: id, type, label, x, y, width, height }) => {
      const data = unwrap(
        await supabase
          .from('room_elements')
          .insert({
            seating_chart_id: id,
            element_type: type,
            label,
            position_x: x,
            position_y: y,
            width,
            height,
            rotation: 0,
          })
          .select()
          .single()
      );
      return dbToRoomElement(data);
    },
    // Post-write append reproducing the old `[...roomElements, newElement]` state write.
    onSuccess: (newElement, vars) => {
      void qc.cancelQueries({
        queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId),
      });
      qc.setQueryData<RoomElement[]>(
        queryKeys.seatingChart.roomElementsByChart(vars.chartId),
        (prev) => (prev ? [...prev, newElement] : [newElement])
      );
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId) }),
  });

  const { mutateAsync: addRoomElementAsync } = addRoomElementMutation;
  const addRoomElement = useCallback(
    async (type: RoomElementType, x: number, y: number): Promise<RoomElement | null> => {
      if (!chart) return null;

      // Dimensions must be multiples of 40px grid
      const defaults: Record<RoomElementType, { width: number; height: number; label: string }> = {
        teacher_desk: { width: 120, height: 80, label: 'Teacher' },
        door: { width: 80, height: 40, label: 'Door' },
        window: { width: 80, height: 40, label: 'Window' },
        countertop: { width: 120, height: 80, label: 'Counter' },
        sink: { width: 40, height: 40, label: 'Sink' },
      };

      const config = defaults[type];

      // Snap then clamp - snap when writing state, not just rendering
      const snap = (v: number) => Math.round(v / chart.gridSize) * chart.gridSize;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
      const clampedX = snap(clamp(x, 0, chart.canvasWidth - config.width));
      const clampedY = snap(clamp(y, 0, chart.canvasHeight - config.height));

      try {
        return await addRoomElementAsync({
          chartId: chart.id,
          type,
          label: config.label,
          x: clampedX,
          y: clampedY,
          width: config.width,
          height: config.height,
        });
      } catch {
        // Surfaced via actionError.
        return null;
      }
    },
    [chart, addRoomElementAsync]
  );

  const moveRoomElementMutation = useMutation<
    void,
    Error,
    { chartId: string; id: string; x: number; y: number },
    RoomElementsContext
  >({
    mutationFn: async ({ id, x, y }) => {
      unwrap(
        await supabase.from('room_elements').update({ position_x: x, position_y: y }).eq('id', id)
      );
    },
    // Synchronous patch — same drag-end reconciliation seam as moveGroup.
    onMutate: ({ chartId: cid, id, x, y }) => {
      const key = queryKeys.seatingChart.roomElementsByChart(cid);
      void qc.cancelQueries({ queryKey: key });
      const previousRoomElements = qc.getQueryData<RoomElement[]>(key);
      qc.setQueryData<RoomElement[]>(key, (prev) =>
        prev ? prev.map((e) => (e.id === id ? { ...e, x, y } : e)) : prev
      );
      return { previousRoomElements };
    },
    onError: (_err, vars, context) => {
      if (context?.previousRoomElements !== undefined) {
        qc.setQueryData(
          queryKeys.seatingChart.roomElementsByChart(vars.chartId),
          context.previousRoomElements
        );
      }
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId) }),
  });

  const { mutateAsync: moveRoomElementAsync } = moveRoomElementMutation;
  const moveRoomElement = useCallback(
    async (id: string, x: number, y: number) => {
      if (!chart) return;

      const element = chart.roomElements.find((e) => e.id === id);
      if (!element) return;

      // For 90°/270° rotation, visual dimensions are swapped
      const rot = ((element.rotation % 360) + 360) % 360;
      const is90or270 = rot === 90 || rot === 270;
      const w = is90or270 ? element.height : element.width;
      const h = is90or270 ? element.width : element.height;

      // Snap then clamp - snap when writing state, not just rendering
      const snap = (v: number) => Math.round(v / chart.gridSize) * chart.gridSize;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
      const clampedX = snap(clamp(x, 0, chart.canvasWidth - w));
      const clampedY = snap(clamp(y, 0, chart.canvasHeight - h));

      try {
        await moveRoomElementAsync({
          chartId: chart.id,
          id,
          x: clampedX,
          y: clampedY,
        });
      } catch {
        // Rolled back in onError; surfaced via actionError.
      }
    },
    [chart, moveRoomElementAsync]
  );

  const resizeRoomElementMutation = useMutation<
    void,
    Error,
    { chartId: string; id: string; width: number; height: number; x: number; y: number },
    RoomElementsContext
  >({
    mutationFn: async ({ id, width, height, x, y }) => {
      unwrap(
        await supabase
          .from('room_elements')
          .update({ width, height, position_x: x, position_y: y })
          .eq('id', id)
      );
    },
    // Synchronous patch — same drag-end reconciliation seam as moveGroup.
    onMutate: ({ chartId: cid, id, width, height, x, y }) => {
      const key = queryKeys.seatingChart.roomElementsByChart(cid);
      void qc.cancelQueries({ queryKey: key });
      const previousRoomElements = qc.getQueryData<RoomElement[]>(key);
      qc.setQueryData<RoomElement[]>(key, (prev) =>
        prev ? prev.map((e) => (e.id === id ? { ...e, width, height, x, y } : e)) : prev
      );
      return { previousRoomElements };
    },
    onError: (_err, vars, context) => {
      if (context?.previousRoomElements !== undefined) {
        qc.setQueryData(
          queryKeys.seatingChart.roomElementsByChart(vars.chartId),
          context.previousRoomElements
        );
      }
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId) }),
  });

  const { mutateAsync: resizeRoomElementAsync } = resizeRoomElementMutation;
  const resizeRoomElement = useCallback(
    async (id: string, width: number, height: number, x?: number, y?: number) => {
      if (!chart) return;

      const element = chart.roomElements.find((e) => e.id === id);
      if (!element) return;

      // Snap then clamp - snap when writing state
      const snap = (v: number) => Math.round(v / chart.gridSize) * chart.gridSize;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

      // Snap width/height to grid, minimum 1 grid square
      const newWidth = snap(clamp(width, chart.gridSize, chart.canvasWidth));
      const newHeight = snap(clamp(height, chart.gridSize, chart.canvasHeight));

      // Snap x/y to grid
      const newX = snap(clamp(x ?? element.x, 0, chart.canvasWidth - newWidth));
      const newY = snap(clamp(y ?? element.y, 0, chart.canvasHeight - newHeight));

      try {
        await resizeRoomElementAsync({
          chartId: chart.id,
          id,
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY,
        });
      } catch {
        // Rolled back in onError; surfaced via actionError.
      }
    },
    [chart, resizeRoomElementAsync]
  );

  const deleteRoomElementMutation = useMutation<void, Error, { chartId: string; id: string }>({
    mutationFn: async ({ id }) => {
      unwrap(await supabase.from('room_elements').delete().eq('id', id));
    },
    // Post-write filter reproducing the old `roomElements.filter(...)` state write.
    onSuccess: (_data, vars) => {
      void qc.cancelQueries({
        queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId),
      });
      qc.setQueryData<RoomElement[]>(
        queryKeys.seatingChart.roomElementsByChart(vars.chartId),
        (prev) => (prev ? prev.filter((e) => e.id !== vars.id) : prev)
      );
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId) }),
  });

  const { mutateAsync: deleteRoomElementAsync } = deleteRoomElementMutation;
  const deleteRoomElement = useCallback(
    async (id: string): Promise<boolean> => {
      if (!chart) return false;
      try {
        await deleteRoomElementAsync({ chartId: chart.id, id });
        return true;
      } catch {
        // Surfaced via actionError.
        return false;
      }
    },
    [chart, deleteRoomElementAsync]
  );

  const rotateRoomElementMutation = useMutation<
    void,
    Error,
    {
      chartId: string;
      id: string;
      rotation: number;
      x: number;
      y: number;
      positionChanged: boolean;
    }
  >({
    mutationFn: async ({ id, rotation, x, y, positionChanged }) => {
      const updateData: { rotation: number; position_x?: number; position_y?: number } = {
        rotation,
      };
      if (positionChanged) {
        updateData.position_x = x;
        updateData.position_y = y;
      }

      unwrap(await supabase.from('room_elements').update(updateData).eq('id', id));
    },
    // Post-write patch reproducing the old rotation/position state write:
    // invalidate-only loses a turn on rapid clicks (stale-cache read during the
    // refetch gap).
    onSuccess: (_data, vars) => {
      void qc.cancelQueries({
        queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId),
      });
      qc.setQueryData<RoomElement[]>(
        queryKeys.seatingChart.roomElementsByChart(vars.chartId),
        (prev) =>
          prev
            ? prev.map((e) =>
                e.id === vars.id ? { ...e, rotation: vars.rotation, x: vars.x, y: vars.y } : e
              )
            : prev
      );
    },
    onSettled: (_data, _err, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.seatingChart.roomElementsByChart(vars.chartId) }),
  });

  const { mutateAsync: rotateRoomElementAsync } = rotateRoomElementMutation;
  const rotateRoomElement = useCallback(
    async (id: string) => {
      if (!chart) return;

      const element = chart.roomElements.find((e) => e.id === id);
      if (!element) return;

      const newRotation = (element.rotation + 90) % 360;

      // For 90°/270° rotation, visual dimensions are swapped
      const is90or270 = newRotation === 90 || newRotation === 270;
      const w = is90or270 ? element.height : element.width;
      const h = is90or270 ? element.width : element.height;

      // Snap then clamp - snap when writing state, not just rendering
      const snap = (v: number) => Math.round(v / chart.gridSize) * chart.gridSize;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
      const newX = snap(clamp(element.x, 0, chart.canvasWidth - w));
      const newY = snap(clamp(element.y, 0, chart.canvasHeight - h));
      const positionChanged = newX !== element.x || newY !== element.y;

      try {
        await rotateRoomElementAsync({
          chartId: chart.id,
          id,
          rotation: newRotation,
          x: newX,
          y: newY,
          positionChanged,
        });
      } catch {
        // Surfaced via actionError.
      }
    },
    [chart, rotateRoomElementAsync]
  );

  // ============================================
  // Presets
  // ============================================

  const applyPresetMutation = useMutation<void, Error, { chartId: string; preset: LayoutPreset }>({
    // Single-transaction RPC (deferred #27): settings update, group/element
    // deletes, and reinserts commit atomically — a mid-sequence failure rolls
    // back EVERYTHING (deletes included), so the chart can no longer be wiped
    // by a partial apply. The server validates the layout jsonb shape BEFORE
    // any write (#27 addendum, edge-5) and its RAISE messages surface via the
    // actionError toast; onSettled invalidation converges the caches either way.
    mutationFn: async ({ chartId: id, preset }) => {
      // layoutData is sent AS-IS (camelCase keys; the server maps them to
      // columns). The payload comes from the list cache, already Zod-validated
      // at the queryFn boundary (#15, implemented). The Json cast mirrors the
      // layout_data write boundary in useLayoutPresets (:86) — write-direction
      // serialization of already-validated data.
      unwrap(
        await supabase.rpc('seating_apply_preset', {
          p_chart_id: id,
          p_layout: preset.layoutData as unknown as Json,
        })
      );
    },
    // Invalidate-only refresh: the caches repopulate in the background while the
    // previous data stays mounted, so the Editor never unmounts (no loading
    // window, unlike the old fetchChart path which remounted it).
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.seatingChart.all }),
  });

  // isPending is needed for the re-entry guard, so this wrapper's identity does
  // churn on pending flips — required for correctness, unlike the others.
  const { mutateAsync: applyPresetAsync, isPending: applyPresetPending } = applyPresetMutation;
  const applyPreset = useCallback(
    async (preset: LayoutPreset) => {
      if (!chart) return;
      // Re-entry guard: the RPC is atomic and serializes on the chart row, so
      // interleaved corruption is off the table — the guard remains to avoid
      // firing a redundant second RPC (and its extra invalidation round) on a
      // double-click.
      if (applyPresetPending) return;
      try {
        await applyPresetAsync({ chartId: chart.id, preset });
      } catch {
        // Surfaced via actionError.
      }
    },
    [chart, applyPresetAsync, applyPresetPending]
  );

  // ============================================
  // Action errors (mutation failures → dismissible toast)
  // ============================================

  const allMutations: { error: Error | null; reset: () => void }[] = [
    createChartMutation,
    updateSettingsMutation,
    deleteChartMutation,
    addGroupMutation,
    moveGroupMutation,
    deleteGroupMutation,
    rotateGroupMutation,
    assignStudentMutation,
    unassignStudentMutation,
    swapStudentsMutation,
    randomizeMutation,
    addRoomElementMutation,
    moveRoomElementMutation,
    resizeRoomElementMutation,
    deleteRoomElementMutation,
    rotateRoomElementMutation,
    applyPresetMutation,
  ];

  // Derived from mutation state (never useState): first non-null mutation error.
  const actionError = allMutations.find((m) => m.error !== null)?.error ?? null;

  // Latest-ref so clearActionError stays identity-stable — ErrorToast's
  // auto-dismiss effect depends on onDismiss, and a per-render closure would
  // restart the toast timer on every unrelated re-render.
  const allMutationsRef = useRef(allMutations);
  useEffect(() => {
    allMutationsRef.current = allMutations;
  });

  const clearActionError = useCallback(() => {
    allMutationsRef.current.forEach((m) => {
      if (m.error !== null) m.reset();
    });
  }, []);

  // ============================================
  // Computed
  // ============================================

  // Computed: set of assigned student IDs
  const assignedStudentIds = useMemo(() => {
    if (!chart) return new Set<string>();
    const ids = new Set<string>();
    chart.groups.forEach((g) => {
      g.seats.forEach((s) => {
        if (s.studentId) ids.add(s.studentId);
      });
    });
    return ids;
  }, [chart]);

  // Function to get unassigned students
  const unassignedStudents = useCallback(
    (allStudents: Student[]) => {
      return allStudents.filter((s) => !assignedStudentIds.has(s.id));
    },
    [assignedStudentIds]
  );

  // Real refresh: invalidates all three seating caches (shared key prefix) and
  // resolves when the active refetches complete.
  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.seatingChart.all });
  }, [qc]);

  return {
    chart,
    loading,
    error,
    actionError,
    clearActionError,
    createChart,
    updateSettings,
    deleteChart,
    addGroup,
    moveGroup,
    deleteGroup,
    rotateGroup,
    assignStudent,
    unassignStudent,
    swapStudents,
    randomizeAssignments,
    addRoomElement,
    moveRoomElement,
    resizeRoomElement,
    deleteRoomElement,
    rotateRoomElement,
    unassignedStudents,
    assignedStudentIds,
    applyPreset,
    refetch,
  };
}
