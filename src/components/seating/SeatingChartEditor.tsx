import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  pointerWithin,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Student } from '../../types';
import type {
  SeatingChart,
  SeatingGroup,
  RoomElement,
  RoomElementType,
} from '../../types/seatingChart';
import { TableGroup } from './TableGroup';
import { RoomElementDisplay } from './RoomElementDisplay';
import { Button } from '../ui/Button';

interface SeatingChartEditorProps {
  chart: SeatingChart;
  students: Student[];
  onClose: () => void;
  onAddGroup: (x: number, y: number) => Promise<SeatingGroup | null>;
  onMoveGroup: (groupId: string, x: number, y: number) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<boolean>;
  onRotateGroup: (groupId: string) => Promise<void>;
  onAssignStudent: (studentId: string, seatId: string) => Promise<void>;
  onUnassignStudent: (seatId: string) => Promise<void>;
  onSwapStudents: (seatId1: string, seatId2: string) => Promise<void>;
  onRandomize: () => Promise<void>;
  onAddRoomElement: (type: RoomElementType, x: number, y: number) => Promise<RoomElement | null>;
  onMoveRoomElement: (id: string, x: number, y: number) => Promise<void>;
  onDeleteRoomElement: (id: string) => Promise<boolean>;
  onRotateRoomElement: (id: string) => Promise<void>;
  onUpdateSettings: (
    settings: Partial<{
      name: string;
      snapEnabled: boolean;
      gridSize: number;
      canvasWidth: number;
      canvasHeight: number;
    }>
  ) => Promise<void>;
  onSavePreset: (name: string) => Promise<void>;
}

// Draggable student card for unassigned students panel
interface DraggableStudentProps {
  student: Student;
}

function DraggableStudent({ student }: DraggableStudentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { type: 'student', studentId: student.id },
  });

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 cursor-grab hover:bg-gray-50 transition-colors"
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: student.avatarColor || '#6B7280' }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-sm text-gray-700">{student.name}</span>
    </div>
  );
}

// Draggable table group
interface DraggableGroupProps {
  group: SeatingGroup;
  students: Map<string, Student>;
  isSelected: boolean;
  onSelect: () => void;
  snapToGrid: (value: number) => number;
}

