---
project_name: ClassPoints
user_name: Sallvain
date: 2026-04-29
sections_completed:
  [
    'migration_status',
    'technology_stack',
    'language_rules',
    'framework_rules',
    'supabase_rules',
    'testing_rules',
    'code_quality_rules',
    'development_workflow_rules',
    'critical_dont_miss',
    'ui_design_system_rules',
  ]
existing_patterns_found: 13
status: 'complete'
rule_count: 164
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns AI agents must follow when implementing code in this project. Focus on unobvious details. Complement — do not duplicate — `CLAUDE.md`, `AGENTS.md`, and `.claude/rules/*`._

---

## Migration Status (READ FIRST)

**Snapshot taken at HEAD `201c4ae` on branch `redesign/editorial-engineering` (2026-04-29).** If `git log --oneline -5` no longer matches the recent commit list (`201c4ae` → `52fb563` → `4126a49` → `1cca167` → `3057ade`), treat this section as stale and re-derive phase status from `_bmad-output/planning-artifacts/prd.md`, `docs/architecture.md`, and the actual hook code before trusting the claims below.

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
- `docs/adr/ADR-005-queryclient-defaults.md` — QueryClient defaults, adapter error contract, devtools DCE pattern, Phase 2 optimistic mutation AC, and realtime scope policy remain authoritative in this snapshot. **When ADR-006 lands** (user-scoped query keys, tracked in PRD), re-read §1 here because user-scoped keys change cache reset semantics.
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

**Current snapshot:** HEAD `201c4ae` on branch `redesign/editorial-engineering` (2026-04-29). Re-check this section if HEAD moves.

**Runtime / Build**

- React 18.3.1 + React DOM 18.3.1. Use React 18 features only; do not use React 19 APIs.
- TypeScript 5.9.3 with strict mode, `moduleResolution: "bundler"`, `isolatedModules`, `moduleDetection: "force"`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `noUncheckedSideEffectImports`.
- Vite 6.4.2 with `@vitejs/plugin-react` 4.7.0 and `base: "/ClassPoints/"`.

**Backend / Data**

- `@supabase/supabase-js` 2.104.1. Browser code talks directly to Supabase; there is no app server.
- Supabase CLI 2.95.0 for the local stack.
- PostgreSQL + RLS are the authorization boundary.
- `@tanstack/react-query` 5.100.1 is the server-state target for migrated hooks.
- `@tanstack/react-query-devtools` 5.100.1 is dev-only and must stay out of production bundles.

**UI**

- Tailwind CSS 4.2.4 via `@tailwindcss/postcss` 4.2.4. Use Tailwind v4 syntax only.
- `@dnd-kit/core` 6.3.1 and `@dnd-kit/utilities` 3.2.2 for seating-chart drag/drop.
- `lucide-react` 1.9.0 is the only icon library for new UI.
- `uuid` 14.0.0 is pinned through `package.json` overrides; do not downgrade/remove the override.

**Testing**

- Vitest 4.1.5 + jsdom 27.4.0 for unit tests.
- Playwright 1.59.1 for Chromium E2E.
- `@seontechnologies/playwright-utils` 4.3.0 provides E2E fixture helpers.
- `tdd-guard-vitest` 0.2.0 is installed but not wired into `vitest.config.ts`.

**Lint / Format**

- ESLint 9.39.2 flat config only.
- `typescript-eslint` 8.59.0, `eslint-plugin-react-hooks` 5.2.0, `eslint-plugin-react-refresh` 0.5.2.
- Prettier 3.8.3 with semicolons, single quotes, 2-space tabs, trailing commas, and 100-column print width.
- `simple-git-hooks` 2.13.1 + `lint-staged` 16.4.0 run formatting/lint/typecheck on commit.

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- Strict TypeScript is enforced. Delete unused imports, locals, and params instead of prefixing regular unused values with `_`.
- `_data`, `_err`, and similar names are acceptable only when preserving callback parameter positions, especially TanStack callback signatures.
- Relative imports are the project norm. There is no `@/` alias in `tsconfig*.json` or `vite.config.ts`.
- Use `import type` / `export type` for type-only exports. Do not value-export type-only declarations under `isolatedModules`.
- Components should use named exports. `App.tsx` is the tolerated default-export exception.
- Browser code under `src/**` uses `import.meta.env.VITE_*`; Node-side scripts/tests/config use `process.env`. Never read `process.env` from browser code.
- Supabase DB types are snake_case in `src/types/database.ts`; app types are camelCase in `src/types/index.ts`. Convert at query boundaries, not in components.
- When adding a DB column: add a migration, update `DbX`/`NewX`/`UpdateX`, update app-facing types if needed, update transforms, and verify explicit `.select(...)` lists.
- Prefer `throw error` for new Supabase query/mutation code when callers may need `error.code`, `details`, or `hint`. Existing `new Error(error.message)` sites are migration debt.
- Do not add new unguarded `as T` casts at Supabase or JSONB boundaries. Use typed Supabase results first; use runtime validation for untyped payloads.
- `as unknown as` is acceptable only for the known Supabase realtime typing workaround and practical test mocks.

