# ClassPoints Modernization Plan

## Purpose

This document captures **why** we're reworking large parts of ClassPoints and **what good looks like** at the other end. It is the durable reference that the migration PRD, follow-up refactor PRs, and any AI agent working in this repo should read before writing or changing code.

It exists because the first generation of this codebase was built on a set of handwritten "rules" that treated ad-hoc patterns as architecture. Those rules have been removed from `CLAUDE.md` and preserved, renamed with a `legacy-` prefix, under `docs/` — **not as guidance, but as an inventory of what to refactor away from.**

## Reference inventory — `docs/legacy-*.md`

The following files document the current-state patterns in the codebase. Every one of them is a target for reversal, not a rule to follow.

| File                              | What it documents                                                                                            | Status                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `docs/legacy-components.md`       | Component structure, naming, "always use `useApp()`" facade rule                                             | Mostly keep (naming, hooks-before-returns); drop the facade-mandatory part                            |
| `docs/legacy-contexts.md`         | Provider hierarchy, `useApp()` as the single state facade                                                    | Facade pattern dies; hierarchy stays                                                                  |
| `docs/legacy-hooks.md`            | Hand-rolled `{data, loading, error, refetch}` shape, manual cleanup                                          | **Primary refactor target** — replaced by TanStack Query                                              |
| `docs/legacy-state-management.md` | Three-layer state story (global/feature/local) built around Context + custom hooks                           | Reframed: server state moves out of Context entirely                                                  |
| `docs/legacy-supabase.md`         | Query/insert/update/delete patterns, optimistic-update 5-step contract, manual realtime subscription/cleanup | **Primary refactor target** — most of this is what TanStack Query handles natively                    |
| `docs/legacy-migrations.md`       | DB migration rules (RLS, `REPLICA IDENTITY FULL`, triggers, RPC conventions)                                 | **Keep** — these are database-layer rules, orthogonal to the frontend refactor                        |
| `docs/legacy-testing.md`          | Vitest + Playwright patterns, E2E local-Supabase requirement                                                 | **Mostly keep** (the E2E allow-list is a security boundary); testing shape simplifies after migration |
| `docs/legacy-utils.md`            | Utility function conventions                                                                                 | Keep — no dependency on the broken patterns                                                           |

When any of these files describe a pattern that matches what a code path currently does, that's a signal the path is a migration candidate.

---

## The diagnosis

ClassPoints is a Supabase-backed CRUD app with realtime. For this shape of application, the industry-default architecture is:

- **Server state** (anything that lives in Postgres) → TanStack Query (React Query)
- **UI / session state** (modals, active selection, in-flight drag state) → React Context or a small client-state store (Zustand, Jotai)

Instead, the codebase reinvents this with:

- **~2,400 lines** of handwritten feature hooks (`useStudents`, `useClassrooms`, `useBehaviors`, `useTransactions`, `useLayoutPresets`, `useSeatingChart`) that each maintain their own `useState(data)` + `useState(loading)` + `useState(error)` + manual `refetch` + manual realtime merge logic
- A **849-line `AppContext`** that re-exposes every feature hook's entire surface as a single `useApp()` facade
- A **manual 5-step optimistic-update contract** (capture previous → setX(new) → await → rollback on error) repeated across every mutation site, with 4 explicit rollback sites in `useSeatingChart` alone

Concretely, this is wrong in the following ways:

1. **It reimplements, badly, what `@tanstack/react-query` provides for free.** `useQuery`, `useMutation`, `queryClient.invalidateQueries`, `setQueryData`, and the `onMutate`/`onError` rollback hook cover every case the handwritten code is trying to handle — with fewer bugs, automatic dedup, proper cache sharing across components, devtools, and documented semantics.
2. **It creates subtle correctness bugs.** Two components mounting hooks that fetch the same data issue duplicate network requests (no dedup). Optimistic updates applied in one component don't propagate to another consuming the same data through a different hook instance. Realtime `onUpdate` handlers race with in-flight mutations because there is no canonical cache.
3. **It leaks.** Every handwritten `supabase.channel(...).subscribe()` must be manually cleaned up; several historical bugs trace to missing or incorrect cleanup. A query layer centralizes subscription lifecycle.
4. **It ossifies.** Because `useApp()` is mandatory-by-convention, every new piece of server state has to be threaded through `AppContext.tsx` — pushing that file toward 1,000+ lines and turning it into the bottleneck for every feature change.
5. **It's a learning-cost sinkhole.** A new contributor (human or AI) has to internalize a bespoke pattern that has no external documentation, when the TanStack Query docs would teach the industry-standard equivalent in an hour.

