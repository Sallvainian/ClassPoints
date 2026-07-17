import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import {
  DndContext,
  DragStartEvent,
  DragCancelEvent,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Student } from '../../types';
import type {
  SeatingChart,
  SeatingGroup,
  RoomElement,
  RoomElementType,
  LayoutPreset,
} from '../../types/seatingChart';
import { TableGroup } from './TableGroup';
import { RoomElementDisplay } from './RoomElementDisplay';
import { Button } from '../ui/Button';
import { useAvatarColor } from '../../hooks';
import { getAvatarColorForName } from '../../utils';

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
  onResizeRoomElement: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number
  ) => Promise<void>;
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
  presets: LayoutPreset[];
  onLoadPreset: (preset: LayoutPreset) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<boolean>;
}

/**
 * dnd-kit's MouseSensor rejects only right-click; the PointerSensor it
 * replaced required the primary button. Preserve that contract — a
 * middle-button press must keep its native behavior (autoscroll), never
 * start a drag.
 */
class PrimaryButtonMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: MouseEvent }) => nativeEvent.button === 0,
    },
  ] as typeof MouseSensor.activators;
}

/**
 * One-shot coarse-pointer read (repo convention: raw matchMedia, same as
 * DashboardView's 48rem check). Pointer class doesn't change mid-session in
 * practice; hybrid devices that flip (iPad + trackpad) re-read on the next
 * editor mount.
 */
function useIsCoarsePointer(): boolean {
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  return coarse;
}

// Canvas-px breathing room inside the sized wrapper so resize handles on
// elements at the canvas top/left edge can overhang without being clipped.
const EDGE_BLEED = 24;

// Draggable student card for unassigned students panel
interface DraggableStudentProps {
  student: Student;
}

