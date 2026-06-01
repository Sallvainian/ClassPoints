import { describe, it, expect } from 'vitest';
import { dbStudentToApp, dbClassroomToApp } from './transforms';
import type { StudentWithPoints, ClassroomWithCount } from './transforms';
import { studentPoints, classPoints } from '../utils/pointSelectors';
import type { AppStudent } from './index';

function makeStudent(over: Partial<StudentWithPoints> = {}): StudentWithPoints {
  return {
    id: 's1',
    classroom_id: 'c1',
    name: 'Ada',
    avatar_color: '#abc',
    point_total: 10,
    positive_total: 12,
    negative_total: -2,
    today_total: 3,
    this_week_total: 7,
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  } as StudentWithPoints;
}

function makeClassroom(over: Partial<ClassroomWithCount> = {}): ClassroomWithCount {
  return {
    id: 'c1',
    name: 'Class A',
    user_id: 'u1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    student_count: 1,
    point_total: 10,
    positive_total: 12,
    negative_total: -2,
    student_summaries: [
      {
        id: 's1',
        name: 'Ada',
        avatar_color: '#abc',
        point_total: 10,
        positive_total: 12,
        negative_total: -2,
        today_total: 3,
        this_week_total: 7,
      },
    ],
    ...over,
  };
}

describe('dbStudentToApp', () => {
  it('maps snake_case totals to camelCase app shape', () => {
    const app = dbStudentToApp(makeStudent());
    expect(app).toEqual({
      id: 's1',
      name: 'Ada',
      avatarColor: '#abc',
      pointTotal: 10,
      positiveTotal: 12,
      negativeTotal: -2,
      todayTotal: 3,
      thisWeekTotal: 7,
    });
  });

  it('coerces a null/empty avatar_color to undefined', () => {
    expect(dbStudentToApp(makeStudent({ avatar_color: null })).avatarColor).toBeUndefined();
    expect(dbStudentToApp(makeStudent({ avatar_color: '' })).avatarColor).toBeUndefined();
  });
});

describe('dbClassroomToApp', () => {
  it('maps the row and uses student_summaries as the students array', () => {
    const app = dbClassroomToApp(makeClassroom());
    expect(app.id).toBe('c1');
    expect(app.name).toBe('Class A');
    expect(app.pointTotal).toBe(10);
    expect(app.positiveTotal).toBe(12);
    expect(app.negativeTotal).toBe(-2);
    expect(app.students).toHaveLength(1);
    expect(app.students[0]).toMatchObject({ id: 's1', pointTotal: 10, todayTotal: 3 });
    // ms timestamps from ISO strings
    expect(app.createdAt).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
    expect(app.updatedAt).toBe(new Date('2026-01-02T00:00:00.000Z').getTime());
  });

  it('leaves today/week totals undefined when no active roster is supplied', () => {
    const app = dbClassroomToApp(makeClassroom());
    expect(app.todayTotal).toBeUndefined();
    expect(app.thisWeekTotal).toBeUndefined();
  });

  it('sums today/week from the active roster when it belongs to this classroom', () => {
    const roster = [
      makeStudent({ id: 's1', today_total: 3, this_week_total: 7 }),
      makeStudent({ id: 's2', today_total: 4, this_week_total: 1 }),
    ];
    const app = dbClassroomToApp(makeClassroom(), roster);
    expect(app.todayTotal).toBe(7);
    expect(app.thisWeekTotal).toBe(8);
  });

  it('leaves today/week undefined when the active roster belongs to another classroom', () => {
    const roster = [makeStudent({ id: 's9', classroom_id: 'other' })];
    const app = dbClassroomToApp(makeClassroom(), roster);
    expect(app.todayTotal).toBeUndefined();
    expect(app.thisWeekTotal).toBeUndefined();
  });

  it('leaves today/week undefined when the active roster is empty', () => {
    const app = dbClassroomToApp(makeClassroom(), []);
    expect(app.todayTotal).toBeUndefined();
    expect(app.thisWeekTotal).toBeUndefined();
  });
});

describe('studentPoints', () => {
  const app: AppStudent = {
    id: 's1',
    name: 'Ada',
    pointTotal: 10,
    positiveTotal: 12,
    negativeTotal: -2,
    todayTotal: 3,
    thisWeekTotal: 7,
  };

  it('reads stored totals into the StudentPoints shape', () => {
    expect(studentPoints(app)).toEqual({
      total: 10,
      positiveTotal: 12,
      negativeTotal: -2,
      today: 3,
      thisWeek: 7,
    });
  });

  it('returns zeros for a missing student', () => {
    expect(studentPoints(undefined)).toEqual({
      total: 0,
      positiveTotal: 0,
      negativeTotal: 0,
      today: 0,
      thisWeek: 0,
    });
  });
});

describe('classPoints', () => {
  const students: AppStudent[] = [
    {
      id: 's1',
      name: 'Ada',
      pointTotal: 10,
      positiveTotal: 12,
      negativeTotal: -2,
      todayTotal: 3,
      thisWeekTotal: 7,
    },
    {
      id: 's2',
      name: 'Bo',
      pointTotal: 5,
      positiveTotal: 5,
      negativeTotal: 0,
      todayTotal: 1,
      thisWeekTotal: 2,
    },
  ];

  it('aggregates the named subset', () => {
    expect(classPoints(students, ['s1', 's2'])).toEqual({
      total: 15,
      positiveTotal: 17,
      negativeTotal: -2,
      today: 4,
      thisWeek: 9,
    });
  });

  it('treats an unknown id as zeros', () => {
    expect(classPoints(students, ['s1', 'missing'])).toEqual({
      total: 10,
      positiveTotal: 12,
      negativeTotal: -2,
      today: 3,
      thisWeek: 7,
    });
  });

  it('returns zeros with no subset (the original never summed the whole roster)', () => {
    expect(classPoints(students)).toEqual({
      total: 0,
      positiveTotal: 0,
      negativeTotal: 0,
      today: 0,
      thisWeek: 0,
    });
    expect(classPoints(students, [])).toEqual({
      total: 0,
      positiveTotal: 0,
      negativeTotal: 0,
      today: 0,
      thisWeek: 0,
    });
  });
});
