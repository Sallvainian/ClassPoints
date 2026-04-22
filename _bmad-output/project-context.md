---
project_name: ClassPoints
user_name: Sallvain
date: 2026-04-22
sections_completed:
  [
    'migration_status',
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

_This file contains critical rules and patterns AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss. Complement — do not duplicate — `CLAUDE.md` and `.claude/rules/*`._

---

## Mid-Migration Status (READ FIRST)

**ClassPoints is mid-migration away from hand-rolled React data patterns toward `@tanstack/react-query`.** The repo today contains both the legacy shape and the target shape side by side. When you scan the codebase for patterns to follow, you WILL find legacy code — do not clone it. The legacy shape is the refactor target, not the rule.

**Authoritative sources — read before writing state/data code:**

- `_bmad-output/planning-artifacts/prd.md` — the PRD for the state-management modernization (scope, phases, acceptance criteria).
- `docs/modernization-plan.md` — the strategy document (diagnosis, target architecture, domain-by-domain migration).
- `docs/legacy/legacy-*.md` — the "as-is" pattern inventory. **These files are refactor targets, not rules to follow.** Specifically:
  - `legacy-hooks.md`, `legacy-supabase.md`, `legacy-state-management.md`, `legacy-contexts.md`, `legacy-components.md` → patterns being reversed.
  - `legacy-migrations.md`, `legacy-testing.md`, `legacy-utils.md` → content still correct; prefix is historical.

**The four legacy patterns being retired — do NOT clone in new code:**

1. Hand-rolled feature hooks exposing `{ data, loading, error, refetch }`. Replaced by thin `useQuery` / `useMutation` wrappers. Consumers receive the TanStack Query result shape directly (`data`, `isLoading`, `isPending`, `error`, `mutate`, …).
2. `useApp()` as a mandatory single-facade over all app data. Post-migration, `useApp()` exposes UI/session state ONLY. Components call data hooks directly.
3. "Every fetching hook exposes a uniform shape" rule. The uniform hand-rolled shape IS the pattern being removed.
4. The 5-step manual optimistic-update contract (`const previous = …` → `setX(new)` → `await` → `setX(previous)` on error). Replaced by `useMutation.onMutate` / `onError` / `onSettled` with the cache as single source of truth.

**New code rule:** data hooks added from Phase 1 onward MUST be `useQuery` / `useMutation` wrappers per the PRD. Cloning the legacy shape into a new file is a PR-review block.

**Realtime scope post-migration — three domains only:**

- Students + point totals
- Point transactions
- Seating chart (seats, groups, room elements)

Every other domain (classrooms list, behavior templates, layout presets, user sound settings, etc.) uses TanStack Query's `refetchOnWindowFocus` + on-demand `invalidateQueries` after mutations. Do NOT attach realtime to those. When realtime IS used, callbacks collapse to invalidating / patching the TanStack Query cache — no manual `onInsert`/`onUpdate`/`onDelete` state merging.

---

## Technology Stack & Versions

**Runtime & Build**

- React 18.3.1 + React DOM 18.3.1
- TypeScript ~5.9.3 (strict mode, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`, `moduleResolution: bundler`)
- Vite 6.0.5 (target ES2020, `jsx: react-jsx`)
- Node types @25.x (tooling only)

**Backend / Data**

- `@supabase/supabase-js` ^2.90.1 — Auth, PostgREST, Realtime (WebSocket)
- `@tanstack/react-query` — server-state cache for all new data hooks (migration in progress)
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
- Transform at the hook boundary (inside `queryFn` for TanStack hooks, at the context/hook edge for legacy code) — never let `snake_case` leak into components.
- When adding a new DB column, update `DbX`, the `X` app type, and the `transformX()` function together.

**Error handling with Supabase**

- ALWAYS destructure `{ data, error }` and check `error` before `data`. Throw `new Error(error.message)` so callers see a real `Error`, not a Supabase object. Inside a `queryFn`, throwing lets TanStack Query surface it as `query.error` — do not swallow it.

**Env access**

- App code (`src/**`) uses `import.meta.env.VITE_*`. Only `VITE_`-prefixed vars are exposed to the browser.
- Node-side files (`scripts/**`, `e2e/**`, `playwright.config.ts`, `vitest.config.ts`) use `process.env` and can read any var, including secrets.
- Never use `process.env` in `src/**` — it will either be undefined at runtime or, worse, a build tool will inline a secret into the client bundle.

### Framework-Specific Rules (React)

**Context hierarchy is fixed — do not reorder**

```
AuthProvider → AuthGuard → SoundProvider → AppProvider → AppContent
```

`AppProvider` depends on the authenticated user from `AuthContext`; `AuthGuard` short-circuits render before data contexts mount. `QueryClientProvider` wraps above `AuthProvider` at the root (see `src/main.tsx`). New top-level providers go INSIDE `AppProvider`, not above it, unless they are auth-layer or cross-cutting infra concerns.

**`AppContext` is UI/session state only — do not pass server data through it**

- `AppContext` holds things that have no server-of-truth: `activeClassroomId`, modal open/closed flags, selection-mode toggles, other transient UI. Target size post-migration: ~150 lines.
- Components that need server data (students, classrooms, behaviors, transactions, seating chart, layout presets) call the corresponding `useQuery` wrapper hook DIRECTLY. Do not add new data pass-throughs to `AppContext`.
- Legacy-shape `useApp().students` / `useApp().classrooms` / etc. access exists in transitional code. Do NOT write new components against that surface; do NOT add new fields to it.
- Feature-scoped UI state (e.g., in-flight drag position for seating chart) stays in a local `useState` or a feature-scoped store — don't promote to `AppContext`.

**Component structure (hooks-before-returns is non-negotiable)**

1. All hooks (including `useQuery` wrappers, `useApp()`, `useAuth()`) first — stable, unconditional order.
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

**Server-state hooks are thin TanStack Query wrappers** (the rule for all new code)

- New fetching hooks wrap `useQuery`; new mutating hooks wrap `useMutation`. Consumers receive the TanStack Query result shape directly (`data`, `isLoading`, `isPending`, `error`, `mutate`, `mutateAsync`, etc.) — do NOT re-wrap into a `{ data, loading, error, refetch }` object.
- Query key convention: `['<domain>', ...scopeParams]` — e.g., `['students', classroomId]`, `['transactions', studentId]`. The SAME resource must use the SAME key everywhere — never fetch the same data under two different keys in two components.
- Transform DB → app types inside `queryFn`: `return data.map(transformStudent)`. Errors thrown from `queryFn` surface as `query.error`; always throw `new Error(error.message)` after destructuring Supabase's `{ data, error }`.
- Legacy hand-rolled hooks (`useClassrooms`, `useStudents`, `useBehaviors`, `useTransactions`, `useSeatingChart`, `useLayoutPresets`) still expose the old `{ data, loading, error, refetch }` shape. They are migration candidates, not templates. Do not copy their shape into new files.

**React Query devtools — dev-only, zero prod refs (NFR4)**

- `@tanstack/react-query-devtools` is a **devDependency** (`npm install -D`). Mount it gated by `import.meta.env.DEV` inside `QueryClientProvider`: `{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}`. Vite replaces `import.meta.env.DEV` with literal `false` in prod; Rollup DCE removes the JSX and tree-shakes the static import.
- **The production bundle must contain zero devtools references.** Greppable acceptance — after `npm run build`, both `rg 'tanstack/react-query-devtools' dist/` and `rg 'ReactQueryDevtools' dist/` must return zero matches. This is an enforced invariant per PRD NFR4, not advisory.
- Do NOT use `@tanstack/react-query-devtools/production` or any runtime-toggle pattern — NFR4 says never in production, not optionally.

**Realtime subscription rules**

- Realtime is attached ONLY to the three live-sync domains (students+totals, point transactions, seating chart). Do NOT add realtime to classrooms, behavior templates, layout presets, or user settings — those use `refetchOnWindowFocus` + `invalidateQueries`.
- Use `useRealtimeSubscription<DbType>({ table, filter, onChange })` — the post-migration callback idiom is a single `onChange` that invalidates (or `setQueryData`-patches) the relevant query key. Do NOT hand-write `onInsert`/`onUpdate`/`onDelete` callbacks in NEW code.
- **Migration-period bridge (Phases 1–3):** the hook carries both shapes at once. Legacy `onInsert` / `onUpdate` / `onDelete` fields are retained as a deprecation bridge so non-migrated callers keep working while each phase converts its callers to `onChange`. The legacy fields are deleted at end of Phase 3. Reason: the `onChange` body invalidates a query key that only exists once the consuming hook is itself a `useQuery` wrapper, which happens in Phases 2 and 3 per the PRD — a pure-onChange rewrite in Phase 1 would either force all hook migrations into Phase 1 (collapsing the phased rollout) or produce throwaway callbacks that manually merge into `useState` and get rewritten in later phases.
- If you hand-roll a channel (rare; the helper should cover you): cleanup in `useEffect` return is MANDATORY — `return () => supabase.removeChannel(channel)`. Missing cleanup = memory + bandwidth leak per remount.
- Filter syntax is PostgREST: `` `classroom_id=eq.${classroomId}` ``. Pass `undefined` to subscribe to everything RLS allows.
- Any table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL` in its migration, or DELETE payloads are empty.

**Optimistic updates — use `useMutation` lifecycle, NOT manual rollback**

The pattern for every new mutation:

```ts
const mutation = useMutation({
  mutationFn: (input) => /* supabase call; throw on error */,
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: ['students', classroomId] });
    const previous = queryClient.getQueryData(['students', classroomId]);
    queryClient.setQueryData(['students', classroomId], (old) => applyOptimistic(old, input));
    return { previous };
  },
  onError: (_err, _input, ctx) => {
    queryClient.setQueryData(['students', classroomId], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['students', classroomId] }),
});
```

- The cache is the single source of truth. Every consumer of the query key sees the optimistic patch and, on error, sees the rollback — automatically. No per-component `const previous = …` captures.
- Do NOT write manual 5-step rollback paths in new code. That contract is a migration target.

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

- `supabase` client is typed via `createClient<Database>(...)`. Table rows come from `src/types/database.ts` as `DbX`; convert to app `X` at the `queryFn`/hook boundary via a `transformX` function.

### Testing Rules

**Two layers, two harnesses**

| Layer | Location                      | Runner                             | Hits network?             |
| ----- | ----------------------------- | ---------------------------------- | ------------------------- |
| Unit  | `src/test/**/*.test.{ts,tsx}` | Vitest 4 + jsdom + Testing Library | No — mock Supabase client |
| E2E   | `e2e/**/*.spec.ts`            | Playwright (Chromium)              | Yes — LOCAL Supabase only |

**Unit tests — mock Supabase, test behavior**

- Mock `@/lib/supabase` at the module boundary — don't hit the network from unit tests.
- For TanStack Query hooks: wrap renders in a test-local `QueryClientProvider` with `retry: false`. Assert on observable behavior via Testing Library queries (`getByRole`, `getByText`) — NOT on internal query state (`result.current.isLoading` transitions). Unit-test `queryFn` as a plain async function where possible.
- Test descriptions start with "should" (`it('should display …')`).
- `tdd-guard-vitest` is wired up — expect feedback when tests are added without a prior red state.

**E2E tests — LOCAL Supabase is mandatory**

- `playwright.config.ts` fail-closes: it parses `VITE_SUPABASE_URL` and refuses to run unless the host is loopback, RFC1918 LAN, or Tailscale CGNAT (100.64.0.0/10). A URL like `https://127.0.0.1.evil.com` is rejected — substring match is NOT safe; always parse hostnames.
- **This allow-list is a security boundary, not a lint rule. Do not weaken or remove it** — it exists so E2E writes can never land in the hosted DB.
- Run flow: `npx supabase start` → `.env.test` with local creds → `npm run test:e2e:local` (seeds user first). CI uses `npm run test:e2e`.
- Authentication is handled by `e2e/auth.setup.ts`, stored at `.auth/user.json`, reused via `storageState`. Don't add per-test login flows.
- Use `data-testid` attributes for selectors; avoid fragile text/CSS selectors for flows likely to rebrand.
- `webServer.reuseExistingServer: false` is deliberate — a manually-started dev server may point at prod. Never flip this to `true`.

