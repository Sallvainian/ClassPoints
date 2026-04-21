# Rules Review — Categories 3 & 4

Session notes from reviewing the draft rules (Categories 3 and 4) against the actual codebase. Captures proposed revisions, an observed realtime bug that reinforces the concerns raised across both categories, and follow-up rule revisions driven by that bug.

## Category 3 — Framework-Specific React / Context

### Proposed revisions & changes

### 1. Split `AppContext` into smaller contexts _(cheap fix — ~1 day)_

- Break the 849-line `src/contexts/AppContext.tsx` into 2–3 contexts along high-churn vs. low-churn lines (e.g., `ClassroomContext`, `StudentsContext`, `UIStateContext`).
- `useApp()` stays as the public facade — reads from multiple inner contexts under the hood.
- Solves ~80% of the re-render pain without new dependencies.

### 2. Build a `useRealtimeQuery` bridge helper _(only if/when migrating to TanStack Query)_

- One helper wrapping `useQuery` + Supabase realtime subscription + surgical `setQueryData` cache patching.
- Prevents 4 drifting realtime-to-cache implementations across `useStudents`, `useClassrooms`, `useBehaviors`, `useTransactions`.
- ~80 lines, written once.

### 3. TanStack Query migration _(roadmap, not now)_

- Migrate the 4 Supabase CRUD hooks (~1,600 lines) + the server-state half of `AppContext.tsx`.
- Skip `src/hooks/useSeatingChart.ts` (1,117 lines) — editor state, wrong tool.
- ~2–4 solid days. Put on roadmap; don't do it on the `bmad-setup` branch.

### 4. Loosen the single-facade rule in the draft rules doc

- Current draft: `useApp()` mandatory, no parallel contexts.
- Revise to: _"`useApp()` is the default, but split off high-churn slices into their own context or selector hook when profiling shows re-render pressure."_
- Keeps the discipline without painting into a corner when tap latency suffers.

### 5. Strengthen the "no fresh object/array literals to memoized children" rule

- Currently listed as one of several performance hazards.
- Revise to call it out by name as _load-bearing_ for this app specifically, because the student grid is the main surface and lives or dies on stable props.

## Observed realtime bug (2026-04-21)

Two browser windows open on the same classroom ("Test") to test realtime.

**Action:** Awarded Harry +3 points from the left window.

**Observed on the right window (the one that didn't initiate):**

| Field                                        | Realtime updated?          |
| -------------------------------------------- | -------------------------- |
| Harry's card main point total (`+3`)         | ✅ Yes                     |
| Harry's per-card "Today: +X" counter         | ❌ No — stayed blank       |
| Class Total header number (`+3`)             | ✅ Yes                     |
| Class Total "Today: +X · Week: +X" aggregate | ❌ No — stayed `+0` / `+0` |
| Sidebar "Test" period entry (`+3 / 0`)       | ✅ Yes                     |

**Additional behavior:** Switching away from the tab and back caused the missing counters to update. Suggests a focus/visibility-triggered refetch is pulling correct data that the initial realtime event didn't deliver.

**Likely hypothesis (not yet verified):** `today_total` and `this_week_total` are DB-trigger-maintained columns on the `students` row (per `CLAUDE.md`). The first realtime event may fire with the new `point_total` but stale aggregate columns, before the trigger has updated them — or the second realtime event carrying the trigger update is being dropped/mishandled. Alternative: the `transform()` mapping in the realtime handler may only be updating specific fields rather than replacing the row wholesale.

**Where to start investigating:** `src/hooks/useStudents.ts` realtime `onUpdate` handler, the `transform` mapping, and whichever component reads `today_total` / `this_week_total` for the per-card and Class Total aggregates. Reinforces the case for a single `useRealtimeQuery` bridge helper (revision #2) where this kind of bug can be fixed in one place instead of four.

---

## Category 4 — Supabase / Realtime / Data Patterns

### Proposed revisions & changes

### 1. Rewrite the optimistic-update "do nothing on success" step

- Current draft step 5: _"On success: do nothing. The realtime INSERT/UPDATE event will arrive and reconcile."_ Plus: _"don't refetch on success — you'd cause a flicker."_
- This is aspirational, not true — directly contradicted by the realtime bug observed above, where `today_total` / `this_week_total` did not reconcile on the second window until a tab-switch forced it.
- Revise to:
  > _On success, do nothing UNLESS the mutation touches denormalized columns maintained by DB triggers. In that case, either (a) use the mutation's `.select()` return to patch local state directly, or (b) ensure the realtime handler treats each UPDATE payload as a full-row replacement so trigger-driven secondary UPDATEs are not dropped._
- The "avoid flicker" guidance stands in principle, but must be weighed against "silent wrong data on the teacher's secondary device is worse than a 50ms flicker." Accuracy wins.

### 2. Add a totality clause to the `transformX` boundary rule

- Current draft says types are converted via `transformX` at the context/hook boundary, but doesn't constrain what `transformX` must map.
- Add:
  > _A `transformX` used in a realtime handler must map every field the app reads from the row, not a subset. When a migration adds a new column that the UI reads (especially DB-trigger-maintained columns), the matching `transformX` must be updated in the same change. Silent partial transforms are a primary source of stale-data bugs._
- This is one of the two plausible root causes of the Category 3 bug.

### 3. Add a multi-event reconciliation clause to the denormalized-totals rule

- Current draft: _"`students.point_total`, `positive_total`, ..., `today_total`, `this_week_total` are maintained by DB triggers. Read them directly."_
- Correct in intent, but silent on how to keep the local copy of those columns fresh when realtime events are the transport.
- Add companion rule:
  > _If a denormalized column is updated by a DB trigger that fires in a separate transaction from the base mutation, the realtime handler must be able to reconcile multiple UPDATE events for the same row — not just the first. Treat every realtime UPDATE payload as a complete replacement of the row's current state, never as a targeted patch of a subset of fields._

### 4. Tag each rule with its impact class

- Annotate each rule as one of:
  - **Classroom responsiveness** — directly observable during class use (realtime correctness, optimistic updates, denormalized totals, re-render performance). Defend at all costs.
  - **Dev hygiene / correctness** — invisible to the teacher but protects code quality (hook shape, RLS boundary, type conversions, RPC usage, `REPLICA IDENTITY FULL`). Keep strict, but not at the cost of responsiveness rules.
- Rationale: the review kept surfacing the tension between "clean architecture" and "fast, correct classroom experience." Making the impact class explicit lets future rule changes be judged against which axis they affect.

### Rules that stand as drafted

- Standard hook return shape `{ data, loading, error, refetch }` — leave.
- `useRealtimeSubscription` over hand-rolled `supabase.channel(...)` — leave; today's bug is about _what the handler does with payloads_, not about the channel wrapper itself.
- `REPLICA IDENTITY FULL` for tables receiving DELETE events — leave.
- RLS enabled with policies in the same migration; service-role key restricted to `scripts/**` — leave.
- PostgREST relation embedding over multi-roundtrip; RPCs for complex joins/time-window queries — leave.

### Cross-reference

Category 4 revisions 1, 2, and 3 are the rule-level expression of the bug recorded above under Category 3 ("Observed realtime bug"). Shipping those three rule changes without also fixing the underlying `useStudents.ts` handler / `transform` mapping would be documentation without enforcement — the two need to move together.
