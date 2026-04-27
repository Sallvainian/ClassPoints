---
project_name: ClassPoints
user_name: Sallvain
date: 2026-04-27
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
    'ui_design_system_rules',
  ]
existing_patterns_found: 13
status: 'complete'
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns AI agents must follow when implementing code in this project. Focus on unobvious details. Complement — do not duplicate — `CLAUDE.md`, `AGENTS.md`, and `.claude/rules/*`._

---

## Migration Status (READ FIRST)

**Snapshot taken at HEAD `d652260` on branch `redesign/editorial-engineering` (2026-04-27).** If `git log --oneline -5` no longer matches the recent commit list (`d652260` → `136f493` → `fb3f239` → `21c821f` → `e1b3c49`), treat this section as a stale snapshot and re-derive phase status from `_bmad-output/planning-artifacts/prd.md` + the actual hook code before trusting the claims below. Note: this branch is 5 commits ahead of `main` and includes the editorial UI redesign (commits `ae7a9a8` + `fb3f239`), the local-Supabase-lifecycle dev script (commits `21c821f` + `136f493`), the realtime channel-name fix (`e1b3c49`), and the stale-JWT graceful-degrade auth fix (`d652260`). See the **UI / Design System Rules** section for redesign-era patterns.

**Phase 3 of the core TanStack Query migration is COMPLETE for the hooks below.** These hooks are TanStack `useQuery` / `useMutation` wrappers and return the target shape (`data`, `isLoading`, `isPending`, `error`, `mutate`, …):

- `useClassrooms` (+ `useCreateClassroom`, `useUpdateClassroom`, `useDeleteClassroom`)
- `useStudents` (+ `useAddStudent`, `useAddStudents`, `useUpdateStudent`, `useRemoveStudent`)
- `useTransactions` (+ `useAwardPoints`, `useUndoTransaction`, `useUndoBatchTransaction`, `useClearStudentPoints`, `useResetClassroomPoints`, `useAdjustStudentPoints`)
- `useBehaviors` (+ `useAddBehavior`, `useUpdateBehavior`, `useDeleteBehavior`)

**Canonical templates for new code:**

- Thin TanStack query hook → `src/hooks/useBehaviors.ts`
- Optimistic mutation → `src/hooks/useTransactions.ts:useAwardPoints` (ADR-005 §4 (a)–(e) compliance comments inline at lines 86-95)
- Realtime + cache merge → `src/hooks/useStudents.ts:44-179`

**Still hand-rolled (`useState` + `useEffect`):**

- `useLayoutPresets` — 166 LOC, legacy `presets/loading/error/refetch` shape, and still uses legacy realtime callbacks. **DO NOT clone its shape.** Target state is a thin TanStack hook with on-demand invalidation, not realtime.
- `useSeatingChart` — 23-value return; deferred reshape per anti-pattern audit cluster #5. **DO NOT clone its shape.** Use the canonical templates above instead.

**`AppContext` post-Phase-3** (`src/contexts/AppContext.tsx`, 797 LOC):

- Holds UI/session state (`activeClassroomId`, modal flags, `batchKindRef`).
- Holds thin imperative wrappers (`createClassroom`, `awardPoints`, `awardClassPoints`, `awardPointsToStudents`, `addBehavior` family, `clearStudentPoints`, `adjustStudentPoints`, `resetClassroomPoints`) that adapt the new mutation hooks to legacy callers. Each individual wrapper throws on Supabase failure (ADR-005 §2).
- Wrappers are migration debt, dissolving in Phase 4. **New components:**
  - MUST call mutation hooks directly (`useAwardPoints`, `useAddStudent`, …)
  - MUST NOT add new fields to `AppContext`
  - MUST NOT add new wrapper functions to `AppContext`, even if they mirror existing ones
  - MUST NOT extend existing wrappers with new parameters

**Wrapper-throw nuance — read both:**

- The individual wrapper throws (`addBehavior`, `updateBehavior`, `awardPoints`, etc.).
- BUT `awardClassPoints` and `awardPointsToStudents` orchestrate per-student `Promise.all` and SILENTLY filter rejected promises to nulls (`AppContext.tsx:419-422`, `:465-468`). The orchestrator returns the "successful" results; per-item failures vanish. This is anti-pattern audit cluster #2. **Do NOT infer a clean throw-on-failure contract at orchestrator call sites just because the inner wrapper throws.** Two source comments at `ClassAwardModal.tsx:64` and `MultiAwardModal.tsx:62` claim "wrapper throws on error with automatic rollback" — those comments are LIES, scheduled for deletion when cluster #2 is fixed.

**Authoritative sources — read before writing state/data code:**

- `_bmad-output/planning-artifacts/prd.md` — TanStack migration PRD (scope, phases, AC).
- `docs/modernization-plan.md` — strategy doc (diagnosis, target architecture).
- `docs/adr/ADR-005-queryclient-defaults.md` — As of HEAD `1b0decb`, sections §1 (QueryClient defaults), §2 (adapter error contract), §3 (devtools DCE), §4 (Phase 2 mutation AC), §5 (gating criterion), §6 (realtime scope) are ALL authoritative; nothing superseded. **When ADR-006 lands** (user-scoped query keys, tracked in PRD), re-read §1 here — user-scoped keys change cache reset semantics and may partially supersede §1 advice.
- `_bmad-output/anti-pattern-audit.md` — 2026-04-25 audit with REAL / OVERSTATED / FALSE-POSITIVE verdicts on 10 clusters. **Consult before re-raising rejected concerns.**
- `docs/legacy/legacy-*.md` — AS-IS pattern inventory. **Refactor targets, NOT rules.** Authoritative subset (still correct, prefix is historical): `legacy-migrations.md`, `legacy-testing.md`, `legacy-utils.md`. The rest describe patterns being reversed.

**Target realtime scope — exactly 3 domains (ADR-005 §6, PRD FR5):**

| Domain                           | Backing tables                                                       | Why realtime                                            |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| `students` (point + time totals) | `students`                                                           | Smartboard reflects phone awards within ~1s             |
| `point_transactions`             | `point_transactions`                                                 | Cross-device undo; DELETE branch decrements time totals |
| `seating-chart`                  | `seating_charts`, `seating_groups`, `seating_seats`, `room_elements` | Drag on laptop → smartboard moves the seat              |

**Non-realtime domains (explicit, NOT default-by-omission):** `classrooms`, `behaviors`, `layout_presets`, user settings. They use `refetchOnWindowFocus: false` defaults + on-demand `invalidateQueries` after mutations.

**Current HEAD drift from target:** actual subscriptions today are `useStudents` (`students` + `point_transactions`), `useTransactions` (`point_transactions`), and legacy `useLayoutPresets` (`layout_presets`). `useSeatingChart` is still hand-rolled and currently has no realtime subscription. Treat `layout_presets` realtime as legacy drift to remove when that hook migrates; treat seating-chart realtime as target work, not current implementation. Do not copy either shape.

**The "exactly 3" count is load-bearing on PRD FR5, Phase 2 mutation race handling, and adapter-bridge memoization assumptions.** A PR that does any of:

- Adds a realtime subscription to a domain NOT in the table above
- Removes a subscription from a domain IN the table above
- Introduces a new data domain or table with undefined realtime status

MUST update ADR-005 §6 AND this section in the same commit. "Decide later" is not acceptable. Adding a 4th realtime channel without that update is a PR-review block.

**Cross-cutting realtime DELETE rule:** ANY table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL` in its migration. Without it, DELETE payloads arrive empty and `payload.old` is unusable. See `supabase/migrations/005_replica_identity_full.sql` for the canonical pattern (`point_transactions` is currently the only DELETE-watching domain; `students` realtime is INSERT/UPDATE-only).

---

## Technology Stack & Versions

**Runtime & Build**

- React 18.3.1 + React DOM 18.3.1 (NOT 19 — `useTransition` / `useDeferredValue` OK; `use()`, `useActionState`, React 19 form actions are NOT)
- TypeScript ~5.9.3 (strict mode + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch` + `noUncheckedSideEffectImports` + `moduleResolution: bundler` + `isolatedModules: true` + `moduleDetection: force` + `allowImportingTsExtensions: true` + `jsx: react-jsx` + `target: ES2020`)
- Vite 6.0.5

**Backend / Data**

- `@supabase/supabase-js` ^2.104.1 — Auth, PostgREST, Realtime (WebSocket). **2.104 added `RejectExcessProperties` on `.update()` payloads** → typed `UpdateX` payloads are required. Reference: `useStudents.useUpdateStudent`, `useClassrooms.useUpdateClassroom`, `useSeatingChart`.
- `@tanstack/react-query` ^5.99.2 — server-state cache for migrated data hooks (Phase 3 core domains complete; `useLayoutPresets` / `useSeatingChart` remain legacy migration targets).
- `@tanstack/react-query-devtools` ^5.100.1 — **devDependency only**, see DCE rules in Supabase / Realtime section.
- Supabase CLI ^2.95.0 (local stack via `npx supabase start`)
- PostgreSQL 15+

**UI & Interaction**

- Tailwind CSS 4.1.17 via `@tailwindcss/postcss` ^4.2.4 — **v4 syntax only** (`@import "tailwindcss"`, `@tailwindcss/postcss` plugin). NEVER add the legacy `tailwindcss` PostCSS plugin or v3-style theme config.
- `@dnd-kit/core` ^6.3.1 + `@dnd-kit/utilities` ^3.2.2 (seating chart DnD)
- `lucide-react` ^1.9.0 — sole icon library; do NOT introduce Heroicons / FontAwesome / inline SVGs for new icons
- `uuid` ^14.0.0 — **forced via `package.json` `overrides`** to close `GHSA-w5hq-g745-h8pq`. Do NOT downgrade or remove the override even if a transitive dep prefers v13.

**Testing**

- Vitest ^4.1.5 + jsdom ^27.4.0 (Vitest 4 API — breaking changes from v1; older test patterns may not apply)
- `@testing-library/react` ^16.3.2 + `@testing-library/jest-dom` ^6.9.1 + `@testing-library/user-event` ^14.6.1
- Playwright ^1.59.1 (Chromium only; auth via `.auth/user.json` storageState)
- `tdd-guard-vitest` ^0.2.0 — installed as a devDependency but NOT wired into `vitest.config.ts`; latent tooling only.

**Lint / Format / Hooks**

- ESLint ^9.39.2 — **flat config only** (`eslint.config.js`). NEVER emit `.eslintrc*` files.
- `typescript-eslint` ^8.59.0 + `eslint-plugin-react-hooks` ^5.0.0 + `eslint-plugin-react-refresh` ^0.5.2
- ESLint ignore list (deliberate): `dist`, `dist-ssr`, `.bmad`, `.claude`, `.agent`, `.cursor`, `.serena`, `node_modules`, `*.config.{js,ts}`, `supabase`, `scripts`, `coverage`. Code under `scripts/` is intentionally outside the lint set.
- Prettier ^3.8.3 — `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: 'es5'`, `printWidth: 100`
- `simple-git-hooks` + `lint-staged` — pre-commit runs `eslint --fix` (on `*.{ts,tsx}`) + `prettier --write` (on `*.{ts,tsx,js,jsx,json,css,md}`) + `npm run typecheck`. **Do NOT bypass with `--no-verify`** — fix the issue and create a NEW commit (do NOT `--amend`, the previous commit went through).

