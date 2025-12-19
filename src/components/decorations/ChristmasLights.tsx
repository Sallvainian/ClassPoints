import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface Light {
  id: number;
  color: string;
  delay: number;
}

const LIGHT_COLORS = [
  '#ff0000', // Red
  '#00ff00', // Green
  '#ffd700', // Gold
  '#0066ff', // Blue
  '#ff69b4', // Pink
];

export function ChristmasLights() {
  const { isChristmas } = useTheme();

  // Generate lights
  const lights = useMemo(() => {
    const lightArray: Light[] = [];
    const count = 20; // Number of bulbs across the top

    for (let i = 0; i < count; i++) {
      lightArray.push({
        id: i,
        color: LIGHT_COLORS[i % LIGHT_COLORS.length],
        delay: (i * 0.15) % 2, // Staggered twinkle
      });
    }

    return lightArray;
  }, []);

  // Don't render if not Christmas mode
  if (!isChristmas) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 pointer-events-none z-40 overflow-hidden"
      aria-hidden="true"
    >
      {/* Wire string */}
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
      >
        <path
          d="M0,2 Q5,5 10,2 Q15,5 20,2 Q25,5 30,2 Q35,5 40,2 Q45,5 50,2 Q55,5 60,2 Q65,5 70,2 Q75,5 80,2 Q85,5 90,2 Q95,5 100,2"
          fill="none"
          stroke="#2d2d2d"
          strokeWidth="0.3"
          className="animate-light-wave"
        />
      </svg>

      {/* Light bulbs */}
      <div className="absolute top-0 left-0 right-0 flex justify-between px-2">
        {lights.map((light) => (
          <div
            key={light.id}
            className="relative animate-twinkle"
            style={{
              animationDelay: `${light.delay}s`,
            }}
          >
            {/* Bulb base */}
            <div
              className="w-2 h-1 mx-auto rounded-t"
              style={{ backgroundColor: '#4a4a4a' }}
            />
            {/* Bulb */}
            <div
              className="w-3 h-4 rounded-b-full mx-auto"
              style={{
                backgroundColor: light.color,
                boxShadow: `0 0 8px ${light.color}, 0 0 16px ${light.color}`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