The original `CLAUDE.md` and `.claude/rules/*` files codified this pattern as architecture. **That was the original mistake**: calling an ad-hoc implementation choice a rule turned it into a trap that every subsequent feature fell into.

---

## Target architecture

**Server state:** `@tanstack/react-query`. One `QueryClient` at the root; feature hooks are thin `useQuery` / `useMutation` wrappers. Realtime subscriptions exist only to trigger `queryClient.invalidateQueries` or `setQueryData` — they do not own state.

**UI / session state:** `AppContext`, slimmed dramatically. Active classroom id, modal open/closed, selection-mode toggles — anything that isn't a copy of server data. Post-migration target size: ~150 lines, down from 849.

**Components:** call `useQuery` hooks directly. The `useApp()` facade survives only for true UI state. `useApp().students` goes away; components that need students call `useStudents()` (a thin `useQuery` wrapper) themselves.

**Realtime subscriptions:** the `useRealtimeSubscription` helper keeps its shape but its callbacks change from "merge the change into local state" to "invalidate the relevant query key." Manual `onInsert`/`onUpdate`/`onDelete` state merging disappears.

**Database / migrations:** unchanged. The DB-layer patterns in `docs/legacy-migrations.md` (RLS, `REPLICA IDENTITY FULL`, trigger-maintained denormalized totals, RPC for aggregate queries) are all correct and survive the refactor.

---

## Domain-by-domain migration

### 1. Server state — hand-rolled hooks → TanStack Query

**Why the existing pattern is broken**

Every feature hook reimplements a subset of the `useQuery` contract. For example, `useStudents` (411 lines) contains:

- `useState(students)`, `useState(loading)`, `useState(error)` — three parallel state buckets that must stay consistent
- `fetchStudents` in `useCallback` — manual dedup (there is none; remounts trigger fresh network calls)
- A `visibilitychange` listener to refetch time totals — a bespoke variant of TanStack Query's `refetchOnWindowFocus` with less correct semantics
- Two `useRealtimeSubscription` calls whose handlers manually splice incoming changes into the local `students` array, each with their own edge-case logic for "did we already add this optimistically?"
- A `refetch` exposed as part of the return shape that upstream code calls whenever it's not sure whether local state reflects reality

Every one of those is solved by `useQuery`. The hand-rolled version is not wrong in an interesting way — it's wrong in the routine way that "I wrote a mutex by hand because I didn't know pthread_mutex_lock existed" is wrong.

**The target**

```ts
// src/hooks/useStudents.ts — post-migration, roughly
export function useStudents(classroomId: string | null) {
  return useQuery({
    queryKey: ['students', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('classroom_id', classroomId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!classroomId,
  });
}
```

That's it for the fetch side. Mutations (`addStudent`, `updateStudent`, `removeStudent`) become `useMutation` hooks with `onMutate` for optimistic updates and `onError` for automatic rollback — no manual `const previous = ...` capture anywhere.

**Migration order (suggested)**

Smallest first, to validate the pattern cheaply before tackling the hard ones:

1. `useBehaviors` (144 lines) — pilot / reference implementation
2. `useLayoutPresets` (166 lines)
3. `useTransactions` (212 lines) — exercises mutation + optimistic update path
4. `useClassrooms` (436 lines)
5. `useStudents` (411 lines) — exercises RPC + window-focus refetch + multi-subscription
6. `useSeatingChart` (1,117 lines) — hardest; also requires splitting server state from drag state (see §9)

---

### 2. `AppContext` — god-facade → UI/session store

**Why the existing pattern is broken**

`AppContext.tsx` is 849 lines. It calls every feature hook, re-exports the combined surface, and accretes business logic (e.g., `awardPointsToClassroom` at line 348 contains the core filter logic for point distribution). Any new server-state feature has to be plumbed through this file, which means:

- Every feature PR touches `AppContext.tsx` — creating merge conflicts out of proportion to the feature's actual complexity
- `useApp()` returns an object with ~40+ fields; consumers pay the re-render cost of any unrelated field change
- Business logic lives on the same object as raw data, so "where does the decision to skip absent students happen?" has an arbitrary answer determined by whoever added the feature

**The target**

`AppContext` keeps only state that genuinely has no server-of-truth:

