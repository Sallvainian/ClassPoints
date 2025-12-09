# ClassPoints - Claude Code Instructions

## Project Overview

ClassPoints is a classroom behavior management web app for teachers to track student points. Built with React 18 + TypeScript + Vite + Supabase.

## Architecture

```
UI Components → React Context → Custom Hooks → Supabase Client → PostgreSQL
```

**Key Contexts (in provider order):**
1. `AuthProvider` - Supabase authentication
2. `AuthGuard` - Route protection
3. `HybridAppProvider` - Online/offline mode switching
4. `AppContext` - Unified API facade for components

## Code Conventions

### File Organization
- Components: `src/components/{feature}/ComponentName.tsx`
- Hooks: `src/hooks/useHookName.ts`
- Types: `src/types/`
- Utils: `src/utils/`

### Naming
- Components: PascalCase (`StudentGrid.tsx`)
- Hooks: camelCase with `use` prefix (`useClassrooms.ts`)
- Types: PascalCase interfaces (`Classroom`, `Student`)

### Component Patterns
```tsx
// Functional components with TypeScript props
interface ComponentProps {
  prop: Type;
}

export function Component({ prop }: ComponentProps) {
  // Hooks at top
  const { data } = useApp();

  // Event handlers
  const handleClick = () => {};

  // Early returns for loading/error states
  if (loading) return <Loading />;

  // Main render
  return <div>...</div>;
}
```

### State Management
- Use `useApp()` hook for app-wide state access
- Local state with `useState` for component-specific state
- Never access contexts directly in components - use `useApp()` facade

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component with provider hierarchy |
| `src/contexts/AppContext.tsx` | Main state facade - READ THIS FIRST for data operations |
| `src/contexts/HybridAppContext.tsx` | Online/offline switching logic |
| `src/contexts/SupabaseAppContext.tsx` | Full Supabase data layer |
| `src/hooks/useRealtimeSubscription.ts` | Generic realtime subscription hook |
| `src/lib/supabase.ts` | Supabase client initialization |
| `supabase/migrations/001_initial_schema.sql` | Database schema with RLS |

## Database

### Tables
- `classrooms` - User's classrooms
- `students` - Students in classrooms
- `behaviors` - Point behavior templates
- `point_transactions` - Awarded points history

### Important: Row Level Security
All tables have RLS. When adding new tables:
```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON new_table
  FOR SELECT USING (user_id = auth.uid());
-- Add INSERT, UPDATE, DELETE policies
```

### Important: Realtime DELETE events
Tables need `REPLICA IDENTITY FULL` for complete DELETE payloads:
```sql
ALTER TABLE table_name REPLICA IDENTITY FULL;
```

## Common Operations

### Adding a new component
1. Create in appropriate `src/components/{feature}/` directory
2. Export from component's index if exists
3. Use `useApp()` for state access

### Adding a new hook
1. Create in `src/hooks/useHookName.ts`
2. Export from `src/hooks/index.ts`
3. Follow existing hook patterns

### Adding a new database table
1. Create migration in `supabase/migrations/`
2. Add RLS policies
3. Add types to `src/types/database.ts`
4. Add domain types to `src/types/index.ts`
5. Create hook for data access

### Modifying state operations
1. Update `SupabaseAppContext.tsx` for Supabase operations
2. Update `HybridAppContext.tsx` if it affects online/offline behavior
3. Expose through `AppContext.tsx` if needed by components

## Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm run dev:host     # Start dev server exposed to network
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
```

## Environment Variables

**Using dotenvx for encrypted secrets.**

| File | Purpose | Git |
|------|---------|-----|
| `.env.local` | Encrypted env vars | ✅ Committed |
| `.env.keys` | Private decryption keys | ❌ Never commit |
| `.env.example` | Template for reference | ✅ Committed |

### Running locally
```bash
npm run dev        # dotenvx is built into npm scripts
npm run dev:host   # expose to network
```

### Required variables (in `.env.local`):
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### CI/CD Setup
Set `DOTENV_PRIVATE_KEY_LOCAL` as a secret in your CI environment.

## Testing

- **Unit tests:** `src/test/` with Vitest
- **E2E tests:** `e2e/` with Playwright
- E2E tests require `TEST_EMAIL` and `TEST_PASSWORD` env vars

## Gotchas

1. **Hooks order matters** - All hooks must be called before any early returns
2. **Realtime subscriptions** - Clean up on unmount to prevent memory leaks
3. **Optimistic updates** - UI updates before server confirmation
4. **Batch operations** - Use `batch_id` for class-wide awards (enables batch undo)
5. **Offline mode** - App works without Supabase using localStorage fallback

## Types

### Core Domain Types
```typescript
type BehaviorCategory = 'positive' | 'negative';

interface Behavior {
  id: string; name: string; points: number;
  icon: string; category: BehaviorCategory;
  isCustom: boolean; createdAt: number;
}

interface Student {
  id: string; name: string; avatarColor?: string;
}

interface Classroom {
  id: string; name: string; students: Student[];
  createdAt: number; updatedAt: number; pointTotal?: number;
}

interface PointTransaction {
  id: string; studentId: string; classroomId: string;
  behaviorId: string; behaviorName: string; behaviorIcon: string;
  points: number; timestamp: number; note?: string;
}
```

## Documentation

Full documentation available in `docs/`:
- [Architecture](docs/architecture.md)
- [Data Models](docs/data-models.md)
- [Tech Stack](docs/tech-stack.md)
- [Source Tree](docs/source-tree.md)
