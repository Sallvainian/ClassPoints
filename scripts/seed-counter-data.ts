/**
 * Seeds the local Supabase with classrooms, students, behaviors, and a mix of
 * point transactions (today / this week / lifetime) so every counter render
 * site has data to show. Idempotent-ish: deletes prior data for the test user
 * before re-seeding.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

(async () => {
  const env: Record<string, string> = {};
  for (const l of readFileSync('.env.test', 'utf8').split('\n')) {
    if (!l.trim() || l.trim().startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  const supa = createClient(env.VITE_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list } = await supa.auth.admin.listUsers();
  const user = list.users.find((u) => u.email === env.VITE_TEST_EMAIL);
  if (!user) throw new Error('test user not found');
  const userId = user.id;

  // Wipe prior classrooms (cascades to students and transactions)
  await supa.from('classrooms').delete().eq('user_id', userId);
  await supa.from('behaviors').delete().eq('user_id', userId);

  const behaviorRowsBase = [
    {
      name: 'Respectful',
      icon: '🙋',
      points: 1,
      category: 'positive' as const,
      is_custom: false,
      user_id: userId,
    },
    {
      name: 'On Task',
      icon: '✅',
      points: 2,
      category: 'positive' as const,
      is_custom: false,
      user_id: userId,
    },
    {
      name: 'Helping',
      icon: '🤝',
      points: 3,
      category: 'positive' as const,
      is_custom: false,
      user_id: userId,
    },
    {
      name: 'Talking',
      icon: '💬',
      points: -1,
      category: 'negative' as const,
      is_custom: false,
      user_id: userId,
    },
    {
      name: 'Off Task',
      icon: '🌙',
      points: -2,
      category: 'negative' as const,
      is_custom: false,
      user_id: userId,
    },
  ];
  const { data: behaviorData, error: behErr } = await supa
    .from('behaviors')
    .insert(behaviorRowsBase)
    .select();
  if (behErr || !behaviorData) throw new Error(`behaviors insert failed: ${behErr?.message}`);
  console.log(`[seed] ${behaviorData.length} behaviors created`);

  const periods = ['Period 1', 'Period 3', 'Period 4'];
  const namesPool = [
    'Anne',
    'Arieonna',
    'Bria',
    'Chelsea',
    'Elena',
    'Jace',
    'Jacob',
    'Jaden',
    'Justin',
    'Marc',
    'Nevaeh',
    'Nicole',
    'Orien',
    'Owen',
    'Xavier',
    'Avery',
    'Brian',
    'Claire',
    'Dylan',
    'Eva',
    'Felix',
    'Grace',
  ];
  const colors = ['#dc6f12', '#3b82f6', '#16a34a', '#a855f7', '#ec4899', '#0ea5e9', '#f97316'];

  const now = Date.now();
  const dayMs = 86_400_000;

  for (let p = 0; p < periods.length; p++) {
    const periodName = periods[p];
    const studentCount = p === 0 ? 15 : p === 1 ? 18 : 12;

    // 1. Create classroom
    const { data: classroom } = await supa
      .from('classrooms')
      .insert({ name: periodName, user_id: userId })
      .select()
      .single();
    if (!classroom) throw new Error(`failed to create classroom ${periodName}`);

    // 2. Create students
    const students = Array.from({ length: studentCount }, (_, i) => ({
      classroom_id: classroom.id,
      name: namesPool[(p * 7 + i) % namesPool.length] + (i >= namesPool.length ? ` ${i}` : ''),
      avatar_color: colors[i % colors.length],
    }));
    const { data: studentData, error: studErr } = await supa
      .from('students')
      .insert(students)
      .select();
    if (studErr || !studentData) throw new Error(`students insert failed: ${studErr?.message}`);

    // 3. Create transactions — mix of today, this week, lifetime older
    const txs: Array<{
      student_id: string;
      classroom_id: string;
      behavior_id: string;
      behavior_name: string;
      behavior_icon: string;
      points: number;
      created_at: string;
    }> = [];

    for (let s = 0; s < studentData.length; s++) {
      const student = studentData[s];
      // 1-3 today (positive bias)
      const todayCount = (s % 3) + 1;
      for (let t = 0; t < todayCount; t++) {
        const b = behaviorData[t % behaviorData.length];
        const offsetMs = t * 60_000 + s * 1000;
        txs.push({
          student_id: student.id,
          classroom_id: classroom.id,
          behavior_id: b.id,
          behavior_name: b.name,
          behavior_icon: b.icon,
          points: b.points,
          created_at: new Date(now - offsetMs).toISOString(),
        });
      }
      // 2-5 this week (older)
      const weekCount = (s % 4) + 2;
      for (let t = 0; t < weekCount; t++) {
        const b = behaviorData[(t + 1) % behaviorData.length];
        txs.push({
          student_id: student.id,
          classroom_id: classroom.id,
          behavior_id: b.id,
          behavior_name: b.name,
          behavior_icon: b.icon,
          points: b.points,
          created_at: new Date(now - 2 * dayMs - t * 3_600_000).toISOString(),
        });
      }
      // 5-10 older lifetime
      const lifetimeCount = (s % 6) + 5;
      for (let t = 0; t < lifetimeCount; t++) {
        const b = behaviorData[(t + 2) % behaviorData.length];
        txs.push({
          student_id: student.id,
          classroom_id: classroom.id,
          behavior_id: b.id,
          behavior_name: b.name,
          behavior_icon: b.icon,
          points: b.points,
          created_at: new Date(now - (10 + t) * dayMs).toISOString(),
        });
      }
    }

    // Insert in chunks to avoid payload size issues
    for (let i = 0; i < txs.length; i += 200) {
      const chunk = txs.slice(i, i + 200);
      const { error } = await supa.from('point_transactions').insert(chunk);
      if (error) throw new Error(`tx insert chunk ${i}: ${error.message}`);
    }

    console.log(
      `[seed] ${periodName}: ${studentData.length} students, ${behaviorData.length} behaviors, ${txs.length} transactions`
    );
  }

  console.log('[seed] done');
})();
