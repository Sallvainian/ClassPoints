/**
 * SeatingChartEditor — pointer-activation semantics (dnd-kit activationConstraint).
 *
 * What jsdom CAN express (verified against jsdom 29 + @dnd-kit/core 6.3.1):
 * - jsdom 29 implements PointerEvent, and `isPrimary`/`button`/`clientX|Y`
 *   survive the constructor — which is everything dnd-kit's PointerSensor
 *   activator and distance constraint read.
 * - dnd-kit's click-suppressor is a capture-phase document `click` listener
 *   armed ONLY on sensor ACTIVATION (AbstractPointerSensor.handleStart) and
 *   removed 50ms after detach. So a `click` dispatched after a sub-5px
 *   press/release reaches React exactly when the constraint keeps the sensor
 *   pending (the fix), and is swallowed when the press activated a drag
 *   instantly (the pre-fix bug). The suppression mechanics are therefore
 *   faithfully reproduced here. Pin attribution (mutation-verified): the two
 *   sub-5px click tests fail with the `sensors` prop removed; the two
 *   drag-and-return tests fail with the no-op belt removed; the move-persist
 *   test pins unchanged ≥5px drag semantics (delta from the original
 *   pointerdown, belt does not over-suppress); the keyboard test pins
 *   KeyboardSensor's presence in the explicit (defaults-replacing) sensor set.
 *
 * What jsdom can NOT express — covered by the spec's runtime Playwright pass:
 * - Browser-synthesized clicks after pointerup (clicks are dispatched
 *   explicitly below), real hit-testing/geometry (every rect is 0x0), and
 *   droppable collision (`over` is never populated), so seat-assignment drops
 *   and the visual no-5px-jump drag feel are runtime-only checks.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

function makeProps(chart: SeatingChart = makeChart()) {
  return {
    chart,
    students: [],
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

const pointer = { isPrimary: true, button: 0, pointerId: 1 };

describe('SeatingChartEditor pointer activation (activationConstraint distance: 5)', () => {
  it('sub-5px press on a group fires onSelect (toolbar appears) and issues no move', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A'); // inside TableGroup's onClick root
    const draggable = getDraggableContaining('A');

    fireEvent.pointerDown(badge, { ...pointer, clientX: 130, clientY: 130 });
    // The constraint must keep the sensor PENDING — no activation on press
    // (same activation signal the drag tests use). Guards against an
    // activate-AND-click-lands regression slipping past the toolbar assert.
    expect(draggable.className).not.toContain('opacity-70');
    fireEvent.pointerUp(badge, { ...pointer, clientX: 130, clientY: 130 });
    // Browsers synthesize a click after pointerup; jsdom does not — dispatch
    // it explicitly. Pre-fix, dnd-kit's capture-phase suppressor (armed by
    // instant activation) stops this click before it reaches React.
    fireEvent.click(badge, { clientX: 130, clientY: 130 });

    expect(await screen.findByRole('button', { name: 'Rotate Group' })).toBeInTheDocument();
    expect(props.onMoveGroup).not.toHaveBeenCalled();
  });

  it('sub-5px press on a room element fires onSelect (toolbar appears) and issues no move', async () => {
    const chart = makeChart({
      roomElements: [
        {
          id: 'e1',
          type: 'teacher_desk',
          x: ORIGIN.x,
          y: ORIGIN.y,
          width: 120,
          height: 80,
          rotation: 0,
        },
      ],
    });
    const props = renderEditor(makeProps(chart));
    const label = screen.getByText('Teacher'); // inside the drag handle; click bubbles to the selecting wrapper
    const draggable = getDraggableContaining('Teacher');

    fireEvent.pointerDown(label, { ...pointer, clientX: 130, clientY: 130 });
    // Constraint keeps the sensor PENDING — no activation on press.
    expect(draggable.className).not.toContain('opacity-70');
    fireEvent.pointerUp(label, { ...pointer, clientX: 130, clientY: 130 });
    fireEvent.click(label, { clientX: 130, clientY: 130 });

    expect(await screen.findByRole('button', { name: 'Delete Element' })).toBeInTheDocument();
    expect(props.onMoveRoomElement).not.toHaveBeenCalled();
  });

  it('a ≥5px group drag returned to its origin activates but persists nothing (no-op belt)', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A');
    const draggable = getDraggableContaining('A');

    fireEvent.pointerDown(badge, { ...pointer, clientX: 130, clientY: 130 });
    // Exceed the 5px constraint → the drag ACTIVATES (non-vacuity control).
    fireEvent.pointerMove(document, { ...pointer, clientX: 140, clientY: 140 });
    await waitFor(() => expect(draggable.className).toContain('opacity-70'));

    // Return to the origin and release: delta (0,0) → snapped target equals
    // the cached position → the belt skips the move call.
    fireEvent.pointerMove(document, { ...pointer, clientX: 130, clientY: 130 });
    fireEvent.pointerUp(document, { ...pointer, clientX: 130, clientY: 130 });
    await waitFor(() => expect(draggable.className).not.toContain('opacity-70'));

    expect(props.onMoveGroup).not.toHaveBeenCalled();
  });

  it('a ≥5px room-element drag returned to its origin activates but persists nothing (no-op belt)', async () => {
    const chart = makeChart({
      roomElements: [
        {
          id: 'e1',
          type: 'teacher_desk',
          x: ORIGIN.x,
          y: ORIGIN.y,
          width: 120,
          height: 80,
          rotation: 0,
        },
      ],
    });
    const props = renderEditor(makeProps(chart));
    const label = screen.getByText('Teacher');
    const draggable = getDraggableContaining('Teacher');

    fireEvent.pointerDown(label, { ...pointer, clientX: 130, clientY: 130 });
    fireEvent.pointerMove(document, { ...pointer, clientX: 140, clientY: 140 });
    await waitFor(() => expect(draggable.className).toContain('opacity-70'));

    fireEvent.pointerMove(document, { ...pointer, clientX: 130, clientY: 130 });
    fireEvent.pointerUp(document, { ...pointer, clientX: 130, clientY: 130 });
    await waitFor(() => expect(draggable.className).not.toContain('opacity-70'));

    expect(props.onMoveRoomElement).not.toHaveBeenCalled();
  });

  it('a ≥5px group drag to a new position persists the snapped move (belt does not over-suppress)', async () => {
    const props = renderEditor();
    const badge = screen.getByText('A');

    fireEvent.pointerDown(badge, { ...pointer, clientX: 130, clientY: 130 });
    fireEvent.pointerMove(document, { ...pointer, clientX: 140, clientY: 140 }); // activates
    fireEvent.pointerMove(document, { ...pointer, clientX: 175, clientY: 170 }); // delta (45, 40)
    fireEvent.pointerUp(document, { ...pointer, clientX: 175, clientY: 170 });

    // Delta is measured from the ORIGINAL pointerdown (no 5px jump):
    // snap(120 + 45) = 160, snap(120 + 40) = 160.
    await waitFor(() => expect(props.onMoveGroup).toHaveBeenCalledWith('g1', 160, 160));
    expect(props.onMoveGroup).toHaveBeenCalledTimes(1);
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