### Framework-Specific Rules (React)

**Treat the current architecture as transitional, not ideal.** The app is mid-TanStack migration: server data is moving out of `AppContext` into direct query/mutation hooks, while `AppContext` remains as an adapter for legacy consumers. Do not copy transitional seams as new patterns.

- Provider order is dependency-driven: `QueryClientProvider` wraps everything; `AuthProvider` and `AuthGuard` gate the app; `SoundProvider` stays below auth because it reads `useAuth()`; `AppProvider` stays below the auth gate; `DevtoolsGate` is a sibling of `<App />` inside `QueryClientProvider`.
- Server state from Supabase belongs in TanStack Query hooks using `queryKeys`. UI/session state stays local or in `AppContext` when it is truly cross-cutting.
- New components should call query/mutation hooks directly. Do not add new server-data fields or wrapper functions to `AppContext`.
- `useLayoutPresets` and `useSeatingChart` are still hand-rolled `useState`/`useEffect` hooks. They are migration targets, not templates.
- `useBehaviors`, `useStudents`, and `useTransactions.useAwardPoints` are the current hook templates for thin queries, realtime cache merge, and optimistic mutation.
- Hooks run before conditional returns. Keep hook order stable, then define handlers, then return early if needed.
- Default event handlers to plain functions. Use `useCallback` only for memoized child props or dependency arrays; DOM elements do not benefit from callback identity stability.
- Use shared UI primitives (`Button`, `Input`, `Modal`, `Dialog`) and Tailwind v4 utilities. Do not hand-roll modal chrome for new UI.
- Use `lucide-react` for new icons and route sounds through `SoundProvider` / `useSoundEffects`; do not instantiate `new Audio()` in components.
- Keep lazy loading at the top-level view boundary. Bridge named exports with `.then((m) => ({ default: m.View }))` when using `React.lazy()`.

**Known transition zones to avoid copying:** `AppContext` wrappers, `useLayoutPresets`, `useSeatingChart`, legacy realtime callbacks, `SoundSettingsModal` chrome, and any component still reading migrated server data through `useApp()`.

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

**Three layers, three runners**

| Layer               | Location                         | Runner              | Boundary                                     |
| ------------------- | -------------------------------- | ------------------- | -------------------------------------------- |
| Unit                | `src/**/*.test.{ts,tsx}`         | Vitest 4 + jsdom    | Mock Supabase; no real network               |
| Backend integration | `tests/integration/**/*.test.ts` | Vitest 4 + node     | Real local Supabase via service-role helpers |
| E2E                 | `tests/e2e/**/*.spec.ts`         | Playwright Chromium | Browser + Vite + real local Supabase         |

- Unit tests live under `src/test/`, co-located `__tests__/`, and `src/contexts/*.test.tsx`. Use the location nearest the SUT.
- Unit tests mock Supabase at the module boundary and use fresh test-local `QueryClient` instances with retries disabled. Do not mock TanStack Query itself.
- Backend integration tests and E2E tests are local-Supabase only. `vitest.integration.config.ts` and `playwright.config.ts` parse `new URL(...).hostname` and refuse hosted/public hosts. Do not weaken this guard or replace it with substring matching.
- E2E specs import `test`/`expect` from `tests/support/fixtures`, not directly from Playwright, so the merged `playwright-utils` fixtures stay consistent.
- Shared `.auth/user.json` means parallel E2E specs use the same test user. Mutating specs must namespace data with helpers like `uniqueSlug()` and clean up through fixtures or `afterEach`/`afterAll`.
- Do not add arbitrary sleeps. Use Playwright locators/expectations, Testing Library `findBy*`/`waitFor`, or `recurse` for polling eventual consistency.
- `tdd-guard-vitest` is installed but not wired into `vitest.config.ts`; treat it as latent tooling until a PR adds reporters and a gate.
- Current CI is split: `.github/workflows/test.yml` runs lint, typecheck, bundle check, sharded E2E, and E2E burn-in; `.github/workflows/deploy.yml` also runs `npm run test -- --run` before Pages build.
- No coverage threshold is enforced today. Add focused tests based on risk, not a numeric target.

### Code Quality, Style & Organization

- Keep feature work inside the existing folder structure. Do not invent parallel `features/`, `modules/`, or alias-based import hierarchies.
- Components use PascalCase filenames and named exports. Hooks use `use*` names and live in `src/hooks/`; utilities stay in `src/utils/`; shared infra stays in `src/lib/`.
- Do not add new component-folder barrels. Existing component `index.ts` files are historical; the intentional barrel is `src/hooks/index.ts`.
- Shared UI should use `src/components/ui` primitives. New modals use `Modal` or `Dialog`; do not hand-roll modal chrome.
- Static styling uses Tailwind v4 utilities. Inline styles are for runtime-computed values only, such as DnD transforms, geometry, progress widths, avatar colors, and z-index.
- Use stable React keys. Never use `key={index}` for reorderable lists, and never use `key={name}` for students because names are not unique.
- Define constants for storage keys and magic strings. Do not repeat literals like the current `ThemeContext` `'theme'` cleanup target.
- Comments should explain non-obvious constraints or invariants, not restate code. Delete or fix comments that no longer match behavior.
- Run Prettier on modified files before committing. Pre-commit runs lint-staged plus `npm run typecheck`; do not bypass it.
- Treat audit-tagged dead/legacy code as cleanup candidates when touched, not as new-code templates.

