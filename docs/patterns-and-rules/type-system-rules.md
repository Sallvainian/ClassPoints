# Type System Rules

## Dual Type System

Two parallel type definitions exist:

1. **Database types** (`src/types/database.ts`) - Snake_case, matches Supabase
2. **Domain types** (`src/types/index.ts`) - CamelCase, used in components

```tsx
// Database type (database.ts)
interface Student {
  id: string;
  classroom_id: string; // snake_case
  avatar_color: string | null;
}

// Domain type (index.ts)
interface Student {
  id: string;
  classroomId: string; // camelCase
  avatarColor?: string;
}
```

**Rules:**

- Hooks work with database types internally
- Context maps to domain types before exposing to components
- Components should only see domain types

## Type Alias Convention

```tsx
// Row types (read)
export type Classroom = Database['public']['Tables']['classrooms']['Row'];

// Insert types (create)
export type NewClassroom = Database['public']['Tables']['classrooms']['Insert'];

// Update types (modify)
export type UpdateClassroom = Database['public']['Tables']['classrooms']['Update'];
```

**Rules:**

- `New*` prefix for Insert types
- `Update*` prefix for Update types
- Plain name for Row (read) types

## Strict TypeScript Rules

From `tsconfig.app.json`:

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

**Rules:**

- No unused variables or parameters
- All switch cases must have break/return
- Strict null checking enabled

---
