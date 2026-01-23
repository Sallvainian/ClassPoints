# Development Guide - ClassPoints

## Prerequisites

- **Node.js:** v20+ (LTS recommended)
- **npm:** v10+ (comes with Node.js)
- **Supabase Account:** For backend services
- **dotenvx:** Bundled via dev dependencies

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd ClassPoints
npm install

# Get decryption keys from team lead (required for .env.local)
# Save to .env.keys (NEVER commit this file)

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Setup

### Required Environment Variables

ClassPoints uses **dotenvx** for encrypted secrets. The `.env.local` file is committed (encrypted), but you need the private key in `.env.keys` to decrypt.

| File           | Purpose            | Git              |
| -------------- | ------------------ | ---------------- |
| `.env.local`   | Encrypted env vars | Committed        |
| `.env.keys`    | Decryption keys    | **NEVER commit** |
| `.env.example` | Template reference | Committed        |

**Required variables:**

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**For E2E tests:**

```
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword123
```

### Getting Decryption Keys

1. Contact the project maintainer for `DOTENV_PRIVATE_KEY_LOCAL`
2. Create `.env.keys`:
   ```
   DOTENV_PRIVATE_KEY_LOCAL=your_key_here
   ```
3. Verify: `npm run dev` should start without errors

### CI/CD Setup

Set `DOTENV_PRIVATE_KEY_LOCAL` as a secret in your CI environment.

## npm Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Start dev server (localhost:5173)    |
| `npm run dev:host`    | Start dev server exposed to network  |
| `npm run build`       | Production build                     |
| `npm run preview`     | Preview production build             |
| `npm run lint`        | Run ESLint                           |
| `npm run typecheck`   | Run TypeScript type checking         |
| `npm run test`        | Run unit tests (Vitest, watch mode)  |
| `npm run test:e2e`    | Run E2E tests (Playwright, headless) |
| `npm run test:e2e:ui` | Run E2E tests with Playwright UI     |

## Development Workflow

### 1. Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Development Loop

```bash
# Start dev server
npm run dev

# In another terminal, run tests in watch mode
npm run test

# Check types periodically
npm run typecheck
```

### 3. Pre-commit Checks

Git hooks automatically run on commit:

- `lint-staged` - ESLint fix on staged files
- `typecheck` - Full TypeScript check

### 4. Manual Checks Before PR

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## Code Organization

### Adding a New Component

1. Create in appropriate feature folder:

   ```
   src/components/{feature}/ComponentName.tsx
   ```

2. Follow the component pattern:

   ```tsx
   interface ComponentProps {
     prop: Type;
   }

   export function Component({ prop }: ComponentProps) {
     const { data } = useApp(); // Always use useApp()
     // ...
   }
   ```

3. Export from barrel file:
   ```typescript
   // src/components/{feature}/index.ts
   export { Component } from './Component';
   ```

### Adding a New Hook

1. Create in hooks folder:

   ```
   src/hooks/useHookName.ts
   ```

2. Follow the hook pattern:

   ```typescript
   export function useHookName(param: Type): ReturnType {
     const [state, setState] = useState<Type | null>(null);
     // ...
     return { state, actions };
   }
   ```

3. Export from barrel:
   ```typescript
   // src/hooks/index.ts
   export { useHookName } from './useHookName';
   ```

### Adding a Database Table

1. Create migration file:

   ```
   supabase/migrations/XXX_description.sql
   ```

2. Add RLS policies:

   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can view own data" ON new_table
     FOR SELECT USING (user_id = auth.uid());
   ```

3. Add types to `src/types/database.ts`

4. Add domain types to `src/types/index.ts`

5. Create hook for data access

### Realtime Considerations

For tables with realtime subscriptions, set `REPLICA IDENTITY FULL`:

```sql
ALTER TABLE table_name REPLICA IDENTITY FULL;
```

This ensures DELETE events include full row data.

## Testing

### Unit Tests

Location: `src/test/`

```bash
# Run all tests
npm run test

# Run specific test
npm run test -- studentParser

# Run with coverage
npm run test -- --coverage
```

Pattern:

```typescript
import { describe, it, expect } from 'vitest';

describe('functionName', () => {
  it('should handle expected case', () => {
    const result = functionName(input);
    expect(result).toBe(expected);
  });
});
```

### E2E Tests

Location: `e2e/`

```bash
# Run headless
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

Requires `TEST_EMAIL` and `TEST_PASSWORD` in environment.

## Debugging

### Browser DevTools

1. React DevTools extension for component inspection
2. Network tab for Supabase API calls
3. Application > Local Storage for persisted state

### Supabase Dashboard

Access your project at `https://supabase.com/dashboard/project/{project-id}`:

- Table Editor for data inspection
- SQL Editor for queries
- Logs for debugging
- Auth for user management

### VS Code Extensions

Recommended:

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Importer

## Common Tasks

### Reset Local Database

```sql
-- In Supabase SQL Editor
TRUNCATE classrooms CASCADE;
```

### Clear localStorage

```javascript
// Browser console
localStorage.clear();
```

### Test with Different User

```javascript
// Browser console
await window.__SUPABASE_CLIENT__.auth.signOut();
```

### Check Supabase Connection

```javascript
// Browser console
const { data, error } = await window.__SUPABASE_CLIENT__.from('classrooms').select('*');
console.log({ data, error });
```

## Deployment

### Build for Production

```bash
npm run build
```

Output is in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### CI/CD

GitHub Actions workflows:

- `test.yml` - Run tests on PR
- `deploy.yml` - Deploy to production
- `claude.yml` - Claude Code automation
- `claude-code-review.yml` - Automated code review

## Troubleshooting

### "Missing Supabase environment variables"

Ensure `.env.keys` exists with the decryption key:

```
DOTENV_PRIVATE_KEY_LOCAL=your_key
```

### "useApp must be used within HybridAppProvider"

Component is outside the provider hierarchy. Check that it's rendered within `<App>`.

### Realtime Not Working

1. Check table has realtime enabled in Supabase dashboard
2. Verify RLS policies allow access
3. Check for `REPLICA IDENTITY FULL` on table

### Type Errors After Schema Change

Regenerate types:

```bash
npx supabase gen types typescript --project-id PROJECT_ID > src/types/database.ts
```

### ESLint/Prettier Conflicts

```bash
npm run lint -- --fix
npx prettier --write .
```