**Env / Scripts**

- `fnox exec` (age-encrypted env loader) wraps `npm run build`, `npm run preview`, `npm run dev:hosted`, `npm run migrate`. Decrypts `fnox.toml` payloads against the matching age private key.
- `npm run dev` and `npm run dev:host` are **local-by-default** (plain `vite --mode test`, no fnox) — Vite reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env.test` (gitignored, holds local non-secret credentials) and hits a local Supabase stack. **Do NOT add `fnox exec --` to `dev`**; it's deliberately omitted.
- `npm run dev:hosted` is the hosted fallback (`fnox exec -- vite`) — use only when reproducing a hosted-only bug.
- `tsx` ^4.21.0 for ad-hoc scripts under `scripts/` (Node-side, `process.env`).
- `npm run check:bundle` (`scripts/check-bundle.mjs`) — CI-required post-build assertion that `dist/` has zero `react-query-devtools` chunks AND zero textual matches for `'react-query-devtools'` / `'ReactQueryDevtools'` in any emitted `.js` (excluding source maps). Run after `npm run build`.

**Version constraints AI agents MUST respect**

- React **18** features only (see Runtime above for the React-19-NOT list)
- Tailwind **v4** syntax (no v3 `tailwind.config.js` theme extensions, no legacy plugin)
- Vitest **4** API (legacy v1 patterns will misbehave — when in doubt, check `vitest.config.ts` and existing tests under `src/test/**`)
- ESLint **flat config only** (no `.eslintrc*`)
- supabase-js **2.104+** semantics — typed `UpdateX` payloads on `.update()` (see Backend above)
- `uuid` **v14+** — security override; v13 will fail audit

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Strict mode is enforced** — pre-commit + CI block violations:

- Delete unused imports / regular locals / params outright (`tsconfig.app.json` enforces `noUnusedLocals: true` + `noUnusedParameters: true`). Do NOT prefix with `_` to silence regular unused vars.
- **Underscore-prefix exception:** `_data`, `_err`, `_input` in TanStack callback signatures (e.g., `onError: (_err, input, context)`) IS legitimate — you need a later positional param and `_`-prefix is the canonical "intentionally unused but required for signature." See `useTransactions.ts:212`, `useStudents.ts:243, 268, 295, 311`.
- `useUnknownInCatchVariables` is implicit under `strict: true` (TS 4.4+) — `catch (err)` is ALREADY `unknown`. Do NOT add manual `: unknown` annotations and do NOT try to "fix" it with `: any` (audit cluster 4-FALSE-POSITIVE — don't act on it).
- `noFallthroughCasesInSwitch: true` — every `case` needs a `break` / `return` / `throw`.
- `noUncheckedSideEffectImports: true` — every side-effect-only import (`import './x'`) must have a real side effect. Don't remove `import './index.css'` thinking it's orphaned (CSS injection is the side effect).

**Module resolution**

- `moduleResolution: "bundler"` + `allowImportingTsExtensions: true` — relative imports do NOT need `.js` extensions (Vite resolves `.ts` / `.tsx` directly).
- **`import type` rules under `isolatedModules`:**
  - REQUIRED for type-only re-exports (`export type { Foo }`) — a value-form `export { Foo }` of a type-only declaration breaks `isolatedModules`.
  - RECOMMENDED but not required for type-only imports — adds intent + can speed compilation marginally.
  - **`verbatimModuleSyntax` is deliberately NOT enabled** (ADR-005 §3 line 54). TS emit under `isolatedModules` (without `verbatimModuleSyntax`) already elides unused type imports — the elision happens at the TS compiler stage, before Vite's bundler ever sees the code. Adopting `verbatimModuleSyntax` would force every type import to be `import type` without improving DCE. Don't propose enabling it.
- `moduleDetection: "force"` — every file is scoped to module scope (not global). A `.ts` file with no imports/exports is still a module, not an ambient script.

**Exports**

- Components: prefer **named exports** (`export function Foo()`) for HMR stability under `react-refresh/only-export-components` (warn-level). The one tolerated exception is `App.tsx` (`export default function App`); do NOT add new default exports for components.
- A file exporting a component should export ONLY components (`allowConstantExport: true` permits constants alongside, but no helper functions or types). Move helpers/types to dedicated files: cross-feature helpers → `src/utils/`; feature-scoped helpers → sibling `*.utils.ts`; app types → `src/types/`; co-located feature types → `*.types.ts`.
- Hooks live in `src/hooks/` and re-export through `src/hooks/index.ts` — that barrel is intentional (the only one). Add new hooks to the barrel; do NOT add re-export barrels in component folders (HMR predictability suffers).
- Wildcard re-exports — `src/types/index.ts:6` (`export * from './seatingChart'`) is a known cleanup target. New code uses explicit `export type { Foo, Bar }` because it keeps jump-to-def predictable, makes type drift visible in PR diffs, and prevents accidentally re-exporting internal types.

**Type mapping (DB ↔ App)**

- DB types are `snake_case` and live in `src/types/database.ts` as `DbX` / `NewX` / `UpdateX`.
- App types are camelCase and live in `src/types/index.ts`.
- Conversion functions live in `src/types/transforms.ts` (`dbToBehavior`, `dbToClassroom`, `dbToStudent`, `dbToPointTransaction`).
- **Transform at the `queryFn` boundary** — never let `snake_case` leak into components. Exception: `useTransactions` deliberately keeps `DbPointTransaction` shape (45 legacy consumers read it directly via `useApp().transactions`); `dbToPointTransaction` is `{ ...row }` passthrough that formalizes the boundary without reshaping fields.
- **Nested types follow the parent's case convention.** `ClassroomWithCount.student_summaries` is `snake_case` because `ClassroomWithCount extends DbClassroom`; consumers needing camelCase traverse and convert (see `AppContext.mappedClassrooms:668-710`). When defining a new aggregate type, decide case-convention upfront and stick with it across nesting depths.
- **When adding a DB column — checklist:**
  1. SQL migration (zero-padded prefix in `supabase/migrations/`).
  2. Add the column to `DbX` in `src/types/database.ts`.
  3. If user-facing, add to the `X` app type in `src/types/index.ts`.
  4. Update `transformX()` in `src/types/transforms.ts` IF it's an explicit-field transform (`dbToBehavior`, `dbToClassroom`, `dbToStudent`). Skip step 4 for `dbToPointTransaction` — it's `{ ...row }` passthrough and picks up new fields automatically.
  5. Verify the queryFn `.select(...)` clause: `.select('*')` picks up new columns automatically; explicit-column `.select('id, name')` (e.g., `useClassrooms.ts:23-25`) drops them silently — update the select.

**Error handling with Supabase**

Two contracts present in the codebase:

- **Throw-the-original** (`if (error) throw error`) — preserves `error.code` (`PGRST116`, `42501`, …), `error.details`, `error.hint`. Required when consumers need to discriminate by code (`SoundContext.tsx:148` `fetchError.code === 'PGRST116'` is the load-bearing example).
- **Throw-message-only** (`if (error) throw new Error(error.message)`) — currently dominant: 18 sites in TanStack hooks (audit cluster #1, REAL sev 4) + 9 in `useSeatingChart.ts` (out-of-cluster but same pattern, hand-rolled hook). Drops `error.code`. Audit-tagged for migration to an `unwrap()` helper.

**For new hooks today:** if you have any chance of needing code-level discrimination, throw the original (`throw error`). Otherwise either form is acceptable while migration is in flight. **Don't add new code-discrimination requirements with throw-message-only at the throw site** — retrofitting later is the audit-cluster cost.

**`unwrap<T>(result)` helper** is _planned_ in `src/lib/supabase.ts` (~30 min fix, tracked in audit) — **DOES NOT EXIST YET. Do not import it.** When it lands, the two contracts above collapse to "use `unwrap()`."

- Inside a `queryFn`, throwing surfaces as `query.error`. Inside a `mutationFn`, throwing triggers `useMutation.onError`. Never swallow errors at the queryFn / mutationFn boundary; let TanStack Query propagate them.
- **TanStack `onError` context narrowing is non-obvious.** `context` is `Context | undefined` (undefined when `onMutate` threw or returned undefined). Use the `if (context?.previousX !== undefined)` pattern (`useTransactions.useAwardPoints:212-227`). `context?.previousX` is NOT equivalent to `context.previousX !== undefined` — `previousX` may legitimately be `undefined` (no prior cache data); writing that via `setQueryData(undefined)` wipes the cache and is worse than no rollback.

**Env access**

- App code (`src/**`) uses `import.meta.env.VITE_*`. ONLY `VITE_`-prefixed vars reach the browser bundle.
- Node-side files (`scripts/**`, `tests/e2e/**`, `playwright.config.ts`, `vitest.config.ts`) use `process.env` and may read any var (including secrets like service-role keys).
- **Never `process.env` in `src/**`** — at best it's `undefined` at runtime; at worst Vite inlines a secret into the client bundle.
- Required `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are validated at startup in `src/lib/supabase.ts:7-9` (throws if missing). Don't replicate this guard elsewhere.

**Type-system discipline (audit-tagged hot spots)**

- Three sites use `as T` on Supabase data with no runtime guarantees and need schema validation (zod / valibot at the `queryFn` boundary, ideally in `src/types/transforms.ts`):
  - `src/hooks/useRealtimeSubscription.ts:135-141` — `payload.new as T` / `payload.old as D`
  - `src/hooks/useLayoutPresets.ts:41` — `data.map((p) => dbToLayoutPreset(p as DbLayoutPreset))`
  - `src/types/seatingChart.ts:211` — `preset.layout_data as LayoutPresetData` (JSONB — highest priority; JSONB has zero static guarantees)
- **Don't add new `as T` casts on Supabase boundaries.** The `supabase` client is `createClient<Database>(...)`-typed; `.from('students').select('*').single()` already returns typed data. Many existing casts (e.g., `src/utils/migrateToSupabase.ts:223, 272, 300, 327`) are redundant — try deleting them first.
- `as unknown as` is acceptable in **exactly two** places:
  1. `useRealtimeSubscription.ts:118-126` — Supabase's `.on('postgres_changes', …)` is over-strict literal-typed; the cast loosens. Don't try to "fix" — the recommended fix may not compile.
  2. Test mocks (`vi.fn() as unknown as typeof fetch`, `class MockX implements Y` in `src/test/sounds.test.ts`) — implementing every method on `Response` / `AudioContext` for a 2-3-method test is impractical.
- **Anywhere else, `as unknown as` is an anti-pattern.** If you need to launder a type, the right fix is a runtime guard or a discriminated union, NOT a cast.
- **`Partial<T>` is a known smell at 13 sites in `src/`** — distribution and guidance:
  - **Test factories (2 sites in `src/test/leaderboardCalculations.test.ts:14, 29`)** — for new factories, use `Required<T>` defaults + a `Pick<T, K>` override pattern. Tighter type errors when shapes drift.
  - **`AppContext.tsx` legacy wrapper signatures (6 sites at `:90, 100, 106, 233, 290, 327`)** — `Partial<DbClassroom>` / `Partial<DbStudent>` / `Partial<DbBehavior>`. Migration debt; the underlying mutation hooks (`useUpdateClassroom`, `useUpdateStudent`, `useUpdateBehavior`) already use typed `UpdateX` payloads with supabase-js 2.104 `RejectExcessProperties`. These dissolve when AppContext wrappers do (Phase 4). **Do NOT add new `Partial<DbX>` to AppContext wrappers.**
  - **Settings update interfaces (5 sites: `SoundContext.tsx:58, 171`, `useSeatingChart.ts:32, 205`, `SeatingChartEditor.tsx:49`)** — `Partial<SoundSettings>` and inline `Partial<{ … }>` for layout settings. New settings interfaces should define an explicit `XSettingsUpdate` DTO type rather than `Partial<XSettings>`, so the partial fields are intentional, not inferred.

### Framework-Specific Rules (React)

**Provider hierarchy is fixed — verify before reordering**

```
QueryClientProvider              // src/main.tsx
  ├─ <App />                     // src/App.tsx
  │    └─ AuthProvider           //   outermost app provider — everything below presupposes auth
  │         └─ AuthGuard         //   short-circuits render before data contexts mount
  │              └─ ThemeProvider
  │                   └─ SoundProvider
  │                        └─ AppProvider
  │                             └─ AppContent
  └─ <DevtoolsGate />            // sibling of <App />, NOT nested in any data provider
```

**Why the order matters (verified consumption chain):**

- `QueryClientProvider` is outermost so every TanStack hook below it resolves to the same client.
- `AuthProvider` is outermost-of-the-app-providers; `AuthGuard` (right under it) renders nothing if not authenticated, so all providers below it presuppose a signed-in user.
- `ThemeProvider` has no Auth/Sound deps (it just reads/writes `localStorage`).
- **`SoundProvider` calls `useAuth()` at `SoundContext.tsx:67`** (`const { user } = useAuth()`) for the user-scoped sound-settings query — so SoundProvider MUST be below AuthProvider.
- `AppProvider` does NOT directly consume `useAuth` / `useSound` (grep confirms — no imports). It calls TanStack hooks that resolve queries scoped to the authenticated user; the only ordering requirement for `AppProvider` is that `AuthGuard` has gated render above it.

`<DevtoolsGate />` is mounted as a sibling of `<App />` inside `QueryClientProvider` (NOT inside `AppProvider`). Do NOT move it. New top-level providers go INSIDE `AppProvider` unless they are auth-layer or cross-cutting infra (and check whether they consume `useAuth` — that determines their tier).

**`AppContext` is UI/session state + thin migration-period wrappers**

- Currently 797 LOC. UI/session state (no server-of-truth): `activeClassroomId`, modal flags, selection-mode toggles, `batchKindRef` (in-memory Map for batch-kind tracking on undo). Target post-Phase-4: ~150 lines.
- Migration-period wrappers (`createClassroom`, `awardPoints`, `awardClassPoints`, `awardPointsToStudents`, `addBehavior` family, `clearStudentPoints`, `adjustStudentPoints`, `resetClassroomPoints`): exist so legacy callers keep working through Phase 4. Each individual wrapper THROWS on Supabase failure (ADR-005 §2).
- **`useApp()` MUST NOT expose new server-data pass-throughs.** Access to `students` / `classrooms` / `transactions` / `behaviors` via `useApp()` is migration debt — new components call hooks directly (`useStudents(classroomId)`, `useClassrooms()`, etc.).
- **`awardClassPoints` / `awardPointsToStudents` orchestrators silently swallow per-item failures** at `AppContext.tsx:408-424` and `:454-470` (`Promise.all` + per-item `.catch((err) => { console.error(err); return null; })` at `:419-422` and `:465-468`). The inner mutation throws, but the outer return value is "successful results only" — caller sees `length === 5` if all succeeded OR `length === 3` if 2 failed and has no way to distinguish from "you only awarded 3." Audit cluster #2.
- **For new orchestrators that batch a `mutateAsync` over a list:** the `Promise.all + per-promise .catch` pattern is _behaviorally fine_ (it's equivalent to `Promise.allSettled` for "don't fail-fast"). The bug is silent partial failure. Surface the failure count to the user (toast / state) — counting nulls in the existing pattern works, or use `Promise.allSettled` and read `.status === 'rejected'`. Either is acceptable; **silently filtering nulls and reporting "success" is the anti-pattern**, not the choice between `allSettled` and `all + catch`.

**Component structure (hooks-before-returns is non-negotiable)**

1. All hooks first — stable, unconditional order. (`useQuery`, `useMutation`, `useApp()`, `useAuth()`, `useState`, `useEffect`, all of them.)
2. Event handlers (default to plain function expressions; see useCallback discipline below).
3. Early returns AFTER hooks.
4. Main render JSX.

A hook called after an early return crashes the next render when the branch flips. `eslint-plugin-react-hooks` catches most violations; do not silence the rule.

**`useCallback` discipline — drop it when the consumer is a DOM element**

The audit verified **three** cargo-cult sites in the codebase:

- `src/components/home/ClassroomCard.tsx:10` — `handleClick = useCallback(...)`, consumed only by `<button onClick={handleClick}>` (line 21)
- `src/components/students/StudentPointCard.tsx:67` — `handleClick = useCallback(...)`, consumed only by `<button onClick={handleClick}>` (line 93)
- `src/components/students/StudentPointCard.tsx:77` — `handleKeyDown = useCallback(...)`, consumed only by `<button onKeyDown={handleKeyDown}>` (line 94)

The DOM `<button>` does NOT memoize and does NOT care about callback reference stability. The `memo` wrapper on the _containing_ component (`memo(ClassroomCardComponent)`, `memo(StudentPointCardComponent)`) memoizes the **component from re-rendering** when ITS parent's other state changes — it has nothing to do with the inner callback's stability.

**Default to plain function expressions** (`const handleClick = () => onSelect(id)`).

**Reach for `useCallback` only when:**

- The callback is passed to a `React.memo`-wrapped child component (NOT a DOM element) AND that child's render cost matters, OR
- The callback is in a dependency array of a `useEffect` / `useMemo` / another `useCallback` (transitively).

Wrapping a callback whose only consumer is a DOM element costs more than it saves (allocation + dep-tracking + reduced inline-ability) — verified.

**Performance: unstable reference hazards**

- Don't pass fresh object/array literals as props to memoized children — wrap in `useMemo` first.
- Derive state inline or via `useMemo` — never store derived values in parallel `useState` (they drift, and `setX` in render is a separate bug).
- `useState(() => expensiveCompute())` defers initialization; `useState(expensiveCompute())` runs every render.

**`react-refresh/only-export-components` (warn-level)**

- Files that export a component export ONLY components (`allowConstantExport: true` permits constants alongside).
- Move helpers/types out of component files — see Language section for destinations.
- The warning means HMR won't preserve component state across edits when violated. Not a hard error, but consistently violated → degraded DX.

**Lazy loading (verified pattern in `App.tsx`)**

- Top-level views are `lazy()`-imported and wrapped in `<Suspense fallback={<ViewFallback />}>`: `MigrationWizard`, `DashboardView`, `ClassSettingsView`, `ProfileView`, `TeacherDashboard`.
- Use `.then((m) => ({ default: m.X }))` to bridge named exports → default-export-required `lazy()` signature (the codebase uses named exports per the export rules).
- Don't `lazy()` small components; the network round-trip cost dominates for sub-50 KB chunks.

**Tailwind v4 styling**

- Utility classes in `className` only.
- Inline `style={{...}}` is allowed ONLY for dynamic values that cannot be expressed as classes:
  - `@dnd-kit` `style={{ transform }}` (legitimate exception)
  - Computed colors / sizes from props that can't enumerate to classes (e.g., `style={{ backgroundColor: bgColor }}` at `StudentPointCard.tsx:130` for avatar)
- No CSS Modules, no styled-components, no emotion, no `tailwind-merge` shimming.
- **Configuration source-of-truth:** `@tailwindcss/postcss` (configured in `postcss.config.js`) reads `@import "tailwindcss"` from `src/index.css`. Theme extensions (if any) use the v4 `@theme` block in `index.css`.
- **A vestigial `tailwind.config.js` exists at project root** — 11-line v3-style stub (`content`, `theme: { extend: {} }`, `plugins: []`). Tailwind v4 does NOT read it. **Don't add config to it expecting it to take effect; don't delete it casually if anything else references it.** When v4 migration is fully cleaned up it should be removed.

**Icons & sounds**

- Icons: `lucide-react` only. Do NOT import Heroicons / FontAwesome / inline SVGs for new icons.
- Sounds: route through `SoundProvider` / `useSoundEffects`. Do NOT `new Audio()` from components — the provider centralizes preload + volume + browser autoplay handling, and reads user-scoped sound settings via `useAuth()` (which is why SoundProvider's hierarchy position matters — see Provider hierarchy above).

**State management direction (normative)**

- **Server state (anything from Supabase) → TanStack Query** via the registered query key. See `src/lib/queryKeys.ts`.
- **UI / session state → `AppContext` + `useApp()`.** Active classroom selection, modal state, transient UI flags.
- **Legacy AppContext wrappers** (`awardClassPoints`, `addBehavior`, etc.) — migration debt. New components call mutation hooks directly when adding new flows; existing callers stay until Phase 4.
- **No Zustand under this initiative.** Out of scope for the current migration. If `SeatingChartEditor.tsx` (1350 LOC) is later split, a seating-scoped Zustand store is the recommended target — NOT an expanded `AppContext`.

### Supabase, Realtime & Data Access

**Query key registry — `src/lib/queryKeys.ts` is the single source of truth**

- NEVER construct query keys inline at call sites. Import builders: `queryKeys.students.byClassroom(id)`, `queryKeys.classrooms.all`, `queryKeys.transactions.list(classroomId)`, `queryKeys.behaviors.all`, `queryKeys.layoutPresets.all`, `queryKeys.seatingChart.metaByClassroom(id)`.
- Read paths and invalidation paths use the SAME builder so they cannot drift.
- When adding a domain: add the entry to `queryKeys` first, then the hook. PR review should reject inline keys.
- The `useStudents` `byClassroom` cache holds **students-table columns + RPC time-totals merged into one payload** (per `queryKeys.ts:13-15` comment); a prior `timeTotalsByClassroom` separate-key shape was dropped — don't reintroduce it.

**QueryClient defaults are deliberate (ADR-005 §1) — do NOT override per-hook**

`src/lib/queryClient.ts` sets:

- `refetchOnWindowFocus: false` — Phase 2 optimistic mutations race their `onSettled` invalidation refetch against a focus refetch (the later response wins → projector flicker on hosted latency). Realtime covers cross-tab sync for the target live-sync domains; non-realtime tabs accept that focus-back doesn't auto-refresh. Current `layout_presets` realtime is legacy drift, not a precedent.
- `gcTime: 10 * 60_000` (10 min) — active teacher sessions keep queries mounted longer than v5's 5-min default. Eviction during use causes a full `isPending` flash on next read (Amelia's pre-mortem attack #5).
- `staleTime: 30_000` — background freshness without hammering Supabase during rapid per-student awards. Deliberate, not arbitrary.
- `structuralSharing: true` — load-bearing for the Phase 1–3 adapter bridge (ref-stable query data → ref-stable adapter output). v5 default-on; pinned explicitly so a future default change doesn't silently regress.
- `retry: 1` (queries), `retry: 0` (mutations).
- `networkMode: 'online'`.
- `refetchOnReconnect: true`.

If you need different behavior for a specific hook, **read ADR-005 first** and document the deviation inline in the hook (the override is a rebuttal of the rationale; future readers need to see why the default was wrong here).

**Canonical hook patterns — copy these, NOT `useSeatingChart` / `useLayoutPresets`**

| Pattern                        | Reference                                                                             | Notes                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thin query (`useQuery`)        | `src/hooks/useBehaviors.ts:17-30`                                                     | Sort in queryFn, transform via `dbToBehavior`, no realtime                                                                                               |
| Realtime + cache merge         | `src/hooks/useStudents.ts:44-179`                                                     | Two `useRealtimeSubscription` calls (students UPDATE/INSERT/DELETE + point_transactions DELETE), `qc.setQueryData` merge logic, visibilitychange handler |
| Optimistic mutation            | `src/hooks/useTransactions.ts:useAwardPoints` (`:97-235`)                             | All 5 ADR-005 §4 (a)–(e) AC met with inline comments mapping each to its line                                                                            |
| Plain mutation (no `onMutate`) | `src/hooks/useBehaviors.ts:useAddBehavior` (`:32-42`)                                 | `mutationFn` + `onSettled: invalidateQueries` only — Phase 2 §4 AC does NOT apply                                                                        |
| Split mutations per CRUD op    | `useClassrooms.ts` `useCreateClassroom` / `useUpdateClassroom` / `useDeleteClassroom` | Each is its own hook returning `useMutation`                                                                                                             |

**Standard mutation shape (canonical):**

```ts
return useMutation<DbX, Error, Input>({
  mutationFn: async (input) => {
    const { data, error } = await supabase.from('xs').insert(payload).select().single();
    if (error) throw new Error(error.message); // or: throw error (preserves .code; preferred for new code)
    return data;
  },
  onSettled: (_data, _err, input) => {
    qc.invalidateQueries({ queryKey: queryKeys.xs.byScope(input.scopeId) });
    // plus any cross-hook aggregates (e.g., classrooms.all if students change)
  },
});
```

**Optimistic mutations (ADR-005 §4 AC checklist — required when `onMutate` is present):**

Every `useMutation` with `onMutate` MUST satisfy all 5:

- **(a) Null-guard `context.previous*` in `onError` rollback.** `context?.previousX !== undefined` — `undefined` post-cancellation would write `undefined` into the cache via `setQueryData(undefined)`, worse than no rollback. (See Language section for why `context?.previousX` differs from `context.previousX !== undefined`.)
- **(b) Keep `onMutate` pure and idempotent.** Duplicate mutation invocations can happen through double-clicks, re-submits, or `mutate()` calls inside effects that React StrictMode re-runs in dev. Impure callbacks ship double writes. Guard pattern: `const alreadyPatched = previousX?.some((x) => x.id === optimisticId) ?? false; if (!alreadyPatched) { … }` (see `useAwardPoints:138-205`).
- **(c) Derive temp-row IDs deterministically** (content-hash, NOT `crypto.randomUUID()`). Non-deterministic temp IDs break rollback when the same input is re-submitted. `useAwardPoints` uses `` `optimistic-${studentId}-${behaviorId}-${timestamp}` `` (`:132`).
- **(d) Wire `throwOnError: true` OR explicit `onError` + toast** — never neither. Silent failure with optimistic writes leaves the UI desynced from the server.
- **(e) Read state from `qc.getQueryData(...)`, NOT from the component closure.** Stale closures in `onMutate` across re-renders produce ghost writes. `useAwardPoints` reads `previousTransactions`, `previousClassrooms`, `previousStudents` via `qc.getQueryData(...)` (`:127-129`).

Plain mutations (no `onMutate`) carry NO Phase 2 regression surface; the (a)–(e) checklist does NOT apply.

**Devtools DCE pattern (NFR4) — non-negotiable**

The pattern lives in `src/main.tsx:14-24`:

```tsx
function DevtoolsGate() {
  const [Tools, setTools] = useState<ComponentType<{ initialIsOpen?: boolean }> | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) {
      void import('@tanstack/react-query-devtools').then((m) => {
        setTools(() => m.ReactQueryDevtools);
      });
    }
  }, []);
  return Tools ? <Tools initialIsOpen={false} /> : null;
}
```

- The dynamic `import()` is **inside a `useEffect` body gated on `import.meta.env.DEV`**. Vite replaces the flag with a `false` literal in prod; the entire `if` body dead-codes; Rollup never sees the `import()` call → no chunk emitted for the devtools package.
- A module-scope `lazy(() => import('@tanstack/react-query-devtools'))` would STILL register the import with Rollup and emit a devtools chunk (~200 KB). The audit-required form does not.
- `scripts/check-bundle.mjs` (CI-gated via `npm run check:bundle`) asserts: zero chunks named `*devtools*` AND zero textual matches for `'react-query-devtools'` / `'ReactQueryDevtools'` in any emitted `.js` (excluding source maps).
- Do NOT use `@tanstack/react-query-devtools/production` or any runtime toggle — NFR4 is "never in production," not "optionally."

**Realtime subscription rules**

- Target policy: realtime attaches ONLY to the three live-sync domains (see Migration Status section §6). Current HEAD still has `layout_presets` legacy realtime in `useLayoutPresets`; do not add more, and remove it when migrating that hook. Do NOT add realtime to classrooms, behaviors, or user settings.
- Use `useRealtimeSubscription<DbType>({ table, filter, enabled, onChange })` — the hook owns channel lifecycle (cleanup, reconnect, status transitions).
- **Preferred callback:** the single `onChange` form (`(payload) => …`). The handler routes by `payload.eventType` and either `qc.setQueryData(...)` patches the cache (preferred for hot paths — see `useStudents.ts:48-102` INSERT/UPDATE/DELETE merge) OR `qc.invalidateQueries(...)` (for low-frequency events — see `useTransactions.ts:61-66`).
- **Legacy callbacks** (`onInsert` / `onUpdate` / `onDelete`) — still supported, dev-mode warning fires when supplied alongside `onChange`. Current legacy consumers are `useLayoutPresets` and the `useStudents` `point_transactions` DELETE branch. Do NOT add new callers of the legacy fields.
- Filter syntax is PostgREST: `` `classroom_id=eq.${classroomId}` ``. Pass `undefined` to subscribe to everything RLS allows.
- **Realtime DELETE on `point_transactions` is the cross-device undo time-totals decrement path** — `useStudents.ts:111-162`. Relies on `REPLICA IDENTITY FULL` (migration `005_replica_identity_full.sql`) to receive the deleted row's data; without it, `payload.old` is empty. With RLS enabled, Supabase Realtime may still filter `payload.old` down to insufficient fields, so keep the fallback `invalidateQueries(...)` path.
- Hand-rolled channels (outside `useRealtimeSubscription`): cleanup in `useEffect` return is MANDATORY — `return () => supabase.removeChannel(channel)`. Prefer the helper.

**Time-totals nuance in `useStudents`**

- `today_total` / `this_week_total` come from the `get_student_time_totals` RPC inside `queryFn` (`useStudents.ts:194-211`).
- They are **PRESERVED across realtime UPDATE events** (`useStudents.ts:67-92`) — the DB trigger bumps lifetime totals on every point award; if we re-fetched the RPC on every event, it'd fire per tap. Time totals refresh via:
  1. `point_transactions` DELETE realtime → local decrement (`:111-162`)
  2. `visibilitychange` handler → invalidate + refetch (day-boundary safety, `:167-179`)
  3. Mutation `onSettled` invalidations (undo / clear / adjust / reset)

**Denormalized totals — READ, DON'T COMPUTE**

- `students.point_total`, `positive_total`, `negative_total` are maintained by DB triggers (migration `011_add_student_point_totals.sql`).
- Do NOT aggregate `point_transactions` client-side for display — that path exists only for audit views and time-window RPCs.
- **Updating `students.point_total` directly from app code is silently overwritten** by the next `point_transactions` trigger fire. Always mutate via `point_transactions`.
- When adding a denormalized column, ship the trigger in the SAME migration.

**RLS is the authorization boundary**

- Every new table: enable RLS + explicit policies for the operations the app actually performs in the same migration. A table with RLS enabled but no matching policy is fully blocked to clients; a table without RLS is the data-leak vector.
- Service-role key is for Node-side code only (`scripts/**`, `tests/support/helpers/supabase-admin.ts`, and E2E specs that import it). NEVER reachable from `src/**` or any browser bundle.
- `VITE_SUPABASE_ANON_KEY` is what ships to the browser. The anon key + RLS policies are the security boundary.

**Schema validation at trust boundaries (audit cluster 3c)**

Three sites use `as T` on Supabase data with no runtime guarantees and need schema validation (zod / valibot at the `queryFn` boundary, ideally in `src/types/transforms.ts`):

- `src/hooks/useRealtimeSubscription.ts:135-141` — `payload.new as T` / `payload.old as D` (generic cast on every realtime payload)
- `src/hooks/useLayoutPresets.ts:41` — `data.map((p) => dbToLayoutPreset(p as DbLayoutPreset))`
- `src/types/seatingChart.ts:211` — `preset.layout_data as LayoutPresetData` (JSONB column — highest priority; JSONB has zero static guarantees)

**Hardcoded table names**

- 65 string-literal `from('table_name')` sites in `src/` (verified via `grep -rn "from('"`).
- Planned: `src/lib/tableNames.ts` constants file. Not yet landed. New code SHOULD anticipate the migration but use the literal today (typed via `Database` interface anyway).
- When the constants file lands, all sites get batch-replaced.

**Query shape**

- Prefer `.select('*, related(*)')` PostgREST embedding over multiple round-trips for related-row joins.
- For complex queries (multi-table joins + aggregation, time windows): add a Postgres RPC and call `supabase.rpc('name', args)`. See `get_student_time_totals` for the canonical example.
- `.select('*')` picks up new columns automatically; explicit-column `.select('id, name')` (e.g., `useClassrooms.ts:23-25`) drops new columns silently — see Language section's DB-column checklist.

**Type-safety at the Supabase boundary**

- `supabase` client is `createClient<Database>(...)`-typed (`src/lib/supabase.ts:11`). `.from('students').select('*').single()` returns typed `data: Student`.
- supabase-js 2.104 `RejectExcessProperties` requires typed `UpdateX` payloads on `.update()` calls — see `useUpdateStudent`, `useUpdateClassroom`, `useUpdateBehavior` for the pattern. **Do NOT pass `Partial<DbX>` to `.update()` in new code** — use the generated `UpdateX` type.

**Migration sequencing**

- 11 migrations exist (`001_initial_schema.sql` → `011_add_student_point_totals.sql`). Zero-padded prefix.
- Increment from the last file in `supabase/migrations/`. Don't reuse a number, even for renames.
- Realtime enabled at `004_enable_realtime.sql`; `REPLICA IDENTITY FULL` at `005_replica_identity_full.sql`; `batch_id` at `006_add_batch_id.sql`; sound settings at `007`; seating charts at `008`; room element fixes at `009` / `010`; denormalized totals at `011`.

**Service-role key handling (Node-side scripts/tests only)**

- `scripts/seed-test-user.ts`, `scripts/seed-test-classroom.ts`, `scripts/seed-counter-data.ts`, `scripts/verify-undo-fix.ts`, and `tests/support/helpers/supabase-admin.ts` use `process.env.SUPABASE_SERVICE_ROLE_KEY` (Node-side only).
- `npm run test:seed` runs local seeding from `.env.test`. Hosted/production credentials stay env-injected (for example through `fnox exec --`), never hardcoded.
- A service-role import sneaking into `src/**` is a data-leak vulnerability — every code review should grep for `service_role` in the diff.

### Testing Rules

**Two layers, two harnesses**

| Layer | Location                                         | Runner                             | Hits network?             |
| ----- | ------------------------------------------------ | ---------------------------------- | ------------------------- |
| Unit  | `src/**/*.test.{ts,tsx}` (anywhere under `src/`) | Vitest 4 + jsdom + Testing Library | No — mock Supabase client |
| E2E   | `tests/e2e/**/*.spec.ts`                         | Playwright (Chromium)              | Yes — LOCAL Supabase only |

`vitest.config.ts:10` only excludes `**/e2e/**` from the unit run; the default `**/*.{test,spec}.{ts,tsx}` glob picks up tests anywhere in `src/`. Tests currently live in 3 locations:

- `src/test/` (legacy single folder)
- `src/hooks/__tests__/` (co-located near hooks)
- `src/utils/__tests__/` (co-located near utils)

**Existing unit tests (current scope, sparse):**

- `src/test/leaderboardCalculations.test.ts` — pure-function tests with `Partial<AppStudent>` factories
- `src/test/sounds.test.ts` — `SoundContext` tests with `MockAudioContext` / `vi.fn() as unknown as typeof fetch`
- `src/test/useRotatingCategory.test.ts` — hook test with `vi.useFakeTimers()`
- `src/test/TeacherDashboard.test.tsx` — component render test
- `src/hooks/__tests__/useRealtimeSubscription.test.ts` — channel-status / reconnect tests
- `src/utils/__tests__/studentParser.test.ts` — parser unit tests

`src/test/setup.ts` is the shared Vitest setup (jsdom polyfills + `@testing-library/jest-dom` matchers).

For a new test, either location is acceptable — match the file you're testing (co-locate via `__tests__/` if the SUT is in `src/hooks/` / `src/utils/` / `src/components/`; use `src/test/` for cross-file scenarios).

**Unit tests — mock Supabase, test behavior**

- **Mock Supabase at the module boundary** via `vi.mock('../lib/supabase', () => ({ ... }))` at the top of the test file. Use the relative import path the SUT actually uses (`'../lib/supabase'` or `'../../lib/supabase'` depending on test depth) — there is **no `@/` alias** configured in this codebase (no `paths` in `tsconfig*.json`, no `resolve.alias` in `vite.config.ts`). See `src/test/TeacherDashboard.test.tsx:7` and `src/test/sounds.test.ts:29` for the canonical pattern.
- Put chain stubs inside the `vi.mock` factory (or a reusable mock helper), NOT scattered inline per-assertion.
- For TanStack hooks: wrap renders in a test-local `QueryClientProvider` with `retry: false` and a fresh `QueryClient` per test. Assert via Testing Library queries (`getByRole`, `getByText`, `findBy*`) — NOT on internal query state (`result.current.isLoading` transitions are flaky and an implementation detail).
- For pure `queryFn` logic, extract it as a plain async function and test it directly without rendering — easier and stricter.
- `vi.fn() as unknown as typeof fetch` and `class MockX implements Y` casts in test files are acceptable (audit FALSE POSITIVE — implementing every method on `Response` / `AudioContext` for tests that touch 2-3 is a non-starter). See `src/test/sounds.test.ts:139, 323, 341`.
- Test descriptions: existing convention varies — most start with `should` (`useRotatingCategory.test.ts`, `sounds.test.ts`), but `studentParser.test.ts:6` uses `it('parses ...')`. Match the convention of nearby tests rather than enforcing a global rule.

**Test-tooling notes**

- `tdd-guard-vitest` ^0.2.0 is a `devDependency` (`package.json:61`) but is **NOT currently wired into `vitest.config.ts`** (no `reporters` block). The package is intended as a TDD-workflow guard but doesn't run today; treat it as latent tooling. If you wire it up, the PR should follow the package's README (add a `reporters` entry to the test config) and become a CI gate.

**E2E tests — LOCAL Supabase is mandatory (security boundary)**

- `playwright.config.ts:31-51` fail-closes: it parses `VITE_SUPABASE_URL` via `new URL(...).hostname` and refuses to run unless the host is one of:
  - `localhost` / `127.0.0.1` (loopback)
  - `10.*`, `192.168.*`, `172.16.*`–`172.31.*` (RFC1918 LAN)
  - `100.64.*`–`100.127.*` (Tailscale CGNAT 100.64.0.0/10)
- **A URL like `https://127.0.0.1.evil.com` is REJECTED** — substring match is NOT safe; always parse hostnames with `new URL(...).hostname`. The allow-list at `playwright.config.ts:39-45` is a security boundary, NOT a lint rule. Do not weaken or remove it.
- `webServer.reuseExistingServer: false` (`playwright.config.ts:94`) is deliberate — a manually-started dev server may still be pointed at hosted Supabase via shell-env or a stale `dev:hosted` session. **Never flip this to `true`.**
- `.env.test` is parsed via `dotenv.parse()` (`playwright.config.ts:14-21`) and force-overrides `process.env`. Vite's default `loadEnv(..., '')` would let shell env shadow the dotenv file; the bespoke parsing prevents that. Don't refactor this back to `loadEnv`.
- Run flow:
  ```
  npx supabase start                # boot local Postgres/Realtime/Auth on 127.0.0.1
  cp .env.test.example .env.test    # fill in anon + service-role keys from `npx supabase status`
  npm run test:e2e:local            # seeds test user (npm run test:seed) then playwright test
  ```
