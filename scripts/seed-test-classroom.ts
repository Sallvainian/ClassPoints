/**
 * Seed a demo classroom with students into the LOCAL Supabase stack.
 * Idempotent — re-running won't create duplicates.
 *
 * Requires the test user from scripts/seed-test-user.ts to already exist.
 * Reads credentials from .env.test.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(process.cwd(), '.env.test');
const raw = readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = env.VITE_TEST_EMAIL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TEST_EMAIL) {
  console.error('[seed-test-classroom] Missing env values in .env.test');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Look up the test user's id by email
const { data: usersList, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  console.error(`[seed-test-classroom] Failed to list users: ${listError.message}`);
  process.exit(1);
}
const testUser = usersList.users.find((u) => u.email === TEST_EMAIL);
if (!testUser) {
  console.error(
    `[seed-test-classroom] No user with email ${TEST_EMAIL}. Run npm run test:seed first.`
  );
  process.exit(1);
}

const CLASSROOM_NAME = 'Demo Class';

// Find-or-create classroom
const { data: existingClassrooms } = await admin
  .from('classrooms')
  .select('id, name')
  .eq('user_id', testUser.id)
  .eq('name', CLASSROOM_NAME);

let classroomId: string;
if (existingClassrooms && existingClassrooms.length > 0) {
  classroomId = existingClassrooms[0].id;
  console.log(`[seed-test-classroom] Reusing existing "${CLASSROOM_NAME}" (id=${classroomId})`);
} else {
  const { data: newClassroom, error: createError } = await admin
    .from('classrooms')
    .insert({ name: CLASSROOM_NAME, user_id: testUser.id })
    .select()
    .single();

  if (createError || !newClassroom) {
    console.error(`[seed-test-classroom] Failed to create classroom: ${createError?.message}`);
    process.exit(1);
  }
  classroomId = newClassroom.id;
  console.log(`[seed-test-classroom] Created classroom "${CLASSROOM_NAME}" (id=${classroomId})`);
}

// Student roster — keeping it small and diverse for UI feedback
const STUDENT_NAMES = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Katherine Johnson',
  'Dennis Ritchie',
  'Margaret Hamilton',
  'Linus Torvalds',
  'Barbara Liskov',
];

// Only add students that don't already exist in this classroom
const { data: existingStudents } = await admin
  .from('students')
  .select('name')
  .eq('classroom_id', classroomId);

const existingNames = new Set((existingStudents ?? []).map((s) => s.name));
const toInsert = STUDENT_NAMES.filter((n) => !existingNames.has(n)).map((name) => ({
  name,
  classroom_id: classroomId,
}));

if (toInsert.length === 0) {
  console.log(`[seed-test-classroom] All ${STUDENT_NAMES.length} students already present.`);
} else {
  const { data: inserted, error: insertError } = await admin
    .from('students')
    .insert(toInsert)
    .select('id, name');

  if (insertError) {
    console.error(`[seed-test-classroom] Failed to insert students: ${insertError.message}`);
    process.exit(1);
  }
  console.log(
    `[seed-test-classroom] Added ${inserted?.length ?? 0} students (${existingNames.size} were already present)`
  );
  for (const s of inserted ?? []) {
    console.log(`  - ${s.name}`);
  }
}

console.log(`[seed-test-classroom] Done. Classroom id: ${classroomId}`);
