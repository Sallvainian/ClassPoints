# Responsive Design Strategy

## Platform Priority

ClassPoints is **Smart Board-first**, with graceful degradation:

| Platform                | Priority  | Optimization                                |
| ----------------------- | --------- | ------------------------------------------- |
| Smart Board (1920×1080) | Primary   | Largest touch targets, classroom visibility |
| Laptop (1366×768)       | Secondary | Full functionality, mouse/keyboard support  |
| Tablet (1024×768)       | Tertiary  | Touch optimized, simplified layout          |
| Phone (375×667)         | Future    | Basic functionality, responsive grid        |

## Breakpoint Strategy

**Custom breakpoints for classroom use:**

| Breakpoint | Name               | Target                        |
| ---------- | ------------------ | ----------------------------- |
| ≥1280px    | `sb` (Smart Board) | Full layout, large targets    |
| ≥1024px    | `lg` (Laptop)      | Full layout, standard targets |
| ≥768px     | `md` (Tablet)      | Simplified layout             |
| <768px     | `sm` (Phone)       | Single column, bottom nav     |

## Responsive Adaptations

**Student Grid:**
| Breakpoint | Behavior |
|------------|----------|
| Smart Board | 6-8 columns, large cards |
| Laptop | 4-6 columns, medium cards |
| Tablet | 3-4 columns, medium cards |
| Phone | 2 columns, small cards |

**Navigation:**
| Breakpoint | Behavior |
|------------|----------|
| Smart Board | Persistent sidebar |
| Laptop | Collapsible sidebar |
| Tablet | Hamburger menu → drawer |
| Phone | Bottom navigation bar |

**Behavior Modal:**
| Breakpoint | Behavior |
|------------|----------|
| Smart Board | Two-column, centered |
| Laptop | Two-column, centered |
| Tablet | Two-column, full width |
| Phone | Single column, bottom sheet |
