# Utility Patterns

**Applies to:** `src/utils/**/*.ts`

---

## Naming Conventions

- **Files:** camelCase, descriptive (`formatDate.ts`, `pointCalculations.ts`)
- **Functions:** camelCase, verb-first (`formatDate`, `calculateTotal`)
- **Constants:** UPPER_SNAKE_CASE (`DEFAULT_POINTS`, `MAX_STUDENTS`)

---

## Structure Pattern

```ts
// Single responsibility - one utility per file or grouped by domain

/**
 * Brief description of what this does
 */
export function utilityName(param: ParamType): ReturnType {
  // Implementation
}

// For grouped utilities
export const dateUtils = {
  format: (date: Date) => {
    /* ... */
  },
  parse: (str: string) => {
    /* ... */
  },
};
```

---

## Required Patterns

- Pure functions (no side effects)
- Explicit parameter and return types
- Export from utility file directly or barrel
- Handle edge cases (null, undefined, empty arrays)

---

## Anti-Patterns

- **NEVER** mutate input parameters
- **NEVER** access global state or contexts
- **AVOID** async operations in pure utilities
- **AVOID** overly generic utilities ("doEverything")

---

## Type Utilities

Location: `src/types/`

```ts
// Domain types
export interface Student {
  id: string;
  name: string;
  avatarColor?: string;
}

// Utility types
export type BehaviorCategory = 'positive' | 'negative';

// Database types
export type Tables = Database['public']['Tables'];
```

---

## Examples

**Good:**

```ts
export function calculateStudentTotal(transactions: PointTransaction[]): number {
  return transactions.reduce((sum, t) => sum + t.points, 0);
}
```

**Bad:**

```ts
export function calculateStudentTotal(transactions) {
  // No types
  let total = 0;
  transactions.forEach((t) => {
    total += t.points;
    saveToLocalStorage(total); // Side effect in utility!
  });
  return total;
}
```
