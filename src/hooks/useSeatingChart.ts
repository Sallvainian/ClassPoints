import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import type { Student } from '../types';
import type {
  SeatingChart,
  SeatingGroup,
  RoomElement,
  RoomElementType,
  DbSeatingChart,
  DbSeatingGroup,
  DbSeatingSeat,
  DbRoomElement,
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
  error: Error | null;

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
  deleteRoomElement: (id: string) => Promise<boolean>;
  rotateRoomElement: (id: string) => Promise<void>;

  // Computed
  unassignedStudents: (allStudents: Student[]) => Student[];
  assignedStudentIds: Set<string>;

  // Refetch
  refetch: () => Promise<void>;
}

export function useSeatingChart(classroomId: string | null): UseSeatingChartReturn {
  const [chart, setChart] = useState<SeatingChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch seating chart with all related data
  const fetchChart = useCallback(async () => {
    if (!classroomId) {
      setChart(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch the seating chart for this classroom
      const { data: chartData, error: chartError } = await supabase
        .from('seating_charts')
        .select('*')
        .eq('classroom_id', classroomId)
        .maybeSingle();

      if (chartError) {
        throw new Error(chartError.message);
      }

      if (!chartData) {
        setChart(null);
        setLoading(false);
        return;
      }

      // Fetch groups for this chart
      const { data: groupsData, error: groupsError } = await supabase
        .from('seating_groups')
        .select('*')
        .eq('seating_chart_id', chartData.id)
        .order('letter', { ascending: true });

      if (groupsError) {
        throw new Error(groupsError.message);
      }

      // Fetch all seats for these groups
      const groupIds = (groupsData || []).map((g) => g.id);
      let seatsData: DbSeatingSeat[] = [];
      if (groupIds.length > 0) {
        const { data: seats, error: seatsError } = await supabase
          .from('seating_seats')
          .select('*')
          .in('seating_group_id', groupIds)
          .order('position_in_group', { ascending: true });

        if (seatsError) {
          throw new Error(seatsError.message);
        }
        seatsData = seats || [];
      }

      // Fetch room elements
      const { data: elementsData, error: elementsError } = await supabase
        .from('room_elements')
        .select('*')
        .eq('seating_chart_id', chartData.id);

      if (elementsError) {
        throw new Error(elementsError.message);
      }

      // Convert DB types to app types
      const groups: SeatingGroup[] = (groupsData || []).map((g) =>
        dbToSeatingGroup(g as DbSeatingGroup, seatsData)
      );
      const roomElements: RoomElement[] = (elementsData || []).map((e) =>
        dbToRoomElement(e as DbRoomElement)
      );

      const seatingChart = dbToSeatingChart(chartData as DbSeatingChart, groups, roomElements);

      setChart(seatingChart);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch seating chart'));
      setChart(null);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  // Real-time subscriptions
  useRealtimeSubscription<DbSeatingChart>({
    table: 'seating_charts',
    filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
    onInsert: () => fetchChart(),
    onUpdate: () => fetchChart(),
    onDelete: () => setChart(null),
  });

  useRealtimeSubscription<DbSeatingGroup>({
    table: 'seating_groups',
    filter: chart?.id ? `seating_chart_id=eq.${chart.id}` : undefined,
    onInsert: () => fetchChart(),
    onUpdate: () => fetchChart(),
    onDelete: () => fetchChart(),
  });

  useRealtimeSubscription<DbSeatingSeat>({
    table: 'seating_seats',
    onInsert: () => fetchChart(),
    onUpdate: () => fetchChart(),
    onDelete: () => fetchChart(),
  });

  useRealtimeSubscription<DbRoomElement>({
    table: 'room_elements',
    filter: chart?.id ? `seating_chart_id=eq.${chart.id}` : undefined,
    onInsert: () => fetchChart(),
    onUpdate: () => fetchChart(),
    onDelete: () => fetchChart(),
  });

  // Create a new seating chart
  const createChart = useCallback(
    async (name = 'Seating Chart'): Promise<SeatingChart | null> => {
      if (!classroomId) return null;

      try {
        const { data, error: insertError } = await supabase
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
          .single();

        if (insertError) throw new Error(insertError.message);

        const newChart: SeatingChart = {
          id: data.id,
          classroomId: data.classroom_id,
          name: data.name,
          snapEnabled: data.snap_enabled,
          gridSize: data.grid_size,
          canvasWidth: data.canvas_width,
          canvasHeight: data.canvas_height,
          groups: [],
          roomElements: [],
          createdAt: new Date(data.created_at).getTime(),
          updatedAt: new Date(data.updated_at).getTime(),
        };

        setChart(newChart);
        return newChart;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create seating chart'));
        return null;
      }
    },
    [classroomId]
  );

  // Update chart settings
  const updateSettings = useCallback(
    async (
      settings: Partial<{
        name: string;
        snapEnabled: boolean;
        gridSize: number;
        canvasWidth: number;
        canvasHeight: number;
      }>
    ) => {
      if (!chart) return;

      const updates: Record<string, unknown> = {};
      if (settings.name !== undefined) updates.name = settings.name;
      if (settings.snapEnabled !== undefined) updates.snap_enabled = settings.snapEnabled;
      if (settings.gridSize !== undefined) updates.grid_size = settings.gridSize;
      if (settings.canvasWidth !== undefined) updates.canvas_width = settings.canvasWidth;
      if (settings.canvasHeight !== undefined) updates.canvas_height = settings.canvasHeight;

      const { error: updateError } = await supabase
        .from('seating_charts')
        .update(updates)
        .eq('id', chart.id);

      if (updateError) {
        setError(new Error(updateError.message));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              ...settings,
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

  // Delete chart
  const deleteChart = useCallback(async (): Promise<boolean> => {
    if (!chart) return false;

    const { error: deleteError } = await supabase
      .from('seating_charts')
      .delete()
      .eq('id', chart.id);

    if (deleteError) {
      setError(new Error(deleteError.message));
      return false;
    }

    setChart(null);
    return true;
  }, [chart]);

  // Add a new group
  const addGroup = useCallback(
    async (x: number, y: number): Promise<SeatingGroup | null> => {
      if (!chart) return null;

      const letter = getNextGroupLetter(chart.groups);

      try {
        const { data, error: insertError } = await supabase
          .from('seating_groups')
          .insert({
            seating_chart_id: chart.id,
            letter,
            position_x: x,
            position_y: y,
            rotation: 0,
          })
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);

        // Seats are auto-created by trigger, fetch them
        const { data: seatsData } = await supabase
          .from('seating_seats')
          .select('*')
          .eq('seating_group_id', data.id)
          .order('position_in_group', { ascending: true });

        const newGroup: SeatingGroup = {
          id: data.id,
          letter: data.letter,
          x: data.position_x,
          y: data.position_y,
          rotation: data.rotation,
          seats: (seatsData || []).map((s) => ({
            id: s.id,
            positionInGroup: s.position_in_group as 1 | 2 | 3 | 4,
            studentId: s.student_id,
          })),
        };

        // Optimistic update
        setChart((prev) =>
          prev
            ? {
                ...prev,
                groups: [...prev.groups, newGroup],
                updatedAt: Date.now(),
              }
            : null
        );

        return newGroup;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to add group'));
        return null;
      }
    },
    [chart]
  );

  // Move a group
  const moveGroup = useCallback(
    async (groupId: string, x: number, y: number) => {
      if (!chart) return;

      const { error: updateError } = await supabase
        .from('seating_groups')
        .update({ position_x: x, position_y: y })
        .eq('id', groupId);

      if (updateError) {
        setError(new Error(updateError.message));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) => (g.id === groupId ? { ...g, x, y } : g)),
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

  // Delete a group
  const deleteGroup = useCallback(
    async (groupId: string): Promise<boolean> => {
      if (!chart) return false;

      const { error: deleteError } = await supabase
        .from('seating_groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) {
        setError(new Error(deleteError.message));
        return false;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.filter((g) => g.id !== groupId),
              updatedAt: Date.now(),
            }
          : null
      );

      return true;
    },
    [chart]
  );

  // Rotate a group by 90 degrees
  const rotateGroup = useCallback(
    async (groupId: string) => {
      if (!chart) return;

      const group = chart.groups.find((g) => g.id === groupId);
      if (!group) return;

      const newRotation = (group.rotation + 90) % 360;

      const { error: updateError } = await supabase
        .from('seating_groups')
        .update({ rotation: newRotation })
        .eq('id', groupId);

      if (updateError) {
        setError(new Error(updateError.message));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) =>
                g.id === groupId ? { ...g, rotation: newRotation } : g
              ),
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

  // Assign a student to a seat
  const assignStudent = useCallback(
    async (studentId: string, seatId: string) => {
      if (!chart) return;

      // First, unassign this student from any other seat
      const currentSeat = chart.groups
        .flatMap((g) => g.seats)
        .find((s) => s.studentId === studentId);

      if (currentSeat) {
        await supabase.from('seating_seats').update({ student_id: null }).eq('id', currentSeat.id);
      }

      // Then assign to the new seat
      const { error: updateError } = await supabase
        .from('seating_seats')
        .update({ student_id: studentId })
        .eq('id', seatId);

      if (updateError) {
        setError(new Error(updateError.message));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) => ({
                ...g,
                seats: g.seats.map((s) => {
                  if (s.id === seatId) return { ...s, studentId };
                  if (s.studentId === studentId) return { ...s, studentId: null };
                  return s;
                }),
              })),
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

  // Unassign a student from a seat
  const unassignStudent = useCallback(
    async (seatId: string) => {
      if (!chart) return;

      const { error: updateError } = await supabase
        .from('seating_seats')
        .update({ student_id: null })
        .eq('id', seatId);

      if (updateError) {
        setError(new Error(updateError.message));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) => ({
                ...g,
                seats: g.seats.map((s) => (s.id === seatId ? { ...s, studentId: null } : s)),
              })),
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

  // Swap students between two seats
  const swapStudents = useCallback(
    async (seatId1: string, seatId2: string) => {
      if (!chart) return;

      const allSeats = chart.groups.flatMap((g) => g.seats);
      const seat1 = allSeats.find((s) => s.id === seatId1);
      const seat2 = allSeats.find((s) => s.id === seatId2);

      if (!seat1 || !seat2) return;

      // Swap in database
      const { error: error1 } = await supabase
        .from('seating_seats')
        .update({ student_id: seat2.studentId })
        .eq('id', seatId1);

      const { error: error2 } = await supabase
        .from('seating_seats')
        .update({ student_id: seat1.studentId })
        .eq('id', seatId2);

      if (error1 || error2) {
        setError(new Error('Failed to swap students'));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) => ({
                ...g,
                seats: g.seats.map((s) => {
                  if (s.id === seatId1) return { ...s, studentId: seat2.studentId };
                  if (s.id === seatId2) return { ...s, studentId: seat1.studentId };
                  return s;
                }),
              })),
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

  // Randomize student assignments
  const randomizeAssignments = useCallback(
    async (students: Student[]) => {
      if (!chart) return;

      // Get all available seats
      const allSeats = chart.groups.flatMap((g) => g.seats);

      // Shuffle students (Fisher-Yates)
      const shuffled = [...students];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Clear all seats first
      for (const seat of allSeats) {
        await supabase.from('seating_seats').update({ student_id: null }).eq('id', seat.id);
      }

      // Assign shuffled students to seats
      const assignments: Array<{ seatId: string; studentId: string }> = [];
      for (let i = 0; i < Math.min(shuffled.length, allSeats.length); i++) {
        await supabase
          .from('seating_seats')
          .update({ student_id: shuffled[i].id })
          .eq('id', allSeats[i].id);
        assignments.push({ seatId: allSeats[i].id, studentId: shuffled[i].id });
      }

      // Refetch to get accurate state
      await fetchChart();
    },
    [chart, fetchChart]
  );

  // Add a room element
  const addRoomElement = useCallback(
    async (type: RoomElementType, x: number, y: number): Promise<RoomElement | null> => {
      if (!chart) return null;

      const defaults = {
        teacher_desk: { width: 140, height: 70, label: 'Teacher' },
        door: { width: 60, height: 20, label: 'Door' },
      };

      const config = defaults[type];

      try {
        const { data, error: insertError } = await supabase
          .from('room_elements')
          .insert({
            seating_chart_id: chart.id,
            element_type: type,
            label: config.label,
            position_x: x,
            position_y: y,
            width: config.width,
            height: config.height,
            rotation: 0,
          })
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);

        const newElement: RoomElement = {
          id: data.id,
          type: data.element_type,
          label: data.label ?? undefined,
          x: data.position_x,
          y: data.position_y,
          width: data.width,
          height: data.height,
          rotation: data.rotation,
        };

        // Optimistic update
        setChart((prev) =>
          prev
            ? {
                ...prev,
                roomElements: [...prev.roomElements, newElement],
                updatedAt: Date.now(),
              }
            : null
        );

        return newElement;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to add room element'));
        return null;
      }
    },
    [chart]
  );

  // Move a room element
  const moveRoomElement = useCallback(
    async (id: string, x: number, y: number) => {
      if (!chart) return;

      const { error: updateError } = await supabase
        .from('room_elements')
        .update({ position_x: x, position_y: y })
        .eq('id', id);

      if (updateError) {
        setError(new Error(updateError.message));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              roomElements: prev.roomElements.map((e) => (e.id === id ? { ...e, x, y } : e)),
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

  // Delete a room element
  const deleteRoomElement = useCallback(
    async (id: string): Promise<boolean> => {
      if (!chart) return false;

      const { error: deleteError } = await supabase.from('room_elements').delete().eq('id', id);

      if (deleteError) {
        setError(new Error(deleteError.message));
        return false;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              roomElements: prev.roomElements.filter((e) => e.id !== id),
              updatedAt: Date.now(),
            }
          : null
      );

      return true;
    },
    [chart]
  );

  // Rotate a room element by 90 degrees
  const rotateRoomElement = useCallback(
    async (id: string) => {
      if (!chart) return;

      const element = chart.roomElements.find((e) => e.id === id);
      if (!element) return;

      const newRotation = (element.rotation + 90) % 360;

      const { error: updateError } = await supabase
        .from('room_elements')
        .update({ rotation: newRotation })
        .eq('id', id);

      if (updateError) {
        setError(new Error(updateError.message));
        return;
      }

      // Optimistic update
      setChart((prev) =>
        prev
          ? {
              ...prev,
              roomElements: prev.roomElements.map((e) =>
                e.id === id ? { ...e, rotation: newRotation } : e
              ),
              updatedAt: Date.now(),
            }
          : null
      );
    },
    [chart]
  );

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

  return {
    chart,
    loading,
    error,
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
    deleteRoomElement,
    rotateRoomElement,
    unassignedStudents,
    assignedStudentIds,
    refetch: fetchChart,
  };
}
