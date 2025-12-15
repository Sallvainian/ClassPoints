---
project_name: 'ClassPoints'
user_name: 'Sallvain'
date: '2025-12-13'
sections_completed:
  [
    'technology_stack',
    'typescript_rules',
    'framework_rules',
    'testing_rules',
    'code_quality',
    'workflow',
    'gotchas',
  ]
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Technology   | Version | Notes                          |
| ------------ | ------- | ------------------------------ |
| React        | 18.3.1  | Functional components only     |
| TypeScript   | ~5.6.2  | `strict: true` enabled         |
| Vite         | 6.0.5   | Dev server: port 5173          |
| Supabase     | 2.84.0  | Auth + PostgreSQL + Realtime   |
| Tailwind CSS | 4.1.17  | v4 with `@tailwindcss/postcss` |
| Vitest       | 4.0.13  | Unit tests in `src/test/`      |
| Playwright   | 1.57.0  | E2E tests in `e2e/`            |
| ESLint       | 9.17.0  | Flat config format             |

**Environment Setup:**

- dotenvx encrypts `.env.local` (committed)
- `.env.keys` contains decryption keys (never commit)
- CI needs `DOTENV_PRIVATE_KEY_LOCAL` secret

## Critical Implementation Rules

### TypeScript Rules

**Strict Mode Requirements:**

- `strict: true` is enabled - all types must be explicit
- No `any` types without justification
- No non-null assertions (`!`) unless proven safe
- No `@ts-ignore` for fixable errors

**Import/Export:**

- Use named exports (not default) for utilities, hooks, components
- Import types with `import type { X }` when possible
- Barrel exports (`index.ts`) for feature folders

**Error Handling:**

- Always destructure `{ data, error }` from Supabase calls
- Check `error` before using `data`
- Handle null/undefined explicitly (no silent failures)

### React Rules

**Hooks (CRITICAL):**

- ALL hooks must be called BEFORE any early returns
- Use `useApp()` for state - never access contexts directly
- Clean up subscriptions in useEffect return functions

**Component Pattern:**

```tsx
interface Props {
  /* ... */
}

export function Component({ prop }: Props) {
  // 1. Hooks first (ALL of them)
  const { data } = useApp();

  // 2. Event handlers
  const handleClick = () => {};

  // 3. Early returns (AFTER hooks)
  if (loading) return <Loading />;

  // 4. Main render
  return <div>...</div>;
}
```

**Context Hierarchy (order matters):**

1. `AuthProvider` - Authentication
2. `AuthGuard` - Route protection
3. `HybridAppProvider` - Online/offline mode
4. `AppContext` - Unified API facade

### Supabase Rules

**Realtime Subscriptions:**

- Tables need `REPLICA IDENTITY FULL` for DELETE payloads
- Always unsubscribe on component unmount
- Use optimistic updates with server reconciliation

**RLS (Row Level Security):**

- ALL tables must have RLS enabled
- Every new table needs SELECT/INSERT/UPDATE/DELETE policies
- Pattern: `user_id = auth.uid()`

### Testing Rules

**Unit Tests (Vitest):**

- Location: `src/test/`
- Pattern: `ComponentName.test.tsx` or `hookName.test.ts`
- Use `@testing-library/react` for component tests
- Mock Supabase client for isolated tests

**E2E Tests (Playwright):**

- Location: `e2e/`
- Requires env vars: `TEST_EMAIL`, `TEST_PASSWORD`
- Tests run against real Supabase (not mocked)
- Use `npm run test:e2e:ui` for visual debugging

**Commands:**

- `npm run test` - Run unit tests (watch mode)
- `npm run test:e2e` - Run E2E tests
- `npm run test:e2e:ui` - E2E with Playwright UI

### Code Quality & Style

**File Organization:**

- Components: `src/components/{feature}/ComponentName.tsx`
- Hooks: `src/hooks/useHookName.ts`
- Types: `src/types/`
- Utils: `src/utils/`

**Naming Conventions:**
| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `StudentGrid.tsx` |
| Hooks | use + PascalCase | `useClassrooms.ts` |
| Types | PascalCase | `Classroom`, `Student` |
| Handlers | handle + Action | `handleClick` |

**ESLint (Flat Config):**

- Config file: `eslint.config.js` (not `.eslintrc`)
- Run: `npm run lint`
- Plugins: react-hooks, react-refresh, typescript-eslint

### Development Workflow

**Local Development:**

- `npm run dev` - Start dev server (port 5173)
- `npm run dev:host` - Expose to network (mobile testing)
- `npm run build` - Production build with type checking

**Git Workflow:**

- Main branch: `main`
- Create feature branches for changes
- CI runs on push (lint, typecheck, build)

**Deployment:**

- Frontend: GitHub Pages (static hosting)
- Backend: Supabase (auth, database, realtime)
- CI secret: `DOTENV_PRIVATE_KEY_LOCAL` for env decryption

**Adding New Features:**

1. Create component in `src/components/{feature}/`
2. Create hook if data access needed in `src/hooks/`
3. Add types to `src/types/`
4. Use `useApp()` facade for state access
5. Add tests in `src/test/` or `e2e/`

### Critical Gotchas (Don't Miss!)

**⚠️ React Hook Order:**

- ALL hooks MUST be called before ANY early return
- Wrong: `if (loading) return <X />; const data = useHook();`
- Right: `const data = useHook(); if (loading) return <X />;`

**⚠️ State Access:**

- ALWAYS use `useApp()` hook - never access contexts directly
- `useApp()` is the single facade for all app data operations

**⚠️ Realtime Subscriptions:**

- ALWAYS clean up in useEffect return function
- Tables need `REPLICA IDENTITY FULL` for DELETE payloads
- Forgetting cleanup = memory leaks

**⚠️ Batch Operations:**

- Use `batch_id` for class-wide point awards
- Enables single undo for entire batch

**⚠️ Security:**

- Never commit `.env.keys`
- All tables need RLS policies
- Pattern: `user_id = auth.uid()`

**⚠️ Offline Mode:**

- App works without Supabase (localStorage fallback)
- `HybridAppProvider` handles mode switching

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

---

_Last Updated: 2025-12-13_
