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

## From user-observed bug (logged during spec-tanstack-phase-2 scoping, 2026-04-24)

### 3. Seating chart realtime updates broken — requires manual refresh

- **Source:** User report (2026-04-24) while scoping Phase 2. "Seating charts don't update real time. I need to refresh."
- **Scenario:** Seating chart is one of the three approved realtime domains per ADR-005 §6 + PRD FR5. Subscription exists in `useSeatingChart.ts`, but cross-device seat moves are not propagating; the second device sees stale layout until a manual refresh.
- **Why deferred:** Out of Phase 2 scope — Phase 2 only touches `useClassrooms` and `useTransactions`. `useSeatingChart` is untouched per the spec's Boundaries constraints. Fixing the subscription likely requires inspecting channel filter, enabled flag, or `onChange` routing specific to the seating-chart hook — a separate focused investigation.
- **Follow-up:** Dedicated bug-fix PR. Start by verifying: (a) the Supabase `seating_charts` table has `REPLICA IDENTITY FULL` or the columns needed for the filter, (b) the `useRealtimeSubscription` filter in `useSeatingChart.ts` matches the row(s) the other device is updating, (c) the channel actually reaches `SUBSCRIBED` status (check dev console for CHANNEL_ERROR), (d) `onChange` / legacy-callback routing isn't swallowing events. Likely a single-file fix in `useSeatingChart.ts` once the root cause is found.

## From spec-tanstack-phase-2 (Phase 2 — classrooms + transactions migration)

### 4. Cross-hook invalidation for `useClassrooms` aggregates when Phase 3 migrates `useStudents`

- **Source:** Phase 2 implementation (2026-04-24). Explicit deferred-work call-out in `spec-tanstack-phase-2.md` Design Notes.
- **Scenario:** Phase 2 keeps a `students`-table realtime subscription inside `useClassrooms` that invalidates `queryKeys.classrooms.all` on any student row change. The subscription is the cross-aggregate refresh trigger: when device A awards points, the DB trigger bumps `students.point_total` → realtime UPDATE event arrives on device B → classroom roll-ups invalidate and refetch. This works, but it means two hooks (`useClassrooms` and, post-Phase-3, `useStudents`) will subscribe to the same `students` table, creating two channels for the same events.
- **Why deferred:** Removing the subscription from `useClassrooms` now would leave cross-device classroom aggregates stuck until a window-focus refetch — regression. Phase 3 migrates `useStudents` and is the natural home for the owning subscription. Phase 2's spec explicitly calls this out as an Ask-First question for Phase 3.
- **Follow-up:** During Phase 3 planning, decide between (a) keeping the `useClassrooms` students-table subscription and accepting the double-subscription cost, or (b) moving the classroom-aggregate refresh trigger into `useStudents`' `onChange` (e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.classrooms.all })` alongside the students invalidation), removing the `useClassrooms` subscription entirely. (b) is cleaner and aligns with ADR-005 §Runtime Channel Count (exactly 3 channels at steady state).

### 5. `networkMode: 'online'` paused-mutation UI indicator (now visible with optimistic writes)

- **Source:** Phase 2 implementation (2026-04-24). Evolution of Phase 1's deferred item #2, now more user-visible.
- **Scenario:** `QueryClient` defaults `mutations.networkMode: 'online'` per ADR-005 / arch §QueryClient topology. Phase 2's `useAwardPoints` is optimistic: `onMutate` patches the transactions + classroom caches synchronously, so the UI updates even when offline. But the network call pauses — `mutateAsync` never resolves, `onSettled` never fires, and on tab close the optimistic patch is lost from the cache on next load. The teacher sees a point award that silently disappears.
- **Why deferred:** Fixing needs a UI affordance (per-mutation `isPaused` indicator or a top-level "pending sync" banner) plus a policy decision between `networkMode: 'always'` (queue and succeed-or-error when online) and fail-fast with toast. Neither is a code-only change — it touches UX.
- **Follow-up:** Dedicated PR that wires `awardPointsMutation.isPaused` into `AppContext.error` or a dedicated pending-sync surface, and either (a) keeps `networkMode: 'online'` + shows a visible "awaiting connection" indicator, or (b) overrides to `networkMode: 'always'` and relies on the existing `refetchOnReconnect` infra for consistency checks. Decision needs design input — treat as UX work, not a pure refactor.

---

Append-only. Do not edit entries; add new ones below.