- Auth setup: `tests/e2e/auth.setup.ts` (the `setup` Playwright project) signs in via UI, stores cookies / localStorage at `.auth/user.json`, then every spec reuses it via `storageState`. Don't add per-test login flows.
- **Shared `.auth/user.json` + `fullyParallel: true` caveat:** all parallel tests authenticate as the same test user. Tests that mutate user-scoped state (classroom create/delete, behavior templates, sound settings) MUST namespace their data (e.g., generate unique classroom names per test) AND clean up in `test.afterEach` / `test.afterAll`. Otherwise parallel runs cross-pollute. If a feature genuinely needs per-test isolation, use Playwright's auth-per-test pattern (each test signs in fresh) — but that adds latency.
- Use `data-testid` attributes for selectors where text/role isn't stable. Auto-waiting locators (`getByRole`, `getByText`, `getByLabel`) are preferred over CSS selectors.

**CI scope (current state)**

`.github/workflows/test.yml` runs:

- `npm run lint`
- `npm run typecheck`
- `npm run check:bundle` (NFR4 devtools-DCE assertion after build)
- `npm run test:e2e` sharded across 4 workers (`--shard=N/4`)
- An E2E burn-in job that runs the suite ≥2× to catch flake

**Vitest unit tests are NOT in CI** — run them locally with `npm test` (watch mode) or `npm test -- --run` (single pass). Adding Vitest to CI is a future addition; until then, treat unit tests as developer-machine-only verification.

