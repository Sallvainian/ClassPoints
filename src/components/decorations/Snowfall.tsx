import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface Snowflake {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export function Snowfall() {
  const { isChristmas } = useTheme();

  // Generate snowflakes only once
  const snowflakes = useMemo(() => {
    const flakes: Snowflake[] = [];
    const count = 25; // Limited for performance

    for (let i = 0; i < count; i++) {
      flakes.push({
        id: i,
        left: Math.random() * 100, // Random horizontal position (%)
        size: Math.random() * 8 + 4, // 4-12px
        duration: Math.random() * 10 + 10, // 10-20s fall time
        delay: Math.random() * 10, // Stagger start
        opacity: Math.random() * 0.4 + 0.6, // 0.6-1.0 opacity
      });
    }

    return flakes;
  }, []);

  // Don't render if not Christmas mode
  if (!isChristmas) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      aria-hidden="true"
    >
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute animate-snowfall"
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            willChange: 'transform',
          }}
        >
          {/* Snowflake character or SVG */}
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="w-full h-full drop-shadow-sm"
            style={{
              filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))',
            }}
          >
            <path d="M12 2L12 22M2 12L22 12M5.64 5.64L18.36 18.36M18.36 5.64L5.64 18.36"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"/>
            <circle cx="12" cy="12" r="2" fill="white"/>
            <circle cx="12" cy="4" r="1" fill="white"/>
            <circle cx="12" cy="20" r="1" fill="white"/>
            <circle cx="4" cy="12" r="1" fill="white"/>
            <circle cx="20" cy="12" r="1" fill="white"/>
            <circle cx="6.34" cy="6.34" r="0.8" fill="white"/>
            <circle cx="17.66" cy="17.66" r="0.8" fill="white"/>
            <circle cx="17.66" cy="6.34" r="0.8" fill="white"/>
            <circle cx="6.34" cy="17.66" r="0.8" fill="white"/>
          </svg>
        </div>
      ))}
    </div>
  );
}