**Cleanup & parallelism**

- Every `afterEach`/`afterAll` that creates side effects (Supabase rows, timers, subscriptions) MUST undo them. A dangling row in local Supabase will cross-pollute parallel runs.
- `fullyParallel: true` is the default — treat each spec as isolated; share no mutable state via module scope.

**Do NOT**

- Run E2E against hosted Supabase, even "just once to check prod parity."
- Assert on internal hook state (legacy or TanStack) instead of rendered output.
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
├── lib/          # supabase.ts, queryClient.ts, cross-cutting infra
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

**State management direction (normative — read before adding data hooks)**

- **Server state (anything from Supabase) → TanStack Query.** From Phase 1 onward, new data hooks MUST be `useQuery` / `useMutation` wrappers per the PRD. Cloning the legacy `{ data, loading, error, refetch }` hand-rolled shape in a new file is a PR-review block.
- **UI / session state → `AppContext` + `useApp()`.** Active classroom selection, modal state, transient UI — things that don't live in Postgres.
- **Legacy hooks still exist** (`useClassrooms`, `useStudents`, `useBehaviors`, `useTransactions`, `useSeatingChart`, `useLayoutPresets`) — they are migration candidates, not templates. Migrate them when you're already touching them; never extend their shape for a new feature.
- **No Zustand under this initiative.** Adding a new state library is out of scope for the TanStack Query migration. The slim `AppContext` remains the home for UI/session state at current volume. Future exception: if the 1350-line seating editor is later broken into sub-components, a seating-scoped Zustand store is the recommended target for its coordination state (selection, active drag, tool mode, zoom) — not an expanded `AppContext` or a new React Context. Until that split happens, the editor's intra-component `useState` hooks stay as-is.
- See `docs/modernization-plan.md` and `_bmad-output/planning-artifacts/prd.md` for phase order and acceptance criteria. `docs/legacy/legacy-state-management.md` describes the AS-IS — do not treat it as forward-looking.

