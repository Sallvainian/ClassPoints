---
project_name: ClassPoints
user_name: Sallvain
date: 2026-04-21
sections_completed:
  [
    'technology_stack',
    'language_rules',
    'framework_rules',
    'supabase_rules',
    'testing_rules',
    'code_quality_rules',
    'critical_dont_miss',
  ]
status: 'complete'
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss. Complement — do not duplicate — `CLAUDE.md` and `.claude/rules/*`._

---

## Technology Stack & Versions

**Runtime & Build**

- React 18.3.1 + React DOM 18.3.1
- TypeScript ~5.9.3 (strict mode, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`, `moduleResolution: bundler`)
- Vite 6.0.5 (target ES2020, `jsx: react-jsx`)
- Node types @25.x (tooling only)

**Backend / Data**

- `@supabase/supabase-js` ^2.90.1 — Auth, PostgREST, Realtime (WebSocket)
- Supabase CLI ^2.92.1 (local stack via `npx supabase start`)
- PostgreSQL 15+

**UI & Interaction**

- Tailwind CSS 4.1.17 via `@tailwindcss/postcss` 4.1.18 (v4 — PostCSS plugin, NOT the legacy `tailwindcss` PostCSS plugin)
- `@dnd-kit/core` ^6.3.1 + `@dnd-kit/utilities` ^3.2.2 (seating chart DnD)
- `lucide-react` ^1.8.0, `uuid` ^13.0.0

**Testing**

- Vitest ^4.0.17 + jsdom ^27.4.0
- `@testing-library/react` ^16.3.2 + `jest-dom` ^6.9.1 + `user-event` ^14.6.1
- Playwright ^1.57.0 (Chromium only, auth via `.auth/user.json` storageState)
- `tdd-guard-vitest` ^0.1.6

**Lint / Format / Hooks**

- ESLint ^9.39.2 (flat config, `eslint.config.js`) + `typescript-eslint` ^8.53.0 + `eslint-plugin-react-hooks` ^5.0.0 + `eslint-plugin-react-refresh` ^0.4.26
- Prettier ^3.8.0 (semi, single-quote, tabWidth 2, trailingComma `es5`, printWidth 100)
- `simple-git-hooks` + `lint-staged` — pre-commit runs `eslint --fix` + `prettier --write` + `npm run typecheck`

**Env / Scripts**

- `fnox exec` wraps dev/build/preview (env-var loader — do NOT replace with plain `vite`)
- `tsx` ^4.21.0 for ad-hoc scripts

**Version constraints AI agents must respect**

- Tailwind **v4** syntax (`@import "tailwindcss"`, `@tailwindcss/postcss` plugin). Do NOT generate v3-style `tailwind.config.js` theme extensions beyond the existing pattern; do NOT add the legacy `tailwindcss` PostCSS plugin.
- React **18** (not 19) — `useTransition`/`useDeferredValue` OK; do NOT use `use()`, `useActionState`, or React 19 form actions.
- Vitest **4** API (breaking changes from v1).
- ESLint **flat config only** — do NOT emit `.eslintrc*` files.

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Strict mode is enforced** — flags ON, CI/pre-commit blocks violations:

- `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`
- Delete unused imports/params outright. Do NOT prefix with `_` to silence — if something is unused, remove it.

**Module resolution**

- `moduleResolution: "bundler"` + `allowImportingTsExtensions: true` — relative imports do NOT need `.js` extensions (Vite resolves `.ts`/`.tsx` directly).
- `isolatedModules: true` — every file must be independently transpilable. Use `import type` for type-only imports.
- `moduleDetection: "force"` — every file is a module; no ambient scripts.

**Exports**

- **Named exports only** for components (`export function Foo()`). Default exports are not used in components and conflict with `eslint-plugin-react-refresh`'s `only-export-components` rule.
- Hooks live in `src/hooks/` and are re-exported from `src/hooks/index.ts` (barrel file).

**Type mapping (DB ↔ App)**

- DB types are `snake_case` (`src/types/database.ts`); app types are `camelCase` (`src/types/index.ts`).
- Transform at the context/hook boundary — never let `snake_case` leak into components.
- When adding a new DB column, update `DbX`, the `X` app type, and the `transformX()` function together.

**Error handling with Supabase**

- ALWAYS destructure `{ data, error }` and check `error` before `data`. Throw `new Error(error.message)` so callers see a real `Error`, not a Supabase object.
- In optimistic-update paths, catch the error and roll back local state; don't let it bubble uncaught past the hook boundary.

**Env access**

- App code (`src/**`) uses `import.meta.env.VITE_*`. Only `VITE_`-prefixed vars are exposed to the browser.
- Node-side files (`scripts/**`, `e2e/**`, `playwright.config.ts`, `vitest.config.ts`) use `process.env` and can read any var, including secrets.
- Never use `process.env` in `src/**` — it will either be undefined at runtime or, worse, a build tool will inline a secret into the client bundle.

### Framework-Specific Rules (React)

**Context hierarchy is fixed — do not reorder**

```
AuthProvider → AuthGuard → SoundProvider → AppProvider → AppContent
```

`AppProvider` depends on the authenticated user from `AuthContext`; `AuthGuard` short-circuits render before data contexts mount. New top-level providers go INSIDE `AppProvider`, not above it, unless they are auth-layer concerns.

**Single facade rule — no direct context imports from components**

- ALWAYS `const { ... } = useApp()` (or `useAuth()`).
- NEVER `import { AppContext } from '...'; useContext(AppContext)` in a component.
- When adding new state/operations: extend `AppContext.tsx`, update the `AppContextValue` interface, expose via `useApp()`. Don't create parallel app-wide contexts.
- Feature-scoped state (e.g., `useSeatingChart`) stays in a hook — don't promote to context unless multiple unrelated component trees need it.

**Component structure (hooks-before-returns is non-negotiable)**

1. All hooks (including `useApp()`) first — stable, unconditional order.
2. Event handlers (wrap in `useCallback` if passed to memoized children).
3. Early returns AFTER hooks.
4. Main render.

A hook called after an early return will crash the next render when the branch flips. `eslint-plugin-react-hooks` catches most — but not all — violations.

**Performance: unstable reference hazards**

- Don't pass fresh object/array literals as props to memoized children — wrap in `useMemo`.
- `useCallback` for handlers passed to children or used in effect deps.
- Derive state inline or via `useMemo` — never store derived values in parallel `useState` (they drift).

**`react-refresh/only-export-components`** (warn)

- A file exporting a component should export ONLY components (plus `allowConstantExport` constants). Move helper functions/types out of component files to keep HMR stable.

**Tailwind v4 styling**

- Utility classes in `className` only. Inline `style={{...}}` is allowed only for dynamic values that cannot be expressed as classes (e.g., computed `transform` for drag-and-drop).
- No CSS Modules, no styled-components, no emotion — Tailwind-only.

### Supabase, Realtime & Data Access

**Every fetching hook exposes a uniform shape**

`{ data|<domain>, loading, error, refetch }` — match `useClassrooms`, `useStudents`, `useSeatingChart`. Don't invent new shapes; symmetry keeps hooks interchangeable at call sites.

**Realtime subscription rules**

- Use `useRealtimeSubscription<DbType>({ table, filter, onInsert, onUpdate, onDelete })` — do NOT hand-roll `supabase.channel(...)` unless the helper can't do what you need.
- If you hand-roll, cleanup in `useEffect` return is MANDATORY: `return () => supabase.removeChannel(channel)`. Missing cleanup = memory + bandwidth leak per remount.
- Filter syntax is PostgREST: `` `classroom_id=eq.${classroomId}` ``. Pass `undefined` to subscribe to everything RLS allows.
- Any table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL` in its migration, or DELETE payloads are empty.

**Optimistic update contract**

1. Capture `previous` state.
2. `setX(new)` — UI updates immediately.
3. `await supabase....` — server mutation.
4. On `error`: `setX(previous)` AND `setError(new Error(error.message))` AND stop. Don't refetch in the error path unless realtime won't reconcile.
5. On success: do nothing. The realtime INSERT/UPDATE event will reconcile. Calling `refetch` on success causes a flicker.

**Denormalized totals — READ, DON'T COMPUTE**

- `students.point_total`, `positive_total`, `negative_total`, `today_total`, `this_week_total` are maintained by DB triggers. Read them directly.
- Do NOT aggregate `point_transactions` client-side for display. That path exists only for audit views and time-window RPCs (`get_student_time_totals`).
- When adding a denormalized column, ship the trigger in the SAME migration. Never leave totals to "eventual" app-code maintenance.

**RLS is the authorization boundary**

- Every new table: enable RLS + SELECT/INSERT/UPDATE/DELETE policies in the same migration. A table without policies is effectively read-only to clients.
- Never bypass RLS with a service-role key in app code. Service role is for `scripts/**` (migrations, seeding) only.

**Query shape**

- Prefer `.select('*, related(*)')` PostgREST embedding over multiple round-trips.
- For complex queries (joins + aggregation, time windows), add a Postgres RPC and call `supabase.rpc('name', args)` — don't reconstruct in TypeScript.

**Types**

- `supabase` client is typed via `createClient<Database>(...)`. Table rows come from `src/types/database.ts` as `DbX`; convert to app `X` at the context/hook boundary via a `transformX` function.

### Testing Rules

**Two layers, two harnesses**

| Layer | Location                      | Runner                             | Hits network?             |
| ----- | ----------------------------- | ---------------------------------- | ------------------------- |
| Unit  | `src/test/**/*.test.{ts,tsx}` | Vitest 4 + jsdom + Testing Library | No — mock Supabase client |
| E2E   | `e2e/**/*.spec.ts`            | Playwright (Chromium)              | Yes — LOCAL Supabase only |

**Unit tests — mock Supabase, test behavior**

- Mock `@/lib/supabase` at the module boundary — don't hit the network from unit tests.
- Assert on observable behavior via Testing Library queries (`getByRole`, `getByText`) — NOT internal hook state (`result.current.loading === false`).
- Test descriptions start with "should" (`it('should display …')`).
- `tdd-guard-vitest` is wired up — expect feedback when tests are added without a prior red state.

**E2E tests — LOCAL Supabase is mandatory**

- `playwright.config.ts` fail-closes: it parses `VITE_SUPABASE_URL` and refuses to run unless the host is loopback, RFC1918 LAN, or Tailscale CGNAT (100.64.0.0/10). A URL like `https://127.0.0.1.evil.com` is rejected — substring match is NOT safe; always parse hostnames.
- **Do not weaken or remove this guard** — it exists so E2E writes can never land in the hosted DB.
- Run flow: `npx supabase start` → `.env.test` with local creds → `npm run test:e2e:local` (seeds user first). CI uses `npm run test:e2e`.
- Authentication is handled by `e2e/auth.setup.ts`, stored at `.auth/user.json`, reused via `storageState`. Don't add per-test login flows.
- Use `data-testid` attributes for selectors; avoid fragile text/CSS selectors for flows likely to rebrand.
- `webServer.reuseExistingServer: false` is deliberate — a manually-started dev server may point at prod. Never flip this to `true`.

**Cleanup**

- Every `afterEach`/`afterAll` that creates side effects (Supabase rows, timers, subscriptions) MUST undo them. A dangling row in local Supabase will cross-pollute parallel runs.
- `fullyParallel: true` is the default — treat each spec as isolated; share no mutable state via module scope.

**Do NOT**

- Run E2E against hosted Supabase, even "just once to check prod parity."
- Assert on internal hook state instead of rendered output.
- Use `setTimeout`/arbitrary waits — use Playwright's auto-waiting locators and Testing Library's `findBy*` / `waitFor`.

### Code Quality, Style & Organization

**Naming**

- Components: PascalCase filename matching export (`StudentGrid.tsx` → `export function StudentGrid`).
- Hooks: camelCase with `use` prefix (`useClassrooms.ts`).
- Utils: camelCase (`formatDate.ts`); one concern per file where practical.
- Tests: `{Name}.test.{ts,tsx}` under `src/test/**`; E2E specs end in `.spec.ts` under `e2e/**`.
- Migrations: zero-padded sequential prefix (`012_add_foo.sql`) — increment from the last file in `supabase/migrations/`.

**File/folder layout (do not restructure casually)**

```
src/
├── App.tsx, main.tsx
├── components/   # UI components, grouped by feature subfolder
├── contexts/     # AppContext, AuthContext (only)
├── hooks/        # feature data hooks + barrel index.ts
├── lib/          # supabase.ts and cross-cutting infra
├── services/     # non-Supabase integrations
├── types/        # index.ts (app), database.ts (DB), feature-specific
├── utils/        # pure helpers
└── test/         # unit tests
```

Feature work goes into the existing folder; don't invent parallel hierarchies (`features/`, `modules/`, etc.).

**Comments**

- Default to no comments. Well-named identifiers carry the "what."
- Only write a comment for non-obvious _why_: a hidden constraint, a subtle invariant, a workaround. Example: the allow-list rationale in `playwright.config.ts`.
- Don't reference PRs/tickets/authors in code comments — they rot and belong in commit messages.

**Prettier / ESLint**

- `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: 'es5'`, `printWidth: 100`.
- Pre-commit runs `eslint --fix` + `prettier --write` + `tsc -b --noEmit`. Don't bypass with `--no-verify` without a reason you'd say out loud to the team.
- The ESLint ignore list deliberately skips `.bmad`, `.claude`, `.agent`, `.cursor`, `.serena`, `supabase`, `scripts`, and `*.config.{js,ts}`. Don't lint-target those.

**State management direction (IMPORTANT — read before adding new data hooks)**

- **Server state (anything from Supabase) → TanStack Query (`@tanstack/react-query`).** New data hooks should be `useQuery` / `useMutation` wrappers, with `queryClient.invalidateQueries` or `setQueryData` driven from realtime callbacks.
- **UI / session state → `AppContext` + `useApp()`.** Active classroom selection, modal state, transient UI — things that don't live in Postgres.
- **Legacy shape:** existing feature hooks (`useClassrooms`, `useStudents`, `useBehaviors`, `useTransactions`, `useSeatingChart`, `useLayoutPresets`) still follow the hand-rolled `{ data, loading, error, refetch }` pattern with manual optimistic updates. Treat these as _legacy — migrate to TanStack Query when you're already touching them._ Do NOT clone this pattern for new hooks.
- See `docs/architecture.md` and `.claude/rules/state-management.md` for the (being-revised) migration plan.

**Don't add**

- Re-export barrels in component folders (keeps HMR predictable). The hook barrel (`src/hooks/index.ts`) is the intentional exception.
- Premature abstractions: three similar lines is cheaper than the wrong abstraction. Wait for the fourth instance.

### Critical Don't-Miss Rules

**Security**

- Service-role Supabase key NEVER ships to the browser. Only `VITE_SUPABASE_ANON_KEY` is exposed via `import.meta.env`. Service-role use is confined to `scripts/**` via `process.env`.
- New tables without RLS policies are a data-leak vector. Enable RLS + author SELECT/INSERT/UPDATE/DELETE policies in the same migration.
- The E2E Supabase allow-list in `playwright.config.ts` is a security boundary, not a lint rule. Changes to it need genuine justification.

**Subscription & memory leaks**

- Every `supabase.channel(...).subscribe()` needs a matching `supabase.removeChannel(channel)` in the effect cleanup. Omitting it is the #1 way to leak in this codebase.
- Every `setInterval`/`setTimeout` inside a hook needs `clearInterval`/`clearTimeout` in cleanup.
- `useEffect` deps: if a function is referenced, either include it in deps (and `useCallback` it upstream) or pull it into the effect body. Silencing `react-hooks/exhaustive-deps` is almost always a bug.

**State consistency**

- Don't store derived values in `useState`. Compute inline or `useMemo`. Synchronized state drifts; derived state can't.
- Don't call `setState` in the render phase. Use `useEffect` or key-based remount.
- When multiple components read the same server data, they must go through the same query key / hook — never duplicate `useState([])` in two places for the same resource.

**Database & realtime gotchas**

- `REPLICA IDENTITY FULL` is required for realtime DELETE events. Forgetting it ships a table whose DELETEs arrive with empty payloads → optimistic rollback (or TanStack cache invalidation) is impossible.
- Point totals are trigger-maintained. Updating `students.point_total` directly from app code will be silently overwritten by the next `point_transactions` trigger fire — mutate via `point_transactions`.
- `ON DELETE CASCADE` on foreign keys is the default expectation for owned relationships (classroom → students → transactions). Review each new FK deliberately — cascade, RESTRICT, or SET NULL.

**Workflow gotchas**

- Run commands via the npm scripts, not bare `vite`/`tsc` — the scripts wrap `fnox exec` for env loading.
- Pre-commit hook runs lint-staged + typecheck. If it fails, FIX and make a NEW commit — do NOT `--amend` (the previous commit went through; amending rewrites unrelated history). Do NOT `--no-verify`.
- Destructive git ops (`reset --hard`, `push --force`, branch delete) require explicit user approval every time, even after a prior approval for a similar action.

**UI gotchas**

- `@dnd-kit` transforms are the one legitimate use of inline `style={{ transform }}`. Everything else is Tailwind classes.
- Icons come from `lucide-react` — don't introduce Heroicons, FontAwesome, or inline SVGs for new icons.
- Sounds go through `SoundProvider` / `useSoundEffects`. Don't call `new Audio()` from components.

**Anti-patterns seen in the wild**

```ts
// BAD — hook after early return
export function Card({ x }: Props) {
  if (!x) return null;
  const { foo } = useApp(); // CRASH on next render
}

// BAD — aggregating transactions client-side for totals
const total = transactions.reduce((s, t) => s + t.points, 0); // stale, expensive
// GOOD
const { pointTotal } = student; // trigger-maintained, authoritative

// BAD — substring match on Supabase URL
if (url.includes('127.0.0.1')) allow(); // `https://127.0.0.1.evil.com` slips through
// GOOD
new URL(url).hostname === '127.0.0.1';

// BAD — no subscription cleanup
useEffect(() => {
  supabase.channel('x').subscribe();
}, []);
// GOOD
useEffect(() => {
  const ch = supabase.channel('x').subscribe();
  return () => supabase.removeChannel(ch);
}, []);
```

---

## Usage Guidelines

**For AI Agents**

- Read this file before implementing code in `src/**` or `supabase/migrations/**`.
- Prefer the more restrictive option when in doubt.
- If you encounter a pattern that contradicts this file, surface the conflict — don't silently break from the docs.

**For Humans**

- Keep lean — this file goes into every agent's context. Don't duplicate `CLAUDE.md` or `.claude/rules/*`; link to them.
- Update when tech stack or architectural decisions change (the TanStack Query migration is a pending update target).
- Remove rules that become obvious or enforceable by tooling.

_Last updated: 2026-04-21_