function DraggableGroup({
  group,
  students,
  isSelected,
  onSelect,
  snapToGrid,
}: DraggableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `group-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  // Track pending position to prevent flicker on drag end
  const pendingPos = useRef<{ x: number; y: number } | null>(null);

  // Calculate the actual position including any drag offset
  let displayX: number;
  let displayY: number;

  if (isDragging && transform) {
    displayX = snapToGrid(group.x + transform.x);
    displayY = snapToGrid(group.y + transform.y);
    pendingPos.current = { x: displayX, y: displayY };
  } else if (
    pendingPos.current &&
    (pendingPos.current.x !== group.x || pendingPos.current.y !== group.y)
  ) {
    // Use pending position until props catch up
    displayX = pendingPos.current.x;
    displayY = pendingPos.current.y;
  } else {
    displayX = group.x;
    displayY = group.y;
    pendingPos.current = null;
  }

  // Clear pending position when props match
  useLayoutEffect(() => {
    if (
      pendingPos.current &&
      pendingPos.current.x === group.x &&
      pendingPos.current.y === group.y
    ) {
      pendingPos.current = null;
    }
  }, [group.x, group.y]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: displayX,
    top: displayY,
    zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg opacity-80' : ''}
    >
      <TableGroup
        group={group}
        students={students}
        isSelected={isSelected}
        onSelect={onSelect}
        isEditing
      />
    </div>
  );
}

// Draggable room element
interface DraggableRoomElementProps {
  element: RoomElement;
  isSelected: boolean;
  onSelect: () => void;
  onRotate: () => void;
  snapToGrid: (value: number) => number;
}

function DraggableRoomElement({
  element,
  isSelected,
  onSelect,
  onRotate,
  snapToGrid,
}: DraggableRoomElementProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `room-${element.id}`,
    data: { type: 'room-element', elementId: element.id },
  });

  // Track pending position to prevent flicker on drag end
  const pendingPos = useRef<{ x: number; y: number } | null>(null);

  // Check if element is rotated 90 or 270 degrees (portrait orientation)
  const isPortrait = element.rotation === 90 || element.rotation === 270;

  // Calculate the actual position including any drag offset
  let displayX: number;
  let displayY: number;

  if (isDragging && transform) {
    displayX = snapToGrid(element.x + transform.x);
    displayY = snapToGrid(element.y + transform.y);
    pendingPos.current = { x: displayX, y: displayY };
  } else if (
    pendingPos.current &&
    (pendingPos.current.x !== element.x || pendingPos.current.y !== element.y)
  ) {
    // Use pending position until props catch up
    displayX = pendingPos.current.x;
    displayY = pendingPos.current.y;
  } else {
    displayX = element.x;
    displayY = element.y;
    pendingPos.current = null;
  }

  // Clear pending position when props match
  useLayoutEffect(() => {
    if (
      pendingPos.current &&
      pendingPos.current.x === element.x &&
      pendingPos.current.y === element.y
    ) {
      pendingPos.current = null;
    }
  }, [element.x, element.y]);

  // When rotated 90/270, we need to offset the position because CSS rotation happens around center
  const offsetX = isPortrait ? (element.width - element.height) / 2 : 0;
  const offsetY = isPortrait ? (element.height - element.width) / 2 : 0;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: displayX + offsetX,
    top: displayY + offsetY,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: isDragging ? 1000 : isSelected ? 100 : 2,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'ring-2 ring-blue-500 ring-offset-2 rounded opacity-80' : ''}
    >
      <RoomElementDisplay
        element={element}
        isSelected={isSelected}
        onSelect={onSelect}
        onRotate={onRotate}
        isEditing
        skipRotation
      />
    </div>
  );
}

export function SeatingChartEditor({
  chart,
  students,
  onClose,
  onAddGroup,
  onMoveGroup,
  onDeleteGroup,
  onRotateGroup,
  onAssignStudent,
  onUnassignStudent: _onUnassignStudent,
  onSwapStudents: _onSwapStudents,
  onRandomize,
  onAddRoomElement,
  onMoveRoomElement,
  onDeleteRoomElement,
  onRotateRoomElement,
  onUpdateSettings,
  onSavePreset,
}: SeatingChartEditorProps) {
  // Reserved for future: right-click to unassign, drag-to-swap
  void _onUnassignStudent;
  void _onSwapStudents;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [addingRoomElement, setAddingRoomElement] = useState<RoomElementType | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Element size defaults for preview
  const elementSizes: Record<RoomElementType | 'group', { width: number; height: number }> = {
    teacher_desk: { width: 120, height: 80 },
    door: { width: 80, height: 40 },
    window: { width: 80, height: 40 },
    countertop: { width: 120, height: 80 },
    sink: { width: 40, height: 40 },
    group: { width: 160, height: 160 },
  };

  // Student map for quick lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Unassigned students
  const unassignedStudents = useMemo(() => {
    const assignedIds = new Set<string>();
    chart.groups.forEach((g) => {
      g.seats.forEach((s) => {
        if (s.studentId) assignedIds.add(s.studentId);
      });
    });
    return students.filter((s) => !assignedIds.has(s.id));
  }, [chart.groups, students]);

  // Track Alt key for disabling snap and R key for rotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }
      // R key to rotate while dragging or when selected
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (draggingType === 'group' && draggingId) {
          onRotateGroup(draggingId);
        } else if (draggingType === 'room-element' && draggingId) {
          onRotateRoomElement(draggingId);
        } else if (selectedGroupId) {
          onRotateGroup(selectedGroupId);
        } else if (selectedElementId) {
          onRotateRoomElement(selectedElementId);
        }
      }
      // Delete/Backspace/D to delete while dragging or when selected
      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'd' || e.key === 'D') {
        // Check if we're dragging something
        if (draggingType === 'group' && draggingId) {
          e.preventDefault();
          onDeleteGroup(draggingId);
          setDraggingType(null);
          setDraggingId(null);
        } else if (draggingType === 'room-element' && draggingId) {
          e.preventDefault();
          onDeleteRoomElement(draggingId);
          setDraggingType(null);
          setDraggingId(null);
        } else if (selectedGroupId) {
          e.preventDefault();
          onDeleteGroup(selectedGroupId);
          setSelectedGroupId(null);
        } else if (selectedElementId) {
          e.preventDefault();
          onDeleteRoomElement(selectedElementId);
          setSelectedElementId(null);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedGroupId,
    selectedElementId,
    draggingType,
    draggingId,
    onDeleteGroup,
    onDeleteRoomElement,
    onRotateGroup,
    onRotateRoomElement,
  ]);

  // Snap to grid helper
  const snapToGrid = useCallback(
    (value: number): number => {
      if (!chart.snapEnabled || isAltPressed) return value;
      return Math.round(value / chart.gridSize) * chart.gridSize;
    },
    [chart.snapEnabled, chart.gridSize, isAltPressed]
  );

  // Handle canvas mouse move for preview
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isAddingGroup && !addingRoomElement) {
        if (previewPos) setPreviewPos(null);
        return;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = snapToGrid(e.clientX - rect.left);
      const y = snapToGrid(e.clientY - rect.top);

      setPreviewPos({ x, y });
    },
    [isAddingGroup, addingRoomElement, snapToGrid, previewPos]
  );

  // Handle canvas mouse leave - clear preview
  const handleCanvasMouseLeave = useCallback(() => {
    setPreviewPos(null);
  }, []);

  // Handle canvas click for adding items
  const handleCanvasClick = useCallback(async () => {
    if (!isAddingGroup && !addingRoomElement) {
      // Clear selections
      setSelectedGroupId(null);
      setSelectedElementId(null);
      return;
    }

    if (!previewPos) return;

    const { x, y } = previewPos;

    if (addingRoomElement) {
      await onAddRoomElement(addingRoomElement, x, y);
      setAddingRoomElement(null);
    } else if (isAddingGroup) {
      await onAddGroup(x, y);
      setIsAddingGroup(false);
    }

    setPreviewPos(null);
  }, [isAddingGroup, addingRoomElement, previewPos, onAddGroup, onAddRoomElement]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    setDraggingType(data?.type || null);
    setDraggingId(data?.groupId || data?.elementId || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const data = active.data.current;

    setDraggingType(null);
    setDraggingId(null);

    // Handle student dropped on seat
    if (data?.type === 'student' && over) {
      const overId = String(over.id);
      if (overId.startsWith('seat-')) {
        const seatId = overId.replace('seat-', '');
        await onAssignStudent(data.studentId, seatId);
      }
      return;
    }

    // Handle group movement
    if (data?.type === 'group') {
      const group = chart.groups.find((g) => g.id === data.groupId);
      if (group) {
        const newX = snapToGrid(group.x + delta.x);
        const newY = snapToGrid(group.y + delta.y);
        await onMoveGroup(data.groupId, newX, newY);
      }
      return;
    }

    // Handle room element movement
    if (data?.type === 'room-element') {
      const element = chart.roomElements.find((e) => e.id === data.elementId);
      if (element) {
        const newX = snapToGrid(element.x + delta.x);
        const newY = snapToGrid(element.y + delta.y);
        await onMoveRoomElement(data.elementId, newX, newY);
      }
    }
  };

  // Handle save preset
  const handleSavePreset = async () => {
    if (presetName.trim()) {
      await onSavePreset(presetName.trim());
      setPresetName('');
      setShowPresetInput(false);
    }
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onClose} variant="ghost" size="sm">
              ← Back
            </Button>
            <h2 className="text-lg font-semibold text-gray-800">Edit Seating Chart</h2>
          </div>
          <div className="flex items-center gap-2">
            {showPresetInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="px-2 py-1 border rounded text-sm"
                  autoFocus
                />
                <Button onClick={handleSavePreset} variant="primary" size="sm">
                  Save
                </Button>
                <Button onClick={() => setShowPresetInput(false)} variant="ghost" size="sm">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowPresetInput(true)} variant="secondary" size="sm">
                Save as Preset
              </Button>
            )}
            <Button onClick={onClose} variant="primary" size="sm">
              Done
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white border-b px-4 py-2 flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              setIsAddingGroup(!isAddingGroup);
              setAddingRoomElement(null);
            }}
            variant={isAddingGroup ? 'primary' : 'secondary'}
            size="sm"
          >
            {isAddingGroup ? 'Click to place...' : '+ Add Table Group'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'teacher_desk' ? null : 'teacher_desk');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'teacher_desk' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'teacher_desk' ? 'Click to place...' : '+ Teacher Desk'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'door' ? null : 'door');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'door' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'door' ? 'Click to place...' : '+ Door'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'window' ? null : 'window');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'window' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'window' ? 'Click to place...' : '+ Window'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'countertop' ? null : 'countertop');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'countertop' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'countertop' ? 'Click to place...' : '+ Counter'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'sink' ? null : 'sink');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'sink' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'sink' ? 'Click to place...' : '+ Sink'}
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <Button
            onClick={() => onUpdateSettings({ snapEnabled: !chart.snapEnabled })}
            variant={chart.snapEnabled ? 'primary' : 'secondary'}
            size="sm"
          >
            Snap: {chart.snapEnabled ? 'ON' : 'OFF'}
          </Button>

          <Button onClick={onRandomize} variant="secondary" size="sm">
            Randomize Students
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          {/* Canvas size controls */}
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span>Size:</span>
            <Button
              onClick={() =>
                onUpdateSettings({ canvasWidth: Math.max(800, chart.canvasWidth - 200) })
              }
              variant="ghost"
              size="sm"
              className="px-2"
            >
              -W
            </Button>
            <span>
              {chart.canvasWidth}×{chart.canvasHeight}
            </span>
            <Button
              onClick={() => onUpdateSettings({ canvasWidth: chart.canvasWidth + 200 })}
              variant="ghost"
              size="sm"
              className="px-2"
            >
              +W
            </Button>
            <Button
              onClick={() =>
                onUpdateSettings({ canvasHeight: Math.max(400, chart.canvasHeight - 200) })
              }
              variant="ghost"
              size="sm"
              className="px-2"
            >
              -H
            </Button>
            <Button
              onClick={() => onUpdateSettings({ canvasHeight: chart.canvasHeight + 200 })}
              variant="ghost"
              size="sm"
              className="px-2"
            >
              +H
            </Button>
          </div>

          {selectedGroupId && (
            <>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <Button
                onClick={() => {
                  onRotateGroup(selectedGroupId);
                }}
                variant="secondary"
                size="sm"
              >
                Rotate Group
              </Button>
              <Button
                onClick={() => {
                  onDeleteGroup(selectedGroupId);
                  setSelectedGroupId(null);
                }}
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700"
              >
                Delete Group
              </Button>
            </>
          )}

          {selectedElementId && (
            <>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <Button
                onClick={() => onRotateRoomElement(selectedElementId)}
                variant="secondary"
                size="sm"
              >
                Rotate Element
              </Button>
              <Button
                onClick={() => {
                  onDeleteRoomElement(selectedElementId);
                  setSelectedElementId(null);
                }}
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700"
              >
                Delete Element
              </Button>
            </>
          )}
        </div>

        {/* Help text */}
        <div className="px-4 py-1 text-xs text-gray-500 bg-gray-50 border-b">
          Drag to reposition • R to rotate • Alt to disable snap • Delete to remove • Double-click
          elements to rotate
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="inline-flex gap-4">
            {/* Canvas */}
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              className={`relative border-2 rounded-lg bg-white flex-shrink-0 ${
                isAddingGroup || addingRoomElement
                  ? 'cursor-crosshair border-blue-400'
                  : 'border-gray-200'
              }`}
              style={{
                width: chart.canvasWidth,
                height: chart.canvasHeight,
                backgroundImage: chart.snapEnabled
                  ? `
                    linear-gradient(to right, #f0f0f0 1px, transparent 1px),
                    linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
                  `
                  : undefined,
                backgroundSize: chart.snapEnabled
                  ? `${chart.gridSize}px ${chart.gridSize}px`
                  : undefined,
              }}
            >
              {/* Table Groups */}
              {chart.groups.map((group) => (
                <DraggableGroup
                  key={group.id}
                  group={group}
                  students={studentMap}
                  isSelected={selectedGroupId === group.id}
                  onSelect={() => {
                    setSelectedGroupId(group.id);
                    setSelectedElementId(null);
                  }}
                  snapToGrid={snapToGrid}
                />
              ))}

              {/* Room Elements */}
              {chart.roomElements.map((element) => (
                <DraggableRoomElement
                  key={element.id}
                  element={element}
                  isSelected={selectedElementId === element.id}
                  onSelect={() => {
                    setSelectedElementId(element.id);
                    setSelectedGroupId(null);
                  }}
                  onRotate={() => onRotateRoomElement(element.id)}
                  snapToGrid={snapToGrid}
                />
              ))}

              {/* Preview outline when adding element */}
              {previewPos && (isAddingGroup || addingRoomElement) && (
                <div
                  className="absolute border-2 border-blue-500 rounded-lg bg-blue-100/30 pointer-events-none"
                  style={{
                    left: previewPos.x,
                    top: previewPos.y,
                    width: elementSizes[addingRoomElement || 'group'].width,
                    height: elementSizes[addingRoomElement || 'group'].height,
                    zIndex: 999,
                  }}
                />
              )}

              {/* Front of room label */}
              <div className="absolute bottom-0 left-0 right-0 text-center text-sm text-gray-400 py-2 border-t border-gray-100">
                FRONT OF ROOM
              </div>
            </div>

            {/* Unassigned Students Panel */}
            <div
              className="w-64 bg-white border rounded-lg p-4 flex-shrink-0 self-start flex flex-col"
              style={{ height: chart.canvasHeight }}
            >
              <h3 className="font-medium text-gray-800 mb-3 flex-shrink-0">
                Unassigned Students ({unassignedStudents.length})
              </h3>
              <div className="space-y-2 overflow-y-auto flex-1">
                {unassignedStudents.map((student) => (
                  <DraggableStudent key={student.id} student={student} />
                ))}
                {unassignedStudents.length === 0 && (
                  <p className="text-sm text-gray-500 italic">All students assigned</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggingType === 'student' && (
            <div className="bg-white rounded-lg border border-blue-500 shadow-lg px-3 py-2">
              <span className="text-sm text-gray-700">Dragging student...</span>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
