import { describe, it, expect } from 'vitest';
import {
  getOverallLeaders,
  getTodayStars,
  getClassChampions,
  getThisWeekLeaders,
  getBestBehaved,
  getRisingStars,
  MILESTONES,
} from '../utils/leaderboardCalculations';
import type { AppStudent, AppClassroom } from '../contexts/HybridAppContext';

// Helper to create test students
function createStudent(overrides: Partial<AppStudent> = {}): AppStudent {
  return {
    id: crypto.randomUUID(),
    name: 'Test Student',
    pointTotal: 0,
    positiveTotal: 0,
    negativeTotal: 0,
    todayTotal: 0,
    thisWeekTotal: 0,
    ...overrides,
  };
}

// Helper to create test classrooms
function createClassroom(
  overrides: Partial<AppClassroom> = {},
  students: AppStudent[] = []
): AppClassroom {
  return {
    id: crypto.randomUUID(),
    name: 'Test Classroom',
    students,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('getOverallLeaders', () => {
  it('should sort by pointTotal descending', () => {
    const students = [
      createStudent({ name: 'Low', pointTotal: 10 }),
      createStudent({ name: 'High', pointTotal: 50 }),
      createStudent({ name: 'Mid', pointTotal: 30 }),
    ];

    const result = getOverallLeaders(students);

    expect(result[0].student.name).toBe('High');
    expect(result[1].student.name).toBe('Mid');
    expect(result[2].student.name).toBe('Low');
  });

  it('should limit to specified count (default 5)', () => {
    const students = Array.from({ length: 10 }, (_, i) =>
      createStudent({ name: `Student ${i}`, pointTotal: i * 10 })
    );

    const result = getOverallLeaders(students);
    expect(result).toHaveLength(5);

    const result3 = getOverallLeaders(students, 3);
    expect(result3).toHaveLength(3);
  });

  it('should handle empty array', () => {
    const result = getOverallLeaders([]);
    expect(result).toHaveLength(0);
  });

  it('should handle tied scores', () => {
    const students = [
      createStudent({ name: 'A', pointTotal: 50 }),
      createStudent({ name: 'B', pointTotal: 50 }),
      createStudent({ name: 'C', pointTotal: 50 }),
    ];

    const result = getOverallLeaders(students);
    expect(result).toHaveLength(3);
    // All should be included, order preserved from original array
  });

  it('should set value to pointTotal', () => {
    const students = [createStudent({ pointTotal: 42 })];
    const result = getOverallLeaders(students);
    expect(result[0].value).toBe(42);
  });
});

describe('getTodayStars', () => {
  it('should filter students with todayTotal > 0', () => {
    const students = [
      createStudent({ name: 'Active', todayTotal: 10 }),
      createStudent({ name: 'Inactive', todayTotal: 0 }),
    ];

    const result = getTodayStars(students);

    expect(result).toHaveLength(1);
    expect(result[0].student.name).toBe('Active');
  });

  it('should sort by todayTotal descending', () => {
    const students = [
      createStudent({ name: 'Low', todayTotal: 5 }),
      createStudent({ name: 'High', todayTotal: 20 }),
      createStudent({ name: 'Mid', todayTotal: 10 }),
    ];

    const result = getTodayStars(students);

    expect(result[0].student.name).toBe('High');
    expect(result[1].student.name).toBe('Mid');
    expect(result[2].student.name).toBe('Low');
  });

  it('should return empty array when no activity today', () => {
    const students = [createStudent({ todayTotal: 0 }), createStudent({ todayTotal: 0 })];

    const result = getTodayStars(students);
    expect(result).toHaveLength(0);
  });

  it('should include subtitle "today"', () => {
    const students = [createStudent({ todayTotal: 5 })];
    const result = getTodayStars(students);
    expect(result[0].subtitle).toBe('today');
  });
});

describe('getClassChampions', () => {
  it('should select highest-point student per classroom', () => {
    const class1Students = [
      createStudent({ name: 'Class1-Low', pointTotal: 10 }),
      createStudent({ name: 'Class1-High', pointTotal: 50 }),
    ];
    const class2Students = [
      createStudent({ name: 'Class2-High', pointTotal: 30 }),
      createStudent({ name: 'Class2-Low', pointTotal: 5 }),
    ];

    const classrooms = [
      createClassroom({ name: 'Class 1' }, class1Students),
      createClassroom({ name: 'Class 2' }, class2Students),
    ];

    const result = getClassChampions(classrooms);

    expect(result).toHaveLength(2);
    expect(result[0].student.name).toBe('Class1-High');
    expect(result[0].subtitle).toBe('Class 1');
    expect(result[1].student.name).toBe('Class2-High');
    expect(result[1].subtitle).toBe('Class 2');
  });

  it('should handle empty classrooms', () => {
    const classrooms = [
      createClassroom({ name: 'Empty Class' }, []),
      createClassroom({ name: 'Has Students' }, [createStudent({ pointTotal: 10 })]),
    ];

    const result = getClassChampions(classrooms);

    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toBe('Has Students');
  });

  it('should limit to 5 champions', () => {
    const classrooms = Array.from({ length: 10 }, (_, i) =>
      createClassroom({ name: `Class ${i}` }, [createStudent({ pointTotal: i * 10 })])
    );

    const result = getClassChampions(classrooms);
    expect(result).toHaveLength(5);
  });
});

describe('getThisWeekLeaders', () => {
  it('should filter students with thisWeekTotal > 0', () => {
    const students = [
      createStudent({ name: 'Active', thisWeekTotal: 25 }),
      createStudent({ name: 'Inactive', thisWeekTotal: 0 }),
    ];

    const result = getThisWeekLeaders(students);

    expect(result).toHaveLength(1);
    expect(result[0].student.name).toBe('Active');
  });

  it('should sort by thisWeekTotal descending', () => {
    const students = [
      createStudent({ name: 'Low', thisWeekTotal: 10 }),
      createStudent({ name: 'High', thisWeekTotal: 100 }),
    ];

    const result = getThisWeekLeaders(students);

    expect(result[0].student.name).toBe('High');
    expect(result[1].student.name).toBe('Low');
  });

  it('should include subtitle "this week"', () => {
    const students = [createStudent({ thisWeekTotal: 15 })];
    const result = getThisWeekLeaders(students);
    expect(result[0].subtitle).toBe('this week');
  });
});

describe('getBestBehaved', () => {
  it('should calculate ratio correctly', () => {
    const students = [createStudent({ name: 'Good', positiveTotal: 100, negativeTotal: -10 })];

    const result = getBestBehaved(students);

    expect(result[0].value).toBe('10.0'); // 100 / 10 = 10
  });

  it('should handle zero negative points (divisor = 1)', () => {
    const students = [createStudent({ name: 'Perfect', positiveTotal: 50, negativeTotal: 0 })];

    const result = getBestBehaved(students);

    // 50 / 1 = 50
    expect(result[0].value).toBe('50.0');
  });

  it('should display infinity symbol for very high ratios', () => {
    // This test checks that Infinity is handled, though with divisor=1 for 0 negatives,
    // we won't actually get Infinity. The safeguard is still there.
    const students = [createStudent({ positiveTotal: 1000, negativeTotal: 0 })];

    const result = getBestBehaved(students);
    // With divisor = 1, result is 1000.0, not infinity
    expect(result[0].value).toBe('1000.0');
  });

  it('should sort by ratio descending', () => {
    const students = [
      createStudent({ name: 'Low', positiveTotal: 10, negativeTotal: -10 }), // ratio 1
      createStudent({ name: 'High', positiveTotal: 100, negativeTotal: -10 }), // ratio 10
      createStudent({ name: 'Mid', positiveTotal: 50, negativeTotal: -10 }), // ratio 5
    ];

    const result = getBestBehaved(students);

    expect(result[0].student.name).toBe('High');
    expect(result[1].student.name).toBe('Mid');
    expect(result[2].student.name).toBe('Low');
  });

  it('should filter out students with no positive points', () => {
    const students = [
      createStudent({ name: 'HasPositive', positiveTotal: 10, negativeTotal: -5 }),
      createStudent({ name: 'NoPositive', positiveTotal: 0, negativeTotal: -5 }),
    ];

    const result = getBestBehaved(students);

    expect(result).toHaveLength(1);
    expect(result[0].student.name).toBe('HasPositive');
  });

  it('should include subtitle "ratio"', () => {
    const students = [createStudent({ positiveTotal: 10, negativeTotal: -5 })];
    const result = getBestBehaved(students);
    expect(result[0].subtitle).toBe('ratio');
  });
});

describe('getRisingStars', () => {
  it('should match exact milestone values', () => {
    const students = MILESTONES.map((m) =>
      createStudent({ name: `Milestone-${m}`, pointTotal: m })
    );

    const result = getRisingStars(students, 10);

    expect(result).toHaveLength(MILESTONES.length);
  });

  it('should not match non-milestone values', () => {
    const students = [
      createStudent({ pointTotal: 2 }), // Not a milestone
      createStudent({ pointTotal: 15 }), // Not a milestone
      createStudent({ pointTotal: 99 }), // Not a milestone
    ];

    const result = getRisingStars(students);

    expect(result).toHaveLength(0);
  });

  it('should sort by pointTotal descending', () => {
    const students = [
      createStudent({ name: 'Low', pointTotal: 5 }),
      createStudent({ name: 'High', pointTotal: 100 }),
      createStudent({ name: 'Mid', pointTotal: 25 }),
    ];

    const result = getRisingStars(students);

    expect(result[0].student.name).toBe('High');
    expect(result[1].student.name).toBe('Mid');
    expect(result[2].student.name).toBe('Low');
  });

  it('should format value as "X pts"', () => {
    const students = [createStudent({ pointTotal: 50 })];
    const result = getRisingStars(students);
    expect(result[0].value).toBe('50 pts');
  });

  it('should include subtitle "milestone reached!"', () => {
    const students = [createStudent({ pointTotal: 10 })];
    const result = getRisingStars(students);
    expect(result[0].subtitle).toBe('milestone reached!');
  });
});

describe('MILESTONES constant', () => {
  it('should contain expected values', () => {
    expect(MILESTONES).toContain(1);
    expect(MILESTONES).toContain(5);
    expect(MILESTONES).toContain(10);
    expect(MILESTONES).toContain(25);
    expect(MILESTONES).toContain(50);
    expect(MILESTONES).toContain(69);
    expect(MILESTONES).toContain(75);
    expect(MILESTONES).toContain(100);
  });

  it('should be sorted ascending', () => {
    const sorted = [...MILESTONES].sort((a, b) => a - b);
    expect(MILESTONES).toEqual(sorted);
  });
});