function DraggableStudent({ student }: DraggableStudentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { type: 'student', studentId: student.id },
  });

  const rawColor = student.avatarColor || getAvatarColorForName(student.name);
  const { bg, textClass } = useAvatarColor(rawColor);

  const style = {
    // In-place transform is screen-px inside the scaled wrapper, so the
    // dimmed source card lags the pointer at zoom !== 1. Cosmetic only: the
    // DragOverlay is the visible feedback and student drops resolve via
    // over.id, never this transform.
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-callout-none flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 cursor-grab hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${textClass}`}
        style={{ backgroundColor: bg }}
      >
        {student.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-sm text-gray-700 dark:text-zinc-200">{student.name}</span>
    </div>
  );
}

// Draggable table group
interface DraggableGroupProps {
  group: SeatingGroup;
  students: Map<string, Student>;
  isSelected: boolean;
  onSelect: () => void;
  onUnassignStudent: (seatId: string) => void;
  snapToGrid: (value: number) => number;
  /** Editor zoom — dnd-kit transforms are screen px, positions are canvas px. */
  scale: number;
  disabled?: boolean;
  studentsAreDraggable?: boolean;
}

function DraggableGroup({
  group,
  students,
  isSelected,
  onSelect,
  onUnassignStudent,
  snapToGrid,
  scale,
  disabled = false,
  studentsAreDraggable = false,
}: DraggableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `group-${group.id}`,
    data: { type: 'group', groupId: group.id },
    disabled,
  });

  // Use local state for final snapped position (for after drag ends)
  const [localPos, setLocalPos] = useState({ x: group.x, y: group.y });
  const wasDragging = useRef(false);

  // Sync local position with props, but only when not just finished dragging
  useLayoutEffect(() => {
    if (!isDragging && !wasDragging.current) {
      setLocalPos({ x: group.x, y: group.y });
    }
    if (!isDragging && wasDragging.current) {
      // Just finished dragging - check if props caught up
      if (group.x === localPos.x && group.y === localPos.y) {
        wasDragging.current = false;
      }
    }
  }, [group.x, group.y, isDragging, localPos.x, localPos.y]);

  // Track dragging state and update final position when drag ends
  useLayoutEffect(() => {
    if (isDragging) {
      wasDragging.current = true;
    }
  }, [isDragging]);

  // Update local position to snapped position during drag (for when drag ends)
  useLayoutEffect(() => {
    if (isDragging && transform) {
      // transform is screen px; positions are canvas px inside a scale()
      // wrapper — divide before snapping (must mirror handleDragEnd's math or
      // the optimistic position diverges from the persisted one).
      const snappedX = snapToGrid(group.x + transform.x / scale);
      const snappedY = snapToGrid(group.y + transform.y / scale);
      // Syncs committed position to the transient dnd-kit drag transform (not a
      // prop, so not derivable during render). Kept as local UI state by design
      // decision D1 (seating drag layer stays local useState/useRef). Permanent.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalPos({ x: snappedX, y: snappedY });
    }
  }, [isDragging, transform, group.x, group.y, snapToGrid, scale]);

  // Calculate positions: free movement for element, snapped for indicator
  const freeX = isDragging && transform ? group.x + transform.x / scale : localPos.x;
  const freeY = isDragging && transform ? group.y + transform.y / scale : localPos.y;
  const snappedX = snapToGrid(freeX);
  const snappedY = snapToGrid(freeY);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: freeX,
    top: freeY,
    zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
    cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
  };

  // Group dimensions for snap indicator (must match TableGroup)
  const GROUP_WIDTH = 200; // SEAT_SIZE * 2
  const GROUP_HEIGHT = 240; // 40px badge + SEAT_SIZE * 2

  return (
    <>
      {/* Snap position indicator - shows where element will land */}
      {isDragging && (
        <div
          className="absolute border-2 border-blue-500 rounded-lg bg-blue-100/30 pointer-events-none"
          style={{
            left: snappedX,
            top: snappedY,
            width: GROUP_WIDTH,
            height: GROUP_HEIGHT,
            zIndex: 999,
          }}
        />
      )}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`touch-callout-none ${isDragging ? 'opacity-70' : ''}`}
      >
        <TableGroup
          group={group}
          students={students}
          isSelected={isSelected}
          onSelect={onSelect}
          onUnassignStudent={onUnassignStudent}
          isEditing
          studentsAreDraggable={studentsAreDraggable}
        />
      </div>
    </>
  );
}

// Draggable room element with resize handles
interface DraggableRoomElementProps {
  element: RoomElement;
  isSelected: boolean;
  onSelect: () => void;
  onResize: (width: number, height: number, x?: number, y?: number) => void;
  snapToGrid: (value: number) => number;
  /** Editor zoom — pointer deltas are screen px, positions are canvas px. */
  scale: number;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
}

function DraggableRoomElement({
  element,
  isSelected,
  onSelect,
  onResize,
  snapToGrid,
  scale,
  gridSize,
  canvasWidth,
  canvasHeight,
}: DraggableRoomElementProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `room-${element.id}`,
    data: { type: 'room-element', elementId: element.id },
  });
  const coarsePointer = useIsCoarsePointer();

  // Local state for position/dimensions during interaction
  const [local, setLocal] = useState({
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  });

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  // Render-side mirror of resizeRef.scale (refs must not be read in render):
  // handles are sized from the gesture's scale so a concurrent zoom-button
  // tap can't visibly inflate/shrink them mid-drag.
  const [gestureScale, setGestureScale] = useState<number | null>(null);
  const resizeRef = useRef<{
    edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
    // Only the pointer that started the resize may steer/end it — with touch,
    // a second finger fires the same window events with its own coordinates.
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startElemX: number;
    startElemY: number;
    // Zoom at gesture start — stashed so a mid-resize zoom change (second
    // finger on a toolbar button) can't skew the delta math.
    scale: number;
  } | null>(null);

  // Track when we were interacting (to know when to sync from props)
  const wasInteracting = useRef(false);

  // Track interaction state
  useLayoutEffect(() => {
    if (isDragging || isResizing) {
      wasInteracting.current = true;
    }
  }, [isDragging, isResizing]);

  // Sync local state from props when NOT interacting
  useLayoutEffect(() => {
    if (!isDragging && !isResizing) {
      if (wasInteracting.current) {
        // Check if props caught up
        if (
          element.x === local.x &&
          element.y === local.y &&
          element.width === local.width &&
          element.height === local.height
        ) {
          wasInteracting.current = false;
        }
      } else {
        // Not interacting and wasn't just interacting - sync from props
        setLocal((prev) => {
          if (
            prev.x === element.x &&
            prev.y === element.y &&
            prev.width === element.width &&
            prev.height === element.height
          ) {
            return prev;
          }
          return { x: element.x, y: element.y, width: element.width, height: element.height };
        });
      }
    }
  }, [element.x, element.y, element.width, element.height, isDragging, isResizing, local]);

  // Update local position during drag
  useLayoutEffect(() => {
    if (isDragging && transform) {
      // transform is screen px; positions are canvas px inside a scale()
      // wrapper — divide before snapping (must mirror handleDragEnd's math or
      // the optimistic position diverges from the persisted one).
      const snappedX = snapToGrid(element.x + transform.x / scale);
      const snappedY = snapToGrid(element.y + transform.y / scale);
      // Syncs committed position to the transient dnd-kit drag transform (not a
      // prop, so not derivable during render). Kept as local UI state by design
      // decision D1 (seating drag layer stays local useState/useRef). Permanent.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocal((prev) => {
        if (prev.x === snappedX && prev.y === snappedY) return prev;
        return { ...prev, x: snappedX, y: snappedY };
      });
    }
  }, [isDragging, transform, element.x, element.y, snapToGrid, scale]);

  // Handle resize pointer events (mouse, touch, pen). Window-level so the
  // gesture survives leaving the handle; iOS's implicit touch capture keeps
  // pointermove firing without an explicit setPointerCapture.
  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!resizeRef.current) return;
      if (e.pointerId !== resizeRef.current.pointerId) return;

      const { edge, startX, startY, startWidth, startHeight, startElemX, startElemY, scale } =
        resizeRef.current;
      // Pointer coords are screen px; the element renders inside a scale()
      // transform, so convert to canvas px BEFORE snapping.
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startElemX;
      let newY = startElemY;

      if (edge.includes('e')) newWidth = snapToGrid(startWidth + deltaX);
      if (edge.includes('w')) {
        const widthChange = snapToGrid(deltaX);
        newWidth = startWidth - widthChange;
        newX = startElemX + widthChange;
      }
      if (edge.includes('s')) newHeight = snapToGrid(startHeight + deltaY);
      if (edge.includes('n')) {
        const heightChange = snapToGrid(deltaY);
        newHeight = startHeight - heightChange;
        newY = startElemY + heightChange;
      }

      newWidth = Math.max(gridSize, newWidth);
      newHeight = Math.max(gridSize, newHeight);

      setLocal({ x: newX, y: newY, width: newWidth, height: newHeight });
    };

    const handlePointerUp = (e: PointerEvent) => {
      const start = resizeRef.current;
      if (!start || e.pointerId !== start.pointerId) return;
      // Persist once on pointerup — and only when something changed: a plain
      // tap on a handle (no move) must not fire a no-op DB write.
      const changed =
        local.width !== start.startWidth ||
        local.height !== start.startHeight ||
        local.x !== start.startElemX ||
        local.y !== start.startElemY;
      if (changed) onResize(local.width, local.height, local.x, local.y);
      setIsResizing(false);
      setGestureScale(null);
      resizeRef.current = null;
    };

    // The browser took the pointer back (scroll gesture won, palm rejection,
    // system overlay): revert to the pre-resize dims and persist nothing.
    const handlePointerCancel = (e: PointerEvent) => {
      const start = resizeRef.current;
      if (!start || e.pointerId !== start.pointerId) return;
      setLocal({
        x: start.startElemX,
        y: start.startElemY,
        width: start.startWidth,
        height: start.startHeight,
      });
      setIsResizing(false);
      setGestureScale(null);
      resizeRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [isResizing, snapToGrid, gridSize, onResize, local]);

  const handleResizeStart = (
    e: React.PointerEvent,
    edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) => {
    // Primary pointer + main button only (mirrors dnd-kit's own activator
    // guard) — a second finger or right-click must not start a resize.
    if (!e.isPrimary || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setGestureScale(scale);
    resizeRef.current = {
      edge,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: local.width,
      startHeight: local.height,
      startElemX: local.x,
      startElemY: local.y,
      scale,
    };
  };

  // Calculate display values from local state
  const freeX = isDragging && transform ? element.x + transform.x / scale : local.x;
  const freeY = isDragging && transform ? element.y + transform.y / scale : local.y;
  const snappedX = snapToGrid(freeX);
  const snappedY = snapToGrid(freeY);

  // Calculate rotation-aware bounds
  const rot = ((element.rotation % 360) + 360) % 360;
  const is90 = rot === 90;
  const is180 = rot === 180;
  const is270 = rot === 270;

  // Snap helper
  const snap = (v: number) => Math.round(v / gridSize) * gridSize;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

  // Use unified local state for width/height
  const w = snap(local.width);
  const h = snap(local.height);

  // Bounding box size after rotation (for right angles)
  const boxW = is90 || is270 ? h : w;
  const boxH = is90 || is270 ? w : h;

  const maxLeft = canvasWidth - boxW;
  const maxTop = canvasHeight - boxH;

  // Display position: during drag show free movement, otherwise use local state
  const displayLeft = isDragging ? freeX : snap(clamp(local.x, 0, maxLeft));
  const displayTop = isDragging ? freeY : snap(clamp(local.y, 0, maxTop));

  // Keep rotated content inside wrapper (origin top-left)
  const translate = is90
    ? `translate(${h}px, 0)`
    : is180
      ? `translate(${w}px, ${h}px)`
      : is270
        ? `translate(0, ${w}px)`
        : 'translate(0, 0)';

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: displayLeft,
    top: displayTop,
    width: boxW,
    height: boxH,
    zIndex: isDragging || isResizing ? 1000 : isSelected ? 100 : 2,
  };

  const innerStyle: React.CSSProperties = {
    width: w,
    height: h,
    transformOrigin: 'top left',
    transform: `${translate} rotate(${rot}deg)`,
  };

  // Resize-handle geometry, two constraints in tension:
  //  - sizes are divided by the zoom scale so the ON-SCREEN target stays
  //    constant at any zoom (at scale 1 fine pointers get exactly the
  //    historical 10px — auto-fit means most sessions now run below 1);
  //  - hit boxes are CLAMPED to 40% of the element's smaller dimension so the
  //    corners can never tile a small element: the center strip must stay
  //    reachable for press-and-hold drags and taps, and the outward apron
  //    must not blanket neighbors. The clamp leaves small-element corners
  //    below finger size at fit zoom — resizing a 40px sink on touch
  //    practically means zooming in first, the standard tablet pattern.
  // During a resize, size the handles from the gesture's stashed scale (the
  // delta math already uses the ref stash; this keeps the visuals consistent).
  const effectiveScale = isResizing && gestureScale != null ? gestureScale : scale;
  const handleSize = Math.min(
    (coarsePointer ? 32 : 10) / effectiveScale,
    Math.min(local.width, local.height) * 0.4
  );
  const dotSize = Math.min(14 / effectiveScale, handleSize * 0.75);
  const handleVisual = 'bg-blue-500 border-2 border-white rounded-sm';

  const renderHandle = (
    edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
    cursorClass: string,
    pos: React.CSSProperties
  ) => (
    <div
      key={edge}
      // touch-none is load-bearing: without it the overflow-auto container
      // pans on finger-drag and fires pointercancel, aborting every resize.
      className={`absolute z-50 touch-none ${cursorClass} ${
        coarsePointer ? 'flex items-center justify-center' : handleVisual
      }`}
      style={{ ...pos, width: handleSize, height: handleSize }}
      onPointerDown={(e) => handleResizeStart(e, edge)}
    >
      {coarsePointer && (
        <div className={handleVisual} style={{ width: dotSize, height: dotSize }} />
      )}
    </div>
  );

  return (
    <>
      {/* Snap position indicator - shows where element will land */}
      {isDragging && (
        <div
          className="absolute border-2 border-blue-500 rounded bg-blue-100/30 pointer-events-none"
          style={{
            left: snap(clamp(snappedX, 0, maxLeft)),
            top: snap(clamp(snappedY, 0, maxTop)),
            width: boxW,
            height: boxH,
            zIndex: 999,
          }}
        />
      )}
      {/* Wrapper positioned on grid with bounding box size */}
      <div
        ref={setNodeRef}
        style={wrapperStyle}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {/* Inner rotated element */}
        <div style={innerStyle}>
          {/* Drag handle - the main element */}
          <div
            {...attributes}
            {...listeners}
            className={`touch-callout-none w-full h-full ${isDragging ? 'opacity-70 cursor-grabbing' : 'cursor-grab'}`}
          >
            <RoomElementDisplay element={element} isSelected={isSelected} isEditing skipRotation />
          </div>

          {/* Resize handles - only show when selected and not dragging.
              Coarse pointers get corners only: 32px hit boxes on all 8
              positions would overlap into ambiguity on a 40px-minimum
              element, and snap (default ON) absorbs cross-axis drift, so
              axis-aligned corner resizes stay practical. */}
          {isSelected && !isDragging && (
            <>
              {!coarsePointer && (
                <>
                  {renderHandle('w', 'cursor-ew-resize', {
                    left: -handleSize / 2,
                    top: '50%',
                    marginTop: -handleSize / 2,
                  })}
                  {renderHandle('e', 'cursor-ew-resize', {
                    right: -handleSize / 2,
                    top: '50%',
                    marginTop: -handleSize / 2,
                  })}
                  {renderHandle('n', 'cursor-ns-resize', {
                    top: -handleSize / 2,
                    left: '50%',
                    marginLeft: -handleSize / 2,
                  })}
                  {renderHandle('s', 'cursor-ns-resize', {
                    bottom: -handleSize / 2,
                    left: '50%',
                    marginLeft: -handleSize / 2,
                  })}
                </>
              )}
              {renderHandle('nw', 'cursor-nwse-resize', {
                left: -handleSize / 2,
                top: -handleSize / 2,
              })}
              {renderHandle('ne', 'cursor-nesw-resize', {
                right: -handleSize / 2,
                top: -handleSize / 2,
              })}
              {renderHandle('sw', 'cursor-nesw-resize', {
                left: -handleSize / 2,
                bottom: -handleSize / 2,
              })}
              {renderHandle('se', 'cursor-nwse-resize', {
                right: -handleSize / 2,
                bottom: -handleSize / 2,
              })}
            </>
          )}
        </div>
      </div>
    </>
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
  onUnassignStudent,
  onSwapStudents,
  onRandomize,
  onAddRoomElement,
  onMoveRoomElement,
  onResizeRoomElement,
  onDeleteRoomElement,
  onRotateRoomElement,
  onUpdateSettings,
  onSavePreset,
  presets,
  onLoadPreset,
  onDeletePreset,
}: SeatingChartEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [addingRoomElement, setAddingRoomElement] = useState<RoomElementType | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [showPresetList, setShowPresetList] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [tablesLocked, setTablesLocked] = useState(false);
  const [draggingStudent, setDraggingStudent] = useState<Student | null>(null);
  const [scale, setScale] = useState(1);

  // Supplying `sensors` REPLACES dnd-kit's defaults, so everything here is
  // re-added deliberately. MouseSensor + TouchSensor split what PointerSensor
  // used to do, so each input gets its own activation gate:
  //  - MouseSensor keeps the 5px movement threshold (sub-5px presses stay
  //    clicks — native click bubbles to the existing onSelect wiring instead
  //    of being swallowed by dnd-kit's click-suppressor, which arms only
  //    after a drag actually activates);
  //  - TouchSensor requires a 200ms press-and-hold (8px wiggle tolerance)
  //    before a drag starts, so quick swipes keep scrolling the editor and
  //    the student list, and a plain tap's click still selects;
  //  - KeyboardSensor: dropping it would be a silent a11y regression —
  //    Enter/Space keyboard drags are live today via its onKeyDown activator
  //    delivered through the spread {...listeners}; {...attributes} only
  //    carries role/tabIndex/aria.
  const sensors = useSensors(
    useSensor(PrimaryButtonMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const draggingRaw = draggingStudent
    ? draggingStudent.avatarColor || getAvatarColorForName(draggingStudent.name)
    : '#6b7280';
  const { bg: draggingBg, textClass: draggingTextClass } = useAvatarColor(draggingRaw);

  // Zoom constants
  const ZOOM_STEP = 0.1;
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 1.5;
  // Coarse pointers never auto-fit below this: SEAT_SIZE(100) × 0.44 = 44px,
  // the minimum comfortable touch target for drag sources/drop targets. The
  // canvas pans in the overflow-auto scroller instead of shrinking further.
  const MIN_TOUCH_SCALE = 0.44;

  const coarsePointer = useIsCoarsePointer();
  const [fitScale, setFitScale] = useState(1);
  // Manual zoom must survive window resizes / canvas-size tweaks — refit only
  // applies its scale while the user hasn't zoomed by hand (the % fit button
  // re-arms auto-fit).
  const userZoomedRef = useRef(false);

  // Fit-to-screen scale, computed on mount + resize. useLayoutEffect: the
  // scale-1 default must never paint — a 1600px canvas at 100% blows past an
  // iPad viewport for one visible frame (same rationale as SeatingChartView).
  // The w-64 panel (256px) and gap-4 (16px) sit INSIDE the scaled wrapper, so
  // they belong in the denominator; 32 is the scroller's own p-4 padding.
  useLayoutEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const updateFit = () => {
      const available = container.clientWidth - 32;
      // jsdom (and a mid-teardown container) report clientWidth 0 — a
      // negative scale would corrupt every interaction. Keep the default.
      if (available <= 0) return;
      const raw = Math.min(1, available / (chart.canvasWidth + 16 + 256));
      const fit = coarsePointer ? Math.max(MIN_TOUCH_SCALE, raw) : raw;
      setFitScale(fit);
      if (!userZoomedRef.current) setScale(fit);
    };

    updateFit();
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, [chart.canvasWidth, coarsePointer]);

  const handleZoomIn = useCallback(() => {
    userZoomedRef.current = true;
    setScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  // Zoom-out floor: fitScale when it is below MIN_ZOOM (a 1600px chart fits
  // narrow viewports only below 0.3), else MIN_ZOOM — a fixed floor would
  // strand narrow viewports wider than the screen after one zoom-in.
  const handleZoomOut = useCallback(() => {
    userZoomedRef.current = true;
    setScale((prev) => Math.max(Math.min(MIN_ZOOM, fitScale), prev - ZOOM_STEP));
  }, [fitScale]);

  const handleFitToScreen = useCallback(() => {
    userZoomedRef.current = false;
    setScale(fitScale);
  }, [fitScale]);

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

      // rect is the SCALED canvas; convert to canvas space before snapping
      // (dividing after snapping would shrink the effective grid pitch).
      const x = snapToGrid((e.clientX - rect.left) / scale);
      const y = snapToGrid((e.clientY - rect.top) / scale);

      setPreviewPos({ x, y });
    },
    [isAddingGroup, addingRoomElement, snapToGrid, previewPos, scale]
  );

  // Handle canvas mouse leave - clear preview
  const handleCanvasMouseLeave = useCallback(() => {
    setPreviewPos(null);
  }, []);

  // Handle canvas click for adding items
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent) => {
      if (!isAddingGroup && !addingRoomElement) {
        // Clear selections
        setSelectedGroupId(null);
        setSelectedElementId(null);
        return;
      }

      // Mouse users placed via the mousemove ghost; a touch tap never fired a
      // mousemove, so derive the spot from the tap's own coordinates.
      let pos = previewPos;
      if (!pos) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        pos = {
          x: snapToGrid((e.clientX - rect.left) / scale),
          y: snapToGrid((e.clientY - rect.top) / scale),
        };
      }

      const { x, y } = pos;

      if (addingRoomElement) {
        await onAddRoomElement(addingRoomElement, x, y);
        setAddingRoomElement(null);
      } else if (isAddingGroup) {
        await onAddGroup(x, y);
        setIsAddingGroup(false);
      }

      setPreviewPos(null);
    },
    [isAddingGroup, addingRoomElement, previewPos, onAddGroup, onAddRoomElement, snapToGrid, scale]
  );

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    setDraggingType(data?.type || null);
    setDraggingId(data?.groupId || data?.elementId || null);

    // Track which student is being dragged for the overlay
    if (data?.type === 'student' || data?.type === 'seated-student') {
      const student = studentMap.get(data.studentId);
      setDraggingStudent(student || null);
    } else {
      setDraggingStudent(null);
    }
  };

  // A cancelled drag (Escape, or a system gesture stealing the touch) fires
  // onDragCancel INSTEAD of onDragEnd: clear the dragging state — a stale
  // draggingId would misdirect the R/Delete key handlers — and remount the
  // positioned children via the epoch key: their optimistic localPos was
  // synced to the aborted drag and their props will never catch up to it.
  const [dragEpoch, setDragEpoch] = useState(0);
  const handleDragCancel = (event: DragCancelEvent) => {
    const type = event.active.data.current?.type;
    setDraggingType(null);
    setDraggingId(null);
    setDraggingStudent(null);
    // Only group/room-element drags carry optimistic localPos that a cancel
    // strands; student drags resolve via over.id and need no remount — and a
    // global remount would wipe an unrelated in-flight resize's local state.
    if (type === 'group' || type === 'room-element') {
      setDragEpoch((epoch) => epoch + 1);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const data = active.data.current;

    setDraggingType(null);
    setDraggingId(null);
    setDraggingStudent(null);

    // Handle unassigned student dropped on seat
    if (data?.type === 'student' && over) {
      const overId = String(over.id);
      if (overId.startsWith('seat-')) {
        const seatId = overId.replace('seat-', '');
        await onAssignStudent(data.studentId, seatId);
      }
      return;
    }

    // Handle seated student being dragged
    if (data?.type === 'seated-student') {
      const sourceSeatId = data.seatId;

      if (over) {
        const overId = String(over.id);
        if (overId.startsWith('seat-')) {
          const targetSeatId = overId.replace('seat-', '');
          if (targetSeatId !== sourceSeatId) {
            // Check if target seat is occupied
            let targetOccupied = false;
            for (const group of chart.groups) {
              const seat = group.seats.find((s) => s.id === targetSeatId);
              if (seat?.studentId) {
                targetOccupied = true;
                break;
              }
            }

            if (targetOccupied) {
              // Swap students
              await onSwapStudents(sourceSeatId, targetSeatId);
            } else {
              // Move to empty seat (assignStudent handles clearing old seat)
              await onAssignStudent(data.studentId, targetSeatId);
            }
          }
          return;
        }
      }

      // Dropped outside a seat - unassign the student
      await onUnassignStudent(sourceSeatId);
      return;
    }

    // Handle group movement
    if (data?.type === 'group') {
      const group = chart.groups.find((g) => g.id === data.groupId);
      if (group) {
        // delta is screen px; positions are canvas px inside a scale()
        // wrapper — divide before snapping.
        const newX = snapToGrid(group.x + delta.x / scale);
        const newY = snapToGrid(group.y + delta.y / scale);
        // No-op belt: skip the move when the snapped target equals the group's
        // current cached position (deliberately NOT raw delta === 0 — a small
        // drag that snaps back to the origin is also a no-op).
        if (newX === group.x && newY === group.y) return;
        await onMoveGroup(data.groupId, newX, newY);
      }
      return;
    }

    // Handle room element movement
    if (data?.type === 'room-element') {
      const element = chart.roomElements.find((e) => e.id === data.elementId);
      if (element) {
        // delta is screen px; positions are canvas px inside a scale()
        // wrapper — divide before snapping.
        const newX = snapToGrid(element.x + delta.x / scale);
        const newY = snapToGrid(element.y + delta.y / scale);
        // No-op belt: skip the move when the snapped target equals the element's
        // current cached position (deliberately NOT raw delta === 0).
        if (newX === element.x && newY === element.y) return;
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
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={pointerWithin}
    >
      {/* touch-manipulation kills iOS double-tap zoom inside the editor */}
      <div className="touch-manipulation fixed inset-0 bg-gray-100 dark:bg-zinc-950 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Header — wraps on narrow viewports instead of overflowing */}
        <div className="bg-white dark:bg-zinc-900 border-b px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <Button onClick={onClose} variant="ghost" size="sm">
              ← Back
            </Button>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-100 min-w-0 truncate">
              Edit Seating Chart
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {showPresetInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="px-2 py-1 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 border border-gray-300 dark:border-zinc-700 rounded text-sm"
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
              <>
                <div className="relative">
                  <Button
                    onClick={() => setShowPresetList(!showPresetList)}
                    variant="secondary"
                    size="sm"
                  >
                    Load Preset {presets.length > 0 && `(${presets.length})`}
                  </Button>
                  {showPresetList && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border rounded-lg shadow-lg z-50 min-w-64 max-h-80 overflow-auto">
                      {presets.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-500">
                          No saved presets
                        </div>
                      ) : (
                        presets.map((preset) => (
                          <div
                            key={preset.id}
                            className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 border-b last:border-b-0 flex items-center justify-between gap-2"
                          >
                            <button
                              onClick={async () => {
                                await onLoadPreset(preset);
                                // Preset apply no longer remounts the Editor; the
                                // old groups/elements are replaced with new ids, so
                                // drop any selection pointing at them.
                                setSelectedGroupId(null);
                                setSelectedElementId(null);
                                setShowPresetList(false);
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="font-medium text-sm">{preset.name}</div>
                              <div className="text-xs text-gray-500 dark:text-zinc-500">
                                {new Date(preset.createdAt).toLocaleDateString()} •{' '}
                                {preset.layoutData.groups.length} tables
                              </div>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await onDeletePreset(preset.id);
                              }}
                              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 dark:text-red-300 text-sm px-2"
                              title="Delete preset"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Button onClick={() => setShowPresetInput(true)} variant="secondary" size="sm">
                  Save as Preset
                </Button>
              </>
            )}
            <Button onClick={onClose} variant="primary" size="sm">
              Done
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-zinc-900 border-b px-4 py-2 flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              setIsAddingGroup(!isAddingGroup);
              setAddingRoomElement(null);
            }}
            variant={isAddingGroup ? 'primary' : 'secondary'}
            size="sm"
          >
            {isAddingGroup ? 'Tap or click to place...' : '+ Add Table Group'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'teacher_desk' ? null : 'teacher_desk');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'teacher_desk' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'teacher_desk' ? 'Tap or click to place...' : '+ Teacher Desk'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'door' ? null : 'door');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'door' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'door' ? 'Tap or click to place...' : '+ Door'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'window' ? null : 'window');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'window' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'window' ? 'Tap or click to place...' : '+ Window'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'countertop' ? null : 'countertop');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'countertop' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'countertop' ? 'Tap or click to place...' : '+ Counter'}
          </Button>
          <Button
            onClick={() => {
              setAddingRoomElement(addingRoomElement === 'sink' ? null : 'sink');
              setIsAddingGroup(false);
            }}
            variant={addingRoomElement === 'sink' ? 'primary' : 'secondary'}
            size="sm"
          >
            {addingRoomElement === 'sink' ? 'Tap or click to place...' : '+ Sink'}
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <Button
            onClick={() => onUpdateSettings({ snapEnabled: !chart.snapEnabled })}
            variant={chart.snapEnabled ? 'primary' : 'secondary'}
            size="sm"
          >
            Snap: {chart.snapEnabled ? 'ON' : 'OFF'}
          </Button>

          <Button
            onClick={() => setTablesLocked(!tablesLocked)}
            variant={tablesLocked ? 'primary' : 'secondary'}
            size="sm"
          >
            🔒 Tables: {tablesLocked ? 'LOCKED' : 'Unlocked'}
          </Button>

          <Button onClick={onRandomize} variant="secondary" size="sm">
            Randomize Students
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          {/* Canvas size controls */}
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-zinc-400">
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

          <div className="w-px h-6 bg-gray-300 mx-2" />

          {/* Zoom controls. Locked while a drag is live: dnd-kit deltas are
              cumulative screen px, so a mid-drag scale change (second finger
              tapping zoom during a touch drag) would skew the whole
              accumulated delta at drop. */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-950 rounded-lg p-1">
            <button
              onClick={handleZoomOut}
              disabled={scale <= Math.min(MIN_ZOOM, fitScale) || draggingType !== null}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Zoom out"
            >
              <span className="text-base font-medium text-gray-600 dark:text-zinc-400">−</span>
            </button>
            <button
              onClick={handleFitToScreen}
              disabled={draggingType !== null}
              className="px-2 h-7 text-xs text-gray-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900 rounded-md transition-colors min-w-[3rem] disabled:opacity-40"
              title="Fit to screen"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={scale >= MAX_ZOOM || draggingType !== null}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Zoom in"
            >
              <span className="text-base font-medium text-gray-600 dark:text-zinc-400">+</span>
            </button>
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
                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 dark:text-red-300"
              >
                Delete Group
              </Button>
            </>
          )}

          {selectedElementId && (
            <>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <Button
                onClick={() => {
                  onRotateRoomElement(selectedElementId);
                }}
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
                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 dark:text-red-300"
              >
                Delete Element
              </Button>
            </>
          )}
        </div>

        {/* Help text */}
        <div className="px-4 py-1 text-xs text-gray-500 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-900 border-b">
          Drag to reposition (press and hold on touch) • Drag corners/edges to resize • Rotate and
          Delete from the toolbar (or R / Delete keys) • Alt disables snap • Lock tables to move
          students
        </div>

        {/* Main content. overscroll-contain stops iOS rubber-banding the page
            behind the editor; select-none stops long-press text selection
            racing TouchSensor's 200ms hold. */}
        <div
          className="flex-1 overflow-auto overscroll-contain select-none p-4"
          ref={editorContainerRef}
        >
          {/* transform: scale() is visual-only — without a width/height-
              compensated wrapper the scroller keeps the full unscaled layout
              footprint and pans into blank space at fit (same fix as
              SeatingChartView's #132 sized wrapper). 272 = gap-4 + w-64
              panel; 32 ≈ the FRONT OF ROOM label row. EDGE_BLEED pads the
              scaled content so resize handles on elements at x/y=0 aren't
              clipped by the overflow:hidden (best effort — very low zoom can
              still clip part of a large handle). */}
          <div
            style={{
              width: (chart.canvasWidth + 272 + EDGE_BLEED * 2) * scale,
              height: (chart.canvasHeight + 32 + EDGE_BLEED * 2) * scale,
              overflow: 'hidden',
            }}
          >
            <div
              className="inline-flex gap-4 items-start"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                padding: EDGE_BLEED,
              }}
            >
              {/* Canvas container */}
              <div className="flex flex-col flex-shrink-0">
                {/* Canvas */}
                <div
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={handleCanvasMouseLeave}
                  className={`relative outline outline-2 rounded-lg bg-white dark:bg-zinc-900 flex-shrink-0 ${
                    isAddingGroup || addingRoomElement
                      ? 'cursor-crosshair outline-blue-400'
                      : 'outline-gray-200 dark:outline-zinc-800'
                  }`}
                  style={{
                    width: chart.canvasWidth,
                    height: chart.canvasHeight,
                    backgroundImage: chart.snapEnabled
                      ? `
                    linear-gradient(to right, var(--chart-grid-line) 1px, transparent 1px),
                    linear-gradient(to bottom, var(--chart-grid-line) 1px, transparent 1px)
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
                      key={`${group.id}-${dragEpoch}`}
                      group={group}
                      students={studentMap}
                      isSelected={selectedGroupId === group.id}
                      onSelect={() => {
                        setSelectedGroupId(group.id);
                        setSelectedElementId(null);
                      }}
                      onUnassignStudent={onUnassignStudent}
                      snapToGrid={snapToGrid}
                      scale={scale}
                      disabled={tablesLocked}
                      studentsAreDraggable={tablesLocked}
                    />
                  ))}

                  {/* Room Elements */}
                  {chart.roomElements.map((element) => (
                    <DraggableRoomElement
                      key={`${element.id}-${dragEpoch}`}
                      element={element}
                      isSelected={selectedElementId === element.id}
                      onSelect={() => {
                        setSelectedElementId(element.id);
                        setSelectedGroupId(null);
                      }}
                      onResize={(width, height, x, y) =>
                        onResizeRoomElement(element.id, width, height, x, y)
                      }
                      snapToGrid={snapToGrid}
                      scale={scale}
                      gridSize={chart.gridSize}
                      canvasWidth={chart.canvasWidth}
                      canvasHeight={chart.canvasHeight}
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
                </div>
                {/* Front of room label - outside canvas */}
                <div
                  className="text-center text-sm text-gray-400 dark:text-zinc-600 py-1 border-t border-gray-200 dark:border-zinc-800 -mt-px"
                  style={{ width: chart.canvasWidth }}
                >
                  FRONT OF ROOM
                </div>
              </div>

              {/* Unassigned Students Panel */}
              <div
                className="w-64 bg-white dark:bg-zinc-900 border rounded-lg p-4 flex-shrink-0 self-start flex flex-col"
                style={{ height: chart.canvasHeight }}
              >
                <h3 className="font-medium text-gray-800 dark:text-zinc-100 mb-3 flex-shrink-0">
                  Unassigned Students ({unassignedStudents.length})
                </h3>
                <div className="space-y-2 overflow-y-auto flex-1">
                  {unassignedStudents.map((student) => (
                    <DraggableStudent key={student.id} student={student} />
                  ))}
                  {unassignedStudents.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-zinc-500 italic">
                      All students assigned
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {(draggingType === 'student' || draggingType === 'seated-student') && draggingStudent && (
            <div
              className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg border-2 border-blue-500 flex flex-col items-center justify-center p-1"
              style={{ width: 100, height: 100 }}
            >
              {/* Avatar */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shadow-inner ${draggingTextClass}`}
                style={{ backgroundColor: draggingBg }}
              >
                {draggingStudent.name.charAt(0).toUpperCase()}
              </div>
              {/* Name */}
              <span className="text-xs font-medium text-gray-800 dark:text-zinc-100 text-center truncate w-full mt-1">
                {draggingStudent.name.split(' ')[0]}
              </span>
              {/* Points */}
              <span
                className={`text-sm font-bold ${draggingStudent.pointTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {draggingStudent.pointTotal >= 0 ? '+' : ''}
                {draggingStudent.pointTotal}
              </span>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
