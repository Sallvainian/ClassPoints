/**
 * SeatingChartEditor — input semantics (dnd-kit MouseSensor + TouchSensor +
 * KeyboardSensor) and zoom-scale compensation.
 *
 * What jsdom CAN express (verified against jsdom 29 + @dnd-kit/core 6.3.1):
 * - MouseSensor activates on `mousedown` and attaches its move/end listeners
 *   to the OWNER DOCUMENT, so mouse sequences are: mousedown on the element,
 *   mousemove/mouseup on `document` (mirrors the old PointerSensor drive).
 * - TouchSensor activates on `touchstart` but attaches its move/end listeners
 *   to the TOUCHED ELEMENT — touchmove/touchend must be dispatched on the
 *   element, never `document`. Every touch event must carry
 *   `touches: [{ clientX, clientY }]`: dnd-kit reads `event.touches[0]` and a
 *   missing array becomes {x:0,y:0}, spuriously tripping the tolerance
 *   cancel. jsdom 29 constructs real TouchEvents from plain-object inits.
 * - The 200ms activation delay is a plain setTimeout → drive with fake
 *   timers; the 8px tolerance is a strict `>` comparison, so aborts use
 *   clearly-past-8px moves.
 * - dnd-kit's click-suppressor is armed ONLY on sensor ACTIVATION, so clicks
 *   dispatched after a sub-5px press or a sub-200ms tap reach React (the
 *   click-to-select contract, on both input types).
 * - Auto-fit on open is guarded for jsdom: containers report clientWidth 0,
 *   so the fit bails and scale stays 1 — every coordinate expectation below
 *   that doesn't explicitly zoom assumes scale 1 and would break if the
 *   guard regressed. Fit itself is tested by stubbing clientWidth and firing
 *   a window resize (the fit effect re-runs on resize).
 *
 * What jsdom can NOT express — covered by the iPad Playwright spec and the
 * on-device checklist: browser-synthesized clicks after pointerup/touchend
 * (dispatched explicitly below), real hit-testing/geometry (every rect is
 * 0x0), droppable collision (`over` is never populated), and real
 * scroll-vs-hold gesture arbitration.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Credless-CI safety: the editor imports `useAvatarColor` from the src/hooks
// barrel, which transitively evaluates src/lib/supabase.ts (throws without
// env). Stub env BEFORE importOriginal, keep the real exports (#14 pattern).
vi.mock('../../../lib/supabase', async (importOriginal) => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
  const actual = await importOriginal<typeof import('../../../lib/supabase')>();
  return { ...actual };
});

import { SeatingChartEditor } from '../SeatingChartEditor';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import type { Student } from '../../../types';
import type { SeatingChart } from '../../../types/seatingChart';

const GRID = 40;
// On-grid origin so a drag-and-return is a TRUE no-op for the belt
// (snapToGrid(origin + 0) === origin).
const ORIGIN = { x: 120, y: 120 };

function makeChart(overrides: Partial<SeatingChart> = {}): SeatingChart {
  return {
    id: 'chart-1',
    classroomId: 'class-1',
    name: 'Test Chart',
    snapEnabled: true,
    gridSize: GRID,
    canvasWidth: 800,
    canvasHeight: 600,
    groups: [
      {
        id: 'g1',
        letter: 'A',
        x: ORIGIN.x,
        y: ORIGIN.y,
        rotation: 0,
        seats: ([1, 2, 3, 4] as const).map((positionInGroup) => ({
          id: `seat-${positionInGroup}`,
          positionInGroup,
          studentId: null,
        })),
      },
    ],
    roomElements: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const DESK_ELEMENT = {
  id: 'e1',
  type: 'teacher_desk' as const,
  x: ORIGIN.x,
  y: ORIGIN.y,
  width: 120,
  height: 80,
  rotation: 0,
};

// Smallest default element — the worst case for handle-vs-drag-surface real
// estate (the coarse hit boxes are clamped against it).
const SINK_ELEMENT = {
  id: 'e2',
  type: 'sink' as const,
  x: ORIGIN.x,
  y: ORIGIN.y,
  width: 40,
  height: 40,
  rotation: 0,
};

function makeProps(chart: SeatingChart = makeChart()) {
  return {
    chart,
    students: [] as Student[],
    onClose: vi.fn(),
    onAddGroup: vi.fn(async () => null),
    onMoveGroup: vi.fn(async () => undefined),
    onDeleteGroup: vi.fn(async () => true),
    onRotateGroup: vi.fn(async () => undefined),
    onAssignStudent: vi.fn(async () => undefined),
    onUnassignStudent: vi.fn(async () => undefined),
    onSwapStudents: vi.fn(async () => undefined),
    onRandomize: vi.fn(async () => undefined),
    onAddRoomElement: vi.fn(async () => null),
    onMoveRoomElement: vi.fn(async () => undefined),
    onResizeRoomElement: vi.fn(async () => undefined),
    onDeleteRoomElement: vi.fn(async () => true),
    onRotateRoomElement: vi.fn(async () => undefined),
    onUpdateSettings: vi.fn(async () => undefined),
    onSavePreset: vi.fn(async () => undefined),
    presets: [],
    onLoadPreset: vi.fn(async () => undefined),
    onDeletePreset: vi.fn(async () => true),
  };
}

function renderEditor(props = makeProps()) {
  render(<SeatingChartEditor {...props} />, { wrapper: ThemeProvider });
  return props;
}

/** The dnd-kit draggable node (has the {...attributes} spread) containing `text`. */
function getDraggableContaining(text: string): HTMLElement {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-roledescription="draggable"]')
  );
  const match = nodes.find((node) => node.textContent?.includes(text));
  if (!match) {
    throw new Error(`No draggable node containing "${text}" found`);
  }
  return match;
}

