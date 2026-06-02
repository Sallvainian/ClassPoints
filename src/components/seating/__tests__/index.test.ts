import { describe, it, expect } from 'vitest';
import * as SeatingBarrel from '../index';

/**
 * Tests for src/components/seating/index.ts barrel.
 *
 * The primary concern addressed by this PR:
 * - SeatingChartEditor must NOT be re-exported from the barrel to preserve
 *   the Vite/Rolldown code-split via dynamic import in SeatingChartView.
 *   A static barrel re-export would pull SeatingChartEditor into every chunk
 *   that touches this barrel (e.g. DashboardView), defeating lazy loading
 *   (INEFFECTIVE_DYNAMIC_IMPORT warning).
 */
describe('seating barrel (src/components/seating/index.ts)', () => {
  describe('SeatingChartEditor is excluded from static barrel', () => {
    it('should NOT export SeatingChartEditor', () => {
      // This is the critical invariant: a static re-export would defeat the
      // dynamic import / code-split in SeatingChartView.
      expect('SeatingChartEditor' in SeatingBarrel).toBe(false);
    });

    it('SeatingChartEditor export should be undefined when accessed via barrel', () => {
      // Belt-and-suspenders: accessing the key directly should yield undefined.
      expect((SeatingBarrel as Record<string, unknown>)['SeatingChartEditor']).toBeUndefined();
    });
  });

  describe('expected exports are still present', () => {
    it('should export ViewModeToggle', () => {
      expect(SeatingBarrel.ViewModeToggle).toBeDefined();
    });

    it('should export EmptyChartPrompt', () => {
      expect(SeatingBarrel.EmptyChartPrompt).toBeDefined();
    });

    it('should export SeatCard', () => {
      expect(SeatingBarrel.SeatCard).toBeDefined();
    });

    it('should export TableGroup', () => {
      expect(SeatingBarrel.TableGroup).toBeDefined();
    });

    it('should export RoomElementDisplay', () => {
      expect(SeatingBarrel.RoomElementDisplay).toBeDefined();
    });

    it('should export SeatingChartCanvas', () => {
      expect(SeatingBarrel.SeatingChartCanvas).toBeDefined();
    });

    it('should export SeatingChartView', () => {
      expect(SeatingBarrel.SeatingChartView).toBeDefined();
    });
  });

  describe('barrel export count sanity check', () => {
    it('should export exactly 7 named members (regression guard)', () => {
      // Prevents accidental additions to or deletions from the barrel.
      // Update this count deliberately when adding/removing exports.
      const exportedKeys = Object.keys(SeatingBarrel);
      expect(exportedKeys).toHaveLength(7);
    });

    it('should not export any symbol named "Editor" (broad guard)', () => {
      // Ensures no variant of the editor component sneaks into the barrel.
      const exportedKeys = Object.keys(SeatingBarrel);
      const editorExports = exportedKeys.filter((key) =>
        key.toLowerCase().includes('editor')
      );
      expect(editorExports).toHaveLength(0);
    });
  });
});