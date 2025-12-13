# Accessibility Strategy

## WCAG Compliance Target

**Level:** WCAG 2.1 AA compliance (required for educational software).

## Accessibility Requirements

**Perceivable:**

- [ ] All images have alt text
- [ ] Color is not the only indicator of meaning
- [ ] Text contrast ≥4.5:1 (body), ≥3:1 (large text)
- [ ] UI scalable to 200% without loss of functionality

**Operable:**

- [ ] All functions keyboard accessible
- [ ] Focus indicators visible (2px outline)
- [ ] Touch targets ≥44px
- [ ] No time-dependent interactions (except animations)
- [ ] Skip navigation link available

**Understandable:**

- [ ] Language declared in HTML
- [ ] Form labels associated with inputs
- [ ] Error messages descriptive and helpful
- [ ] Consistent navigation patterns

**Robust:**

- [ ] Valid HTML structure
- [ ] ARIA landmarks and labels where appropriate
- [ ] Works with screen readers (VoiceOver, NVDA)

## Keyboard Navigation

| Key         | Action                                   |
| ----------- | ---------------------------------------- |
| Tab         | Move to next interactive element         |
| Shift+Tab   | Move to previous element                 |
| Enter/Space | Activate focused element                 |
| Escape      | Close modal/overlay                      |
| Arrow keys  | Navigate within components (grid, modal) |

## Screen Reader Support

**Announcements:**

- Point awarded: "Emma received 3 points for Excellent Work"
- Student selected (Random): "Emma has been selected"
- Error: "Error: Could not save changes. Please try again."

**Landmarks:**

- `<header>` - App header
- `<nav>` - Classroom navigation
- `<main>` - Student grid
- `<aside>` - Settings panel

---