- `activeClassroomId` (probably — could also move to URL/router state)
- UI flags: selection mode, modal open states, sound-enabled toggle
- Auth session (already separate in `AuthContext` — keep as-is)

Everything currently in `AppContext` that starts life as a Supabase row — `classrooms`, `students`, `behaviors`, `transactions` — comes out. Components that need those call `useClassrooms()` / `useStudents()` / etc. directly.

Business logic currently in `AppContext` methods moves to either:

- A `useMutation` hook if it's a server-state mutation (e.g., `useAwardPointsToClassroom` does the filter internally)
- A pure function in `src/utils/` if it's a domain computation

**Acceptance signal**

Post-migration, `AppContext.tsx` is under ~200 lines and has zero imports from `src/hooks/use{Classrooms,Students,Behaviors,Transactions,...}`.

---

### 3. Realtime subscriptions — scope down, simplify the rest

**Why the existing pattern is broken**

Two problems, separate concerns:

1. **Scope:** every feature hook subscribes to realtime, whether or not the data actually benefits from push-based sync. Settings changes, class-list additions, and behavior-template edits all fire live updates nobody is waiting for — that's bandwidth + subscription lifecycle overhead with no user-visible payoff.
2. **Implementation:** the current `useRealtimeSubscription` contract asks callers to handwrite three callbacks per table (`onInsert`, `onUpdate`, `onDelete`), each merging the incoming change into local component state. Merge logic is duplicated per hook and has to account for "did we already apply this optimistically?", "is the incoming row compatible with our representation?", and "how do we reconcile after a disconnect?" (`onReconnect` → full refetch is correct but hand-rolled).

**Scope decision — which data actually needs push**

| Domain                                           | Realtime? | Rationale                                                                                   |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------- |
| **Students + point totals**                      | **Yes**   | Smartboard must reflect awarded points within ~1 second for the live-class-display use case |
| **Point transactions**                           | **Yes**   | Feeds the totals above; also needed for undo-across-devices                                 |
| **Seating chart** (seats, groups, room elements) | **Yes**   | User requirement: show students live when the teacher rearranges seats                      |
| Classrooms list                                  | No        | Created once, rarely edited; fine to refresh on page load or window focus                   |
| Behavior templates                               | No        | Configured in advance, not changing mid-lesson                                              |
| Layout presets                                   | No        | Saved once, loaded on demand                                                                |
| User sound settings                              | No        | Per-device preference; no cross-device sync needed                                          |

Everything in the "No" rows switches to TanStack Query's default sync: `refetchOnWindowFocus` + on-demand `invalidateQueries` after mutations. That's sufficient for data the user views but doesn't "watch live."

**Implementation — what realtime looks like post-migration**

For the three domains that keep push, `useRealtimeSubscription` stays as a helper but its callbacks collapse to a single idiom:

```ts
useRealtimeSubscription({
  table: 'students',
  filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
  onChange: () => queryClient.invalidateQueries({ queryKey: ['students', classroomId] }),
});
```

TanStack Query handles the rest: invalidation triggers a background refetch, the cache updates once, and every component subscribed to that query key re-renders with the new data. No manual merging. No "did we already add this optimistically" logic — the cache is the single source of truth and optimistic updates live _in_ the cache via `setQueryData`.

For mutations where a cheap targeted update beats a full refetch (hot paths like point-award on the smartboard), callers can still do `queryClient.setQueryData` in `onChange` — but that's a deliberate optimization, not the default.

**Reference — ClassDojo uses the same pattern**

Network inspection of teach.classdojo.com shows they use PubNub (third-party managed pub/sub) for their equivalent live-sync. Supabase Realtime is the same category of solution, already bundled with your backend. No transport change is warranted.

---

### 4. Optimistic updates — manual rollback → `useMutation.onMutate`

**Why the existing pattern is broken**

The current "5-step optimistic contract" documented in `docs/legacy-supabase.md` requires each mutation to:

1. Capture `const previous = students;`
2. Call `setStudents(new)` optimistically
3. `await supabase....`
4. On error: `setStudents(previous); setError(...)`
5. On success: rely on realtime to reconcile (sometimes — other times explicit `refetch`)

This is repeated at **every** mutation site. `useSeatingChart` alone has 4 rollback captures. The pattern is:

- **Error-prone**: forgetting step 4 silently desynchronizes local state from the server
- **Not composable**: can't easily roll up multiple optimistic changes and atomically rollback
- **Tied to local `useState`**: if two components have their own hook instance, one can roll back while the other stays optimistic

