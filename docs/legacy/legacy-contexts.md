---
paths:
  - 'src/contexts/**/*.tsx'
---

# Context Patterns

---

## Context Hierarchy (Order Matters!)

```
AuthProvider          → Authentication state
  AuthGuard           → Route protection
    SoundProvider     → Sound effects
      AppProvider     → Main app state (Supabase + realtime)
        AppContent    → Main app with unified context
```

---

## Key Contexts

| Context       | Purpose                                       | Access Via  |
| ------------- | --------------------------------------------- | ----------- |
| `AuthContext` | User auth & session                           | `useAuth()` |
| `AppContext`  | Supabase operations, realtime sync, app state | `useApp()`  |

---

## Required Patterns

- Components MUST use `useApp()` - never access contexts directly
- `useApp()` is the single facade for all data operations
- Context providers must maintain the hierarchy order
- Error boundaries should wrap context consumers

---

## Anti-Patterns

- **NEVER** import `AppContext` directly in components — always use the `useApp()` hook
- **NEVER** change the provider hierarchy order
- **AVOID** adding new contexts without a strong reason; prefer extending `AppContext` or creating a feature-scoped hook

---

## Modifying State Operations

When adding new state operations:

1. Add the fetch/mutation to `AppContext.tsx` and expose it on the `useApp()` return value (update the `AppContextValue` interface alongside).

---

## Examples

**Good (component accessing state):**

```tsx
export function Dashboard() {
  const { classrooms, students, awardPoints } = useApp();
  // Use data and actions from the facade
}
```

**Bad (direct context access):**

```tsx
import { AppContext } from '../contexts/AppContext';

export function Dashboard() {
  const context = useContext(AppContext); // WRONG - use useApp()
}
```

---

## Supabase Integration

- All Supabase operations go through `AppContext`
- Use optimistic updates for responsive UI
- Handle `{ data, error }` destructuring pattern
- RLS policies enforce server-side access control
