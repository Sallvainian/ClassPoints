---
title: 'TanStack Query migration — Phase 0 bootstrap + Phase 1 pilot (`useBehaviors`)'
type: 'refactor'
created: '2026-04-22'
status: 'done'
baseline_commit: '3860463'
context:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Server-state hooks are hand-rolled (`useState(data)/useState(loading)/useState(error)` + manual optimistic rollback + unneeded realtime), violating the modernization PRD. `useBehaviors` is the smallest — the PRD-designated pilot. No TanStack Query infra exists yet, so Phase 0 and Phase 1 are bundled in this deliverable.

**Approach:** Phase 0 — install `@tanstack/react-query` + devtools, add `queryClient.ts` / `queryKeys.ts` singletons, wrap `<App />` with `QueryClientProvider` (devtools dev-gated per NFR4). Phase 1 — extend `useRealtimeSubscription` with an `onChange` deprecation bridge (Decision 3), rewrite `useBehaviors` as `useQuery` + three split `useMutation` hooks (non-optimistic — matches current runtime and avoids violating arch invariant #5; full `onMutate`/`onError` optimism lands in Phase 2 where it matters), drop the behaviors realtime subscription (FR9), and add an `AppContext` adapter so `useApp().behaviors` / `addBehavior` / `updateBehavior` / `deleteBehavior` / `refetchBehaviors` keep their current shape (PRD Risk 3). Zero component edits.

## Boundaries & Constraints

**Always:**

- All new code follows arch doc canonical templates (§QueryClient topology, §Query key conventions, §useMutation lifecycle, §useRealtimeSubscription). No deviation without updating arch.md first.
- `queryKey`s at call sites come from `queryKeys.*` builders only — never inline tuples.
- DB→App transforms live in `src/types/transforms.ts`; called inside `queryFn` only (FR22).
- `@tanstack/react-query-devtools` is a **devDependency**; mount is gated by `import.meta.env.DEV` (NFR4).
- `useBehaviors` post-migration contains zero `useState(loading|error|behaviors)`, zero `const previous =`, and zero realtime subscription.
- `AppContext` adapter produces reference-stable `behaviors` array via `useMemo` keyed on `behaviorsQuery.data` — relies on default `structuralSharing: true`.
- `useApp()` behaviors surface preserves existing consumer contract (5 components: BehaviorPicker via 3 modals + settings + migration wizard).
- Pre-commit hook (lint-staged + typecheck) must not be bypassed.

**Ask First:**

- Any observed runtime behavior change in the 5 consumer components beyond "identical" during manual smoke.
- Any grep-verified invariant from Phase 0/1 acceptance that cannot be achieved with the planned changes (would trigger arch.md amendment).

**Never:**

- No Phase 2/3/4/5/6 work. Do not touch `useClassrooms`, `useStudents`, `useTransactions`, `useLayoutPresets`, `useSeatingChart`, or the 45 component files that consume data via `useApp()`.
- No `queryClient.clear()` on logout — deferred to Phase 4 (arch cross-cutting notes).
- No schema/migration/RLS changes. No component edits. No Zustand. No new libraries beyond the two TanStack packages.
- No `process.env` in `src/**`; no `.amend`; no `--no-verify`.
- Do not weaken Playwright local-Supabase allow-list.

## I/O & Edge-Case Matrix

| Scenario                  | Input / State                                   | Expected Output / Behavior                                                                                                     | Error Handling                                                                            |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Fresh load                | User logs in, opens any modal showing behaviors | `useQuery` fetches once; sorted behaviors render (positive then negative, by points desc)                                      | Supabase error → `new Error(msg)` thrown in `queryFn`; `useApp().error` surfaces non-null |
| Add behavior              | User submits new behavior from settings         | `mutationFn` awaits Supabase insert; `onSettled` invalidates → refetch lands new row (non-optimistic; matches current runtime) | Server rejects → mutation throws; adapter `catch` returns `null` (legacy contract)        |
| Update behavior           | Edit existing behavior                          | `mutationFn` awaits update; `onSettled` invalidates                                                                            | Rejected → mutation throws; adapter resolves `void` (legacy swallow)                      |
| Delete behavior           | Delete behavior from settings                   | `mutationFn` awaits delete; `onSettled` invalidates                                                                            | Rejected → mutation throws; adapter resolves `void`                                       |
| `resetBehaviorsToDefault` | Admin resets to seed list                       | Existing direct-supabase delete+insert runs unchanged, then `behaviorsQuery.refetch()` reloads cache                           | Error bubbles as before (existing `throw new Error(...)`)                                 |
| Two tabs                  | Tab A adds behavior                             | Tab B shows the new behavior within one `refetchOnWindowFocus` cycle (no realtime)                                             | N/A                                                                                       |
| Hook unmount (NFR6)       | `useRealtimeSubscription` caller unmounts       | `supabase.removeChannel` called with the same channel instance                                                                 | N/A                                                                                       |

</frozen-after-approval>

## Code Map

- `package.json` -- add `@tanstack/react-query` (runtime) + `@tanstack/react-query-devtools` (dev)
- `src/lib/queryClient.ts` -- NEW. `QueryClient` singleton; defaults per arch §QueryClient topology
- `src/lib/queryKeys.ts` -- NEW. Full typed builder map per arch §Query key conventions (all domains; only behaviors used this phase)
- `src/types/transforms.ts` -- NEW. `dbToBehavior` only (other transforms land in future phases)
- `src/main.tsx` -- wrap `<App />` in `<QueryClientProvider>`; dev-gated `<ReactQueryDevtools />`
- `src/hooks/useRealtimeSubscription.ts` -- add `onChange` field + dual-dispatch + dev warning on overlap (Decision 3 transitional signature)
- `src/hooks/__tests__/useRealtimeSubscription.test.ts` -- add NFR6 mount/unmount test; `onChange` precedence test
- `src/hooks/useBehaviors.ts` -- rewrite as `useQuery` + exported `useAddBehavior` / `useUpdateBehavior` / `useDeleteBehavior` mutations; drop realtime; keep `sortBehaviors`
- `src/contexts/AppContext.tsx` -- replace current `useBehaviors()` destructure with adapter block (query + three mutations + `useMemo` + `useCallback` wrappers); preserve `AppContextValue` fields

## Tasks & Acceptance

**Execution:**

- [x] `package.json` -- `npm install @tanstack/react-query && npm install -D @tanstack/react-query-devtools` -- arch §Devtools mount wiring
- [x] `src/lib/queryClient.ts` -- create singleton with full `defaultOptions` block verbatim from arch §QueryClient topology -- enforces `structuralSharing: true` load-bearing for adapter
- [x] `src/lib/queryKeys.ts` -- create full typed builder (all six domains) verbatim from arch §Query key conventions -- single source of truth; greppable invariant #3, #4
- [x] `src/types/transforms.ts` -- create file with `dbToBehavior` only; follow Phase 1 stub block from arch §Type boundary -- enables hook-boundary transform (FR22, greppable invariant #7)
- [x] `src/main.tsx` -- wrap `<App />` in `<QueryClientProvider>`; mount `{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}` -- NFR4, Decision 4 primary mechanism
- [x] `src/hooks/useRealtimeSubscription.ts` -- add `onChange?: (payload: RealtimePostgresChangesPayload<T>) => void` to options; internal routing (if `onChange`: dispatch all events; else legacy fan-out); dev-mode `console.warn` if `onChange` + any legacy callback both supplied -- Decision 3 Phase-1 transitional signature
- [x] `src/hooks/__tests__/useRealtimeSubscription.test.ts` -- add `it('should removeChannel on unmount with the same channel instance')` (NFR6) and `it('should route all events to onChange when provided, ignoring legacy callbacks')` -- NFR6 verification, `onChange` precedence guard
- [x] `src/hooks/useBehaviors.ts` -- rewrite: `useBehaviors()` returns `useQuery({ queryKey: queryKeys.behaviors.all, queryFn: fetch+sort+transform })`; export `useAddBehavior` / `useUpdateBehavior` / `useDeleteBehavior` each as `useMutation({ mutationFn, onSettled: invalidate(queryKeys.behaviors.all) })` — **non-optimistic** (matches current runtime; avoids `const previous =` which would violate arch invariant #5); no realtime subscription -- FR1, FR9, greppable invariants #5, #6, #7
- [x] `src/contexts/AppContext.tsx` -- replace `useBehaviors()` destructure with adapter: call `useBehaviors()` + three mutation hooks; `const behaviors = useMemo(() => query.data ?? [], [query.data])` (query already returns app-shape `Behavior[]` post-transform inside `queryFn`); `behaviorsLoading = query.isPending`; `behaviorsError = query.error`; `addBehavior / updateBehavior / deleteBehavior` = `useCallback` wrappers around `mutation.mutateAsync` preserving `Promise<X | null>` + `Promise<void>` legacy return contracts (null/void on error per current file); `refetchBehaviors = query.refetch` -- PRD Risk 3 adapter bridge; zero component edits

**Acceptance Criteria:**

- Given `npm run build`, when it completes, then `rg 'tanstack/react-query-devtools' dist/` and `rg 'ReactQueryDevtools' dist/` both return 0 matches (NFR4, arch invariants #1, #2).
- Given `src/`, when `rg "queryKey:\s*\[" src/ --glob '!src/lib/queryKeys.ts'` runs, then 0 matches (invariant #3).
- Given `src/`, when `rg "invalidateQueries\(\{\s*queryKey:\s*\[" src/` runs, then 0 matches (invariant #4).
- Given `src/hooks/useBehaviors.ts`, when `rg "useState.*loading|useState.*error\b|const previous\s*=" <file>` runs, then 0 matches (invariants #5, #6).
- Given `src/hooks/useBehaviors.ts`, when `rg "useRealtimeSubscription|supabase\.channel\(" <file>` runs, then 0 matches (FR9 — behaviors realtime removed).
- Given `src/hooks/useBehaviors.ts`, when `rg "from '\.\./types/transforms'" <file>` runs, then exactly 1 match (invariant #7).
- Given the logged-in app, when user opens BehaviorPicker (via AwardPointsModal / ClassAwardModal / MultiAwardModal) and creates / edits / deletes a behavior, then UI behaves identically to pre-migration (zero visible diff).
- Given two open tabs, when Tab A adds a behavior, then Tab B shows it after next window-focus refetch (no realtime required).
- Given all existing tests, when `npm run lint && npm run typecheck && npm test` runs, then all pass unchanged; plus the two new `useRealtimeSubscription` tests pass.

## Design Notes

**Adapter — `useApp().behaviors` shape change (invisible):** Adapter applies `dbToBehavior`, converting `is_custom` → `isCustom` and `created_at: string` → `createdAt: number`. `AppContextValue.behaviors: AppBehavior[]` has always declared the camelCase shape; the current code type-puns because no consumer reads those two fields (verified: `BehaviorPicker` and settings touch only `id/name/points/icon/category`). Post-Phase-1 the declared type and runtime shape finally align. If any consumer surfaces `isCustom` / `createdAt` during smoke, treat as a regression signal.

**Non-optimistic mutations — deliberate scope call.** The current `useBehaviors` is not optimistic (each mutation awaits Supabase, then syncs local state). Post-migration mirrors that: `{ mutationFn, onSettled: invalidate }`. This (a) preserves current runtime exactly, (b) satisfies arch invariant #5 (`rg "const previous\s*=" src/hooks/useBehaviors.ts` → 0) which the canonical optimistic template from arch §useMutation lifecycle would violate by definition, and (c) avoids solving server-generated-id temp-row reconciliation — an avoidable complexity for a domain where mutations are rare (settings edits). Phase 2 `useTransactions` is the canonical demonstration site for the full optimistic pattern where latency matters (point award).

**`useBehaviors` new shape — golden example:**

```ts
export function useBehaviors(): UseQueryResult<Behavior[]> {
  return useQuery({
    queryKey: queryKeys.behaviors.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('behaviors').select('*');
      if (error) throw new Error(error.message);
      return sortBehaviors(data.map(dbToBehavior));
    },
  });
}
export function useAddBehavior() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<NewBehavior, 'id' | 'created_at'>): Promise<Behavior> => {
      const { data, error } = await supabase.from('behaviors').insert(input).select().single();
      if (error) throw new Error(error.message);
      return dbToBehavior(data);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.behaviors.all }),
  });
}
```

**`onChange` transitional dispatch — internal rule:** If `onChange` is supplied, ignore the three legacy callbacks entirely for that subscription. If both are supplied (mis-migration), `console.warn` in dev and let `onChange` win. This keeps the 6 other legacy callers (across useClassrooms/useLayoutPresets/useTransactions/useStudents) untouched through Phase 1.

**`resetBehaviorsToDefault` continuity:** The existing bespoke delete+insert flow at `AppContext.tsx:277` stays. Replace its final `refetchBehaviors()` call with the adapter-exposed `behaviorsQuery.refetch()` (reference-stable via TanStack Query). This is the cheapest preservation path; the function is flagged for a future cleanup (could become `useResetBehaviors` mutation in a later phase, but out of scope now).

## Verification

**Commands:**

- `npm install @tanstack/react-query && npm install -D @tanstack/react-query-devtools` -- expected: clean install
- `npm run build` -- expected: build succeeds
- `rg 'tanstack/react-query-devtools' dist/ ; rg 'ReactQueryDevtools' dist/` -- expected: 0 matches both
- `npm run typecheck` -- expected: pass
- `npm run lint` -- expected: pass
- `npm test -- --run` -- expected: all existing tests pass plus the two new `useRealtimeSubscription` cases
- `rg "queryKey:\s*\[" src/ --glob '!src/lib/queryKeys.ts'` -- expected: 0
- `rg "useState.*loading|useState.*error\b|const previous\s*=" src/hooks/useBehaviors.ts` -- expected: 0
- `rg "useRealtimeSubscription|supabase\.channel\(" src/hooks/useBehaviors.ts` -- expected: 0

**Manual checks:**

- Log in as the seeded test user; open AwardPointsModal → BehaviorPicker renders positive/negative columns ordered by points desc; pick a behavior → point awarded, modal closes.
- Settings → add a new behavior → appears in the list after the server roundtrip completes (non-optimistic; full optimism lands in Phase 2 on `useTransactions`); close and reopen → still present.
- Settings → edit + delete a behavior → UI reflects after the mutation resolves, persists after reload.
- Open two tabs of the app; add a behavior in Tab A; Tab B shows it after focusing the tab (window-focus refetch).
- In dev, open React Query Devtools panel (bottom-left icon) — confirm `['behaviors']` query entry exists and transitions between fresh/stale states.

## Suggested Review Order

**Bootstrap infra (Phase 0)**

- Provider wiring and dev-gated devtools; single source entry for the migration.
  [`main.tsx:1`](../../src/main.tsx#L1)

- QueryClient singleton + rationale for each default (load-bearing `structuralSharing` for adapter bridge).
  [`queryClient.ts:1`](../../src/lib/queryClient.ts#L1)

- Typed query-key builders — single source of truth; prevents ad-hoc key drift (PRD Risk 1 mitigation).
  [`queryKeys.ts:1`](../../src/lib/queryKeys.ts#L1)

**Transitional hook signature (arch Decision 3)**

- `onChange` added alongside legacy callbacks; dev warning now in useEffect (review patch).
  [`useRealtimeSubscription.ts:18`](../../src/hooks/useRealtimeSubscription.ts#L18)

- Dual-dispatch routing — onChange wins when provided; legacy preserved for non-migrated callers.
  [`useRealtimeSubscription.ts:121`](../../src/hooks/useRealtimeSubscription.ts#L121)

**Pilot hook rewrite (Phase 1)**

- Thin `useQuery` wrapper — transform inside queryFn; sort preserved; zero useState.
  [`useBehaviors.ts:17`](../../src/hooks/useBehaviors.ts#L17)

- Three split non-optimistic `useMutation` hooks; invalidate via `queryKeys.behaviors.all`.
  [`useBehaviors.ts:32`](../../src/hooks/useBehaviors.ts#L32)

- DB→App transform — first entry in `transforms.ts`; pattern for Phase 2+ domains.
  [`transforms.ts:6`](../../src/types/transforms.ts#L6)

**Adapter bridge (PRD Risk 3)**

- Query/mutation plumbing + `useMemo` over `behaviorsQuery.data` for ref-stability.
  [`AppContext.tsx:152`](../../src/contexts/AppContext.tsx#L152)

- Interface signature updated (`DbBehavior` → `AppBehavior` on add return).
  [`AppContext.tsx:77`](../../src/contexts/AppContext.tsx#L77)

- Mutation adapters preserve legacy null/void contracts; errors now logged (review patch).
  [`AppContext.tsx:261`](../../src/contexts/AppContext.tsx#L261)

- One-line inline cast at Phase 1/2 seam — documented adapter debt; dissolves at Phase 2.
  [`AppContext.tsx:338`](../../src/contexts/AppContext.tsx#L338)

- `mappedBehaviors` block deleted — transform now inside queryFn; Chesterton-fence comment kept.
  [`AppContext.tsx:769`](../../src/contexts/AppContext.tsx#L769)

**Tests**

- NFR6 cleanup-on-unmount test (new).
  [`useRealtimeSubscription.test.ts:237`](../../src/hooks/__tests__/useRealtimeSubscription.test.ts#L237)

- `onChange` precedence test (new — Decision 3).
  [`useRealtimeSubscription.test.ts:262`](../../src/hooks/__tests__/useRealtimeSubscription.test.ts#L262)

**Peripherals**

- Runtime + dev dependencies.
  [`package.json:25`](../../package.json#L25)

- Deferred items logged from review (resetBehaviorsToDefault race; per-mutation networkMode override).
  [`deferred-work.md:1`](./deferred-work.md#L1)
