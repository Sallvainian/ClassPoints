# Component Strategy

## Design System Coverage

**Tailwind CSS provides:**

- Typography utilities (text-_, font-_)
- Color utilities (bg-_, text-_, border-\*)
- Spacing utilities (p-_, m-_, gap-\*)
- Layout utilities (flex, grid, responsive variants)
- Animation utilities (transition-_, animate-_)

**Custom components needed for ClassPoints:**
| Component | Purpose | Priority |
|-----------|---------|----------|
| StudentCard | Display student with avatar, name, points | Critical |
| BehaviorModal | Two-column behavior selection | Critical |
| PointBadge | Animated floating point indicator | Critical |
| ClassroomSelector | Sidebar list of classrooms | High |
| Header | App title, settings, logout | High |
| RandomPicker | Animated random student selection | Medium |
| HistoryPanel | Point transaction history | Medium |
| SettingsPanel | User preferences, sound toggle | Medium |

## Custom Component Specifications

### StudentCard

**Purpose:** Display a single student in the grid with quick access to point awarding.

**Anatomy:**

```
┌─────────────────────────┐
│  ┌───┐                  │
│  │ E │  Emma            │
│  └───┘  ───────         │
│         +12 points      │
└─────────────────────────┘
```

**States:**
| State | Visual Treatment |
|-------|------------------|
| Default | White background, subtle border |
| Hover | Elevated shadow, scale 1.02 |
| Active/Pressed | Scale 0.98, darker background |
| Highlighted | Green/orange glow based on last action |
| Selected (Random) | Prominent border, pulsing animation |

**Variants:**

- Size: Small (100px), Medium (140px), Large (180px)
- Density controlled by user toggle

### BehaviorModal

**Purpose:** Present behavior options after student tap.

**Anatomy:**

```
┌───────────────────────────────────────┐
│              Emma                    ✕│
├───────────────────┬───────────────────┤
│    POSITIVE       │    NEEDS WORK     │
│  ───────────────  │  ───────────────  │
│  😊 Helpful +1    │  😐 Off Task -1   │
│  🌟 Great Work +2 │  🔇 Disruptive -1 │
│  ⭐ Excellent +3  │  ⏰ Late -1       │
│  💪 Participation │  📱 Distracted -1 │
└───────────────────┴───────────────────┘
```

**States:**
| State | Visual Treatment |
|-------|------------------|
| Opening | Fade in + scale from 0.95 |
| Behavior hover | Highlight row, show selection cursor |
| Behavior active | Press effect, immediate feedback |
| Closing | Fade out, auto-closes after selection |

### PointBadge

**Purpose:** Animated indicator showing points awarded.

**Animation Sequence:**

1. Appears at student card location (opacity 0 → 1, scale 0.9 → 1.05)
2. Holds briefly (100-200ms)
3. Floats upward 16px while fading (opacity 1 → 0)
4. Total duration: 500-700ms

**Variants:**

- Positive: Green text, "+N" format
- Negative: Orange text, "-N" format

## Component Implementation Guidelines

**Build Order:**

1. StudentCard (blocks all other work)
2. BehaviorModal (core loop completion)
3. PointBadge (feedback polish)
4. Header/ClassroomSelector (navigation)
5. RandomPicker (gamification)
6. Settings/History (secondary features)

**Composition Strategy:**

- Components are pure presentational where possible
- State managed by parent contexts (useApp hook)
- Props for variants, callbacks for actions
- Tailwind for styling, no CSS-in-JS
