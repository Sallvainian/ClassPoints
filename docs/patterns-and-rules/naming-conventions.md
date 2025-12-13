# Naming Conventions

## File Naming

| Type       | Convention                       | Example                |
| ---------- | -------------------------------- | ---------------------- |
| Components | PascalCase.tsx                   | `StudentGrid.tsx`      |
| Hooks      | camelCase with `use` prefix      | `useClassrooms.ts`     |
| Contexts   | PascalCase with `Context` suffix | `AuthContext.tsx`      |
| Types      | camelCase.ts                     | `database.ts`          |
| Utils      | camelCase.ts                     | `migrateToSupabase.ts` |

## Code Naming

| Type           | Convention                  | Example                   |
| -------------- | --------------------------- | ------------------------- |
| Components     | PascalCase                  | `StudentPointCard`        |
| Hooks          | camelCase with `use` prefix | `useRealtimeSubscription` |
| Context values | camelCase                   | `activeClassroomId`       |
| Event handlers | `handle` + Event            | `handleClick`             |
| Boolean props  | `is` or `on` prefix         | `isOpen`, `onClose`       |

## Database Naming

| Type     | Convention                 | Example                           |
| -------- | -------------------------- | --------------------------------- |
| Tables   | snake_case plural          | `point_transactions`              |
| Columns  | snake_case                 | `classroom_id`                    |
| Indexes  | `idx_tablename_column`     | `idx_students_classroom_id`       |
| Policies | Descriptive sentence       | `"Users can view own classrooms"` |
| Triggers | `trigger_action_tablename` | `set_classrooms_user_id`          |

---