/** All rendered resize handles (each carries the load-bearing touch-none). */
function getResizeHandles(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.touch-none'));
}

/** matchMedia override reporting a coarse pointer (everything else false). */
function withCoarsePointer(): () => void {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return () => {
    window.matchMedia = original;
  };
}

const mouse = { button: 0 };
const pointer = { isPrimary: true, button: 0, pointerId: 1 };

/**
 * dnd-kit arms a capture-phase document `click` suppressor when a drag
 * ACTIVATES and removes it only 50ms (real time) after the drag detaches
 * (AbstractPointerSensor.detach → setTimeout(removeAll, 50)). jsdom shares
 * ONE document across this file's tests, so every test that activates a drag
 * must let that window lapse before the next test clicks anything — or the
 * next test's first click is silently swallowed.
 */
async function settleClickSuppressor() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

describe('SeatingChartEditor mouse activation (MouseSensor, activationConstraint distance: 5)', () => {
  it('sub-5px press on a group fires onSelect (toolbar appears) and issues no move', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A'); // inside TableGroup's onClick root
    const draggable = getDraggableContaining('A');

    fireEvent.mouseDown(badge, { ...mouse, clientX: 130, clientY: 130 });
    // The constraint must keep the sensor PENDING — no activation on press
    // (same activation signal the drag tests use). Guards against an
    // activate-AND-click-lands regression slipping past the toolbar assert.
    expect(draggable.className).not.toContain('opacity-70');
    fireEvent.mouseUp(badge, { ...mouse, clientX: 130, clientY: 130 });
    // Browsers synthesize a click after mouseup; jsdom does not — dispatch
    // it explicitly. Pre-#120, dnd-kit's capture-phase suppressor (armed by
    // instant activation) stopped this click before it reached React.
    fireEvent.click(badge, { clientX: 130, clientY: 130 });

    expect(await screen.findByRole('button', { name: 'Rotate Group' })).toBeInTheDocument();
    expect(props.onMoveGroup).not.toHaveBeenCalled();
  });

  it('sub-5px press on a room element fires onSelect (toolbar appears) and issues no move', async () => {
    const props = renderEditor(makeProps(makeChart({ roomElements: [DESK_ELEMENT] })));
    const label = screen.getByText('Teacher'); // inside the drag handle; click bubbles to the selecting wrapper
    const draggable = getDraggableContaining('Teacher');

    fireEvent.mouseDown(label, { ...mouse, clientX: 130, clientY: 130 });
    // Constraint keeps the sensor PENDING — no activation on press.
    expect(draggable.className).not.toContain('opacity-70');
    fireEvent.mouseUp(label, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.click(label, { clientX: 130, clientY: 130 });

    expect(await screen.findByRole('button', { name: 'Delete Element' })).toBeInTheDocument();
    expect(props.onMoveRoomElement).not.toHaveBeenCalled();
  });

  it('a ≥5px group drag returned to its origin activates but persists nothing (no-op belt)', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A');
    const draggable = getDraggableContaining('A');

    fireEvent.mouseDown(badge, { ...mouse, clientX: 130, clientY: 130 });
    // Exceed the 5px constraint → the drag ACTIVATES (non-vacuity control).
    // MouseSensor listens on the owner document for move/end.
    fireEvent.mouseMove(document, { ...mouse, clientX: 140, clientY: 140 });
    await waitFor(() => expect(draggable.className).toContain('opacity-70'));

    // Return to the origin and release: delta (0,0) → snapped target equals
    // the cached position → the belt skips the move call.
    fireEvent.mouseMove(document, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseUp(document, { ...mouse, clientX: 130, clientY: 130 });
    await waitFor(() => expect(draggable.className).not.toContain('opacity-70'));

    expect(props.onMoveGroup).not.toHaveBeenCalled();
    await settleClickSuppressor();
  });

  it('a ≥5px room-element drag returned to its origin activates but persists nothing (no-op belt)', async () => {
    const props = renderEditor(makeProps(makeChart({ roomElements: [DESK_ELEMENT] })));
    const label = screen.getByText('Teacher');
    const draggable = getDraggableContaining('Teacher');

    fireEvent.mouseDown(label, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(document, { ...mouse, clientX: 140, clientY: 140 });
    await waitFor(() => expect(draggable.className).toContain('opacity-70'));

    fireEvent.mouseMove(document, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseUp(document, { ...mouse, clientX: 130, clientY: 130 });
    await waitFor(() => expect(draggable.className).not.toContain('opacity-70'));

    expect(props.onMoveRoomElement).not.toHaveBeenCalled();
    await settleClickSuppressor();
  });

  it('a ≥5px group drag to a new position persists the snapped move (belt does not over-suppress)', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A');

    fireEvent.mouseDown(badge, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(document, { ...mouse, clientX: 140, clientY: 140 }); // activates
    fireEvent.mouseMove(document, { ...mouse, clientX: 175, clientY: 170 }); // delta (45, 40)
    fireEvent.mouseUp(document, { ...mouse, clientX: 175, clientY: 170 });

    // Delta is measured from the ORIGINAL mousedown (no 5px jump):
    // snap(120 + 45) = 160, snap(120 + 40) = 160.
    await waitFor(() => expect(props.onMoveGroup).toHaveBeenCalledWith('g1', 160, 160));
    expect(props.onMoveGroup).toHaveBeenCalledTimes(1);
    await settleClickSuppressor();
  });

  it('middle-button presses never start a drag (PrimaryButtonMouseSensor preserves the old PointerSensor contract)', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A');
    const draggable = getDraggableContaining('A');

    // dnd-kit's stock MouseSensor rejects only right-click — button 1 (middle)
    // would drag. The subclass requires button 0.
    fireEvent.mouseDown(badge, { button: 1, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(document, { button: 1, clientX: 175, clientY: 170 });
    fireEvent.mouseUp(document, { button: 1, clientX: 175, clientY: 170 });

    expect(draggable.className).not.toContain('opacity-70');
    expect(props.onMoveGroup).not.toHaveBeenCalled();
  });

  it('Escape cancels a live drag: nothing persists, the element snaps home, and the R key has no stale target', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A');

    fireEvent.mouseDown(badge, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(document, { ...mouse, clientX: 140, clientY: 140 }); // activates
    fireEvent.mouseMove(document, { ...mouse, clientX: 175, clientY: 170 });
    await waitFor(() => expect(getDraggableContaining('A').className).toContain('opacity-70'));

    // dnd-kit cancels on Escape → onDragCancel (NOT onDragEnd). The epoch key
    // remounts positioned children so their optimistic localPos can't be left
    // stranded at the aborted drag position.
    fireEvent.keyDown(document, { code: 'Escape' });

    await waitFor(() => {
      // Re-query: the remount replaced the node.
      expect(getDraggableContaining('A').style.left).toBe('120px');
    });
    expect(props.onMoveGroup).not.toHaveBeenCalled();

    // Stale draggingId would have routed R to the cancelled drag's target.
    fireEvent.keyDown(window, { key: 'r' });
    expect(props.onRotateGroup).not.toHaveBeenCalled();

    await settleClickSuppressor();
  });

  it('a cancelled STUDENT drag does not remount the positioned children (epoch is scoped)', async () => {
    const student = {
      id: 's1',
      name: 'Zed',
      pointTotal: 0,
      positiveTotal: 0,
      negativeTotal: 0,
      todayTotal: 0,
      thisWeekTotal: 0,
    };
    const props = { ...makeProps(), students: [student] };
    renderEditor(props);

    const groupNode = getDraggableContaining('A');
    const studentCard = getDraggableContaining('Zed');

    fireEvent.mouseDown(studentCard, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(document, { ...mouse, clientX: 175, clientY: 170 });
    await waitFor(() => expect(studentCard.style.opacity).toBe('0.5')); // activated

    fireEvent.keyDown(document, { code: 'Escape' });

    // Student drags carry no optimistic localPos, so their cancel must NOT
    // epoch-remount groups/elements — a global remount would silently wipe an
    // unrelated in-flight resize's local state. Same DOM node ⇒ no remount.
    await settleClickSuppressor();
    expect(getDraggableContaining('A')).toBe(groupNode);
    expect(props.onMoveGroup).not.toHaveBeenCalled();
  });

  it('keyboard dragging still works (KeyboardSensor deliberately re-added in the explicit sensor set)', async () => {
    const props = renderEditor();
    const draggable = getDraggableContaining('A');

    draggable.focus();
    fireEvent.keyDown(draggable, { code: 'Enter' }); // pick up
    await waitFor(() => expect(draggable.className).toContain('opacity-70'));
    fireEvent.keyDown(draggable, { code: 'ArrowRight' }); // +25px
    fireEvent.keyDown(draggable, { code: 'Enter' }); // drop

    // snap(120 + 25) = 160 on x; y unchanged.
    await waitFor(() => expect(props.onMoveGroup).toHaveBeenCalledWith('g1', 160, 120));
  });
});

describe('SeatingChartEditor touch activation (TouchSensor, delay: 200 tolerance: 8)', () => {
  it('a quick tap (no 200ms hold) selects the group and never activates a drag', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A');
    const draggable = getDraggableContaining('A');

    fireEvent.touchStart(badge, { touches: [{ clientX: 130, clientY: 130 }] });
    // Pending, not activated — the tap ends before the 200ms delay fires,
    // which also disarms dnd-kit's click-suppressor.
    expect(draggable.className).not.toContain('opacity-70');
    fireEvent.touchEnd(badge, { touches: [] });
    fireEvent.click(badge, { clientX: 130, clientY: 130 });

    expect(await screen.findByRole('button', { name: 'Rotate Group' })).toBeInTheDocument();
    expect(props.onMoveGroup).not.toHaveBeenCalled();
  });

  it('a 200ms hold then move drags the group and persists the snapped, scale-compensated move', async () => {
    vi.useFakeTimers();
    try {
      const props = renderEditor();
      const badge = screen.getByText('A');
      const draggable = getDraggableContaining('A');

      fireEvent.touchStart(badge, { touches: [{ clientX: 130, clientY: 130 }] });
      expect(draggable.className).not.toContain('opacity-70');

      // The activation delay is a plain setTimeout.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(draggable.className).toContain('opacity-70');

      // TouchSensor's move/end listeners live on the touched ELEMENT (unlike
      // MouseSensor's document listeners) — dispatch there, with a touches[]
      // payload on every event.
      fireEvent.touchMove(badge, { touches: [{ clientX: 175, clientY: 170 }] }); // delta (45, 40)
      fireEvent.touchEnd(badge, { touches: [] });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // scale is 1 in jsdom (fit guard) → snap(120 + 45) = snap(120 + 40) = 160.
      expect(props.onMoveGroup).toHaveBeenCalledWith('g1', 160, 160);

      // Flush the 50ms suppressor-removal timer BEFORE restoring real timers
      // — discarding it would leave the click suppressor on the shared
      // document for the rest of the file.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('moving past the 8px tolerance before the delay fires aborts the pending drag', async () => {
    vi.useFakeTimers();
    try {
      const props = renderEditor();
      const badge = screen.getByText('A');
      const draggable = getDraggableContaining('A');

      fireEvent.touchStart(badge, { touches: [{ clientX: 130, clientY: 130 }] });
      // 20px — clearly past the strict >8px tolerance → the scroll wins.
      fireEvent.touchMove(badge, { touches: [{ clientX: 150, clientY: 130 }] });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      expect(draggable.className).not.toContain('opacity-70');

      fireEvent.touchEnd(badge, { touches: [] });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(props.onMoveGroup).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SeatingChartEditor zoom-scale compensation', () => {
  /** Click the zoom-out button n times (0.1 per step from the scale-1 default). */
  function zoomOutTimes(n: number) {
    const zoomOut = screen.getByTitle('Zoom out');
    for (let i = 0; i < n; i++) fireEvent.click(zoomOut);
  }

  it('a mouse drag at 50% zoom persists the screen delta divided by scale', async () => {
    const props = renderEditor();
    zoomOutTimes(5); // 1.0 → ~0.5
    expect(screen.getByTitle('Fit to screen').textContent).toBe('50%');

    const badge = screen.getByText('A');
    fireEvent.mouseDown(badge, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(document, { ...mouse, clientX: 140, clientY: 140 }); // activates
    fireEvent.mouseMove(document, { ...mouse, clientX: 175, clientY: 170 }); // screen delta (45, 40)
    fireEvent.mouseUp(document, { ...mouse, clientX: 175, clientY: 170 });

    // Canvas delta = screen delta / 0.5 = (90, 80):
    // snap(120 + 90) = 200, snap(120 + 80) = 200. The unscaled (pre-fix)
    // math would have produced (160, 160).
    await waitFor(() => expect(props.onMoveGroup).toHaveBeenCalledWith('g1', 200, 200));
    await settleClickSuppressor();
  });

  it('tap-to-place at 50% zoom derives scale-divided coordinates from the click itself (no mousemove preview)', async () => {
    const props = renderEditor();
    zoomOutTimes(5);

    fireEvent.click(screen.getByRole('button', { name: '+ Add Table Group' }));
    const canvas = document.querySelector('.cursor-crosshair');
    expect(canvas).not.toBeNull();

    // No mousemove first — this is the touch path: previewPos is null and the
    // click's own coordinates are used. jsdom rects are all 0x0 at (0,0), so
    // clientX/Y map straight to scaled-canvas offsets.
    fireEvent.click(canvas!, { clientX: 100, clientY: 60 });

    // (100 - 0) / 0.5 = 200 → snap 200; (60 - 0) / 0.5 = 120 → snap 120.
    await waitFor(() => expect(props.onAddGroup).toHaveBeenCalledWith(200, 120));
  });

  it('mousemove preview placement agrees with the tap path at 50% zoom (same division, applied once)', async () => {
    const props = renderEditor();
    zoomOutTimes(5);

    fireEvent.click(screen.getByRole('button', { name: '+ Add Table Group' }));
    const canvas = document.querySelector('.cursor-crosshair');
    expect(canvas).not.toBeNull();

    // Mouse path: the preview mousemove computes (and stores) the position,
    // the click consumes it. Result must be identical to the direct tap path
    // — a second division anywhere would break this.
    fireEvent.mouseMove(canvas!, { clientX: 100, clientY: 60 });
    fireEvent.click(canvas!, { clientX: 100, clientY: 60 });

    await waitFor(() => expect(props.onAddGroup).toHaveBeenCalledWith(200, 120));
  });

  it('a room-element drag at 50% zoom persists the screen delta divided by scale (element branch, not just groups)', async () => {
    const props = renderEditor(makeProps(makeChart({ roomElements: [DESK_ELEMENT] })));
    zoomOutTimes(5);

    const label = screen.getByText('Teacher');
    fireEvent.mouseDown(label, { ...mouse, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(document, { ...mouse, clientX: 140, clientY: 140 }); // activates
    fireEvent.mouseMove(document, { ...mouse, clientX: 175, clientY: 170 }); // screen delta (45, 40)
    fireEvent.mouseUp(document, { ...mouse, clientX: 175, clientY: 170 });

    // Same math as the group branch — separately mutable code, separately pinned.
    await waitFor(() => expect(props.onMoveRoomElement).toHaveBeenCalledWith('e1', 200, 200));
    await settleClickSuppressor();
  });
});

describe('SeatingChartEditor resize (pointer events)', () => {
  /** Render with one desk element, select it, and return props + the e-handle. */
  async function setupSelectedDesk() {
    const props = renderEditor(makeProps(makeChart({ roomElements: [DESK_ELEMENT] })));
    const label = screen.getByText('Teacher');
    fireEvent.click(label, { clientX: 130, clientY: 130 });
    await screen.findByRole('button', { name: 'Delete Element' });
    const handles = getResizeHandles();
    // Fine pointer (setup.ts matchMedia mock): 8 handles, rendered w, e, n, s,
    // then corners — index 1 is the east edge.
    expect(handles).toHaveLength(8);
    return { props, eastHandle: handles[1] };
  }

  it('drag on the east handle resizes and persists exactly once on pointerup', async () => {
    const { props, eastHandle } = await setupSelectedDesk();

    fireEvent.pointerDown(eastHandle, { ...pointer, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(window, { ...pointer, clientX: 340, clientY: 300 }); // +40 screen px
    fireEvent.pointerUp(window, { ...pointer, clientX: 340, clientY: 300 });

    // scale 1: snap(120 + 40) = 160 wide; height/x/y unchanged.
    await waitFor(() =>
      expect(props.onResizeRoomElement).toHaveBeenCalledWith('e1', 160, 80, 120, 120)
    );
    expect(props.onResizeRoomElement).toHaveBeenCalledTimes(1);
  });

  it('pointercancel mid-resize reverts the dimensions and persists nothing', async () => {
    const { props, eastHandle } = await setupSelectedDesk();
    const rendered = () => getDraggableContaining('Teacher').parentElement!;

    fireEvent.pointerDown(eastHandle, { ...pointer, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(window, { ...pointer, clientX: 380, clientY: 300 });
    // Mid-gesture the local (optimistic) width tracks the pointer…
    expect(rendered().style.width).toBe('200px');

    // The browser reclaimed the pointer (scroll gesture, palm, system UI).
    fireEvent.pointerCancel(window, { ...pointer });

    // …and cancel must snap it BACK, not merely skip the persist — otherwise
    // the element renders resized while the DB still has the old dims.
    expect(rendered().style.width).toBe('120px');

    // No persist — and a late pointerup from the same id is a no-op too.
    fireEvent.pointerUp(window, { ...pointer, clientX: 380, clientY: 300 });
    expect(props.onResizeRoomElement).not.toHaveBeenCalled();
  });

  it('a plain tap on a handle (no movement) persists nothing', async () => {
    const { props, eastHandle } = await setupSelectedDesk();

    // Coarse-pointer reality: selected-element taps often land on a handle.
    // Without the changed-dims guard this fired a no-op DB write per tap.
    fireEvent.pointerDown(eastHandle, { ...pointer, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(window, { ...pointer, clientX: 300, clientY: 300 });

    expect(props.onResizeRoomElement).not.toHaveBeenCalled();
  });

  it('a foreign pointermove alone cannot steer the resize into a persist', async () => {
    const { props, eastHandle } = await setupSelectedDesk();

    fireEvent.pointerDown(eastHandle, { ...pointer, pointerId: 1, clientX: 300, clientY: 300 });
    // Foreign move would set width to snap(120 + 600) = 720 if the pointerId
    // filter on pointermove were dropped; the owning pointer then releases
    // WITHOUT moving. With the filter intact nothing changed → no persist.
    // (Discriminates the move-filter independently of the up-filter, which
    // the concurrent-pointer test below covers.)
    fireEvent.pointerMove(window, {
      isPrimary: false,
      button: 0,
      pointerId: 2,
      clientX: 900,
      clientY: 900,
    });
    fireEvent.pointerUp(window, { ...pointer, pointerId: 1, clientX: 300, clientY: 300 });

    expect(props.onResizeRoomElement).not.toHaveBeenCalled();
  });

  it('a second concurrent pointer can neither steer nor end the resize', async () => {
    const { props, eastHandle } = await setupSelectedDesk();

    fireEvent.pointerDown(eastHandle, { ...pointer, pointerId: 1, clientX: 300, clientY: 300 });
    // Foreign finger: different pointerId — its move must not steer, its up
    // must not persist-and-end.
    fireEvent.pointerMove(window, {
      isPrimary: false,
      button: 0,
      pointerId: 2,
      clientX: 900,
      clientY: 900,
    });
    fireEvent.pointerUp(window, {
      isPrimary: false,
      button: 0,
      pointerId: 2,
      clientX: 900,
      clientY: 900,
    });
    expect(props.onResizeRoomElement).not.toHaveBeenCalled();

    // The original pointer finishes normally with only ITS deltas applied.
    fireEvent.pointerMove(window, { ...pointer, pointerId: 1, clientX: 340, clientY: 300 });
    fireEvent.pointerUp(window, { ...pointer, pointerId: 1, clientX: 340, clientY: 300 });
    await waitFor(() =>
      expect(props.onResizeRoomElement).toHaveBeenCalledWith('e1', 160, 80, 120, 120)
    );
    expect(props.onResizeRoomElement).toHaveBeenCalledTimes(1);
  });

  it('non-primary or non-main-button presses never start a resize', async () => {
    const { props, eastHandle } = await setupSelectedDesk();

    fireEvent.pointerDown(eastHandle, {
      isPrimary: true,
      button: 2,
      pointerId: 1,
      clientX: 300,
      clientY: 300,
    });
    fireEvent.pointerDown(eastHandle, {
      isPrimary: false,
      button: 0,
      pointerId: 2,
      clientX: 300,
      clientY: 300,
    });
    fireEvent.pointerMove(window, { ...pointer, clientX: 380, clientY: 300 });
    fireEvent.pointerUp(window, { ...pointer, clientX: 380, clientY: 300 });

    expect(props.onResizeRoomElement).not.toHaveBeenCalled();
  });

  it('resize deltas are divided by the zoom scale', async () => {
    const props = renderEditor(makeProps(makeChart({ roomElements: [DESK_ELEMENT] })));
    const zoomOut = screen.getByTitle('Zoom out');
    for (let i = 0; i < 5; i++) fireEvent.click(zoomOut); // → 0.5

    fireEvent.click(screen.getByText('Teacher'), { clientX: 130, clientY: 130 });
    await screen.findByRole('button', { name: 'Delete Element' });
    const eastHandle = getResizeHandles()[1];

    fireEvent.pointerDown(eastHandle, { ...pointer, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(window, { ...pointer, clientX: 340, clientY: 300 }); // +40 screen px
    fireEvent.pointerUp(window, { ...pointer, clientX: 340, clientY: 300 });

    // 40 / 0.5 = 80 canvas px: snap(120 + 80) = 200 wide.
    await waitFor(() =>
      expect(props.onResizeRoomElement).toHaveBeenCalledWith('e1', 200, 80, 120, 120)
    );
  });
});

describe('SeatingChartEditor toolbar (touch parity)', () => {
  it('Rotate Element button rotates the selected element (keyboard R no longer required)', async () => {
    const props = renderEditor(makeProps(makeChart({ roomElements: [DESK_ELEMENT] })));

    fireEvent.click(screen.getByText('Teacher'), { clientX: 130, clientY: 130 });
    const rotate = await screen.findByRole('button', { name: 'Rotate Element' });
    fireEvent.click(rotate);

    expect(props.onRotateRoomElement).toHaveBeenCalledWith('e1');
  });
});

describe('SeatingChartEditor coarse-pointer adaptations', () => {
  it('coarse pointers get 4 corner handles with enlarged hit targets (fine keeps 8)', async () => {
    const restore = withCoarsePointer();
    try {
      renderEditor(makeProps(makeChart({ roomElements: [DESK_ELEMENT] })));

      fireEvent.click(screen.getByText('Teacher'), { clientX: 130, clientY: 130 });
      await screen.findByRole('button', { name: 'Delete Element' });

      const handles = getResizeHandles();
      expect(handles).toHaveLength(4);
      // 32px screen hit box at scale 1 (sizes are scale-divided so the
      // on-screen target stays constant at any zoom).
      expect(handles[0].style.width).toBe('32px');
      // Visible dot nested inside the transparent hit box.
      expect(handles[0].querySelector('div')).not.toBeNull();
    } finally {
      restore();
    }
  });

  it('handle hit boxes are clamped on small elements so the drag surface stays reachable', async () => {
    const restore = withCoarsePointer();
    try {
      renderEditor(makeProps(makeChart({ roomElements: [SINK_ELEMENT] })));

      fireEvent.click(screen.getByText('Sink'), { clientX: 130, clientY: 130 });
      await screen.findByRole('button', { name: 'Delete Element' });

      // Unclamped, four 32px corner boxes would fully tile a 40x40 sink —
      // press-and-hold drags and selection taps could never reach the element
      // itself. The clamp caps each box at 40% of the smaller dimension.
      const handles = getResizeHandles();
      expect(handles).toHaveLength(4);
      expect(handles[0].style.width).toBe('16px'); // min(32, 40 * 0.4)
    } finally {
      restore();
    }
  });

  it('coarse pointers floor the auto-fit at MIN_TOUCH_SCALE (0.44) so seats stay tappable', () => {
    const restore = withCoarsePointer();
    try {
      renderEditor();
      const container = document.querySelector<HTMLElement>('.overscroll-contain');
      expect(container).not.toBeNull();

      // A viewport narrow enough that raw fit would be ~0.25 — the floor wins.
      // (chart 800 wide: (300-32)/(800+272) = 0.25.)
      Object.defineProperty(container!, 'clientWidth', { value: 300, configurable: true });
      fireEvent(window, new Event('resize'));

      expect(screen.getByTitle('Fit to screen').textContent).toBe('44%');
    } finally {
      restore();
    }
  });
});

describe('SeatingChartEditor auto-fit on open', () => {
  /** Stub the scroller's clientWidth and re-run the fit via its resize listener. */
  function stubContainerWidth(value: number) {
    const container = document.querySelector<HTMLElement>('.overscroll-contain');
    expect(container).not.toBeNull();
    Object.defineProperty(container!, 'clientWidth', { value, configurable: true });
    fireEvent(window, new Event('resize'));
  }

  const zoomLabel = () => screen.getByTitle('Fit to screen').textContent;

  it('computes fit from the container width with the panel in the denominator', () => {
    renderEditor();

    // jsdom mounts with clientWidth 0 → the guard keeps the scale-1 default
    // (every other test in this file depends on that).
    expect(zoomLabel()).toBe('100%');

    // (968 - 32) / (800 + 16 + 256) = 936 / 1072 ≈ 0.873 → 87%.
    stubContainerWidth(968);
    expect(zoomLabel()).toBe('87%');
  });

  it('fine pointers get the RAW fit — the 0.44 touch floor is coarse-only', () => {
    renderEditor();

    // (300 - 32) / 1072 = 0.25 — an unconditional floor would show 44%.
    stubContainerWidth(300);
    expect(zoomLabel()).toBe('25%');

    // And the zoom-out floor follows fitScale below MIN_ZOOM: at the fit
    // there is nothing further out, so the button is disabled.
    expect(screen.getByTitle('Zoom out')).toBeDisabled();
  });

  it('manual zoom survives window resizes; the fit button re-arms auto-fit', () => {
    renderEditor();
    stubContainerWidth(968);
    expect(zoomLabel()).toBe('87%');

    // Manual zoom…
    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(zoomLabel()).toBe('77%');

    // …must NOT be clobbered by a refit (rotation/Split View/window resize).
    fireEvent(window, new Event('resize'));
    expect(zoomLabel()).toBe('77%');

    // The % button is the explicit way back to fit — and re-arms auto-fit.
    fireEvent.click(screen.getByTitle('Fit to screen'));
    expect(zoomLabel()).toBe('87%');
    fireEvent(window, new Event('resize'));
    expect(zoomLabel()).toBe('87%');
  });
});
