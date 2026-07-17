import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { supabaseAdmin } from '../support/helpers/supabase-admin';

/**
 * Seating-chart editor — touch/tablet E2E (feat/seating-touch).
 *
 * Runs ONLY in the `ipad` Playwright project (834x1194, hasTouch); the
 * chromium project testIgnores this spec and the ipad project's testMatch
 * excludes every other spec — no per-test viewport conditionals needed.
 *
 * The editor was rewritten for touch on this branch (SeatingChartEditor.tsx):
 * MouseSensor(distance 5) + TouchSensor(delay 200, tolerance 8) + KeyboardSensor,
 * auto-fit on open, and tap-to-place that derives canvas coords from the tap
 * event (dividing screen deltas by the zoom scale) when no mousemove preview
 * exists. These are the tap-level contracts jsdom cannot express — the unit
 * suite (SeatingChartEditor.test.tsx) covers pointer-activation semantics; this
 * spec covers real geometry: auto-fit scale, tap-to-place landing under the
 * finger, and the tap-driven element toolbar.
 *
 * Gestures are tap-only. Long-press drags are flaky under CDP touch emulation,
 * so no drag is exercised here; `locator.tap()` / `touchscreen.tap()` require
 * hasTouch, which the ipad project supplies.
 *
 * Seating is a viewMode INSIDE the dashboard, not an App view: boot writes
 * 'app:view'='dashboard', 'app:activeClassroomId'=<seeded id> (both plain
 * strings — App.tsx:49 / AppContext.tsx:15 read them via getItem, no JSON), and
 * 'classpoints-display-settings'=JSON {"viewMode":"seating"} (useDisplaySettings
 * .ts:24 JSON.parses it). No seating chart is seeded — each test creates one
 * through the empty-state CTA, which auto-opens the editor.
 */

// Unique per worker/run so parallel workers never collide (same seeding pattern
// as mobile-shell.spec.ts / realtime-cross-device-totals.spec.ts).
const slug = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

let userId = '';
// Every test seeds its OWN classroom: seating_charts has UNIQUE(classroom_id)
// (migration 008) and a created chart flips the boot view from the empty-state
// CTA to view-mode, so a shared classroom would block later tests' "Create
// Seating Chart" button. Tracked for cascade cleanup in afterAll.
const createdClassroomIds: string[] = [];

test.beforeAll(async () => {
  const db = supabaseAdmin();
  const email = process.env.VITE_TEST_EMAIL;
  if (!email) throw new Error('VITE_TEST_EMAIL required (.env.test)');

  const { data: list, error: lErr } = await db.auth.admin.listUsers();
  if (lErr) throw lErr;
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`test user ${email} not found — run npm run test:seed`);
  userId = user.id;
});

test.afterAll(async () => {
  const db = supabaseAdmin();
  // Classroom delete cascades students, seating_charts, seating_groups and
  // room_elements (all FK ON DELETE CASCADE — migration 008).
  for (const id of createdClassroomIds) {
    await db.from('classrooms').delete().eq('id', id);
  }
});

// Seed a fresh classroom (RLS-owned by the test user) + two students, and
// return its id. Student names deliberately start with 'P' so no avatar badge
// collides with the seating group's 'A' letter badge.
async function seedClassroom(): Promise<string> {
  const db = supabaseAdmin();
  const name = `e2e-seating-${slug}-${createdClassroomIds.length}`;

  const { data: c, error: cErr } = await db
    .from('classrooms')
    .insert({ name, user_id: userId })
    .select('id')
    .single();
  if (cErr || !c) throw new Error(`classroom seed failed: ${cErr?.message}`);
  const id = c.id as string;
  createdClassroomIds.push(id);

  const { error: sErr } = await db.from('students').insert([
    { name: `Pupil One ${slug}`, classroom_id: id },
    { name: `Pupil Two ${slug}`, classroom_id: id },
  ]);
  if (sErr) throw new Error(`student seed failed: ${sErr.message}`);

  return id;
}

