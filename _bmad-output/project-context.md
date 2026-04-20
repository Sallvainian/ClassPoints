---
project_name: 'ClassPoints'
user_name: 'Sallvain'
date: '2026-04-20'
sections_completed: ['technology_stack', 'language_rules']
existing_patterns_found: 'in-progress'
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Runtime & framework**

- React 18.3.1 + React DOM 18.3.1 (JSX runtime: `react-jsx`)
- TypeScript ~5.9.3 — `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `moduleResolution: "bundler"`, `target: ES2020`
- Vite 6.0.5 (ESM; root `package.json` is `"type": "module"`)

**Backend & data**

- Supabase JS 2.90.1 (Auth + Postgres + Realtime). Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Client must be typed: `createClient<Database>(...)` — `Database` from `src/types/database.ts`
- Secrets managed via **Doppler** (migrated away from dotenvx — do not re-introduce `.env` tooling)

**UI**

- Tailwind CSS 4.1.17 via `@tailwindcss/postcss` 4.1.18 (PostCSS 8.5.6, Autoprefixer 10.4.23). Prefer Tailwind classes — no inline styles
- `@dnd-kit/core` 6.3.1 + `@dnd-kit/utilities` 3.2.2 for the seating chart
- `uuid` 13.0.0

**Testing**

- Vitest 4.0.17 + jsdom 27.4.0 (`npm test` runs in watch mode)
- React Testing Library 16.3.2 + `@testing-library/jest-dom` 6.9.1 + `user-event` 14.6.1
- Playwright 1.57.0 — E2E requires `TEST_EMAIL`/`TEST_PASSWORD`
- `tdd-guard-vitest` 0.1.6 is wired in — tests must conform to TDD-guard expectations

**Lint / format / hooks**

- ESLint 9.39.2 (flat config) + `typescript-eslint` 8.53.0 + `eslint-plugin-react-hooks` 5.0.0 + `eslint-plugin-react-refresh` 0.4.26
- Prettier 3.8.0
- `simple-git-hooks` 2.13.1 pre-commit: `lint-staged` + `npm run typecheck` — never bypass with `--no-verify`

**Build & scripts**

- Build: `tsc -b && vite build` (project references: `tsconfig.app.json`, `tsconfig.node.json`)
- Scripts: `tsx` 4.21.0 (used by `scripts/migrate-data.ts`)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Strictness (enforced by `tsconfig.app.json`)**

- Strict mode enabled — **no `any` types without explicit approval** (prefer `unknown` + narrowing)
- `noUnusedLocals` + `noUnusedParameters` — delete unused args/imports; don't leave `_`-prefixed placeholders or "reserved for later" stubs
- `noUncheckedSideEffectImports` — no orphan side-effect imports
- `isolatedModules` + `moduleDetection: force` — every `.ts`/`.tsx` needs at least one `import`/`export`. Use `export type` for type-only re-exports
- `allowImportingTsExtensions: true`, but omit `.ts`/`.tsx` in import specifiers (Vite resolves)

**Imports / exports**

- ESM only (package is `"type": "module"`). No `require`, no CommonJS
- Import the Supabase client from the shared module — never call `createClient` inside a feature file
- Prefer importing from the source file (`./useStudents`) over barrel re-exports. The existing `src/hooks/index.ts` barrel is legacy — don't add new barrels; leaves are fine to import directly (avoids Vite tree-shake and circular-import pitfalls)
- Named exports are the default; `export default` is allowed where it reads better (e.g., single-component files) — no blanket ban

**Types**

- Use the Supabase-generated `Database` types (`src/types/database.ts`) directly wherever practical. A dedicated `transformDbX → X` boundary is only warranted when the UI genuinely needs a shape the DB row doesn't give (computed fields, joined summaries)
- When you do keep a domain type, name the DB variant `DbFoo` and the app variant `Foo`; do the conversion once at the fetch site, not per-component
- Always type `useState` when inference is weak: `useState<Student | null>(null)`, `useState<Error | null>(null)`
- Hook return types: let inference work. Only add an explicit `UseFooReturn` interface when the hook is exported as a stable public contract or the return shape is genuinely unclear from the implementation

**Error handling**

- Supabase calls: destructure `{ data, error }` and check `error` **first**. Throw `new Error(error.message)` rather than returning partial results
- Never assume `data` is non-null without checking `error`
- Don't swallow errors — surface via `setError(...)` on hook state; log once at the originating call site

**Async**

- `async/await` only — no raw `.then()` chains in components/hooks
- Cancel-aware effects when state is set after an `await`: `let cancelled = false; return () => { cancelled = true; };`

**Don't add**

- No runtime validation (Zod, etc.) inside trusted internal code — rely on the typed Supabase client. Validate only at external boundaries (user input, third-party responses)
