import { describe, it, expect } from 'vitest';
import { ClassroomFactory } from '../../support/fixtures/factories/classroom.factory';
import { UserFactory } from '../../support/fixtures/factories/user.factory';
import { supabaseAdmin } from '../../support/helpers/supabase-admin';
import { uniqueSlug } from '../../support/helpers/unique';

async function fetchStudentTotals(studentId: string) {
  const { data, error } = await supabaseAdmin()
    .from('students')
    .select('point_total, positive_total, negative_total')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    throw new Error(`fetchStudentTotals failed: ${error?.message ?? 'no student returned'}`);
  }

  return data;
}

async function fetchTransactionSum(studentId: string) {
  const { data, error } = await supabaseAdmin()
    .from('point_transactions')
    .select('points')
    .eq('student_id', studentId);

  if (error) {
    throw new Error(`fetchTransactionSum failed: ${error.message}`);
  }

  return (data ?? []).reduce((sum, row) => sum + row.points, 0);
}

describe('Student point-total trigger integration', () => {
  it('[P0][STUD.01-INT-04] keeps student lifetime totals equal to point transaction effects after award and delete', async () => {
    const users = new UserFactory();
    const classrooms = new ClassroomFactory();

    try {
      const user = await users.create();
      const classroom = await classrooms.create({ userId: user.id });

      const { data: student, error: studentError } = await supabaseAdmin()
        .from('students')
        .insert({
          classroom_id: classroom.id,
          name: `Student ${uniqueSlug()}`,
          avatar_color: '#4f46e5',
        })
        .select('id')
        .single();

      expect(studentError).toBeNull();
      expect(student?.id).toMatch(/^[0-9a-f-]{36}$/);

      const { data: inserted, error: insertError } = await supabaseAdmin()
        .from('point_transactions')
        .insert([
          {
            student_id: student!.id,
            classroom_id: classroom.id,
            behavior_id: null,
            behavior_name: 'Participation',
            behavior_icon: 'star',
            points: 3,
            note: null,
            batch_id: null,
          },
          {
            student_id: student!.id,
            classroom_id: classroom.id,
            behavior_id: null,
            behavior_name: 'Needs redirection',
            behavior_icon: 'alert',
            points: -1,
            note: null,
            batch_id: null,
          },
        ])
        .select('id, points')
        .order('points', { ascending: false });

      expect(insertError).toBeNull();
      expect(inserted).toHaveLength(2);

      const afterInsert = await fetchStudentTotals(student!.id);
      expect(afterInsert.point_total).toBe(await fetchTransactionSum(student!.id));
      expect(afterInsert.point_total).toBe(2);
      expect(afterInsert.positive_total).toBe(3);
      expect(afterInsert.negative_total).toBe(-1);

      const positiveTransaction = inserted!.find((transaction) => transaction.points === 3);
      expect(positiveTransaction?.id).toMatch(/^[0-9a-f-]{36}$/);

      const { error: deleteError } = await supabaseAdmin()
        .from('point_transactions')
        .delete()
        .eq('id', positiveTransaction!.id);

      expect(deleteError).toBeNull();

      const afterDelete = await fetchStudentTotals(student!.id);
      expect(afterDelete.point_total).toBe(await fetchTransactionSum(student!.id));
      expect(afterDelete.point_total).toBe(-1);
      expect(afterDelete.positive_total).toBe(0);
      expect(afterDelete.negative_total).toBe(-1);
    } finally {
      await classrooms.cleanup();
      await users.cleanup();
    }
  });
});
