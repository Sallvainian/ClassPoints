# Deferred Work

Surfaced but deliberately deferred from its originating spec. Each entry records why it was not fixed in-scope, and what the intended follow-up is.

## From spec-tanstack-phase-0-1 (Phase 0 + Phase 1 pilot)

### 1. `resetBehaviorsToDefault` delete-then-insert race, exposed by realtime removal

- **Source:** Phase 1 review (edge case hunter, blind hunter).
- **Scenario:** `AppContext.resetBehaviorsToDefault` does `supabase.from('behaviors').delete(...)` followed by `supabase.from('behaviors').insert(DEFAULT_BEHAVIORS)`. Between the two awaits, the TanStack cache is stale (insert hasn't invalidated yet). If the insert throws, the final `refetchBehaviors()` never runs; cache stays at 0 behaviors until a separate refetch trigger (focus/window event) fires.
- **Pre-existing:** yes. The legacy code had the same race; realtime on the behaviors table used to fill the hole. Phase 1 removed that realtime per PRD FR5 (three-domain rule), so the race is now visible in the absence of a cache invalidation on error.
- **Why deferred:** The user-facing path still surfaces an error toast (`throw new Error('Failed to reset behaviors...')`); the stale cache auto-recovers on next focus. Fixing requires converting `resetBehaviorsToDefault` into a proper `useResetBehaviors` mutation with `onError` cache-restore semantics — larger than Phase 1's pilot scope.
- **Follow-up:** In a dedicated commit (can land in Phase 4 or a small standalone PR), rewrite as `useResetBehaviors` `useMutation` with `onMutate` snapshot + `onError` rollback + `onSettled` invalidate against `queryKeys.behaviors.all`.

### 2. Per-mutation `networkMode` override for non-optimistic mutations (offline behavior)

- **Source:** Phase 1 review (edge case hunter).
- **Scenario:** `QueryClient` defaults set `mutations.networkMode: 'online'` per architecture §QueryClient topology. With non-optimistic mutations (Phase 1 `useAddBehavior` / `useUpdateBehavior` / `useDeleteBehavior`), an offline click pauses the mutation indefinitely — the `mutateAsync` call never resolves, the adapter's `try/catch` never fires, and the caller sees a hang.
- **Why deferred:** Arch-level decision; `networkMode: 'online'` is chosen on the assumption that Phase 2+ optimistic mutations paper over the pause (cache-patch fires immediately; network call pauses). Phase 1's non-optimistic mutations don't have that cover, but behaviors UI is rare-click (settings-level, not hot-path). Arch doc explicitly says "defer to empirical signal, not speculation" for per-hook overrides.
- **Follow-up:** If empirical reports show offline behavior-settings-editing confusion, override to `networkMode: 'always'` on the three behavior mutations. Otherwise let the Phase 4 adapter dissolution and direct hook consumption expose mutation `isPaused` state to callers, who can surface it in UI.

---

Append-only. Do not edit entries; add new ones below.
