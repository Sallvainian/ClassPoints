import { describe, it, expect } from 'vitest';
import {
  layoutPresetDataSchema,
  dbToLayoutPreset,
  LayoutPresetValidationError,
  ROOM_ELEMENT_TYPES,
} from './seatingChart';
import type { DbLayoutPreset, LayoutPresetData } from './seatingChart';

// Schema boundary tests for the layout_data JSONB column (#15, kernel
// spec-payload-runtime-validation). STRICT on types, LENIENT on ranges:
// the schema must accept every row the app currently loads successfully
// and reject only structural corruption.

function validLayoutData(): LayoutPresetData {
  return {
    groups: [{ letter: 'A', x: 100, y: 120, rotation: 90 }],
    roomElements: [
      { type: 'teacher_desk', label: 'Desk', x: 10, y: 20, width: 120, height: 60, rotation: 0 },
    ],
    settings: { snapEnabled: true, gridSize: 20, canvasWidth: 1200, canvasHeight: 800 },
  };
}

function dbPreset(layoutData: unknown): DbLayoutPreset {
  return {
    id: 'preset-1',
    user_id: 'user-1',
    name: 'Alpha',
    layout_data: layoutData,
    created_at: '2026-05-01T00:00:00.000Z',
  };
}

describe('layoutPresetDataSchema', () => {
  it('[P1][CAP-1] accepts a well-formed layout_data value', () => {
    const result = layoutPresetDataSchema.safeParse(validLayoutData());
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validLayoutData());
  });

  it('[P1][CAP-1] accepts an element WITHOUT the label key (the standard stored shape)', () => {
    // postgrest drops undefined keys on write, so stored rows have label ABSENT.
    const data = validLayoutData();
    const labelless: Record<string, unknown> = { ...data.roomElements[0] };
    delete labelless.label;
    const result = layoutPresetDataSchema.safeParse({ ...data, roomElements: [labelless] });
    expect(result.success).toBe(true);
    expect(result.data?.roomElements[0].label).toBeUndefined();
  });

  it('[P1][CAP-1] tolerates label: null (never written, but nullish by contract)', () => {
    const data = validLayoutData();
    data.roomElements[0].label = null;
    const result = layoutPresetDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    expect(result.data?.roomElements[0].label).toBeNull();
  });

  it('[P1][CAP-1] strips unknown top-level and nested keys (legacy extra keys accepted)', () => {
    const data = validLayoutData();
    const withExtras = {
      ...data,
      legacyTopLevel: 'old',
      groups: [{ ...data.groups[0], extraNested: true }],
      settings: { ...data.settings, theme: 'dark' },
    };
    const result = layoutPresetDataSchema.safeParse(withExtras);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
    expect(result.data).not.toHaveProperty('legacyTopLevel');
    expect(result.data?.groups[0]).not.toHaveProperty('extraNested');
    expect(result.data?.settings).not.toHaveProperty('theme');
  });

  it('[P1][CAP-3] rejects an element type outside the const array', () => {
    const data = validLayoutData();
    const result = layoutPresetDataSchema.safeParse({
      ...data,
      roomElements: [{ ...data.roomElements[0], type: 'bookshelf' }],
    });
    expect(result.success).toBe(false);
  });

  it('[P1][CAP-3] rejects structurally corrupt values (missing groups, mistyped settings, null)', () => {
    const data = validLayoutData();
    const missingGroups: Record<string, unknown> = { ...data };
    delete missingGroups.groups;
    expect(layoutPresetDataSchema.safeParse(missingGroups).success).toBe(false);
    expect(
      layoutPresetDataSchema.safeParse({
        ...data,
        settings: { ...data.settings, gridSize: '20' },
      }).success
    ).toBe(false);
    expect(layoutPresetDataSchema.safeParse(null).success).toBe(false);
    expect(layoutPresetDataSchema.safeParse({ bogus: 1 }).success).toBe(false);
  });

  it('[P1][CAP-3] rejects NaN/Infinity coordinates (they JSON-serialize to null server-side)', () => {
    const nanData = validLayoutData();
    nanData.groups[0].x = Number.NaN;
    expect(layoutPresetDataSchema.safeParse(nanData).success).toBe(false);

    const infData = validLayoutData();
    infData.roomElements[0].width = Number.POSITIVE_INFINITY;
    expect(layoutPresetDataSchema.safeParse(infData).success).toBe(false);
  });

  it('[P1][CAP-2] ROOM_ELEMENT_TYPES is the single source for the element-type union', () => {
    // Pins the coordinated-change contract: new values land in this array
    // (and the DB enum migration) — both the TS union and z.enum derive here.
    expect(ROOM_ELEMENT_TYPES).toEqual(['teacher_desk', 'door', 'window', 'countertop', 'sink']);
  });
});

describe('dbToLayoutPreset', () => {
  it('[P1][CAP-1] transforms a valid row to app shape with z.infer-typed layoutData', () => {
    const preset = dbToLayoutPreset(dbPreset(validLayoutData()));
    expect(preset).toEqual({
      id: 'preset-1',
      userId: 'user-1',
      name: 'Alpha',
      layoutData: validLayoutData(),
      createdAt: new Date('2026-05-01T00:00:00.000Z').getTime(),
    });
  });

  it('[P1][CAP-3] throws the named LayoutPresetValidationError on corrupt layout_data', () => {
    let thrown: unknown;
    try {
      dbToLayoutPreset(dbPreset({ bogus: 1 }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(LayoutPresetValidationError);
    const error = thrown as LayoutPresetValidationError;
    expect(error.name).toBe('LayoutPresetValidationError');
    expect(error.presetId).toBe('preset-1');
    expect(error.presetName).toBe('Alpha');
    // Message carries preset id + name + issue summary.
    expect(error.message).toContain('preset-1');
    expect(error.message).toContain('Alpha');
    expect(error.zodError.issues.length).toBeGreaterThan(0);
  });
});
