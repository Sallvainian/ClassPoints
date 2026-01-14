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
});
