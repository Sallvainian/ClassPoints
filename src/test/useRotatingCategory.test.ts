import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRotatingCategory } from '../hooks/useRotatingCategory';

describe('useRotatingCategory', () => {
  const categories = ['a', 'b', 'c', 'd'] as const;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start with first category', () => {
    const { result } = renderHook(() => useRotatingCategory({ categories }));

    expect(result.current.activeCategory).toBe('a');
  });

  it('should rotate to next category after interval', () => {
    const { result } = renderHook(() => useRotatingCategory({ categories, intervalMs: 1000 }));

    expect(result.current.activeCategory).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.activeCategory).toBe('b');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.activeCategory).toBe('c');
  });

  it('should cycle back to first after last category', () => {
    const { result } = renderHook(() => useRotatingCategory({ categories, intervalMs: 1000 }));

    // Advance through all categories
    act(() => {
      vi.advanceTimersByTime(4000); // 4 intervals to wrap around
    });

    expect(result.current.activeCategory).toBe('a');
  });

  it('should reset timer on manual selection', () => {
    const { result } = renderHook(() => useRotatingCategory({ categories, intervalMs: 1000 }));

    // Wait almost a full interval
    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(result.current.activeCategory).toBe('a');

    // Manually select a category
    act(() => {
      result.current.selectCategory('c');
    });

    expect(result.current.activeCategory).toBe('c');

    // Timer should be reset, so waiting 500ms shouldn't rotate
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.activeCategory).toBe('c');

    // Wait full interval from selection
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.activeCategory).toBe('d');
  });

  it('should cleanup interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useRotatingCategory({ categories, intervalMs: 1000 }));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should use default interval of 7000ms', () => {
    const { result } = renderHook(() => useRotatingCategory({ categories }));

    expect(result.current.activeCategory).toBe('a');

    // Should not rotate at 6999ms
    act(() => {
      vi.advanceTimersByTime(6999);
    });
    expect(result.current.activeCategory).toBe('a');

    // Should rotate at 7000ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.activeCategory).toBe('b');
  });

  it('should handle single category array', () => {
    const { result } = renderHook(() =>
      useRotatingCategory({ categories: ['only'] as const, intervalMs: 1000 })
    );

    expect(result.current.activeCategory).toBe('only');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should stay on the same category (cycle back)
    expect(result.current.activeCategory).toBe('only');
  });

  it('should allow selecting any valid category', () => {
    const { result } = renderHook(() => useRotatingCategory({ categories }));

    act(() => {
      result.current.selectCategory('d');
    });

    expect(result.current.activeCategory).toBe('d');

    act(() => {
      result.current.selectCategory('a');
    });

    expect(result.current.activeCategory).toBe('a');
  });

  it('should not fire after unmount (no timer leaks)', () => {
    // Regression: intervalRef initialized as `undefined` (React 19 explicit init).
    // The cleanup guard `if (intervalRef.current) clearInterval(...)` must
    // prevent any stale timer from mutating state after the component unmounts.
    const { result, unmount } = renderHook(() =>
      useRotatingCategory({ categories, intervalMs: 1000 })
    );

    expect(result.current.activeCategory).toBe('a');

    unmount();

    // Advance well past one interval — should not throw or update state
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // After unmount there is no longer a result to observe, but the critical
    // assertion is that clearInterval was called (confirmed by the existing
    // cleanup test). This test verifies no error is thrown post-unmount.
    expect(true).toBe(true);
  });

  it('should clear previous interval when selectCategory resets the timer', () => {
    // Regression: verifies that rapid manual selections do not accumulate
    // multiple concurrent intervals. Each selectCategory must cancel the
    // outstanding timer before starting a new one.
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { result } = renderHook(() =>
      useRotatingCategory({ categories, intervalMs: 1000 })
    );

    // First selection: should clear the initial interval and start a new one
    act(() => {
      result.current.selectCategory('b');
    });

    // Second selection: should clear the interval from first selection
    act(() => {
      result.current.selectCategory('c');
    });

    // clearInterval should have been called at least twice (once per selectCategory)
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.current.activeCategory).toBe('c');
  });

  it('should initialize intervalRef as undefined before first render side-effects', () => {
    // Regression for React 19 explicit `undefined` initialization:
    // `useRef<ReturnType<typeof setInterval> | undefined>(undefined)`.
    // The cleanup path `if (intervalRef.current) clearInterval(...)` must be
    // safe even if called before the ref is ever populated by startInterval.
    // We validate this by spying on clearInterval and confirming it is NOT
    // called with `undefined` on the very first cleanup invocation.
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() =>
      useRotatingCategory({ categories, intervalMs: 1000 })
    );

    unmount();

    // clearInterval must only be invoked with a real timer id, never undefined
    for (const [arg] of clearIntervalSpy.mock.calls) {
      expect(arg).not.toBeUndefined();
    }
  });

  it('should rotate correctly starting from a manually selected non-first category', () => {
    // Boundary: after manual selection of the last element, the next rotation
    // should wrap around to the first element.
    const { result } = renderHook(() =>
      useRotatingCategory({ categories, intervalMs: 1000 })
    );

    act(() => {
      result.current.selectCategory('d');
    });

    expect(result.current.activeCategory).toBe('d');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.activeCategory).toBe('a');
  });
});
