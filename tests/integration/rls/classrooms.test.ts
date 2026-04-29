import { createClient } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';
import { ClassroomFactory } from '../../support/fixtures/factories/classroom.factory';
import { createImpersonationPair } from '../../support/helpers/impersonation';
import { supabaseAdmin } from '../../support/helpers/supabase-admin';

function anonymousClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('anonymousClient requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe('Classroom RLS integration', () => {
  it('[P0][CLASS.01-INT-01] prevents User A from selecting User B classrooms', async () => {
    const pair = await createImpersonationPair();
    const classrooms = new ClassroomFactory();

    try {
      const bClassroom = await classrooms.create({ userId: pair.userBRecord.id });

      const { data, error } = await pair.userA
        .from('classrooms')
        .select('id, name')
        .eq('id', bClassroom.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    } finally {
      await classrooms.cleanup();
      await pair.cleanup();
    }
  });

  it('[P0][CLASS.01-INT-02] prevents User A from updating or deleting User B classroom', async () => {
    const pair = await createImpersonationPair();
    const classrooms = new ClassroomFactory();

    try {
      const bClassroom = await classrooms.create({ userId: pair.userBRecord.id });

      const updateResult = await pair.userA
        .from('classrooms')
        .update({ name: 'blocked-update' })
        .eq('id', bClassroom.id)
        .select('id, name');

      expect(updateResult.error).toBeNull();
      expect(updateResult.data).toEqual([]);

      const deleteResult = await pair.userA
        .from('classrooms')
        .delete()
        .eq('id', bClassroom.id)
        .select('id');

      expect(deleteResult.error).toBeNull();
      expect(deleteResult.data).toEqual([]);

      const { data: stillPresent, error } = await supabaseAdmin()
        .from('classrooms')
        .select('id, name')
        .eq('id', bClassroom.id)
        .single();

      expect(error).toBeNull();
      expect(stillPresent?.name).toBe(bClassroom.name);
    } finally {
      await classrooms.cleanup();
      await pair.cleanup();
    }
  });

  it('[P0][CLASS.01-INT-03] prevents anonymous clients from selecting classrooms', async () => {
    const pair = await createImpersonationPair();
    const classrooms = new ClassroomFactory();

    try {
      const classroom = await classrooms.create({ userId: pair.userARecord.id });
      const anon = anonymousClient();

      const { data, error } = await anon
        .from('classrooms')
        .select('id, name')
        .eq('id', classroom.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    } finally {
      await classrooms.cleanup();
      await pair.cleanup();
    }
  });
});
