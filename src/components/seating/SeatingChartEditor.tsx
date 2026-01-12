import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
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
}

function DraggableGroup({ group, students, isSelected, onSelect }: DraggableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `group-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: group.x,
    top: group.y,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
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
}

function DraggableRoomElement({ element, isSelected, onSelect }: DraggableRoomElementProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `room-${element.id}`,
    data: { type: 'room-element', elementId: element.id },
  });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
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
      <RoomElementDisplay element={element} isSelected={isSelected} onSelect={onSelect} isEditing />
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
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number } | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

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

  // Track Alt key for disabling snap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedGroupId || selectedElementId)) {
        e.preventDefault();
        if (selectedGroupId) {
          onDeleteGroup(selectedGroupId);
          setSelectedGroupId(null);
        } else if (selectedElementId) {
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
  }, [selectedGroupId, selectedElementId, onDeleteGroup, onDeleteRoomElement]);

  // Snap to grid helper
  const snapToGrid = useCallback(
    (value: number): number => {
      if (!chart.snapEnabled || isAltPressed) return value;
      return Math.round(value / chart.gridSize) * chart.gridSize;
    },
    [chart.snapEnabled, chart.gridSize, isAltPressed]
  );

  // Handle canvas click for adding items
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (!isAddingGroup && !addingRoomElement) {
        // Clear selections
        setSelectedGroupId(null);
        setSelectedElementId(null);
        return;
      }

      const x = snapToGrid(e.clientX - rect.left);
      const y = snapToGrid(e.clientY - rect.top);

      if (addingRoomElement) {
        await onAddRoomElement(addingRoomElement, x, y);
        setAddingRoomElement(null);
      } else if (isAddingGroup) {
        await onAddGroup(x, y);
        setIsAddingGroup(false);
      }
    },
    [isAddingGroup, addingRoomElement, snapToGrid, onAddGroup, onAddRoomElement]
  );

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    setDraggingType(data?.type || null);
    setDraggingId(data?.groupId || data?.elementId || null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, delta } = event;
    const data = active.data.current;

    if (data?.type === 'group') {
      const group = chart.groups.find((g) => g.id === data.groupId);
      if (group) {
        const newX = snapToGrid(group.x + delta.x);
        const newY = snapToGrid(group.y + delta.y);
        setSnapPreview({ x: newX, y: newY });
      }
    } else if (data?.type === 'room-element') {
      const element = chart.roomElements.find((e) => e.id === data.elementId);
      if (element) {
        const newX = snapToGrid(element.x + delta.x);
        const newY = snapToGrid(element.y + delta.y);
        setSnapPreview({ x: newX, y: newY });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const data = active.data.current;

    setDraggingType(null);
    setDraggingId(null);
    setSnapPreview(null);

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
      onDragMove={handleDragMove}
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
          Drag groups to reposition • Hold Alt to disable snap • Delete key to remove selected •
          Drag students to assign
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 overflow-auto p-4">
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={`relative border-2 rounded-lg bg-white ${
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
              {/* Snap preview - shows where item will land */}
              {snapPreview &&
                draggingType &&
                chart.snapEnabled &&
                !isAltPressed &&
                (() => {
                  let width = 160;
                  let height = 200;
                  if (draggingType === 'room-element' && draggingId) {
                    const element = chart.roomElements.find((e) => e.id === draggingId);
                    if (element) {
                      width = element.width;
                      height = element.height;
                    }
                  }
                  return (
                    <div
                      className="absolute border-2 border-dashed border-gray-400 bg-gray-100/30 rounded pointer-events-none"
                      style={{
                        left: snapPreview.x,
                        top: snapPreview.y,
                        width,
                        height,
                        zIndex: 50,
                      }}
                    />
                  );
                })()}

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
                />
              ))}

              {/* Front of room label */}
              <div className="absolute bottom-0 left-0 right-0 text-center text-sm text-gray-400 py-2 border-t border-gray-100">
                FRONT OF ROOM
              </div>
            </div>
          </div>

          {/* Unassigned Students Panel */}
          <div className="w-64 bg-white border-l p-4 overflow-y-auto">
            <h3 className="font-medium text-gray-800 mb-3">
              Unassigned Students ({unassignedStudents.length})
            </h3>
            <div className="space-y-2">
              {unassignedStudents.map((student) => (
                <DraggableStudent key={student.id} student={student} />
              ))}
              {unassignedStudents.length === 0 && (
                <p className="text-sm text-gray-500 italic">All students assigned</p>
              )}
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
