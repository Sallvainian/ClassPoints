# Context Patterns

**Applies to:** `src/contexts/**/*.tsx`

---

## Context Hierarchy (Order Matters!)

```
AuthProvider          → Authentication state
  AuthGuard           → Route protection
    HybridAppProvider → Online/offline mode selection
      AppContent      → Main app with unified context
```

---

## Key Contexts

| Context              | Purpose             | Access Via    |
| -------------------- | ------------------- | ------------- |
| `AuthContext`        | User auth & session | `useAuth()`   |
| `AppContext`         | Unified API facade  | `useApp()`    |
| `HybridAppContext`   | Mode switching      | Internal only |
| `SupabaseAppContext` | Full data layer     | Internal only |

---

## Required Patterns

- Components MUST use `useApp()` - never access contexts directly
- `useApp()` is the single facade for all data operations
- Context providers must maintain the hierarchy order
- Error boundaries should wrap context consumers

---

## Anti-Patterns

- **NEVER** import and use `AppContext`, `HybridAppContext`, etc. directly
- **NEVER** change the provider hierarchy order
- **AVOID** adding new contexts without updating the facade

---

## Modifying State Operations

When adding new state operations:

1. Add to `SupabaseAppContext.tsx` for Supabase operations
2. Update `HybridAppContext.tsx` if it affects online/offline behavior
3. Expose through `AppContext.tsx` for component access
4. Update `useApp()` hook type definitions

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

- All Supabase operations go through `SupabaseAppContext`
- Use optimistic updates for responsive UI
- Handle `{ data, error }` destructuring pattern
- RLS policies enforce server-side access control