### Development Workflow Rules

- Use npm scripts as the command boundary. Do not run bare `vite`, `tsc`, or Playwright commands unless a script cannot express the needed target.
- `npm run dev` and `npm run dev:host` are local-by-default through `scripts/dev.mjs`; do not add `fnox exec --` to them.
- `npm run dev:hosted`, `npm run build`, `npm run preview`, and `npm run migrate` intentionally use `fnox exec --` for hosted credentials.
- E2E and backend integration work must use `.env.test` and a local/private Supabase URL. Hosted Supabase is not a test target.
- After `npm run build`, run `npm run check:bundle` when production bundle contents matter; it is the devtools-leak guard.
- Before committing, run the project formatter on modified files. The pre-commit hook also runs lint-staged and `npm run typecheck`.
- If a pre-commit hook fails, fix the issue, re-stage, and create a new commit. Do not `--amend` the previous commit and do not bypass with `--no-verify`.
- Migration files use the next zero-padded number in `supabase/migrations/`; current last migration is `011_add_student_point_totals.sql`.
- Destructive git operations require explicit user approval.
- Generated context/docs must be verified against current repo files before becoming authoritative.

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

- Treat the AppContext/TanStack split as transitional architecture. Do not normalize it by adding more server-data wrappers or new `useApp()` server-data consumers.
- Finish migration work by shrinking transitional surfaces: `useLayoutPresets`, `useSeatingChart`, AppContext wrappers, legacy realtime callbacks, inconsistent Supabase error handling, and unvalidated JSONB/realtime casts.
- Service-role Supabase keys are Node-side only: scripts, integration/E2E helpers, and test support. They must never be imported or exposed from `src/**`.
- New tables must enable RLS and ship explicit policies in the same migration. RLS without policies blocks clients; no RLS leaks data.
- Realtime DELETE payloads require `REPLICA IDENTITY FULL`, but code must still handle insufficient `payload.old` with invalidation fallback because RLS can filter payloads.
- Point totals are trigger-maintained. Do not compute display totals from transactions or write `students.point_total` directly from app code.
- React Query Devtools must never appear in production bundles. Keep the gated dynamic import pattern and run `npm run check:bundle` after production builds.
- Supabase URL safety checks must parse hostnames with `new URL(...).hostname`; substring checks are security bugs.
- Avoid silent partial failure. Batch operations may use `Promise.allSettled` or `Promise.all` plus per-item catch, but the UI must surface failures.
- Avoid arbitrary waits in tests. Existing waits are debt, not precedent.

---

## Usage Guidelines

**For AI Agents**

- Read this file before implementing code in `src/**` or `supabase/migrations/**`.
- Before clicking "this is the project's pattern" off a single example: cross-check against `_bmad-output/anti-pattern-audit.md` — the audit tags REAL / OVERSTATED / FALSE POSITIVE so you don't re-raise rejected concerns.
- `useSeatingChart`, `useLayoutPresets`, `AppContext` legacy wrappers, and the legacy `useRealtimeSubscription` callback shape are migration targets — don't imitate them. The canonical templates are `useBehaviors.ts` (thin query), `useTransactions.ts:useAwardPoints` (optimistic mutation), and `useStudents.ts` (realtime + cache merge).
- Prefer the more restrictive option when in doubt.
- If you encounter a pattern that contradicts this file, surface the conflict — don't silently break from the docs.
- When this file's claims feel stale (HEAD has moved, file:line refs don't match), treat it as a snapshot and verify against the current code before acting on a specific rule. The Migration Status section's commit list (`201c4ae` → `52fb563` → `4126a49` → `1cca167` → `3057ade`) is the staleness check.

**For Humans**

- Keep this file lean — it goes into every agent's context. Don't duplicate `CLAUDE.md` / `AGENTS.md` / `.claude/rules/*`; link.
- Update when the migration phase advances or architectural decisions change. When `useSeatingChart` is reshaped and the `AppContext` wrappers dissolve, flip the migration-status section accordingly.
- Update the HEAD commit ref + recent-commits list at the top of "Migration Status (READ FIRST)" whenever you regenerate the file, so the staleness check stays useful.
- Remove rules that become enforceable by tooling (e.g., when `unwrap()` lands and ESLint enforces it, the planned-fix paragraph collapses to one line).
- Re-run the audit (`_bmad-output/anti-pattern-audit.md`) periodically to catch new clusters; cite verdicts (REAL / OVERSTATED / FALSE POSITIVE) in this file rather than re-litigating.

_Last updated: 2026-04-29_