**Don't add**

- Re-export barrels in component folders (keeps HMR predictable). The hook barrel (`src/hooks/index.ts`) is the intentional exception.
- Premature abstractions: three similar lines is cheaper than the wrong abstraction. Wait for the fourth instance.

### Critical Don't-Miss Rules

**Security**

- Service-role Supabase key NEVER ships to the browser. Only `VITE_SUPABASE_ANON_KEY` is exposed via `import.meta.env`. Service-role use is confined to `scripts/**` via `process.env`.
- New tables without RLS policies are a data-leak vector. Enable RLS + author SELECT/INSERT/UPDATE/DELETE policies in the same migration.
- The E2E Supabase allow-list in `playwright.config.ts` is a security boundary, not a lint rule. Changes to it need genuine justification.

**Subscription & memory leaks**

- Every `supabase.channel(...).subscribe()` needs a matching `supabase.removeChannel(channel)` in the effect cleanup. Omitting it is the #1 way to leak in this codebase. Prefer `useRealtimeSubscription` — it handles cleanup for you.
- Every `setInterval`/`setTimeout` inside a hook needs `clearInterval`/`clearTimeout` in cleanup.
- `useEffect` deps: if a function is referenced, either include it in deps (and `useCallback` it upstream) or pull it into the effect body. Silencing `react-hooks/exhaustive-deps` is almost always a bug.

