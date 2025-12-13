# Design System

## Design System Choice: Tailwind CSS v4

**Decision:** ClassPoints uses **Tailwind CSS v4** as its primary design system and styling framework.

**Rationale:**

1. **Speed for an interaction-heavy tool** - The core workflow (awarding points, seeing feedback) must be fast and fluid, especially on Smart Boards during live instruction. Tailwind's utility-first approach minimizes context-switching and makes iteration on layout, spacing, and sizing quick.

2. **Consistent visual language via tokens** - ClassPoints requires consistent tokens (color, spacing, typography) more than a heavy component library. Tailwind encourages codifying these as design tokens in config and using them via utility classes.

3. **Responsiveness across platforms** - Tailwind's responsive variants (`sm:`, `md:`, `lg:`) map cleanly to Smart Board (large), laptop (medium), and future phone (small) displays.

4. **Future-proofing** - Config-driven tokens support future theming, accessibility upgrades, and age-group differentiation by modifying tokens rather than refactoring components.

## Smart Board Design Tokens

All design decisions center on **Smart Boards as the primary target** - large, touch-friendly UI optimized for 1-3 meter viewing distance and finger interaction.

### Touch Targets

| Token       | Purpose                                           | Size    | Tailwind                   |
| ----------- | ------------------------------------------------- | ------- | -------------------------- |
| `touch-lg`  | Primary controls (student avatars, award buttons) | 56-64px | `h-14 w-14` to `h-16 w-16` |
| `touch-md`  | Secondary controls (filters, close buttons)       | 44-48px | `h-11 w-11` to `h-12 w-12` |
| `touch-gap` | Spacing between tappable items                    | 8-12px  | `gap-2` to `gap-3`         |

**Hit area principle:** Where visual elements are smaller (icon-only), wrap them in a container providing the full touch target size.

### Typography Scale for Classroom Visibility

Text must be readable from the back of a typical classroom (3-7 meters).

| Token               | Purpose                                | Size    | Tailwind                 |
| ------------------- | -------------------------------------- | ------- | ------------------------ |
| `type-display`      | Page titles (class name)               | 32-40px | `text-2xl` to `text-3xl` |
| `type-heading`      | Section titles                         | 24-28px | `text-xl` to `text-2xl`  |
| `type-student-name` | Student names (primary reading target) | 20-24px | `text-lg` to `text-xl`   |
| `type-label`        | Supporting labels, pill text           | 16-18px | `text-base` to `text-lg` |

**Contrast & Weight:**

- Use `font-medium` (500) minimum for primary labels and student names
- Target WCAG AA contrast (4.5:1) for primary text; minimum 3:1 for very large text (≥24px)

## Spacing and Sizing

### Student Tiles

| Token          | Purpose                      | Value                 | Tailwind                   |
| -------------- | ---------------------------- | --------------------- | -------------------------- |
| `tile-student` | Student card dimensions      | 140-180px × 120-160px | `w-36 h-32` to `w-44 h-40` |
| `grid-gap`     | Grid spacing between tiles   | 12-16px               | `gap-3` to `gap-4`         |
| `bar-height`   | Top/bottom control bars      | 64-80px               | `h-16` to `h-20`           |
| `safe-area`    | Edge margins for Smart Board | 24-32px               | `px-6` to `px-8`           |

### Core Spacing Scale

| Token       | Value | Tailwind |
| ----------- | ----- | -------- |
| `space-xs`  | 4px   | `1`      |
| `space-sm`  | 8px   | `2`      |
| `space-md`  | 12px  | `3`      |
| `space-lg`  | 16px  | `4`      |
| `space-xl`  | 24px  | `6`      |
| `space-2xl` | 32px  | `8`      |

## Animation Guidelines ("Calibrated Celebration")

Feedback should be **immediately noticeable, short (0.5-1s), and non-disruptive**.

### Duration & Timing

| Animation Type                       | Duration              | Timing                                        |
| ------------------------------------ | --------------------- | --------------------------------------------- |
| Celebratory feedback (point awarded) | 0.5-1.0 seconds total | `ease-out` or `cubic-bezier(0.16, 1, 0.3, 1)` |
| Micro-interactions (hover, tap)      | 150-250ms             | `ease-out`                                    |

**Celebration breakdown:**

- Entry animation: 200-300ms
- Hold/peak: 100-300ms
- Exit/fade: 200-400ms

### Motion Patterns

**Allowed/Encouraged:**

- **Subtle scale & opacity:** Point badge scales 0.9 → 1.05 → 1.0 with fade
- **Short directional motion:** "+1" badge floats up 8-16px while fading out
- **Color pulse:** Student tile background tints brighter for 400-600ms, then returns

**Avoid/Restrict:**

- No full-screen flashes or high-frequency strobing
- No complex or looping animations during normal use
- Limit simultaneous celebrations (stagger or subdue when many trigger at once)

### Specific Celebration Patterns

**Single Point Award:**

1. Student tile: Quick `scale-105` → `scale-100` over 250ms with background tint for 400-600ms
2. Point badge: Appears at 0.9 scale, grows to 1.0, moves up 8-16px while fading out over 400-700ms

**Class Milestone:**

1. Banner slides/fades in from top over 250-300ms
2. Holds visible for 700-1200ms
3. Fades out over 300-400ms
4. Reserve for clearly defined milestone triggers only

### Motion Accessibility

- Provide app-level "Reduced Motion" preference (future enhancement)
- When enabled: Replace scale/move with simple opacity; reduce durations to 150-250ms
- No flickering above 3 Hz
- Throttle celebrations if many events fire in quick succession
