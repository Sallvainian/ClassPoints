import { useState, useEffect, useRef, useCallback } from 'react';

interface UseRotatingCategoryOptions<T> {
  categories: readonly T[];
  intervalMs?: number;
}

interface UseRotatingCategoryReturn<T> {
  activeCategory: T;
  selectCategory: (category: T) => void;
}

/**
 * Hook for rotating through categories with auto-timer.
 * Automatically cycles through categories at specified interval.
 * Manual selection resets the timer.
 */
export function useRotatingCategory<T>({
  categories,
  intervalMs = 7000,
}: UseRotatingCategoryOptions<T>): UseRotatingCategoryReturn<T> {
  const [activeCategory, setActiveCategory] = useState<T>(categories[0]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const rotateCategory = useCallback(() => {
    setActiveCategory((current) => {
      const currentIndex = categories.indexOf(current);
      return categories[(currentIndex + 1) % categories.length];
    });
  }, [categories]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(rotateCategory, intervalMs);
  }, [rotateCategory, intervalMs]);

  const selectCategory = useCallback(
    (category: T) => {
      setActiveCategory(category);
      startInterval();
    },
    [startInterval]
  );

  useEffect(() => {
    startInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startInterval]);

  return { activeCategory, selectCategory };
}
