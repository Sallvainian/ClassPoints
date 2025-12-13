# 14. Accessibility (a11y)

## Requirements

- **Keyboard navigation**: All actions accessible via keyboard
- **Screen reader support**: ARIA labels on interactive elements
- **Focus management**: Proper focus handling in modals and drag-drop
- **Color contrast**: WCAG AA compliance for all text

## Implementation

```typescript
// Desk component with accessibility
<div
  role="gridcell"
  aria-label={student ? `Desk assigned to ${student.name}` : 'Empty desk'}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleDeskClick();
    }
  }}
>
```

---
