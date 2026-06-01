import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as path from 'node:path';

/**
 * #23 verification — unify cross-device totals refresh (invalidate-not-merge).
 *
 * The bug this guards: awarding points updated today/this-week on the awarding
 * screen but NOT on a second screen until reload (all-time already crossed over).
 * #23 made the students-table realtime callback invalidate-and-refetch, so the
 * same realtime event that already refreshed all-time now refreshes today/week too.
 *
 * This drives the REAL realtime path (two browser contexts as the same teacher,
 * one local Supabase backend): award in device A, assert device B's counters
 * update WITHOUT a reload via web-first assertions; then undo and assert the
 * decrement. A unit test only proves "invalidate was called" — this proves
 * trigger → realtime event → refetch → correct on-screen value cross-device.
 */

const AUTH_FILE = path.join(process.cwd(), '.auth', 'user.json');

function admin(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required (.env.test)');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Unique per run so parallel/repeat runs never collide (and cleanup is exact).
const slug = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const CLASSROOM_NAME = `e2e-rt-${slug}`;
const STUDENT_NAME = `RT Student ${slug}`;
const BEHAVIOR_NAME = `E2E Award ${slug}`;
const AWARD_POINTS = 2;

let classroomId = '';
let behaviorId = '';

test.beforeAll(async () => {
  const db = admin();
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
  const db = admin();
  // classroom delete cascades students + point_transactions (FK ON DELETE CASCADE).
  if (classroomId) await db.from('classrooms').delete().eq('id', classroomId);
  if (behaviorId) await db.from('behaviors').delete().eq('id', behaviorId);
});

// Boot a page straight into the class DashboardView for the seeded classroom by
// pre-seeding the persisted view + active-classroom localStorage keys, so we don't
// depend on home → card-click navigation.
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

test('#23: award on one device updates today/week on another via realtime (no reload); undo decrements', async ({
  page,
  browser,
}) => {
  // Device A = page (storageState auth from the setup project).
  // Device B = a second context as the SAME teacher (the watcher).
  const ctxB = await browser.newContext({ storageState: AUTH_FILE });
  const pageB = await ctxB.newPage();

  // Count the time-totals RPC on the watcher — the cost the review flagged.
  let watcherRpcCount = 0;
  pageB.on('request', (r) => {
    if (r.url().includes('/rpc/get_student_time_totals')) watcherRpcCount += 1;
  });

  try {
    await openClassView(page);
    await openClassView(pageB);

    const cardA = page.getByRole('button', { name: new RegExp(STUDENT_NAME) });
    const cardB = pageB.getByRole('button', { name: new RegExp(STUDENT_NAME) });
    const classTotalB = pageB.getByRole('button', { name: /Class total/ });

    // Baseline: fresh student, today = 0 → no "today" badge on the watcher.
    await expect(cardB.getByText(/today/)).toHaveCount(0);

    // Device A awards via the behavior picker (modal closes on success).
    await cardA.click();
    const dialog = page.getByRole('dialog', {
      name: new RegExp(`Award points to ${STUDENT_NAME}`),
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: new RegExp(BEHAVIOR_NAME) }).click();

    // Device B, NO reload: the student-card "today" badge appears as "+2 today"
    // via realtime — the exact counter the user reported as broken (screenshot #1).
    await expect(cardB.getByText(/\+2 today/)).toBeVisible({ timeout: 15_000 });
    // ...and the class-total card reflects the +2 (user screenshot #2: today + week).
    await expect(classTotalB).toContainText('+2', { timeout: 15_000 });

    // Device A undoes within the toast window (cross-device undo path #23 reroutes
    // from the deleted local-delta to trigger → realtime → refetch).
    await page.getByRole('button', { name: /Undo/i }).click();

    // Device B, NO reload: today returns to 0 → badge disappears.
    await expect(cardB.getByText(/today/)).toHaveCount(0, { timeout: 15_000 });

     
    console.log(
      `[#23] watcher get_student_time_totals RPC count over load+award+undo: ${watcherRpcCount}`
    );
  } finally {
    await ctxB.close();
  }
});
