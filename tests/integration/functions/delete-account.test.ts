/**
 * delete-account Edge Function — integration against the LOCAL stack.
 *
 * `supabase start` serves everything under supabase/functions/ at
 * /functions/v1/<name> (edge_runtime is enabled in config.toml), so these
 * tests exercise the REAL function: JWT-derived identity, the service-role
 * deleteUser, and the full FK cascade (classrooms → students → transactions,
 * plus behaviors/sound-settings/layout-presets — all ON DELETE CASCADE to
 * auth.users).
 *
 * User lifecycle is managed manually rather than via UserFactory: the user
 * under test is deleted BY the function, and UserFactory.cleanup() throws on
 * an already-deleted id.
 */
import { createClient } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';
import { supabaseAdmin } from '../../support/helpers/supabase-admin';
import { ClassroomFactory } from '../../support/fixtures/factories/classroom.factory';
import { uniqueSlug } from '../../support/helpers/unique';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY as string;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/delete-account`;

type ManualUser = { id: string; email: string; password: string };

async function createUser(): Promise<ManualUser> {
  const slug = uniqueSlug();
  const email = `int-del-${slug}@classpoints.local`;
  const password = `pw-${slug}`;
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Best-effort teardown for users a test did NOT delete (survivors, failures). */
async function deleteUserIfPresent(id: string): Promise<void> {
  await supabaseAdmin().auth.admin.deleteUser(id);
}

async function signInAccessToken(user: ManualUser): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) throw new Error(`signIn failed: ${error?.message}`);
  return data.session.access_token;
}

function invokeDeleteAccount(accessToken?: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('delete-account Edge Function', () => {
  it('[P0][DEL.INT-01] deletes the caller and cascades classrooms, students, and transactions', async () => {
    const admin = supabaseAdmin();
    const classrooms = new ClassroomFactory();
    const user = await createUser();
    let deleted = false;

    try {
      const classroom = await classrooms.create({ userId: user.id });
      const { data: student, error: sErr } = await admin
        .from('students')
        .insert({ name: `Pupil ${uniqueSlug()}`, classroom_id: classroom.id })
        .select('id')
        .single();
      if (sErr || !student) throw new Error(`student seed failed: ${sErr?.message}`);
      const { error: tErr } = await admin.from('point_transactions').insert({
        student_id: student.id,
        classroom_id: classroom.id,
        points: 5,
        behavior_name: 'Integration seed',
        behavior_icon: '⭐',
      });
      if (tErr) throw new Error(`transaction seed failed: ${tErr.message}`);

      const token = await signInAccessToken(user);
      const res = await invokeDeleteAccount(token);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ success: true });
      deleted = true;

      // Auth user is gone…
      const { data: gone } = await admin.auth.admin.getUserById(user.id);
      expect(gone.user).toBeNull();
      // …and the cascade took the owned rows with it.
      const { data: cRows } = await admin.from('classrooms').select('id').eq('id', classroom.id);
      expect(cRows).toEqual([]);
      const { data: sRows } = await admin.from('students').select('id').eq('id', student.id);
      expect(sRows).toEqual([]);
      const { data: tRows } = await admin
        .from('point_transactions')
        .select('id')
        .eq('classroom_id', classroom.id);
      expect(tRows).toEqual([]);
    } finally {
      if (!deleted) await deleteUserIfPresent(user.id);
      // Cascade already removed the rows on success; delete-by-id of nothing
      // is a no-op, so cleanup stays safe on both paths.
      await classrooms.cleanup();
    }
  });

  it('[P0][DEL.INT-02] derives the target from the JWT — a user_id in the body is ignored', async () => {
    const admin = supabaseAdmin();
    const attacker = await createUser();
    const victim = await createUser();
    let attackerDeleted = false;

    try {
      const token = await signInAccessToken(attacker);
      const res = await invokeDeleteAccount(token, { user_id: victim.id });
      expect(res.status).toBe(200);
      attackerDeleted = true;

      // The caller died; the named target survived.
      const { data: attackerGone } = await admin.auth.admin.getUserById(attacker.id);
      expect(attackerGone.user).toBeNull();
      const { data: victimAlive } = await admin.auth.admin.getUserById(victim.id);
      expect(victimAlive.user?.id).toBe(victim.id);
    } finally {
      if (!attackerDeleted) await deleteUserIfPresent(attacker.id);
      await deleteUserIfPresent(victim.id);
    }
  });

  it('[P1][DEL.INT-03] rejects unauthenticated calls with 401', async () => {
    const res = await invokeDeleteAccount(undefined);
    expect(res.status).toBe(401);
  });
});
