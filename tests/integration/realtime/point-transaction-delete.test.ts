import type { RealtimeChannel } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';
import { ClassroomFactory } from '../../support/fixtures/factories/classroom.factory';
import { createImpersonationPair } from '../../support/helpers/impersonation';
import { supabaseAdmin } from '../../support/helpers/supabase-admin';
import { uniqueSlug } from '../../support/helpers/unique';

type DeletedPointTransaction = {
  id?: string;
  student_id?: string;
  classroom_id?: string;
  points?: number;
  created_at?: string;
};

function observeTransactionDelete(channel: RealtimeChannel): {
  subscribed: Promise<void>;
  deleted: Promise<DeletedPointTransaction>;
} {
  let resolveSubscribed!: () => void;
  let rejectSubscribed!: (error: Error) => void;
  let resolveDeleted!: (payload: DeletedPointTransaction) => void;
  let rejectDeleted!: (error: Error) => void;

  const subscribed = new Promise<void>((resolve, reject) => {
    resolveSubscribed = resolve;
    rejectSubscribed = reject;
  });
  const deleted = new Promise<DeletedPointTransaction>((resolve, reject) => {
    resolveDeleted = resolve;
    rejectDeleted = reject;
  });

  const timeout = setTimeout(() => {
    const error = new Error('Timed out waiting for point_transactions DELETE realtime payload');
    rejectSubscribed(error);
    rejectDeleted(error);
  }, 10_000);

  const fail = (status: string) => {
    clearTimeout(timeout);
    const error = new Error(`Realtime channel failed with status ${status}`);
    rejectSubscribed(error);
    rejectDeleted(error);
  };

  channel
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'point_transactions' },
      (payload) => {
        clearTimeout(timeout);
        resolveDeleted(payload.old as DeletedPointTransaction);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') resolveSubscribed();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') fail(status);
    });

  return { subscribed, deleted };
}

describe('Point transaction realtime DELETE integration', () => {
  it('[P0][HIST.01-INT-02] emits deleted row data in payload.old for point_transactions DELETE', async () => {
    const pair = await createImpersonationPair();
    const classrooms = new ClassroomFactory();
    let channel: RealtimeChannel | null = null;

    try {
      const classroom = await classrooms.create({ userId: pair.userARecord.id });

      const { data: student, error: studentError } = await supabaseAdmin()
        .from('students')
        .insert({
          classroom_id: classroom.id,
          name: `Student ${uniqueSlug()}`,
          avatar_color: '#059669',
        })
        .select('id')
        .single();

      expect(studentError).toBeNull();
      expect(student?.id).toMatch(/^[0-9a-f-]{36}$/);

      const { data: transaction, error: transactionError } = await supabaseAdmin()
        .from('point_transactions')
        .insert({
          student_id: student!.id,
          classroom_id: classroom.id,
          behavior_id: null,
          behavior_name: 'Participation',
          behavior_icon: 'star',
          points: 2,
          note: null,
          batch_id: null,
        })
        .select('id')
        .single();

      expect(transactionError).toBeNull();
      expect(transaction?.id).toMatch(/^[0-9a-f-]{36}$/);

      const {
        data: { session },
      } = await pair.userA.auth.getSession();
      if (!session) {
        throw new Error('Expected userA session before subscribing to realtime');
      }
      pair.userA.realtime.setAuth(session.access_token);

      channel = pair.userA.channel(`point-transaction-delete-${uniqueSlug()}`);
      const observed = observeTransactionDelete(channel);
      await observed.subscribed;

      const { error: deleteError } = await pair.userA
        .from('point_transactions')
        .delete()
        .eq('id', transaction!.id);

      expect(deleteError).toBeNull();

      const old = await observed.deleted;
      expect(old.id).toBe(transaction!.id);
      expect(old.student_id).toBe(student!.id);
      expect(old.classroom_id).toBe(classroom.id);
      expect(old.points).toBe(2);
      expect(old.created_at).toEqual(expect.any(String));
    } finally {
      if (channel) {
        await pair.userA.removeChannel(channel);
      }
      await classrooms.cleanup();
      await pair.cleanup();
    }
  });
});