**The target**

```ts
const mutation = useMutation({
  mutationFn: (updates) => supabase.from('students').update(updates).eq('id', id),
  onMutate: async (updates) => {
    await queryClient.cancelQueries({ queryKey: ['students', classroomId] });
    const previous = queryClient.getQueryData(['students', classroomId]);
    queryClient.setQueryData(['students', classroomId], (old) => applyUpdate(old, updates));
    return { previous };
  },
  onError: (err, _updates, ctx) => {
    queryClient.setQueryData(['students', classroomId], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['students', classroomId] }),
});
```

Steps 1–5 of the manual contract collapse into this block. Every consumer of `useQuery(['students', classroomId])` sees the optimistic change and, on error, sees the rollback. There is exactly one source of truth.

---

### 5. Components — minimal change

**Why this is the cheap part**

Today, components call `const { students, awardPoints } = useApp();`. Post-migration, they call `const { data: students } = useStudents();` and `const award = useAwardPoints();`. That's a mechanical edit per call site (~45 files for full conversion), not a redesign.

The existing rules in `docs/legacy-components.md` that survive unchanged:

- Named exports only
- PascalCase filenames matching export name
- Hooks-before-early-returns (a real React requirement)
- Props interface above component
- Tailwind classes over inline styles

The rule that dies: "NEVER access contexts directly, always use `useApp()`" — because the thing `useApp()` is shielding us from no longer exists.

---

### 6. Type mapping (snake_case ↔ camelCase) — keep

**Why this survives**

Database rows are `snake_case` (Postgres convention); app code is `camelCase` (JS/TS convention). The current pattern of transforming at the hook/context boundary is correct. Nothing about TanStack Query changes this — transformation happens inside `queryFn`:

```ts
queryFn: async () => {
  const { data, error } = await supabase.from('students').select('*');
  if (error) throw new Error(error.message);
  return data.map(transformStudent);
};
```

The `Db*` types in `src/types/database.ts` and the `App*` types in `src/types/index.ts` continue to exist and do their job.

---

### 7. Unit testing — simpler, not broken

**Why this gets easier**

Today, testing `useStudents` means mocking Supabase + driving `useState` transitions + asserting on internal hook state. Post-migration, a `useQuery` wrapper is almost pure — the interesting logic is in `queryFn` (a testable async function) and `useMutation` callbacks. Tests can:

- Unit-test `queryFn` as a plain async function with a mocked Supabase client
- Use `@tanstack/react-query`'s `QueryClient` test harness to drive integration-style tests of hooks
- Assert on rendered UI, not on `result.current.loading` transitions (which was already the right pattern, but becomes the _only_ pattern)

Patterns in `docs/legacy-testing.md` that survive: E2E local-Supabase allow-list (security boundary, keep), `data-testid` for E2E selectors, "test behavior not implementation" framing.

---

### 8. Database migrations & RLS — keep as-is

**Why this doesn't move**

`docs/legacy-migrations.md` documents genuinely correct Postgres patterns: RLS on every table, `REPLICA IDENTITY FULL` for realtime DELETE events, indexed foreign keys, trigger-maintained denormalized totals, RPC functions for complex aggregates. None of these are affected by the frontend refactor.

The "legacy-" prefix on that file is accurate only in the sense that it was written by the same person/era as the other rules — the _content_ is fine. Consider this file renameable back to `migrations.md` (or moved to a `docs/database/` subfolder) once the frontend cleanup is far enough along that it won't be confused with the other refactor targets.

---

### 9. `useSeatingChart` — the special case

**Why this needs its own treatment**

`useSeatingChart` is 1,117 lines and mixes two fundamentally different kinds of state:

- **Server state**: the canvas, seats, groups, room_elements rows, and the layout presets associated with the classroom
- **In-flight UI state**: drag-in-progress position, hover targets, selection rectangle, unsaved local edits to a seat position that haven't been committed yet

The migration splits these:

- **Server state → TanStack Query.** Separate `useQuery` per related table: `useSeatingChart`, `useSeats`, `useSeatingGroups`, `useRoomElements`. Mutations are `useMutation` with optimistic `setQueryData`.
- **Drag / in-flight UI state → local `useState` in the canvas component, or a small Zustand store scoped to the seating feature.** This state genuinely doesn't belong on the server and shouldn't pretend to.
- **Realtime stays on.** Unlike the classroom list or behavior templates, seating chart changes are meant to be visible live (student-facing smartboard use case: teacher rearranges seats → students see it update). Each of the four seating tables keeps a `useRealtimeSubscription` → `invalidateQueries` wiring.