**Cleanup & parallelism**

- Every `afterEach` / `afterAll` that creates side effects (Supabase rows, timers, subscriptions, cookies) MUST undo them. Dangling rows in local Supabase cross-pollute parallel runs.
- Unit-test `QueryClient` should have `retry: false` AND be created fresh per test — sharing a client across tests leaks cache state.
- **Vitest `vi.useFakeTimers()` requires explicit `vi.useRealTimers()` in cleanup.** `vi.restoreAllMocks()` does NOT restore timer state. Existing site `src/test/useRotatingCategory.test.ts:8-13` is missing the `useRealTimers()` call — known debt; don't replicate.

**Existing arbitrary-wait debt (don't replicate; fix when touching)**

- `tests/e2e/auth.setup.ts:33` `await page.waitForTimeout(1000)` — masks an unmodeled wait condition after sign-in. Should be replaced with an explicit `expect(...).toBeVisible()` for a post-auth marker.
- `src/hooks/__tests__/useRealtimeSubscription.test.ts:202` `await new Promise((resolve) => setTimeout(resolve, 10))` — used to flush subscribe-callback scheduling. Could be replaced with `await act(async () => {})` or `vi.runAllTicks()`.

**Do NOT**

- Run E2E against hosted Supabase, "just to check prod parity" or otherwise — the allow-list refuses, and bypassing it is a security incident.
- Assert on internal hook state instead of rendered output. (`expect(result.current.isPending).toBe(false)` is a code smell — test what the user sees.)
- Mock TanStack Query itself. Mock the data source (Supabase); let TanStack run real.
- Add tests that depend on real network (third-party APIs, hosted Supabase). Tests must be reproducible from `.env.test` alone.
- Add new arbitrary-wait `setTimeout` / `waitForTimeout` calls — use Playwright's auto-waiting locators and Testing Library's `findBy*` / `waitFor`.

**Coverage expectations**

- No coverage threshold is currently enforced. Vitest runs in watch mode (`npm test`); CI does not run unit tests today.
- Explicit coverage gates are a future addition tracked in PRD; no current policy.

### Code Quality, Style & Organization

**Naming**

- Components: PascalCase filename matching export (`StudentGrid.tsx` → `export function StudentGrid`).
- Hooks: camelCase with `use` prefix.
- Utils: camelCase; one concern per file where practical.
- Tests: `{Name}.test.{ts,tsx}` co-located in `__tests__/` near the SUT, OR in `src/test/` (legacy folder) — both glob-picked-up by `vitest.config.ts`. E2E specs end in `.spec.ts` under `tests/e2e/**`, with one intentional exception: `tests/e2e/auth.setup.ts` is named for Playwright's setup-project pattern (see `playwright.config.ts:75-78`) — don't rename it.
- DB migrations: zero-padded sequential prefix in `supabase/migrations/` (`012_add_foo.sql`); increment from the last file (currently `011_add_student_point_totals.sql`). Don't reuse a number even for renames.
- **Storage / magic-string keys: define a const.** Real exemplars in the codebase:
  - `VIEW_STORAGE_KEY = 'app:view'` at `App.tsx:37`
  - `ACTIVE_CLASSROOM_STORAGE_KEY = 'app:activeClassroomId'` at `AppContext.tsx:149`
- **Anti-exemplar (cleanup target):** `ThemeContext.tsx` repeats the literal `'theme'` at lines 15, 37, 44 instead of using a const — extract to `THEME_STORAGE_KEY` next time the file is touched. **Don't replicate this pattern in new files.**

**File / folder layout (do not restructure casually)**

```
src/
├── App.tsx, main.tsx, index.css
├── components/
│   ├── auth/         # AuthGuard
│   ├── behaviors/    # behavior-template UI
│   ├── classes/      # classroom list, ImportStudentsModal
│   ├── common/       # SyncStatus, shared chrome
│   ├── dashboard/    # DashboardView (419 LOC, borderline mega-component)
│   ├── home/         # TeacherDashboard, ClassroomCard
│   ├── layout/       # app shell
│   ├── migration/    # MigrationWizard (one-time localStorage→Supabase flow)
│   ├── points/       # AwardPointsModal, ClassAwardModal, MultiAwardModal
│   ├── profile/      # ProfileView (auth.updateUser hook target)
│   ├── seating/      # SeatingChartEditor (1350 LOC mega-component)
│   ├── settings/     # ClassSettingsView, SoundSettingsModal
│   ├── students/     # StudentPointCard, StudentGrid
│   └── ui/           # Modal, Button, Input, ErrorToast — shared primitives
├── contexts/         # AppContext, AuthContext, SoundContext, ThemeContext
├── hooks/            # feature data hooks + barrel index.ts + __tests__/
├── lib/              # supabase.ts, queryClient.ts, queryKeys.ts, manualAdjustmentConstants.ts
├── services/         # non-Supabase integrations
├── test/             # legacy unit test folder (still active)
├── types/            # index.ts (app), database.ts (DB), transforms.ts, seatingChart.ts
└── utils/            # pure helpers + __tests__/
```

Feature work goes into the existing folder; don't invent parallel hierarchies.

**Modal chrome — use the shared primitives, don't re-implement**

Two shared primitives in `src/components/ui/`:

- `Modal.tsx` — enforces title-and-body layout (header is just a heading). ARIA `aria-labelledby="modal-title"`, body-scroll-lock, escape-to-close.
- `Dialog.tsx` — chrome-only (overlay + ARIA `aria-label` + scroll-lock + escape + entry animation); body owner controls every pixel inside. Use when you need a custom header (avatar, multi-row meta).

`AwardPointsModal`, `ClassAwardModal`, and `MultiAwardModal` were converted from hand-rolled chrome to `<Dialog>` in commit `ae7a9a8`. **`SoundSettingsModal` (`src/components/settings/SoundSettingsModal.tsx`) is the lone holdout still re-implementing chrome** — eligible for cleanup PR onto `<Dialog>`.

For new modals: import from `'../ui'` (or `'../../ui'` based on depth) — there is no `@/` alias. Choose `<Modal>` if the header is just a title; `<Dialog>` if you need custom header markup. See **UI / Design System Rules** for the full primitive choice rationale.

**Lists with stable keys — `key={index}` is a real bug source**

`key={index}` / `key={i}` causes React to mis-identify rows when the list reorders (sort, filter, insert-at-front), leading to lost component state and visual glitches.

**Verified existing sites (don't replicate; fix when touching the file):**

- `src/components/classes/ImportStudentsModal.tsx:181, 206` — `<li key={i}>` for warnings/errors lists
- `src/components/migration/MigrationWizard.tsx:250, 286` — same pattern

`key={name}` is **also wrong for student names** — the DB does not enforce uniqueness on `students.name`, and students within a classroom can legitimately share names (siblings, common names like "Emma"). Use `key={s.id}` (or a composite if `s.id` doesn't exist for the row type).

**Comments**

- Default to no comments. Well-named identifiers carry the "what."
- DO write a comment for the non-obvious "why": a hidden constraint, a subtle invariant, a workaround for a specific bug, behavior that would surprise a reader. Reference exemplars:
  - `playwright.config.ts:26-30` (E2E URL allow-list rationale — substring-match-is-unsafe explanation)
  - `playwright.config.ts:6-13` (env-override rationale — `loadEnv` shell-shadowing explanation)
  - `useStudents.ts:67-92` (time-totals preservation logic across realtime UPDATE)
  - `useTransactions.ts:86-95` (ADR-005 §4 (a)–(e) inline AC mapping)
  - `useTransactions.ts:131` (deterministic temp-row ID rationale for optimistic-update idempotency)
- Don't reference PRs / tickets / authors in code comments — they rot. Belongs in commit messages.
- **Comments that LIE about behavior are worse than no comments.** Audit cluster #2 verified two:
  - `src/components/points/ClassAwardModal.tsx:64` — claims "wrapper throws on error with automatic rollback"
  - `src/components/points/MultiAwardModal.tsx:62` — same comment about `awardPointsToStudents`

  Both are FALSE: the orchestrator does NOT throw at the call-site layer; per-item failures are silently filtered to nulls (Section 3 covers this). Both comments are scheduled for deletion when cluster #2 is fixed; **do NOT clone this comment when adding new orchestrator wrappers.**

**Prettier / ESLint**

- `.prettierrc`: `{ "semi": true, "singleQuote": true, "tabWidth": 2, "trailingComma": "es5", "printWidth": 100 }`.
- Pre-commit (via `simple-git-hooks` + `lint-staged`) runs `eslint --fix` (on `*.{ts,tsx}`) + `prettier --write` (on `*.{ts,tsx,js,jsx,json,css,md}`) + `npm run typecheck` (`tsc -b --noEmit`).
- ESLint flat-config ignore list (`eslint.config.js:9-30`) deliberately skips `dist`, `dist-ssr`, `.bmad`, `.claude`, `.agent`, `.cursor`, `.serena`, `node_modules`, `*.config.{js,ts}`, `supabase`, `scripts`, `coverage`. Code in `scripts/` is NOT linted; that's deliberate (Node-side, less strict).

**State management direction (normative target — current is mid-migration)**

- **Server state → TanStack Query** via the registered query key (see Supabase / Realtime section). TanStack-backed today: `useClassrooms`, `useStudents`, `useTransactions`, `useBehaviors`. Legacy hand-rolled migration targets: `useLayoutPresets`, `useSeatingChart`.
- **UI / session state → `AppContext` + `useApp()`.**
- **Current consumption pattern** (observed): most components still consume the AppContext wrapper layer (`useApp().awardPoints`, `useApp().classrooms`) rather than calling the hooks directly. That's the migration debt described in the Migration Status section.
- **Normative direction** (target): new components call the mutation / query hooks directly (`useAwardPoints()`, `useStudents(classroomId)`, etc.). Existing callers stay on the AppContext wrappers until Phase 4 dissolves them.
- **No new contexts** unless it's a genuine cross-cutting concern (auth, theme, sound). Theme / sound are pre-Phase-3 design and would arguably be Zustand stores in a greenfield rebuild — but in-scope here, they stay.

**Don't add**

- **New component-folder barrels.** 12 of the 14 component folders already have an `index.ts` (auth, behaviors, classes, dashboard, home, layout, points, profile, seating, settings, students, ui — only `common` and `migration` lack one). These are **historical, not precedent.** New folders should NOT add an `index.ts` because `react-refresh/only-export-components` warning compounds and the import paths are perfectly serviceable as `'../points/AwardPointsModal'`. The hook barrel (`src/hooks/index.ts`) IS intentional — that's the one exception.
- **Premature abstractions.** Three similar lines is cheaper than the wrong abstraction. Wait for the fourth.
- **Wildcard re-exports.** `src/types/index.ts:6` (`export * from './seatingChart'`) is a known cleanup target — see Language section.
- **Helper functions inside component files** — see Language section's component-only-export rule.
- **CSS files outside `src/index.css`** — Tailwind v4 + utility classes only. No CSS Modules, no styled-components. Verified: `src/index.css` is the only CSS file.

**Audit-tagged dead code**

- `src/hooks/usePersistedState.ts` is exported from `src/hooks/index.ts:1` but has **zero importers** in `src/` beyond its own export barrel. Real dead code; `git rm` candidate when next touching the hooks barrel.

### UI / Design System Rules

_Captures the editorial/engineering redesign that landed in commits `ae7a9a8` (Phase 1: tokens + primitives + 4 surfaces) and `fb3f239` (Phase 2: inner-screen restructure), plus the dev-script and auth fixes that shipped alongside it. New UI work should match these patterns; legacy screens that haven't been redesigned cascade into them automatically via the token aliases._

**Token foundation — all design tokens live in `src/index.css`**

- Tailwind v4 reads the `@theme { … }` block (`index.css:36-104`) as both CSS variables AND utility generators. Consume tokens via Tailwind utilities (`bg-accent-500`, `text-ink-strong`, `border-hairline`, `font-display`, `font-mono`); do NOT hand-write `var(--color-…)` references.
- Semantic scales:
  - `accent-{50..950}` (terracotta) — brand, primary CTAs, structural highlights, focus rings.
  - `surface-{1,2,3}` — page bg / card / hover wash. Light defaults are warm off-white; `.dark` flips them to near-black greys (`index.css:117-130`).
  - `ink-{strong,mid,muted}` — text hierarchy.
  - `hairline` / `hairline-strong` — borders. Hairline borders carry the visual weight, not heavy box-shadows.
- The `@theme` block ALSO aliases stock Tailwind `blue-{50..950}` AND `indigo`/`purple-{50,100,400-700}` onto the terracotta scale (`index.css:44-71`). Intentional — retones every legacy `bg-blue-*` / `from-indigo-*` cascade screen we don't redesign by hand. **In new code use `bg-accent-*` directly**; the aliases exist so legacy code doesn't have to be rewritten.
- **Dark-mode CSS gotcha (load-bearing):** any explicit `:root { … }` rule that defines a token must come BEFORE the `.dark { … }` override. `:root` and `.dark` have equal specificity (0,1,0); when `.dark` is on `<html>`, both match and source order wins. The `:root { --chart-grid-line }` block at `index.css:112-114` carries an inline comment about a concrete bug this caused — preserve that ordering for any new tokens you add at `:root` scope.
- Class-based dark mode is wired via `@custom-variant dark (&:where(.dark, .dark *));` (`index.css:4`). The `.dark` class lands on `<html>` from the inline FOUC-prevention script in `index.html:15-26` BEFORE React mounts. **Do not move that script.**

**Typography**

- Three families loaded via Google Fonts in `index.html:11-14`:
  - **Instrument Serif** → `font-display` — headings only.
  - **Geist** (400/500/600) → `font-sans` — body / UI labels / button text. Set as the body default in `index.css:16`; you don't need to add `font-sans` explicitly.
  - **JetBrains Mono** (500 only) → `font-mono` — used with `tabular-nums` for ALL numerals (point totals, deltas, ranks, counts, time). **Numerals are never serif.**
- Big point displays add `tracking-[-0.02em]` (e.g. `StudentPointCard.tsx:137`, `ClassroomCard.tsx:46`).
- Section-label pattern (4-file precedent — `Sidebar.tsx:14-20`, `ProfileView.tsx:15-17`, `ClassSettingsView.tsx:15-17`, `SoundSettings.tsx:16-18`): `font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted`. Each of those files declares a local `function SectionLabel({ children }) { … }`. New screens with 3+ such labels: declare the same local helper rather than promoting to a shared one — call sites differ enough (badges, counts) that abstracting hasn't paid off.

**Component primitives — use, don't re-implement**

- `<Button>` (`src/components/ui/Button.tsx`) — six variants: `primary` (the singular important action per surface), `secondary` (hairline support), `ghost` (transparent tertiary), `danger`, `success`, `warning`. Sizes `sm` / `md` / `lg`. Carries `hover:-translate-y-[1px]` micro-lift; `primary` adds an `0_1px_0_rgba(255,255,255,0.12)_inset` highlight.
- `<Input>` (`src/components/ui/Input.tsx`) — `label` (mono uppercase, `text-[11px] tracking-[0.12em] text-ink-muted`) and `error` props. Auto-derives `id` from `label.toLowerCase().replace(/\s+/g, '-')` if `id` not provided. Hairline border + accent-500 focus ring; switches to red-500 border/ring when `error` is set.
- `<Modal>` (`src/components/ui/Modal.tsx`) — title-and-body. ARIA: `role="dialog" aria-modal="true" aria-labelledby="modal-title"`. Built-in body-scroll-lock + escape-to-close + animated fade/scale entry. Use when the header is just a heading.
- `<Dialog>` (`src/components/ui/Dialog.tsx`) — chrome-only (overlay + ARIA `aria-label` + scroll-lock + escape + entry animation). Body owner controls every pixel inside. Use when you need a custom header (avatar, multi-row meta). Same scroll-lock + escape semantics as `Modal`.
- **Do not hand-roll modal markup.** `AwardPointsModal`, `ClassAwardModal`, `MultiAwardModal` were converted onto `<Dialog>` in commit `ae7a9a8`. `SoundSettingsModal` is the lone holdout still re-implementing chrome (also flagged in Code Quality / Modal chrome).

**Card / tile pattern**

- Stat or content tile baseline: `bg-surface-2 border border-hairline rounded-2xl p-{4 | 5}` (`StudentPointCard.tsx`, `ClassroomCard.tsx`, `BehaviorButton.tsx`).
- Hover: `hover:border-accent-500/40 hover:-translate-y-[1px]`. Scope `transition-[border-color,transform,box-shadow,background-color]` so re-paints stay cheap.
- Selected / active: full `border-accent-500 ring-2 ring-accent-500/30` (`StudentPointCard.tsx:90`).
- Focus-visible: `focus-visible:ring-2 focus-visible:ring-accent-500/{30|40} focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1` — keep this on every interactive tile.
- "Raised" cards meant to look lifted use an inline highlight rather than a heavy box-shadow. Two alphas in current use: `Button` primary uses `0_1px_0_rgba(255,255,255,0.12)_inset` (subtle); `LoginForm.tsx:42` uses `0_1px_0_rgba(255,255,255,0.4)_inset,0_20px_50px_-30px_rgba(0,0,0,0.2)` (panel-level). Pick alpha by visual weight; otherwise hairline border alone is enough.

**Color semantics — DO NOT conflate**

- `emerald-*` (Tailwind built-in) = positive points, "good behavior", success.
- `red-*` (Tailwind built-in) = negative points, "needs work", destructive.
- `accent-*` (terracotta) = brand, primary CTAs, structural highlights, focus rings.
- Not interchangeable. `accent` for "good" feedback, or `emerald` for a primary CTA, would muddle three distinct meanings. `BehaviorButton.tsx` is the canonical emerald/red tile; primary `<Button>` is the canonical accent CTA.

**Animations (defined in `src/index.css:135-215`)**

- Entrance: `animate-fade-up`, `animate-fade-in`, `animate-scale-in`.
- Toasts: `animate-slide-up` (`UndoToast`, `ErrorToast`).
- Pulse-on-award: `animate-pulse-green`, `animate-pulse-red`.
- Stagger entrance children with inline `[animation-delay:80ms]` / `[animation-delay:160ms]` (see `TeacherDashboard.tsx:127, 150`, `AuthPage.tsx:53`).
- `.dot-grid` utility (`index.css:218-222`) — editorial dotted background; current callers `AuthPage.tsx:15`, `TeacherDashboard.tsx:85`.

**Auth boot — graceful stale-JWT degrade (`src/contexts/AuthContext.tsx`)**

- On boot the provider reads the cached session via `supabase.auth.getSession()`, then validates against the server with `supabase.auth.getUser()`. On any validateError (network, 401, refresh-token rejected), it calls `supabase.auth.signOut({ scope: 'local' })` and then iterates `localStorage`, removing every `sb-*` key, and clears local React state — routing the app to the login screen rather than letting the GoTrueClient's auto-refresh loop forever (`AuthContext.tsx:55-138`).
- A 5-second `setTimeout` + `AbortController` is set up around the validation block; the abort `signal` is **not** currently passed to `supabase.auth.getUser()`, so it functions as scaffolding for a future hard timeout rather than enforcing one today. Treat the stale-JWT branch as "any error → purge `sb-*` and route to login," not "exactly 5 s."
- The provider also gates `queryClient.clear()` on a real user-id transition — first event (`prev === undefined`) and `null → null` no-ops pass through; only `userA → userB` (or explicit `signOut`) clears the cache (`AuthContext.tsx:43, 146-158, 224-232`). Don't clear elsewhere on auth events; you'll race with this.
- **Don't bypass this flow.** New auth surfaces hook into `onAuthStateChange` and trust `loading` / `user` from `useAuth()`.

**Local Supabase lifecycle (`scripts/dev.mjs` + `scripts/lib/supabase-host.mjs`)**

- `npm run dev` is local-by-default. The script:
  1. **Strips fnox-auto-injected `VITE_*` env vars** from the spawned `vite` child process so Vite reads `.env.test` instead of process.env (`dev.mjs:94-101`). The `mise-env-fnox` plugin in `mise.toml` injects them at the shell level — keep the plugin; the strip is local to the child.
  2. Calls `ensureDockerRunning()` — starts OrbStack → Docker Desktop → Colima (in that preference order on macOS) if the daemon is dead, polls up to ~30 s. **Never stops Docker** (shared resource). On Linux, prints a hint to start `dockerd` via systemd rather than starting it itself.
  3. Probes Supabase with `curl -s -o /dev/null -m 2 {url}/auth/v1/health`. **Do NOT use `npx supabase status`** — it exits 0 even when containers are missing (false-positive that previously caused the script to skip a needed start, then fail to clean up on exit; see `supabase-host.mjs:132-155` comment).
  4. Starts the stack on launch if down; stops it on dev exit (signal handlers cover SIGINT/SIGTERM/SIGHUP). If the stack was already up before launch, leaves it alone on exit.
- `shouldManageLocalStack()` decides whether to manage by parsing the URL hostname against `os.networkInterfaces()` + `tailscale ip` — loopback / RFC1918 LAN / Tailscale CGNAT count as local; remote hosts skip lifecycle.
- `npm run dev:hosted` is the explicit `fnox exec -- vite` fallback for hosted-Supabase repro.

**Realtime channel naming — `crypto.randomUUID()`, not `Date.now()`**

- `useRealtimeSubscription.ts:107` derives channel names with `crypto.randomUUID()`. Reason: under React 18 StrictMode dev double-mount, cleanup → remount runs in the same microtask (often the same millisecond), so `Date.now()` collides; `supabase.channel(topic)` returns the EXISTING channel for a matching topic; the second `.on('postgres_changes', …)` on a joining channel throws and brings the React tree down. Per-mount UUID guarantees a fresh channel. **Do not revert.** (Distinct from the deterministic temp-row IDs in `useAwardPoints` — see Framework section; that case wants determinism, this one wants uniqueness.)

**Test-string load-bearing literals**

- `src/test/TeacherDashboard.test.tsx` pins these exact strings — do not rename without updating the test:
  - `"Loading your dashboard..."`, `"Unable to load dashboard"`, `"Welcome to ClassPoints!"`
  - button names: `"Retry"`, regex `/Create Your First Classroom/i`
  - greeting regex `/Welcome back, …!/`
  - bare numerals: `"+105"`, `"3"`, `"+15"`, and the literal `"across 2 classes"`
  - classroom rows must remain `<button>` (selected by `getByRole('button', { name: /Class A/i })`)
- The active Playwright spec (`tests/e2e/example.spec.ts`) only asserts the page title regex `/ClassPoints|Vite|React/i`. Don't shrink or remove `<title>` in `index.html`.
- The `e2e.legacy/` folder is NOT wired into Playwright config — copy is free to change there. Don't import from it in active tests.

**Lucide-react gotcha — pinned `^1.9.0`**

- The codebase prefers the post-rename names (e.g. `SquareCheck` over `CheckSquare`; see `BottomToolbar.tsx:2`).
- Both legacy and new names typically exist as aliases in `1.9.0` — `node_modules/lucide-react/dist/esm/lucide-react.mjs` exports both `CheckSquare` and `SquareCheck` (one points to `square-check-big`, the other to `square-check` — they are different icons that share the legacy/new name pairing). When in doubt about a name OR which icon a name resolves to, grep that file for `as <Name>` rather than guessing — defaults moved between minor versions.

### Critical Don't-Miss Rules

**Security**

- **Service-role Supabase key NEVER ships to the browser.** Only `VITE_SUPABASE_ANON_KEY` is exposed (validated at startup in `src/lib/supabase.ts:7-9`). Service-role key use is confined to **Node-side code only** — `scripts/**` (seeding / verification) AND `tests/support/helpers/supabase-admin.ts` + the E2E specs that import it. **Never reachable from `src/**`or any browser bundle.** Every code review should grep the diff for`service_role`/`SUPABASE_SERVICE_ROLE_KEY`.
- **New tables without RLS policies are a data-leak vector.** Every new table needs RLS enabled + **explicit policies for the operations the app actually performs** (a read-only ledger table needs only SELECT; a write-only audit table only INSERT). A table with RLS enabled but NO matching policy is fully blocked to clients — that's the failure mode of "I forgot to add a policy."
- **The E2E Supabase allow-list in `playwright.config.ts:39-45` is a security boundary**, NOT a lint rule. Substring match on URLs is unsafe — always parse hostnames with `new URL(...).hostname`. `webServer.reuseExistingServer: false` (`:94`) and `dotenv.parse()` env override (`:14-21`) are part of the same boundary; do NOT relax.

**Subscription & memory leaks**

- Every `supabase.channel(...).subscribe()` needs a matching `supabase.removeChannel(channel)` in cleanup. **Prefer `useRealtimeSubscription`** — it owns the channel lifecycle (cleanup, reconnect-detection, status transitions).
- Every `setInterval` / `setTimeout` inside a hook or component needs `clearInterval` / `clearTimeout` in cleanup. **Open issue (`src/components/dashboard/DashboardView.tsx`, audit cluster 4b, deferred):** the 1Hz `setInterval` at `:57-63` HAS proper `clearInterval` cleanup, but two unrelated risks remain: (a) **polling churn** — the `setInterval` runs continuously while the view is mounted, even when no undo is pending, and could be replaced with mutation-driven invalidation; (b) **fire-and-forget `setTimeout(..., 100)` close-handlers** at `:115-117`, `:123-125`, `:133-135` have NO cleanup — if the component unmounts within 100ms of a modal close (rare but possible during navigation races), they call `setUndoableAction` after unmount.
- `useEffect` deps: include referenced functions (and `useCallback` them upstream IF the consumer is a memoized component or the callback is in another deps array — see Framework section for the discipline) or pull them into the effect body. **Silencing `react-hooks/exhaustive-deps` is almost always a bug.**

**State consistency**

- Don't store derived values in `useState`. Compute inline or `useMemo`. (Audit found zero violations of this in current code — keep it that way.)
- Don't call `setState` in the render phase.
- Multiple components reading the same server data MUST go through the same `queryKeys.X` builder — never duplicate `useState([])` in two places for the same resource.

**Database & realtime gotchas**

- `REPLICA IDENTITY FULL` is required for realtime DELETE events. **However, with RLS enabled, Supabase Realtime may still filter `payload.old` to primary-key-only fields** for DELETE events (the row data is filtered by RLS at broadcast time). **Always handle insufficient `payload.old` with a fallback `invalidateQueries(...)`** — the canonical pattern is in `useStudents.ts:157-160`:
  ```ts
  if (oldTransaction.student_id && oldTransaction.points !== undefined) {
    // local decrement using the row data
  } else {
    // Fallback: row data missing → refetch the whole list
    qc.invalidateQueries({ queryKey: listKey });
  }
  ```
  Forgetting `REPLICA IDENTITY FULL` ships a table whose DELETEs always arrive with empty `payload.old`; even with it, RLS-filtered tables may still arrive with PK-only `payload.old` — defend in code.
- Point totals are trigger-maintained (migration `011_add_student_point_totals.sql`). Mutate via `point_transactions`, NOT direct `students.point_total` updates — those are silently overwritten by the next trigger fire.
- `ON DELETE CASCADE` on FKs is the default expectation for owned relationships (classroom → students → transactions). Review each new FK deliberately.

**Workflow gotchas**

- Run commands via npm scripts, not bare `vite` / `tsc` — `build` and `preview` wrap `fnox exec`. `dev` is plain `vite --mode test` against local Supabase (deliberate; do not add `fnox exec --` to it).
- **Project workflow policy on pre-commit failure:** when a pre-commit hook fails, the commit did NOT happen — `--amend` would modify the _previous_ commit (not the failed one) and rewrite that commit's history. The project's policy is: **fix the issue, re-stage, and create a NEW commit.** Do NOT `--amend` after a hook failure (modifies unrelated previous commit). Do NOT `--no-verify` (bypasses lint / typecheck / format gates). This is project policy, not a universal Git rule — codebases that don't run pre-commit hooks the same way may amend freely.
- After `npm run build`, run `npm run check:bundle` to assert NFR4 (zero devtools refs in `dist/`).
- Destructive git ops (`reset --hard`, `push --force`, branch delete) require explicit user approval every time.

**UI gotchas**

- **Tailwind for static styling; inline `style={{...}}` for runtime-computed values** that can't enumerate to classes:
  - DnD transforms (`@dnd-kit`) — `style={{ transform }}`
  - Seating-chart canvas / element geometry (`SeatingChartCanvas.tsx`, `SeatingChartEditor.tsx`) — runtime positions, widths, heights
  - Progress widths (`ErrorToast.tsx:67`, `UndoToast.tsx:65`) — `style={{ width: \`${progress}%\` }}`
  - Avatar / seat dynamic background colors (`StudentPointCard.tsx:130`, `AwardPointsModal.tsx:105`, `ClassSettingsView.tsx:204`, `SeatingChartCanvas.tsx:170`)
  - Z-index in stacked overlays (`MultiAwardModal.tsx:132`)

  Static dimensions, paddings, colors that don't depend on runtime values: use Tailwind classes. The rule is "Tailwind by default; inline only when the value is computed at render time."

- Icons: `lucide-react` only (per Tech Stack section).
- Sounds: route through `SoundProvider` / `useSoundEffects`. Don't `new Audio()` from components.

**Anti-patterns seen in the wild (audit-verified — do NOT clone)**

```ts
// BAD — silently swallow per-item failures and report success
// (verified at AppContext.tsx:408-424, :454-470)
const results = await Promise.all(
  students.map((s) =>
    awardOne(s).catch((e) => {
      console.error(e);
      return null;
    })
  )
);
return results.filter(Boolean); // caller thinks ALL succeeded

// GOOD — surface partial failure to the user
const settled = await Promise.allSettled(students.map(awardOne));
const failed = settled.filter((r) => r.status === 'rejected');
if (failed.length) {
  toast.error(`${failed.length} of ${students.length} students failed`);
}
// Or keep Promise.all + .catch shape but count nulls and surface; either is fine.
// The anti-pattern is the silent filter, not the choice of allSettled vs all+catch.

// BAD — losing error.code at the throw site
// (dominant in current TanStack hooks: 18 sites in cluster #1)
if (error) throw new Error(error.message); // can't `if (e.code === 'PGRST116')` upstream

// GOOD (preferred for new code) — preserves PostgrestError
if (error) throw error; // .code, .details, .hint preserved

// BAD — substring match on Supabase URL
if (url.includes('127.0.0.1')) allow(); // `https://127.0.0.1.evil.com` slips through

// GOOD — hostname parse
new URL(url).hostname === '127.0.0.1';

// BAD — hook after early return (rule-of-hooks violation; crashes when branch flips)
export function Card({ x }: Props) {
  if (!x) return null;
  const { data } = useStudents(classroomId); // CRASH on next render
}

// GOOD — hooks first, returns last
export function Card({ x }: Props) {
  const { data } = useStudents(classroomId);
  if (!x) return null;
  return <div>{data?.length}</div>;
}

// BAD — aggregating transactions client-side for totals
const total = transactions.reduce((s, t) => s + t.points, 0);

// GOOD — read denormalized, trigger-maintained columns
const { pointTotal } = student;

// BAD — useCallback in a non-memo / DOM-element context
// (verified: ClassroomCard.tsx:10, StudentPointCard.tsx:67, :77)
const handleClick = useCallback(() => onSelect(id), [onSelect, id]);
return <button onClick={handleClick}>...</button>; // DOM <button> doesn't memoize

// GOOD — plain function expression
const handleClick = () => onSelect(id);
return <button onClick={handleClick}>...</button>;

// BAD — key={index} on a list whose elements may move/duplicate
{students.map((s, i) => <Row key={i} student={s} />)}

// BAD — key={name} for student names (DB does not enforce uniqueness; siblings exist)
{students.map((s) => <Row key={s.name} student={s} />)}

// GOOD
{students.map((s) => <Row key={s.id} student={s} />)}

// BAD — cloning legacy hook shape in new code
export function useFoos() {
  const [data, setData] = useState<Foo[]>([]);
  const [loading, setLoading] = useState(true);
  // … hand-rolled fetch + realtime merge + refetch
  return { foos: data, loading, refetch };
}

// GOOD — thin TanStack wrapper with registered query key (clone useBehaviors.ts)
export function useFoos(scope: string) {
  return useQuery({
    queryKey: queryKeys.foos.byScope(scope),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('foos')
        .select('*')
        .eq('scope', scope);
      if (error) throw error; // preferred for new code (preserves .code)
      return (data ?? []).map(transformFoo);
    },
  });
}

// BAD — useSeatingChart returns 23 values; useLayoutPresets also has legacy data/loading/refetch shape.
// Do NOT use either as a template.
return {
  chart, loading, error, createChart, updateSettings, deleteChart, addGroup,
  /* …17 more, including refetch which signals legacy shape */
};

// GOOD — group by concern when the next big hook is reshaped
return {
  data: { chart, unassignedStudents },
  ops: { createChart, addGroup, /* … */ },
  computed: { /* … */ },
};

// BAD — inline query key (drift between read and invalidate)
useQuery({ queryKey: ['students', classroomId], queryFn: ... });
qc.invalidateQueries({ queryKey: ['student', classroomId] }); // typo: 'student' vs 'students' — silent

// GOOD — registered builder
useQuery({ queryKey: queryKeys.students.byClassroom(classroomId), queryFn: ... });
qc.invalidateQueries({ queryKey: queryKeys.students.byClassroom(classroomId) });

// BAD — adding a wrapper to AppContext that mirrors an existing one
// (Migration Status section: this is migration debt, not a pattern)
function AppProvider() {
  const { mutateAsync: customAward } = useCustomAward();
  return <AppContext.Provider value={{ ...existing, customAward }}>...</AppContext.Provider>;
}

// GOOD — call the hook directly from the component
function MyNewComponent() {
  const customAward = useCustomAward();
  // ...
}
```

**Edge cases agents commonly miss**

- **`onError` context narrowing:** `if (context?.previousX !== undefined)`, NOT `if (context?.previousX)` — see Language section. The latter wipes the cache when prior data was legitimately empty.
- **Cross-device undo time-totals:** the `point_transactions` realtime DELETE branch in `useStudents.ts:111-162` is the propagation path; it requires `REPLICA IDENTITY FULL` AND defends against RLS-filtered `payload.old` with a fallback `invalidateQueries`.
- **Time-totals preservation across UPDATE:** `useStudents.ts:67-92` deliberately does NOT refetch the RPC on every UPDATE — the DB trigger bumps lifetime totals on every point award; refetching per-event would re-fire `get_student_time_totals` per tap. Time totals refresh via DELETE realtime + visibilitychange + mutation `onSettled` instead.
- **`AwardPoints` deterministic temp-row ID:** `` `optimistic-${studentId}-${behaviorId}-${timestamp}` `` (NOT `crypto.randomUUID()`). The reason is general idempotency: any duplicate `onMutate` invocation for the same input must produce the same temp ID so the patch dedup guard (`useTransactions.ts:138`) can detect it. Sources of duplicate invocation include: (a) double-clicks racing the optimistic update, (b) `mutate()` called inside a `useEffect` that StrictMode double-invokes in dev, (c) explicit re-submits. Note: React StrictMode double-runs render / effects / ref callbacks but NOT event handlers — so a `mutate()` from a button `onClick` fires `onMutate` once. The dedup guard is defense-in-depth across all duplicate-invocation paths, not specifically a StrictMode workaround. (ADR-005 §4(c) cites StrictMode but the rationale generalizes.)
- **`useApp()` is migration debt for server data:** access `students`, `classrooms`, `transactions`, `behaviors` via direct hook calls in new components (see Framework / Migration Status sections).

---

## Usage Guidelines

**For AI Agents**

- Read this file before implementing code in `src/**` or `supabase/migrations/**`.
- Before clicking "this is the project's pattern" off a single example: cross-check against `_bmad-output/anti-pattern-audit.md` — the audit tags REAL / OVERSTATED / FALSE POSITIVE so you don't re-raise rejected concerns.
- `useSeatingChart`, `useLayoutPresets`, `AppContext` legacy wrappers, and the legacy `useRealtimeSubscription` callback shape are migration targets — don't imitate them. The canonical templates are `useBehaviors.ts` (thin query), `useTransactions.ts:useAwardPoints` (optimistic mutation), and `useStudents.ts` (realtime + cache merge).
- Prefer the more restrictive option when in doubt.
- If you encounter a pattern that contradicts this file, surface the conflict — don't silently break from the docs.
- When this file's claims feel stale (HEAD has moved, file:line refs don't match), treat it as a snapshot and verify against the current code before acting on a specific rule. The Migration Status section's commit list (`1b0decb` → `613a010` → ...) is the staleness check.

**For Humans**

- Keep this file lean — it goes into every agent's context. Don't duplicate `CLAUDE.md` / `AGENTS.md` / `.claude/rules/*`; link.
- Update when the migration phase advances or architectural decisions change. When `useSeatingChart` is reshaped and the `AppContext` wrappers dissolve, flip the migration-status section accordingly.
- Update the HEAD commit ref + recent-commits list at the top of "Migration Status (READ FIRST)" whenever you regenerate the file, so the staleness check stays useful.
- Remove rules that become enforceable by tooling (e.g., when `unwrap()` lands and ESLint enforces it, the planned-fix paragraph collapses to one line).
- Re-run the audit (`_bmad-output/anti-pattern-audit.md`) periodically to catch new clusters; cite verdicts (REAL / OVERSTATED / FALSE POSITIVE) in this file rather than re-litigating.

_Last updated: 2026-04-27_
