// ============================================
// ClassPoints - Seating Chart Type Definitions
// ============================================

// View mode for dashboard display
export type ViewMode = 'alphabetical' | 'seating';

// Room element types (teacher desk, door)
export type RoomElementType = 'teacher_desk' | 'door';

// Seating chart settings
export interface SeatingChartSettings {
  snapEnabled: boolean;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
}

// Individual seat assignment within a group
export interface SeatAssignment {
  id: string;
  positionInGroup: 1 | 2 | 3 | 4; // 1=top-left, 2=top-right, 3=bottom-left, 4=bottom-right
  studentId: string | null;
}

// Table group (2 paired tables = 4 seats)
export interface SeatingGroup {
  id: string;
  letter: string; // A, B, C...
  x: number;
  y: number;
  rotation: number;
  seats: SeatAssignment[];
}

// Room element (teacher desk, door)
export interface RoomElement {
  id: string;
  type: RoomElementType;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// Main seating chart entity
export interface SeatingChart {
  id: string;
  classroomId: string;
  name: string;
  snapEnabled: boolean;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
  groups: SeatingGroup[];
  roomElements: RoomElement[];
  createdAt: number;
  updatedAt: number;
}

// Layout preset for saving/importing layouts
export interface LayoutPreset {
  id: string;
  userId: string;
  name: string;
  layoutData: LayoutPresetData;
  createdAt: number;
}

// Layout preset data (positions only, no student assignments)
export interface LayoutPresetData {
  groups: Array<{
    letter: string;
    x: number;
    y: number;
    rotation: number;
  }>;
  roomElements: Array<{
    type: RoomElementType;
    label?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>;
  settings: {
    snapEnabled: boolean;
    gridSize: number;
    canvasWidth: number;
    canvasHeight: number;
  };
}

// Database row types (snake_case, matching Supabase)
// Using index signature for compatibility with realtime subscription hook
export type DbSeatingChart = {
  id: string;
  classroom_id: string;
  name: string;
  snap_enabled: boolean;
  grid_size: number;
  canvas_width: number;
  canvas_height: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type DbSeatingGroup = {
  id: string;
  seating_chart_id: string;
  letter: string;
  position_x: number;
  position_y: number;
  rotation: number;
  created_at: string;
  [key: string]: unknown;
};

export type DbSeatingSeat = {
  id: string;
  seating_group_id: string;
  position_in_group: number;
  student_id: string | null;
  created_at: string;
  [key: string]: unknown;
};

export type DbRoomElement = {
  id: string;
  seating_chart_id: string;
  element_type: RoomElementType;
  label: string | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rotation: number;
  created_at: string;
  [key: string]: unknown;
};

export type DbLayoutPreset = {
  id: string;
  user_id: string;
  name: string;
  layout_data: unknown; // JSON from database, needs casting
  created_at: string;
  [key: string]: unknown;
};

// Helper functions for converting between DB and app types
export function dbToSeatingChart(
  chart: DbSeatingChart,
  groups: SeatingGroup[],
  roomElements: RoomElement[]
): SeatingChart {
  return {
    id: chart.id,
    classroomId: chart.classroom_id,
    name: chart.name,
    snapEnabled: chart.snap_enabled,
    gridSize: chart.grid_size,
    canvasWidth: chart.canvas_width,
    canvasHeight: chart.canvas_height,
    groups,
    roomElements,
    createdAt: new Date(chart.created_at).getTime(),
    updatedAt: new Date(chart.updated_at).getTime(),
  };
}

export function dbToSeatingGroup(group: DbSeatingGroup, seats: DbSeatingSeat[]): SeatingGroup {
  return {
    id: group.id,
    letter: group.letter,
    x: group.position_x,
    y: group.position_y,
    rotation: group.rotation,
    seats: seats
      .filter((s) => s.seating_group_id === group.id)
      .map((s) => ({
        id: s.id,
        positionInGroup: s.position_in_group as 1 | 2 | 3 | 4,
        studentId: s.student_id,
      })),
  };
}

export function dbToRoomElement(element: DbRoomElement): RoomElement {
  return {
    id: element.id,
    type: element.element_type,
    label: element.label ?? undefined,
    x: element.position_x,
    y: element.position_y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
  };
}

export function dbToLayoutPreset(preset: DbLayoutPreset): LayoutPreset {
  return {
    id: preset.id,
    userId: preset.user_id,
    name: preset.name,
    layoutData: preset.layout_data as LayoutPresetData,
    createdAt: new Date(preset.created_at).getTime(),
  };
}

// Default settings for new seating charts
export const DEFAULT_SEATING_CHART_SETTINGS: SeatingChartSettings = {
  snapEnabled: true,
  gridSize: 40,
  canvasWidth: 1600,
  canvasHeight: 800,
};

// Group colors for letter badges
export const GROUP_COLORS: Record<string, string> = {
  A: 'bg-blue-500',
  B: 'bg-green-500',
  C: 'bg-orange-500',
  D: 'bg-purple-500',
  E: 'bg-pink-500',
  F: 'bg-teal-500',
  G: 'bg-red-500',
  H: 'bg-indigo-500',
  I: 'bg-yellow-500',
  J: 'bg-cyan-500',
  K: 'bg-lime-500',
  L: 'bg-amber-500',
};

// Get the next available letter for a new group
export function getNextGroupLetter(existingGroups: SeatingGroup[]): string {
  const usedLetters = new Set(existingGroups.map((g) => g.letter));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const letter of alphabet) {
    if (!usedLetters.has(letter)) {
      return letter;
    }
  }
  return 'Z'; // Fallback (shouldn't happen with typical class sizes)
}

// Get group color class
export function getGroupColor(letter: string): string {
  return GROUP_COLORS[letter] || 'bg-gray-500';
}