The 4 "store old position for rollback" sites collapse into `useMutation.onMutate` + `onError`.

Do this one last. The cleaner patterns from the earlier migrations become the template, so by the time this is tackled, the team (and any AI agent) has seen the shape six times.

---

## Migration sequencing

High-level phases. The PRD will fill in acceptance criteria per phase.

| Phase | Scope                                                                                                                                                                                                  | Risk                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 0     | Install `@tanstack/react-query`, wrap `main.tsx` in `QueryClientProvider`, devtools in dev                                                                                                             | low                                     |
| 1     | Migrate `useBehaviors` as the reference pattern. Write a short internal pattern note once it's landed.                                                                                                 | low                                     |
| 2     | `useLayoutPresets`, `useTransactions`, `useClassrooms` — small to medium hooks                                                                                                                         | medium                                  |
| 3     | `useStudents` — exercises RPC, window-focus refetch, multi-subscription                                                                                                                                | medium                                  |
| 4     | Slim `AppContext` — remove server-state pass-through, migrate consumers to call hooks directly                                                                                                         | medium — touches ~45 files mechanically |
| 5     | `useSeatingChart` — split server state from drag state; hardest single piece of work                                                                                                                   | high                                    |
| 6     | Documentation cleanup: rename `legacy-*` files that have been obsoleted or fully superseded; update `docs/architecture.md`; produce a single canonical `docs/architecture.md` reflecting the new shape | low                                     |

**During the migration**, new features should be written in the target style, even if they sit next to legacy-style hooks. A mixed codebase is fine temporarily; writing new features in the legacy style to "match existing code" perpetuates the problem.

---

## Success criteria

- `src/hooks/use{Classrooms,Students,Behaviors,Transactions,LayoutPresets,SeatingChart}.ts` each contain zero `useState(loading)` / `useState(error)` / manual `const previous = ...` rollback captures.
- `src/contexts/AppContext.tsx` is under 200 lines and imports zero feature data hooks.
- Every new data hook added after Phase 1 is a `useQuery` / `useMutation` wrapper.
- Realtime subscriptions exist only on the three domains that need live sync (students + point totals, point transactions, seating chart) — `useClassrooms`, `useBehaviors`, `useLayoutPresets`, and user settings hooks have no realtime subscription.
- Surviving realtime callbacks exist only to invalidate or patch the TanStack Query cache (no manual `onInsert`/`onUpdate`/`onDelete` state merging).
- `docs/architecture.md` is rewritten to describe the post-migration shape; the "React Context over Redux/Zustand" decision is replaced with "TanStack Query for server state."
- `CLAUDE.md` remains lean — commands + env only (current state).

---

## Resolved decisions

- **Sync transport:** keep Supabase Realtime. ClassDojo uses PubNub for the equivalent live-sync need — Supabase Realtime is the same category of solution, already bundled with the backend. No transport change.
- **Scope of realtime:** students + point totals, point transactions, and seating chart only. Everything else uses TanStack Query's `refetchOnWindowFocus` + on-demand invalidation.

## Open questions — to resolve in PRD

1. **Zustand for UI state, or keep enlarged use of `AppContext`?** Leaning toward _stay with `AppContext`_ for UI state since the volume is small and a second library adds surface area without clear benefit at this size. Revisit only if UI state volume grows.
2. **`activeClassroomId`: Context state or URL param?** URL is more shareable, survives reloads cleanly, and removes one concern from `AppContext`. Small but real behavioral change.
3. **Parallel patterns during migration — pinned order, or opportunistic?** Pinned order (phases above) is cleaner for reviewers; opportunistic ("whoever touches a hook migrates it") finishes faster but risks inconsistent pattern examples during the transition.
4. **`useRealtimeSubscription` refactor timing.** It can either (a) ship an `onChange` variant alongside the existing multi-callback API during Phase 1 and deprecate the old API over time, or (b) be rewritten in place at Phase 1 and force each migration to update callers. (a) is safer; (b) is cleaner.
5. **Devtools flag.** `@tanstack/react-query-devtools` should ship in dev only — confirm bundler correctly tree-shakes it out of production build.

---

_Last updated: 2026-04-21_
