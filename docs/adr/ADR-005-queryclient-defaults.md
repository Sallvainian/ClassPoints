# ADR-005 — QueryClient defaults, adapter error contract, devtools DCE pattern, Phase 2 mutation AC

**Status:** Accepted (2026-04-23).
**Supersedes:** QueryClient Topology block in `_bmad-output/planning-artifacts/architecture-trim-V1.md:150`.
**Enacts:** PR #63 hardened patch queue items 4, 5, 6.

## Context

PR #63 bootstrapped TanStack Query and migrated `useBehaviors` as a Phase 1 pilot. Review elicitation (pre-mortem + red-team vs blue-team) surfaced four category-level concerns that the original architecture spec did not cover:

1. **Phase 2 mutation race on focus refetch.** v5's default `refetchOnWindowFocus: true` collides with optimistic-mutation `onSettled` invalidation; the later response wins → point-total flicker visible on classroom projectors. Reproducible only on hosted-latency stacks; locally masked by sub-ms Postgres.
2. **Loading bounce on gcTime eviction.** v5's `isPending = no data AND no error` flips any freshly-evicted query back to `true`; combined with `loading = OR of four isPending` in the adapter bridge, routine idle re-mounts surface as full-screen loading flashes.
3. **Devtools DCE fragility.** Static `import { ReactQueryDevtools }` relied on tree-shaking a JSX-dead expression. Any future side-effectful top-level statement in the devtools package would survive and ship ~200 KB. NFR4 had no positive enforcement.
4. **Adapter error swallowing.** Three inconsistent contracts (`null` on error / `void` on error / throw on error) made consumers unable to distinguish "no-op" from "Supabase failed", silencing two layers of failure for any future `onError` wiring.

## Decision

### 1. QueryClient defaults

| Option                | `refetchOnWindowFocus` | `gcTime`          | Behavior                                                   |
| --------------------- | ---------------------- | ----------------- | ---------------------------------------------------------- |
| (a) v5 defaults       | `true`                 | `5 * 60_000`      | ships the race + the bounce                                |
| (b) adopted           | **`false`**            | **`10 * 60_000`** | no focus-refetch race; idle absorbs 10 min before eviction |
| (c) per-hook override | mixed                  | mixed             | breaks the "defer to defaults" baseline rule               |

**Decision: (b).** `staleTime: 30_000` remains unchanged and is called out as deliberate — background freshness without hammering Supabase during rapid per-student awards.

### 2. Adapter error contract (Phase 1 bridge)

Every `AppContext` wrapper around a `useMutation` **throws on Supabase failure**. `| null` in `addBehavior`'s return signature is semantically reserved for "insert matched zero rows" and is unreachable today while mutation functions use `.single()` (which itself throws on zero rows); the nullable return is preserved on the interface so Phase 4's adapter dissolve is a pure type narrowing, not a runtime-behavior change.

This aligns all four mutation wrappers (`addBehavior`, `updateBehavior`, `deleteBehavior`, `awardPoints` family) on a single pattern, so Phase 2's `onError`/toast/error-boundary wiring has one contract to target.

### 3. Devtools DCE pattern

React Query Devtools load via a `useEffect`-gated dynamic `import()` inside a tiny `DevtoolsGate` component:

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

In prod, Vite replaces `import.meta.env.DEV` with a `false` literal; the `if` body dead-codes, Rollup never sees the `import()` call, and no chunk is emitted for the devtools package at all. A module-scope `lazy(() => import(...))` would still register the import() with Rollup and emit a devtools chunk — rejected as weaker DCE.

`tsconfig.app.json` is already DCE-compatible (`isolatedModules: true`; no `verbatimModuleSyntax`) so TS emit elides unused imports; the pattern swap is a defense against a future side-effectful top-level statement in the devtools package, not a TS emit fix.

### 4. Phase 2 mutation acceptance criteria

Every new `useMutation` that introduces **optimistic updates** must:

- (a) **null-guard `context.previous` in `onError` rollback.** `context.previous === undefined` after cancellation writes `undefined` into the cache on rollback — worse than no rollback.
- (b) **keep `onMutate` pure and idempotent.** React Strict Mode double-invokes `onMutate` in dev; impure callbacks ship double writes.
- (c) **derive temp-row IDs deterministically** (content-hash — not `crypto.randomUUID()`). Non-deterministic temp IDs break rollback when the same input is re-submitted.
- (d) **wire `throwOnError: true` OR explicit `onError` + toast** — never neither. Silent failure with optimistic writes leaves the UI desynced from the server.
- (e) **read state from `queryClient.getQueryData`, not from component closure.** Stale closures in `onMutate` across re-renders produce ghost writes.

### 5. Gating criterion for future phase reviews

**"Any `useMutation` WITH `onMutate`"** — not "any `useMutation`." Invalidate-only mutations (`mutationFn` + `onSettled: invalidateQueries`) carry no Phase 2 regression surface: no optimistic cache writes, no impure callbacks, no stale closures across re-renders. The surface opens when `onMutate` is introduced.

Future phase-review PRs that propose a new `useMutation` with only `mutationFn` + `onSettled: invalidateQueries` do not need to re-litigate this AC from first principles; PRs that propose `onMutate` trigger the full (a)–(e) checklist.

## Consequences

- `refetchOnWindowFocus: false` eliminates cross-tab sync on focus. For tables covered by a realtime channel (`students`, `point_transactions`, `seating-chart` per `architecture-trim-V1.md:126`), realtime fills the gap. **`behaviors` has no realtime channel** — a teacher editing behaviors in tab A will not see the change in tab B until they trigger a refetch through another action. Acceptable: behaviors edits are rare, single-teacher-per-classroom is the default, and adding a realtime channel is tracked separately if a multi-tab behaviors-editing scenario emerges.
- `gcTime: 10 min` raises worst-case cache residency. Bounded — cache is cleared on sign-out and on user-id transitions (see `src/contexts/AuthContext.tsx`).
- The `DevtoolsGate` pattern establishes the precedent for any future DEV-only panel (Sentry dev overlay, perf probe, etc.).
- Adapter error contract unification: Phase 2's toast/onError work has one pattern. Phase 4's adapter dissolve becomes a pure type narrowing for `addBehavior` (drop `| null`).
- Phase 2 AC (a)–(e) become mandatory checklist items; enforced at review, not in code. Phase 2 PR template should include the checklist.
- ADR-006 (user-scoped query keys) is the structural replacement for the current sign-out `queryClient.clear()` defense-in-depth; out of scope here, tracked for the first Phase 2 commit.
