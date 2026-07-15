import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { supabaseAdmin } from '../support/helpers/supabase-admin';

/**
 * Responsive mobile shell (feat/mobile-app) — phone-viewport E2E.
 *
 * Runs ONLY in the `mobile` Playwright project (390x844, hasTouch); the
 * chromium project testIgnores this spec and the mobile project's testMatch
 * excludes the desktop specs — no per-test viewport conditionals needed.
 *
 * Covers the phone shell contract end-to-end:
 * - sidebar hidden below md, BottomNav visible with Home/Class/Profile tabs
 * - tab navigation + aria-current, home card -> class dashboard
 * - Activity panel as a full-width overlay with its phone-only close button
 * - award flow: dialog fits the viewport; UndoToast floats above the tab bar
 *   (offset via --app-bottom-nav-h)
 * - phone-only Preferences (Theme / Sign out) on the Profile view
 */

// Unique per worker/run so parallel workers never collide (and cleanup is
// exact) — same seeding pattern as realtime-cross-device-totals.spec.ts.
const slug = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const CLASSROOM_NAME = `e2e-mobile-${slug}`;
const STUDENT_NAME = `Mobile Student ${slug}`;
const BEHAVIOR_NAME = `Mobile Award ${slug}`;
const AWARD_POINTS = 2;

const VIEWPORT = { width: 390, height: 844 };

let classroomId = '';
let behaviorId = '';

test.beforeAll(async () => {
  const db = supabaseAdmin();
  const email = process.env.VITE_TEST_EMAIL;
  if (!email) throw new Error('VITE_TEST_EMAIL required (.env.test)');

  const { data: list, error: lErr } = await db.auth.admin.listUsers();
  if (lErr) throw lErr;
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`test user ${email} not found — run npm run test:seed`);

  const { data: c, error: cErr } = await db
    .from('classrooms')
    .insert({ name: CLASSROOM_NAME, user_id: user.id })
    .select('id')
    .single();
  if (cErr || !c) throw new Error(`classroom seed failed: ${cErr?.message}`);
  classroomId = c.id as string;

  const { error: sErr } = await db
    .from('students')
    .insert({ name: STUDENT_NAME, classroom_id: classroomId });
  if (sErr) throw new Error(`student seed failed: ${sErr.message}`);

  // behaviors are global (no user/classroom scope); a unique name lets us target it.
  const { data: b, error: bErr } = await db
    .from('behaviors')
    .insert({
      name: BEHAVIOR_NAME,
      points: AWARD_POINTS,
      icon: '⭐',
      category: 'positive',
      is_custom: true,
    })
    .select('id')
    .single();
  if (bErr || !b) throw new Error(`behavior seed failed: ${bErr?.message}`);
  behaviorId = b.id as string;
});

test.afterAll(async () => {
  const db = supabaseAdmin();
  // classroom delete cascades students + point_transactions (FK ON DELETE CASCADE).
  if (classroomId) await db.from('classrooms').delete().eq('id', classroomId);
  if (behaviorId) await db.from('behaviors').delete().eq('id', behaviorId);
});

// The phone tab bar: the only nav whose buttons are visible below md (the
// sidebar and its inner nav are display:none via `hidden md:flex`, so the role
// engine never matches their buttons here).
function bottomNav(page: Page) {
  return page.locator('nav').filter({
    has: page.getByRole('button', { name: 'Profile', exact: true }),
  });
}

// Boot straight into the home view (clear any persisted class view).
async function openHomeView(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('app:view', 'home');
  });
  await page.goto('/');
  await expect(bottomNav(page).getByRole('button', { name: 'Home', exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

// Boot a page straight into the class DashboardView for the seeded classroom by
// pre-seeding the persisted view + active-classroom localStorage keys
// (realtime-cross-device-totals.spec.ts precedent).
async function openClassView(page: Page): Promise<void> {
  await page.addInitScript((cid: string) => {
    window.localStorage.setItem('app:view', 'dashboard');
    window.localStorage.setItem('app:activeClassroomId', cid);
  }, classroomId);
  await page.goto('/');
  // Student card visible = class view loaded + roster fetched.
  await expect(page.getByRole('button', { name: new RegExp(STUDENT_NAME) })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Mobile shell (390x844)', () => {
  test('Given a phone viewport, When the app loads, Then the sidebar is hidden and the bottom nav shows exactly 3 tabs', async ({
    page,
  }) => {
    await openHomeView(page);

    // The desktop sidebar chrome must not be visible below md.
    await expect(page.locator('aside')).toBeHidden();

    const nav = bottomNav(page);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Class', exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
    await expect(nav.getByRole('button')).toHaveCount(3);
  });

  test('Given the home view, When a classroom card is tapped, Then the class dashboard opens and the Class tab is current', async ({
    page,
  }) => {
    await openHomeView(page);
    const nav = bottomNav(page);
    await expect(nav.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await page.getByRole('button', { name: new RegExp(CLASSROOM_NAME) }).click();

    await expect(page.getByRole('heading', { name: CLASSROOM_NAME })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Class', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('Given the class view, When Activity is toggled, Then the panel overlays the full viewport width and its close button restores the grid', async ({
    page,
  }) => {
    await openClassView(page);

    await page.getByRole('button', { name: 'Activity', exact: true }).click();

    const panel = page.locator('aside').filter({ hasText: 'Activity · today' });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    // Full-bleed overlay: spans (roughly) the whole 390px viewport width.
    expect(panelBox!.x).toBeLessThanOrEqual(1);
    expect(panelBox!.width).toBeGreaterThanOrEqual(VIEWPORT.width - 10);

    // Phone-only close affordance dismisses the overlay…
    await panel.getByRole('button', { name: 'Close activity' }).click();
    await expect(panel).toHaveCount(0);
    // …and the student grid is interactive again.
    await expect(page.getByRole('button', { name: new RegExp(STUDENT_NAME) })).toBeVisible();
  });

  test('Given the class view, When a student is awarded points, Then the dialog fits the viewport and the UndoToast floats above the bottom nav', async ({
    page,
  }) => {
    await openClassView(page);

    await page.getByRole('button', { name: new RegExp(STUDENT_NAME) }).click();

    const dialog = page.getByRole('dialog', {
      name: new RegExp(`Award points to ${STUDENT_NAME}`),
    });
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    // Fully inside the 390x844 viewport — no clipped edges on the phone.
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(VIEWPORT.width);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(VIEWPORT.height);

    // Award via the seeded behavior (modal closes on success).
    await dialog.getByRole('button', { name: new RegExp(BEHAVIOR_NAME) }).click();

    const undoButton = page.getByRole('button', { name: 'Undo', exact: true });
    await expect(undoButton).toBeVisible();

    // The fixed toast container offsets by --app-bottom-nav-h: its bottom edge
    // must sit ABOVE the tab bar's top edge, never under it.
    const toast = page.locator('div.fixed').filter({ has: undoButton });
    const toastBox = await toast.boundingBox();
    const navBox = await bottomNav(page).boundingBox();
    expect(toastBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(navBox!.y);
  });

  test('Given the bottom nav, When Profile is tapped, Then the phone-only Preferences expose Theme and Sign out', async ({
    page,
  }) => {
    await openHomeView(page);
    const nav = bottomNav(page);

    await nav.getByRole('button', { name: 'Profile', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Profile', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    // Phone-only Preferences (md:hidden section — the sidebar footer is gone here).
    await expect(page.getByRole('button', { name: /Theme/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign out/ })).toBeVisible();
  });
});
