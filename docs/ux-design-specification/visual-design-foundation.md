# Visual Design Foundation

## Color System

ClassPoints uses a classroom-friendly color palette optimized for Smart Board visibility and emotional clarity.

### Primary Colors

| Role         | Color       | Hex       | Usage                              |
| ------------ | ----------- | --------- | ---------------------------------- |
| Primary      | Bright Blue | `#4A90D9` | Primary actions, navigation, links |
| Primary Dark | Deep Blue   | `#2E5C8A` | Hover states, emphasis             |
| Background   | Soft White  | `#FAFBFC` | Main background                    |
| Surface      | Pure White  | `#FFFFFF` | Cards, modals, elevated surfaces   |

### Semantic Colors

| Role           | Color         | Hex       | Usage                              |
| -------------- | ------------- | --------- | ---------------------------------- |
| Positive       | Vibrant Green | `#22C55E` | Positive behaviors, success states |
| Positive Light | Soft Green    | `#DCFCE7` | Positive backgrounds, highlights   |
| Negative       | Warm Orange   | `#F97316` | Needs Work behaviors, warnings     |
| Negative Light | Soft Orange   | `#FED7AA` | Negative backgrounds, highlights   |
| Error          | Alert Red     | `#EF4444` | Error states, destructive actions  |
| Neutral        | Slate Gray    | `#64748B` | Secondary text, borders            |

### Student Avatar Colors

A curated palette of distinct, visually pleasing colors for student identification:

| Color Name | Hex       | Notes               |
| ---------- | --------- | ------------------- |
| Coral      | `#FF6B6B` | Warm, friendly      |
| Ocean      | `#4ECDC4` | Cool, calming       |
| Sunset     | `#FFE66D` | Bright, energetic   |
| Lavender   | `#9B59B6` | Playful, distinct   |
| Sky        | `#74B9FF` | Light, approachable |
| Mint       | `#00B894` | Fresh, positive     |
| Peach      | `#FD79A8` | Soft, warm          |
| Slate      | `#636E72` | Neutral, mature     |

### Color Accessibility

- All text meets WCAG AA contrast (4.5:1 minimum)
- Interactive elements use 3:1 contrast against backgrounds
- Colors are not the only indicator of state (icons/text supplement)
- Tested for common color blindness types (deuteranopia, protanopia)

## Typography System

### Font Stack

```css
/* Primary: System fonts for performance */
font-family:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Alternative: Inter for refined appearance */
font-family: 'Inter', sans-serif;
```

**Rationale:** System fonts load instantly (critical for Smart Board startup) while providing excellent legibility at large sizes.

### Type Scale (Smart Board Optimized)

| Level        | Size | Weight | Line Height | Use Case                   |
| ------------ | ---- | ------ | ----------- | -------------------------- |
| Display      | 40px | 700    | 1.1         | Classroom name, main title |
| H1           | 32px | 600    | 1.2         | Section headers            |
| H2           | 24px | 600    | 1.3         | Panel titles               |
| Student Name | 20px | 500    | 1.3         | Student cards (primary)    |
| Body         | 18px | 400    | 1.5         | General text               |
| Label        | 16px | 500    | 1.4         | Buttons, tags              |
| Caption      | 14px | 400    | 1.4         | Secondary info             |

### Typography Guidelines

- **Minimum size on Smart Board:** 16px (smaller is unreadable from distance)
- **Student names:** Always 20px+ with medium weight for quick identification
- **Point values:** Bold, high contrast for instant recognition
- **Truncation:** Names over 12 characters may truncate with ellipsis

## Spacing & Layout Foundation

### Base Unit

The spacing system uses **4px as the base unit** with a consistent scale:

| Token     | Value | Tailwind | Use Case                 |
| --------- | ----- | -------- | ------------------------ |
| `space-1` | 4px   | `1`      | Icon gaps, tight spacing |
| `space-2` | 8px   | `2`      | Small internal padding   |
| `space-3` | 12px  | `3`      | Standard gaps            |
| `space-4` | 16px  | `4`      | Card padding             |
| `space-6` | 24px  | `6`      | Section spacing          |
| `space-8` | 32px  | `8`      | Major section breaks     |

### Layout Principles

1. **Density: Medium-High**
   - Student grid should show 20-30 students without scrolling
   - Controls should be visible without searching
   - White space prevents visual clutter but doesn't waste screen real estate

2. **Grid System**
   - Student grid: CSS Grid with `auto-fill` and `minmax(140px, 1fr)`
   - Sidebar: Fixed 280px width on large screens
   - Main content: Fluid, fills remaining space

3. **Visual Hierarchy**
   - Class name: Top, largest element
   - Student grid: Center, majority of screen
   - Controls: Bottom or sidebar, easily accessible but not dominant
   - Point totals: On each card, immediately visible

## Accessibility Considerations

### Visual Accessibility

| Requirement      | Implementation                                   |
| ---------------- | ------------------------------------------------ |
| Color contrast   | All text 4.5:1+ against background               |
| Focus indicators | 2px solid outline, high contrast                 |
| Touch targets    | Minimum 44px × 44px (larger for primary actions) |
| Text scaling     | UI remains usable at 150% zoom                   |

### Motion Accessibility

| Requirement        | Implementation                               |
| ------------------ | -------------------------------------------- |
| Reduced motion     | Respect `prefers-reduced-motion` media query |
| Animation duration | All animations under 1 second                |
| No auto-play       | Animations triggered by user action only     |
| No flickering      | Nothing flashes more than 3x per second      |

### Cognitive Accessibility

| Requirement           | Implementation                         |
| --------------------- | -------------------------------------- |
| Consistent navigation | Same layout across all views           |
| Clear labeling        | All icons have text labels or tooltips |
| Predictable behavior  | Actions do what users expect           |
| Error prevention      | Confirmations for destructive actions  |

### Future Considerations

- High contrast mode (black/white/yellow palette)
- Large text mode (150% scale preset)
- Screen reader announcements for point awards
- Keyboard navigation for laptop/desktop use