**State consistency**

- Don't store derived values in `useState`. Compute inline or `useMemo`. Synchronized state drifts; derived state can't.
- Don't call `setState` in the render phase. Use `useEffect` or key-based remount.
- When multiple components read the same server data, they must go through the same TanStack Query key (for new code) or the same hook instance (for legacy code) — never duplicate `useState([])` in two places for the same resource.

**Database & realtime gotchas**

- `REPLICA IDENTITY FULL` is required for realtime DELETE events. Forgetting it ships a table whose DELETEs arrive with empty payloads → TanStack cache invalidation on DELETE cannot identify the removed row.
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
  const { data } = useStudents(classroomId); // CRASH on next render
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
// GOOD — use the helper (handles cleanup)
useRealtimeSubscription({ table: 'students', onChange: invalidate });

// BAD — cloning legacy shape in new code
export function useFoos() {
  const [data, setData] = useState<Foo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // … hand-rolled fetch + realtime merge + refetch
  return { foos: data, loading, error, refetch };
}
// GOOD — thin TanStack wrapper
export function useFoos(scope: string) {
  return useQuery({
    queryKey: ['foos', scope],
    queryFn: async () => {
      const { data, error } = await supabase.from('foos').select('*').eq('scope', scope);
      if (error) throw new Error(error.message);
      return data.map(transformFoo);
    },
  });
}

// BAD — manual 5-step optimistic rollback
const previous = students;
setStudents(next);
const { error } = await supabase.from('students').update(...);
if (error) { setStudents(previous); setError(new Error(error.message)); }
// GOOD — useMutation lifecycle handles this; cache is the source of truth
```

---

## Usage Guidelines

**For AI Agents**

- Read this file before implementing code in `src/**` or `supabase/migrations/**`.
- If you see legacy-shape code while working, that's the migration target — don't imitate it. Consult `docs/modernization-plan.md` and `_bmad-output/planning-artifacts/prd.md`.
- Prefer the more restrictive option when in doubt.
- If you encounter a pattern that contradicts this file, surface the conflict — don't silently break from the docs.

**For Humans**

- Keep lean — this file goes into every agent's context. Don't duplicate `CLAUDE.md` or `.claude/rules/*`; link to them.
- Update when tech stack or architectural decisions change. When the TanStack Query migration completes, flip the "legacy hooks still exist" caveats to past tense.
- Remove rules that become obvious or enforceable by tooling.

_Last updated: 2026-04-22_