// Boot into the dashboard in seating viewMode, then create a chart through the
// UI — the empty-state "Create Seating Chart" button calls createChart() and
// setIsEditing(true) (SeatingChartView.tsx), so the editor mounts.
async function openSeatingEditor(page: Page, classroomId: string): Promise<void> {
  await page.addInitScript((cid: string) => {
    window.localStorage.setItem('app:view', 'dashboard');
    window.localStorage.setItem('app:activeClassroomId', cid);
    window.localStorage.setItem(
      'classpoints-display-settings',
      JSON.stringify({ viewMode: 'seating' })
    );
  }, classroomId);
  await page.goto('/');

  // Empty-state CTA visible = dashboard mounted in seating viewMode and the
  // chart query resolved to "no chart yet".
  const createBtn = page.getByRole('button', { name: 'Create Seating Chart' });
  await expect(createBtn).toBeVisible({ timeout: 30_000 });
  await createBtn.click();

  // Editor mounted (its heading is an <h2>, distinct from the view-mode "Edit
  // Seating Chart" button we never reach).
  await expect(page.getByRole('heading', { name: 'Edit Seating Chart' })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Seating editor touch (iPad 834x1194)', () => {
  test('[P1][SEAT.TOUCH-E2E-01] Given the editor opens on a tablet viewport, When it mounts, Then the canvas auto-fits below 100% zoom', async ({
    page,
  }) => {
    const classroomId = await seedClassroom();
    await openSeatingEditor(page, classroomId);

    // The zoom-percentage control doubles as "Fit to screen"; at 834px a 1600px
    // canvas auto-fits to ~44%. The bar is simply: it is NOT 100% (auto-fit ran).
    const zoomButton = page.getByTitle('Fit to screen');
    await expect(zoomButton).toBeVisible();
    const label = (await zoomButton.textContent())?.trim() ?? '';
    expect(label).not.toBe('100%');
    const percent = parseInt(label, 10);
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(60);
  });

  test('[P0][SEAT.TOUCH-E2E-02] Given the editor at fit zoom, When a table group is tapped onto the canvas, Then it lands under the finger (scale fix)', async ({
    page,
  }) => {
    const classroomId = await seedClassroom();
    await openSeatingEditor(page, classroomId);

    // Arm placement: the toolbar button flips to placement copy.
    await page.getByRole('button', { name: '+ Add Table Group' }).click();
    await expect(page.getByRole('button', { name: 'Tap or click to place...' })).toBeVisible();

    // The canvas is the only element that gains `cursor-crosshair` in placement
    // mode. Its box is stable across placement (only the outline/cursor change),
    // so capture it now and reuse for the position assertion below.
    const box = await page.locator('.cursor-crosshair').boundingBox();
    expect(box).not.toBeNull();

    // Tap the visual centre of the canvas with an absolute-coordinate touch
    // (deterministic geometry). handleCanvasClick divides the screen delta by
    // `scale` before snapping: at ~44% fit, the group must land under the tap.
    const tapX = box!.x + box!.width * 0.5;
    const tapY = box!.y + box!.height * 0.4;
    await page.touchscreen.tap(tapX, tapY);

    // First group is 'A' (getNextGroupLetter). Its letter badge (exact 'A',
    // case-sensitive — no 'P'-avatar or heading collides) proves placement.
    const badge = page.getByText('A', { exact: true });
    await expect(badge).toBeVisible();

    // Scale-fix pin. With the divide, the group sits under the finger — its
    // centred badge is ~half a group-width (≈45px on screen at fit) to the
    // right of the tap. WITHOUT the divide the group collapses toward the
    // origin (badge ≈150px away), so a 100px tolerance cleanly separates the
    // fixed path from the regression. (addGroup clamps to the canvas, so a
    // broken placement never lands off-canvas — position, not mere visibility,
    // is what pins the fix.)
    const badgeBox = await badge.boundingBox();
    expect(badgeBox).not.toBeNull();
    const badgeCenterX = badgeBox!.x + badgeBox!.width / 2;
    expect(Math.abs(badgeCenterX - tapX)).toBeLessThan(100);
    // And it stays within the canvas horizontal bounds.
    expect(badgeCenterX).toBeGreaterThanOrEqual(box!.x);
    expect(badgeCenterX).toBeLessThanOrEqual(box!.x + box!.width);
  });

  test('[P1][SEAT.TOUCH-E2E-03] Given a placed room element, When it is tapped, Then the rotate/delete toolbar is reachable and delete removes it', async ({
    page,
  }) => {
    const classroomId = await seedClassroom();
    await openSeatingEditor(page, classroomId);

    // Arm the sink tool and tap it onto the canvas.
    await page.getByRole('button', { name: '+ Sink' }).click();
    await expect(page.getByRole('button', { name: 'Tap or click to place...' })).toBeVisible();
    const box = await page.locator('.cursor-crosshair').boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);

    // The placed element renders its default 'Sink' label (exact — the toolbar
    // button reads '+ Sink', so exact matching excludes it).
    const sinkLabel = page.getByText('Sink', { exact: true });
    await expect(sinkLabel).toBeVisible();

    // Tap the element to select it. A quick tap is under TouchSensor's 200ms
    // hold, so it selects (native click bubbling to the wrapper's onClick)
    // instead of starting a drag. The dnd draggable wrapper is the tap target;
    // its 'Sink' text is the only draggable containing that word here.
    const sinkElement = page
      .locator('[aria-roledescription="draggable"]')
      .filter({ hasText: 'Sink' });
    await sinkElement.tap();

    // Selection surfaces the element toolbar.
    const rotateBtn = page.getByRole('button', { name: 'Rotate Element' });
    const deleteBtn = page.getByRole('button', { name: 'Delete Element' });
    await expect(rotateBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // Rotate keeps the selection: element stays visible, toolbar stays open.
    await rotateBtn.tap();
    await expect(sinkLabel).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // Delete removes the element from the canvas.
    await deleteBtn.tap();
    await expect(page.getByText('Sink', { exact: true })).toHaveCount(0);
  });
});
