# Copilot Instructions for ClassPoints

## Project Overview

ClassPoints is a React classroom management app for teachers to track student behavior points. It uses Supabase for real-time data synchronization with offline fallback support. Students never interact with the app directly - they only see the teacher's screen.

## Build & Run Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
npm test             # Vitest unit tests (watch mode)
npm run test:e2e     # Playwright E2E tests
```

## Project Layout

- `src/components/` - React components organized by feature
- `src/contexts/` - React contexts (AuthContext, AppContext, HybridAppContext)
- `src/hooks/` - Custom hooks for data fetching and subscriptions
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions
- `src/test/` - Vitest unit tests
- `e2e/` - Playwright E2E tests
- `supabase/migrations/` - Database schema migrations

## Component Patterns

Always follow this structure for React components:

1. Define props interface above the component: `interface ComponentNameProps { ... }`
2. Export named functions, not default exports: `export function Component() { ... }`
3. Call ALL hooks FIRST before any conditionals or early returns
4. Define event handlers after hooks
5. Place early returns AFTER all hooks are called
6. Use Tailwind CSS classes, never inline styles

**Critical:** Calling hooks after early returns will crash the app. Always call hooks first.

```tsx
// CORRECT pattern
export function StudentCard({ student }: StudentCardProps) {
  const { awardPoints } = useApp();          // 1. Hooks first
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => { ... };         // 2. Event handlers

  if (!student) return null;                 // 3. Early returns AFTER hooks

  return <div>...</div>;                     // 4. Render
}
```

## Context & State Management

**IMPORTANT:** Components MUST use the `useApp()` hook for all app-wide state. Never import or use `AppContext`, `HybridAppContext`, or `SupabaseAppContext` directly.

```tsx
// CORRECT
const { classrooms, students, awardPoints } = useApp();

// WRONG - never do this
const context = useContext(AppContext);
```

Context provider hierarchy (order matters):

```
AuthProvider → AuthGuard → HybridAppProvider → AppContent
```

State layers:

- **Global:** `useApp()` for classrooms, students, behaviors, user
- **Feature:** Custom hooks like `useSeatingChart`, `useLayoutPresets`
- **Local:** `useState` for component-specific UI state (modals, forms)

## Hook Patterns

All custom hooks must:

- Use camelCase with `use` prefix: `useStudents`, `useClassrooms`
- Return explicit types with loading and error states
- ALWAYS clean up subscriptions in useEffect return (prevents memory leaks)
- Use `useCallback` for functions passed to children

```ts
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe(); // CRITICAL: Always cleanup
}, [deps]);
```

## Supabase Patterns

Always follow this pattern for Supabase operations:

```ts
// 1. Destructure data and error
const { data, error } = await supabase.from('table').select('*');

// 2. Check error FIRST
if (error) {
  throw new Error(error.message);
}

// 3. Then use data
return data;
```

Use optimistic updates for responsive UI:

1. Update local state immediately
2. Send request to Supabase
3. On error: rollback local state

Type mapping: Database uses `snake_case`, app uses `camelCase`. Transform at context boundary.

## Testing Patterns

- Unit tests: `src/test/` directory, Vitest framework
- E2E tests: `e2e/` directory, Playwright framework
- Mock Supabase client in unit tests - never hit real API
- Use `data-testid` attributes for E2E selectors
- Test observable behavior, not implementation details

```ts
// CORRECT - testing behavior
it('should display student name', () => {
  render(<StudentCard student={mockStudent} />);
  expect(screen.getByText('John')).toBeInTheDocument();
});

// WRONG - testing implementation
it('should set loading to false', () => {
  expect(result.current.loading).toBe(false);  // Internal state
});
```

## Key Rules

1. **Hooks before returns:** All hooks must be called before any early returns
2. **Use `useApp()` only:** Never access contexts directly
3. **Cleanup subscriptions:** Every useEffect with subscriptions needs cleanup
4. **Optimistic updates:** UI updates before server confirmation
5. **Error handling:** Always check Supabase error before using data
6. **Named exports:** Use `export function`, not `export default`
7. **Tailwind only:** No inline styles, use Tailwind classes
