import { describe, it, expect, afterEach } from 'vitest';
import { record, getByClassroom, subscribe, clear } from '../failedBatchStore';
import type { FailedBatchNotice } from '../failedBatchStore';

function notice(over: Partial<FailedBatchNotice> = {}): FailedBatchNotice {
  return {
    batchId: 'b1',
    classroomId: 'c1',
    kind: 'class',
    behaviorName: 'On Task',
    behaviorIcon: '📚',
    points: 1,
    studentCount: 2,
    timestamp: 0,
    classification: 'ambient',
    ...over,
  };
}

describe('failedBatchStore', () => {
  afterEach(() => clear());

  it('returns a stable EMPTY reference for an unknown classroom', () => {
    expect(getByClassroom('nope')).toBe(getByClassroom('nope'));
    expect(getByClassroom('nope')).toHaveLength(0);
  });

  it('record prepends newest-first and isolates by classroom', () => {
    record(notice({ batchId: 'b1', classroomId: 'c1', timestamp: 1 }));
    record(notice({ batchId: 'b2', classroomId: 'c1', timestamp: 2 }));
    record(notice({ batchId: 'b3', classroomId: 'c2', timestamp: 3 }));

    expect(getByClassroom('c1').map((n) => n.batchId)).toEqual(['b2', 'b1']);
    expect(getByClassroom('c2').map((n) => n.batchId)).toEqual(['b3']);
  });

  it('keeps the same array reference until a write to that classroom (getSnapshot stability)', () => {
    record(notice({ batchId: 'b1', classroomId: 'c1' }));
    const ref = getByClassroom('c1');

    expect(getByClassroom('c1')).toBe(ref); // stable across reads
    record(notice({ batchId: 'b2', classroomId: 'c2' })); // write to a DIFFERENT classroom
    expect(getByClassroom('c1')).toBe(ref); // c1 untouched → same reference
    record(notice({ batchId: 'b3', classroomId: 'c1' })); // write to c1
    expect(getByClassroom('c1')).not.toBe(ref); // new reference after a write
  });

  it('notifies subscribers on record and clear, and stops after unsubscribe', () => {
    let calls = 0;
    const unsubscribe = subscribe(() => {
      calls += 1;
    });

    record(notice());
    expect(calls).toBe(1);
    clear();
    expect(calls).toBe(2);

    unsubscribe();
    record(notice());
    expect(calls).toBe(2);
  });
});
