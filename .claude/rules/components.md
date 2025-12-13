# Component Patterns

**Applies to:** `src/components/**/*.tsx`

---

## Naming Conventions

- **Files:** PascalCase (`StudentGrid.tsx`, `AwardPointsModal.tsx`)
- **Components:** PascalCase, match filename
- **Props interfaces:** `{ComponentName}Props`

---

## Structure Pattern

```tsx
interface ComponentProps {
  prop: Type;
}

export function Component({ prop }: ComponentProps) {
  // 1. ALL hooks first (before any conditionals)
  const { data } = useApp();
  const [state, setState] = useState();

  // 2. Event handlers
  const handleClick = () => {};

  // 3. Early returns AFTER hooks
  if (loading) return <Loading />;

  // 4. Main render
  return <div>...</div>;
}
```

---

## Required Patterns

- Use `useApp()` hook for all app-wide state access
- Never access contexts directly - always use the facade
- Define props interface above component
- Export named functions (not default exports)
- All hooks must be called before any early returns

---

## Anti-Patterns

- **NEVER** call hooks after conditionals or early returns
- **NEVER** access `AuthContext`, `AppContext`, etc. directly
- **AVOID** inline styles - use Tailwind classes
- **AVOID** prop drilling - use `useApp()` instead

---

## Examples

**Good:**

```tsx
export function StudentCard({ student }: StudentCardProps) {
  const { awardPoints } = useApp();
  const [isHovered, setIsHovered] = useState(false);

  if (!student) return null;

  return <div className="p-4">...</div>;
}
```

**Bad:**

```tsx
export default function StudentCard({ student }) {
  // No props type, default export
  if (!student) return null; // Early return BEFORE hooks
  const { awardPoints } = useApp(); // Hook after early return - CRASH!
  return <div style={{ padding: 16 }}>...</div>; // Inline styles
}
```
