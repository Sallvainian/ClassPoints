# 13. Performance Considerations

## Optimization Strategies

1. **Debounced localStorage writes** - 300ms debounce prevents excessive disk I/O
2. **Memoized components** - React.memo on Desk, StudentCard to prevent unnecessary re-renders
3. **Virtual scrolling** - If student lists grow large (>100), consider virtualization
4. **Lazy template loading** - Load template previews on demand

## Bundle Size Targets

| Dependency        | Estimated Size     |
| ----------------- | ------------------ |
| React + ReactDOM  | ~45KB gzipped      |
| @dnd-kit          | ~15KB gzipped      |
| html2canvas       | ~40KB gzipped      |
| Tailwind (purged) | ~10KB gzipped      |
| **Total**         | **~110KB gzipped** |

---
