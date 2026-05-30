---
stepsCompleted:
  - step-01-init
  - step-02-context
  - consolidated-decisions-patterns-structure
  - step-07-validation
  - step-08-complete
status: 'complete'
completedAt: '2026-04-21'
lastStep: 8
workflowDeviation:
  mode: 'option-2-hybrid'
  rationale: >
    Brownfield technical refactor against an existing React/Vite/Supabase codebase.
    Skill steps 3 (starter template), 4 (greenfield decision categories), 5 (generic
    patterns), and 6 (full project tree) are shaped for greenfield. Consolidated into
    a single Architecture Decisions block scoped to the PRD's four open decisions
    plus the MUST-cover list. Step-5 equivalents (query-key shape, useMutation
    lifecycle, hook naming, useRealtimeSubscription signature) and step-6 equivalents
    (new files under src/lib/, seating-chart split file plan) are produced for the
    parts of the code actually changing — not skipped. Locked/unchanged parts get
    one-liner acknowledgement. Steps 1, 2, 7, 8 executed as written.
  consolidatedStep: 'consolidated-decisions-patterns-structure'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - docs/modernization-plan.md
  - _bmad-output/project-context.md
  - docs/legacy/legacy-components.md
  - docs/legacy/legacy-contexts.md
  - docs/legacy/legacy-hooks.md
  - docs/legacy/legacy-migrations.md
  - docs/legacy/legacy-state-management.md
  - docs/legacy/legacy-supabase.md
  - docs/legacy/legacy-testing.md
  - docs/legacy/legacy-utils.md
workflowType: 'architecture'
project_name: 'ClassPoints'
user_name: 'Sallvain'
date: '2026-04-21'
initiativeType: 'technical-modernization-brownfield'
scopeNote: >
  Architecture phase for the PRD-defined state-management modernization.
  Four decisions deferred from PRD to this workflow:
    1. Zustand scope (UI state broadly / seating-chart-only / none)
    2. activeClassroomId ownership (context / URL / small store)
    3. useRealtimeSubscription refactor timing (alongside / in-place)
    4. Devtools bundling mechanism (NFR4: zero prod refs)
  Non-goals: UX, schema/migrations, deployment, test framework design.
---

# Architecture Decision Document — ClassPoints State-Management Modernization

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

_Authoritative upstream inputs: `_bmad-output/planning-artifacts/prd.md` (supersedes), `docs/modernization-plan.md` (background). `docs/legacy/*` describes the **as-is** being refactored AWAY FROM — not forward guidance._

## Architecture Decisions

### Decision 1 — Zustand scope

**Resolution:** **No Zustand introduced under this initiative.** Maps to PRD §"Decisions Required Before Phase 1" #1 **option (a)** — verbatim: "(a) keep expanded `AppContext` usage for all UI state." One nuance: `AppContext` is not _expanded_ under this initiative — it is slimmed per PRD Phase 4 (server-data pass-through removed; UI/session state retained). The PRD's "(a)" wording predates the finalized slim-AppContext scope; in effect here, (a) means "no new state library adopted; `AppContext` remains the home for the UI/session state it already holds, minus the server-data pass-through."

**Ground truth that drove the call** (verified against `src/` at decision time):

- No `SeatingChartContext` / cross-component drag store exists. `grep -rn "SeatingChartContext\|useSeatingChartContext" src/` returns zero hits.
- Drag/selection/tool UI state is already local `useState` inside `SeatingChartEditor.tsx` (lines 602–615) — 14 hooks: `selectedGroupId`, `selectedElementId`, `isAddingGroup`, `addingRoomElement`, `isAltPressed`, `draggingType`, `draggingId`, `draggingStudent`, `previewPos`, `tablesLocked`, `presetName`, `showPresetInput`, `showPresetList`, `scale`. All references (~58 grep hits) are intra-component.
- `@dnd-kit` is the cross-component drag-transport layer — `DndContext` at `SeatingChartEditor.tsx:894`, `useDraggable` at lines 69/123/238 inside sub-components, `DragOverlay` at 1320. Drag transforms flow through `@dnd-kit`'s own subscription machinery; no custom selector layer is needed.
- `unsavedPositions` / stage-and-commit semantics do **not** exist today. `onMoveGroup` (line 868) and `onMoveRoomElement` (line 879) fire immediately via `await`. Introducing staging would be a new user-facing feature and needs a PRD FR, not an architecture decision.

**Consequence for FR17 ("drag state does not live in a `useQuery` cache entry; separation is greppable"):** already structurally satisfied by the current topology — drag state never touched the legacy `useSeatingChart` hook's cache-equivalent state, and the Phase 5 server-state split (`useSeatingChartMeta`, `useSeatingGroups`, `useRoomElements`, `useLayoutPresets` — see §"Seating-chart Phase 5 file plan" below) will not change that. Greppability test post-Phase-5: no `useState` or `setQueryData` call inside any `useQuery` `queryFn` touches drag state.

**Scope impact on other decisions:**

- No new library adopted. `package.json` additions under this initiative are limited to `@tanstack/react-query` + `@tanstack/react-query-devtools`.
- Phase 5 scope stays as the PRD wrote it: split `useSeatingChart.ts` (1117 lines) into server-state `useQuery` hooks. The 1350-line `SeatingChartEditor.tsx` component is **not** split under this initiative. Its 14 `useState` hooks remain in place.
- Decision 2 (`activeClassroomId` ownership) is evaluated on its own — not foreclosed by this decision.

**Deferred direction (recommended target if a future initiative splits `SeatingChartEditor.tsx`):**

If and when the 1350-line editor is broken into sub-components, the recommended state-management target is **Zustand scoped to the seating feature**, not an expansion of `AppContext` or a new React Context. Specifically:

- A seating-scoped Zustand store holds: selection (`selectedGroupId`, `selectedElementId`), active drag (`draggingType`, `draggingId`, `draggingStudent`, `previewPos`), tool mode (`isAddingGroup`, `addingRoomElement`), lock/modifier flags (`tablesLocked`, `isAltPressed`), and zoom (`scale`). These are the state atoms that would otherwise require prop-drilling across a split editor.
- Ephemeral per-modal state (`presetName`, `showPresetInput`, `showPresetList`) likely stays local to whichever sub-component renders the preset UI — not every `useState` needs to move to the store.
- Sub-components select slices via Zustand's selector API; re-renders are scoped to the slices each sub-component actually reads.
- `@dnd-kit` retains its role as the cross-component drag-transport layer — `DndContext` / `useDraggable` / `DragOverlay` are unchanged. Zustand stores derived/coordination state; `@dnd-kit` owns transforms and `isDragging`.
- The store lives at `src/features/seating/seatingStore.ts` (or equivalent co-located path post-split). It is **not** exposed through `useApp()` and does not cross the seating-feature boundary.
- This direction is not a commitment — it's a recommendation preserved here so that a future editor-cleanup effort has a pre-considered architectural target, and does not accidentally reintroduce cross-component drag state without one. The decision to split the editor, and to adopt this direction when doing so, is out of scope for this architecture workflow.

**Rejected alternatives:**

- **Zustand broadly for UI state** — explicit PRD non-goal; `AppContext` stays the home for UI/session state at current volume. Re-evaluate only if UI-state volume grows materially.
- **Zustand scoped to seating, adopted now** — only load-bearing if the editor is also split in this initiative, which it is not. Adopting Zustand without a sub-component split means introducing a store for state that currently works fine as 14 intra-component `useState` hooks — a solution ahead of the problem.

### Decision 2 — `activeClassroomId` ownership

**Resolution:** **Keep `activeClassroomId` as status-quo `useState<string | null>` inside the slimmed `AppContext`, backed by `localStorage` for reload persistence.** Maps to PRD §"Decisions Required Before Phase 1" #2 **option (i)** — "Context state (status quo)."

**Ground truth** (verified at decision time):

- `src/contexts/AppContext.tsx:124` — `useState<string | null>` with a `localStorage` initializer; storage key `'app:activeClassroomId'` defined at `:121`. Classroom selection already survives page reload today.
- Five consumer sites: `AppContext.tsx` itself (passes ID into `useStudents(activeClassroomId):149` and `useTransactions(activeClassroomId):170`; derives `activeClassroom` composite at `:771`); `src/components/layout/Sidebar.tsx:15`; `src/components/profile/ProfileView.tsx:17`; `src/components/dashboard/DashboardView.tsx:26`; `src/components/settings/ClassSettingsView.tsx:19`. Two sites mutate via `setActiveClassroom` (Sidebar, ProfileView).
- No router in the codebase — zero hits for `react-router` / `wouter` / `@tanstack/router` / `useParams` / `useNavigate` / `useSearchParams` across `src/`; no routing dependency in `package.json`. View switching is driven by local UI state, not URL.

**Why (i):** the ID is the prototypical slim-`AppContext` resident — cross-component UI selection with no server-of-truth. `localStorage` already delivers the modernization plan's stated motivation for option (ii) ("survives reloads cleanly"). Zero churn; five consumer sites continue calling `useApp().activeClassroomId` / `setActiveClassroom`.

**Post-Phase-4 shape:**

- `AppContext` continues to own `activeClassroomId` and `setActiveClassroom`. `AppContext` no longer calls `useStudents(activeClassroomId)` / `useTransactions(activeClassroomId)` — consumers call them directly, passing the ID from `useApp().activeClassroomId`.
- `localStorage` initializer + write-back stays in `AppContext` (~10 lines); not extracted to a dedicated persistence hook unless a second state atom needs the same pattern.

**Derived `activeClassroom` composite — Phase 4 casualty regardless of this decision:**

The `activeClassroom` value at `AppContext.tsx:771–787` composes `{ id, name, students, pointTotal, positiveTotal, negativeTotal, todayTotal, thisWeekTotal }`. It exists inside `AppContext` today because `AppContext` currently holds both `activeClassroomId` and `students`. Post-Phase-4 it dissolves:

- Consumers reading `activeClassroom.students.length` → `useStudents(useApp().activeClassroomId).data?.length ?? 0`.
- Consumers reading `activeClassroom.pointTotal` / `positiveTotal` / `negativeTotal` / `todayTotal` / `thisWeekTotal` → combine `useApp().activeClassroomId` with `useClassrooms()` and find the classroom row (denormalized totals maintained by DB triggers per `project-context.md`; never aggregate client-side).
- **The classroom-switch race guard at `AppContext.tsx:776–778` evaporates automatically.** Today's logic — "during classroom switch, `activeClassroomId` changes before `students` refetches; fall back to previous students to prevent flicker via `students[0]?.classroom_id === activeClassroomId` reconciliation" — is replaced at Phase 4 by TanStack Query's per-key isolation: `useStudents(oldId)` and `useStudents(newId)` are distinct cache entries; the new ID's query starts fetching immediately, while the old query's data remains in cache until GC. The hook caller can opt into `placeholderData: keepPreviousData` if mid-fetch flicker is visible in practice; otherwise the isolation alone handles it. Either way, the hand-rolled reconciliation at `:776–778` deletes itself.

**Rejected alternatives:**

- **(ii) URL / router param** — requires a new routing library (PRD non-goal: "no new libraries beyond `@tanstack/react-query` and its devtools"). The hand-rolled alternative (`window.location` + `history.pushState` + `popstate` listener) reintroduces precisely the "bespoke reimplementation of library-provided functionality" anti-pattern this initiative exists to remove. ~30–50 lines of routing glue to solve reload-resilience that `localStorage` already solves. Reconsider only if a concrete URL-shareable-classroom-selection user requirement emerges.
- **(iii) Dedicated small store** — contradicts Decision 1. Introducing Zustand for a single string atom when Decision 1 rejected it for 14 atoms fails the consistency test.

**Greppable acceptance hook (Phase 4):**

- `rg "\bactiveClassroom\b" src/contexts/AppContext.tsx` → matches **only** `activeClassroomId` references (and `setActiveClassroom` / `ACTIVE_CLASSROOM_STORAGE_KEY`); **zero matches** for the bare `activeClassroom` composite identifier. Confirms the derived `{ ...classroom, students }` composite at `:771–787` has been removed.

### Decision 3 — `useRealtimeSubscription` refactor timing

**Resolution:** **Option (a) — alongside variant.** Ship an `onChange` callback field on the hook in Phase 1; retain the existing `onInsert` / `onUpdate` / `onDelete` legacy fields as a deprecation bridge for non-migrated callers. Each migration phase converts its callers to `onChange`. Legacy fields are deleted at end of Phase 3.

**Ground truth that drove the call** (verified against `src/` at decision time):

- Current hook signature at `src/hooks/useRealtimeSubscription.ts:9–26` — multi-callback shape with `onInsert`, `onUpdate`, `onDelete`, plus lifecycle `onStatusChange` and `onReconnect`. Cleanup is solid (`:131–137`); NFR6 ("no subscription outlives its component tree") already holds.
- Callback-via-ref pattern at `:47–60` prevents re-subscription on every render — carries over to the new `onChange` unchanged.
- Seven production call sites across five hook files:
  - **Deleted** (subscription removed; not migrated to `onChange`): `useBehaviors.ts:57`, `useClassrooms.ts:160`, `useClassrooms.ts:203`, `useLayoutPresets.ts:56`
  - **Migrated** to `onChange` as part of each respective phase: `useTransactions.ts:84` (Phase 2), `useStudents.ts:154` (Phase 3), `useStudents.ts:207` (Phase 3)
- Plus 6 test cases in `src/hooks/__tests__/useRealtimeSubscription.test.ts`.
- One partial-callback usage flagged: `useStudents.ts:207–214` uses `onDelete` only, with `// onInsert is intentionally omitted - we use optimistic updates instead`. This collapses cleanly under `onChange` (any event → invalidate; optimism relocates to `useMutation.onMutate`).
- No current caller uses `onReconnect` despite the hook supporting it.

**The sequencing argument (why (a), not (b)):**

The new `onChange` callback body is `() => queryClient.invalidateQueries({ queryKey: [domain, scope] })`. **That query key only exists once the hook itself is migrated to `useQuery`.** Option (b)'s in-place rewrite at Phase 1 would force `useTransactions` and `useStudents` subscription migrations in Phase 1 — but those hooks still hold `useState(transactions)` / `useState(students)` until Phases 2 and 3 per the PRD's pinned rollout. The options collapse to (b1) expand Phase 1 scope to migrate those hooks (the PRD's Phase 1 "Low" risk rating no longer holds), or (b2) write interim `onChange` callbacks that reproduce the old local-state-merge logic, then re-rewrite them in Phases 2 and 3 — double work per subscription. Neither is coherent with the pinned phased rollout. (a) is the only option that lets each phase's subscription rewrite happen naturally alongside its hook migration.

**Target API shape (Phase 1 introduces; post-Phase-3 steady state):**

```ts
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionOptions<T extends Record<string, unknown>> {
  table: string;
  schema?: string; // default 'public'
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'; // default '*'
  filter?: string; // PostgREST filter, e.g. `classroom_id=eq.${id}`
  enabled?: boolean; // default true
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
  onStatusChange?: (status: RealtimeConnectionStatus, err?: Error) => void;
  onReconnect?: () => void;
}
```

- `RealtimePostgresChangesPayload<T>` is imported from `@supabase/supabase-js` (already imported at `useRealtimeSubscription.ts:3` — not a new dependency). Callers who need to branch on event type can destructure `payload.eventType`; callers who just want "invalidate on any change" ignore the payload.
- Ref-based callback pattern (`:47–60` today) is preserved so the hook does not re-subscribe on every render; applies to `onChange` and `onReconnect`.
- Effect deps remain `[table, schema, event, filter, enabled]`.

**Phase 1 transitional signature (Phase 1 → end of Phase 3):**

```ts
interface UseRealtimeSubscriptionOptions<T, D = { id: string }> {
  table: string;
  schema?: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  enabled?: boolean;
  onStatusChange?: (status: RealtimeConnectionStatus, err?: Error) => void;
  onReconnect?: () => void;

  // NEW — preferred for all migrated callers
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;

  // LEGACY — retained only for callers not yet migrated; mutually exclusive with onChange.
  // Removed at end of Phase 3; do not use in new code.
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: D) => void;
}
```

Internal routing: if `onChange` is provided, route all events to it and ignore the legacy three. Otherwise fan out to the legacy three (preserving current behavior). In development, warn if a caller supplies both `onChange` and any of the legacy three — that's a mis-migration.

**Recommended idiom for the two realtime domains:**

```ts
const invalidate = () => queryClient.invalidateQueries({ queryKey: ['students', classroomId] });

useRealtimeSubscription<DbStudent>({
  table: 'students',
  filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
  enabled: !!classroomId,
  onChange: invalidate,
  onReconnect: invalidate,
});
```

Wire `onChange` and `onReconnect` to the **same** invalidate call. The hook does NOT fire `onChange` internally on reconnect — keeping the two explicit avoids hidden behavior. Callers factor the invalidate into a local const to deduplicate. A convenience `invalidateOnReconnect: boolean` flag is not needed for the initiative and can be added later if the idiom proves noisy.

**Phase 3 semantic delta — must be called out in Phase 3 acceptance (not lost functionality, correct design, but a visible behavior shift):**

`useStudents.ts:207–228` today merges incoming DELETE payloads for `point_transactions` into local state synchronously on event receipt — decrementing `point_total` / `positive_total` / `negative_total` and the time-window totals (`today_total`, `this_week_total`) for the affected student. That produces an instant UI update for the **local user** undoing a point, AND for **remote users** (other tabs / devices viewing the same classroom) when they receive the realtime event.

Post-Phase-3 the topology is:

- **Local user's undo (the initiator):** `useMutation.onMutate` optimistically patches the cache (students query key) with decremented totals — visible in one render, same speed as today or faster.
- **Remote user (recipient of realtime event):** `onChange` fires → `invalidateQueries(['students', classroomId])` → TanStack Query refetches → canonical values land after one network roundtrip. One refetch delay vs. today's "merge on event" instant update. Real values are authoritative (come from the DB trigger-maintained denormalized totals and the `get_student_time_totals` RPC) rather than client-side-synthesized from the incoming transaction payload.

This is the correct post-migration shape — the cache is the single source of truth, client-side aggregation from transaction payloads goes away (per the "READ, DON'T COMPUTE" rule in `project-context.md`). But it is a visible behavior delta on the remote-user path and must be documented in Phase 3 acceptance so it does not read as regressed functionality. Phase 3 manual smoke test already covers the two-tab case ("teacher awards in tab A → smartboard tab B reflects within ~1 second; undo in tab A → tab B reverts within ~1 second") — the ~1-second window accommodates the refetch roundtrip; NFR1 is intact.

**End-of-Phase-3 deletion acceptance (sub-criteria to bundle into Phase 3's acceptance list):**

- Legacy callback fields are removed from the hook signature. Verification: `rg "onInsert|onUpdate|onDelete" src/hooks/useRealtimeSubscription.ts` → **zero matches**.
- No caller passes the legacy callback shape. Verification: `rg "onInsert:|onUpdate:|onDelete:" src/` → **zero matches**.
- The transitional `D = { id: string }` generic parameter (present today at `:32` to type `onDelete` payloads) is removed alongside the legacy callbacks — `onChange`'s `RealtimePostgresChangesPayload<T>` carries both old and new row data in its union shape, so the second generic is unneeded post-migration.

**Rejected alternative:**

- **(b) In-place rewrite at Phase 1** — collapses three carefully-sequenced phases into Phase 1 (scope creep that breaks the Low risk rating) or forces double-rewrite of `useTransactions` and `useStudents` subscription callbacks (one interim write against legacy local state, then a second write against the TanStack query key once the hook is migrated). Neither form is coherent with the pinned rollout. Rejected on sequencing grounds — see §"The sequencing argument" above.

### Decision 4 — Devtools bundling mechanism

**Resolution:** **Env-branched static import with render guard, primary; async `mountApp()` with dynamic import in dead branch, contingency.** The authoritative acceptance hook is the production-bundle grep, not the selected mechanism — either path passes NFR4 if DCE fires correctly, and the grep catches any leak regardless of which path was active.

**Ground truth** (verified at decision time):

- `@tanstack/react-query` and `@tanstack/react-query-devtools` are not yet installed. No matches in `package.json`. Phase 0 introduces both.
- Vite `^6.0.5` — Rollup-based production build. `import.meta.env.DEV` is statically replaced with literal `true` / `false` at build time.
- `src/main.tsx` is 10 lines today (`StrictMode` → `App`). No existing `import.meta.env.DEV` usage in the codebase — only `import.meta.env.VITE_*` at `src/lib/supabase.ts:4–5`. Decision 4 establishes the first `.DEV` pattern.
- `dist/` is gitignored (standard Vite).

**Install as devDependency — defense in depth:**

```bash
npm install -D @tanstack/react-query-devtools
npm install @tanstack/react-query
```

`@tanstack/react-query-devtools` is a **devDependency**, not a runtime dependency. If module-graph removal ever fails silently, a `NODE_ENV=production npm ci --omit=dev` install would not have the package installed at all, and the build would throw loudly at install time — one more layer of protection on top of the grep check.

**Primary — env-branched static import:**

```ts
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';
import App from './App';

const queryClient = new QueryClient(/* defaults per §QueryClient topology */);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
);
```

DCE chain: `import.meta.env.DEV` → literal `false` in prod → `false && <ReactQueryDevtools />` → JSX removed → `ReactQueryDevtools` identifier has zero references → static import removed by Rollup (given `@tanstack/react-query-devtools` publishes with `"sideEffects": false`, which is standard for React component packages).

**Contingency — async `mountApp()` with dynamic import in dead branch:**

If the grep below ever fails (future TanStack version flips `"sideEffects"`, a sibling code path bundles devtools code, etc.), fall back to the zero-top-level-static-import pattern:

```ts
// src/main.tsx (contingency)
async function mountApp() {
  let devtools: React.ReactNode = null;
  if (import.meta.env.DEV) {
    const { ReactQueryDevtools } = await import('@tanstack/react-query-devtools');
    devtools = <ReactQueryDevtools initialIsOpen={false} />;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        {devtools}
      </QueryClientProvider>
    </StrictMode>
  );
}
mountApp();
```

Rollup statically folds `if (false) { ... }` away in prod, removing both the dynamic `import()` call and the chunk it would have produced. Zero module-graph entry, zero chunk emission, zero bundle reference — tree-shaking cannot fail open because there is no static import to fail on.

**Phase 0 acceptance hook — authoritative:**

```bash
npm run build
rg 'tanstack/react-query-devtools' dist/   # → 0 matches
rg 'ReactQueryDevtools' dist/              # → 0 matches
```

Both must return zero. `dist/` is gitignored, so the build step is required before the grep; this is intentional — the test is specifically about the production bundle artifact, not source. The grep is the **authoritative test** regardless of which mechanism (primary or contingency) is in play, and catches any leak independently of why tree-shaking did or didn't fire. The `"sideEffects": false` spot-check on the installed devtools package is a useful sanity note but redundant — the grep subsumes it.

**Rejected alternatives:**

- **TanStack's "production devtools" pattern** (`@tanstack/react-query-devtools/production` subpath, lazy-loaded behind a runtime state toggle) — designed for teams that _optionally_ want devtools in production. NFR4 says never. Wrong tool.
- **Conditional `require()`** — not an ES-module pattern; Vite doesn't do CommonJS interop in app code; violates `moduleResolution: "bundler"` config. Reject.
- **`process.env.NODE_ENV` branching** — Vite replaces `import.meta.env.DEV`, not `process.env.NODE_ENV`, inside `src/**`. `process.env` in `src/**` is explicitly disallowed per `project-context.md` (app code uses `import.meta.env.VITE_*`; `process.env` is scripts-and-tests-only). Wrong env surface. Reject.

## Infrastructure

This block defines the canonical shape of the post-migration infrastructure — the file layout, API contracts, and cross-cutting patterns that every migrated hook and component must conform to. Locked/unchanged surface (DB layer, auth flow, Supabase transport, test infrastructure) is referenced by one-liner at each touch point rather than re-documented.

### QueryClient topology

**Instantiation — `src/lib/queryClient.ts`:**

```ts
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — prevents mount/focus refetch churn
      gcTime: 5 * 60_000, // 5 min (TanStack default; explicit)
      refetchOnWindowFocus: true, // non-realtime domains rely on this for freshness
      refetchOnReconnect: true, // complements onReconnect→invalidate on realtime hooks
      retry: 1, // one retry; errors bubble up quickly
      networkMode: 'online', // pause fetch while offline; resume on reconnect
      structuralSharing: true, // ref-stable query results — required for adapter bridge (see PRD Risk 3)
    },
    mutations: {
      retry: 0, // mutations are non-idempotent by default
      networkMode: 'online', // optimistic cache patch applies immediately; network call pauses offline, cache stays optimistic during the pause
    },
  },
});
```

Singleton; module-scope instantiation. Lives in `src/lib/` alongside `supabase.ts` (same "cross-cutting infra singleton" slot). Tests may import `queryClient` and manipulate it directly (`queryClient.setQueryData`, `queryClient.clear()`) or, when isolation is needed, construct a fresh `QueryClient` with the same `defaultOptions` via a local test helper.

**Provider layering — `QueryClientProvider` wraps `<App />` in `src/main.tsx`:**

```ts
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
);
```

Resulting effective tree:

```
StrictMode
  QueryClientProvider                ← new, outside everything
    App
      AuthProvider                   ← App.tsx UNCHANGED
        AuthGuard
          ThemeProvider
            SoundProvider
              AppProvider
                AppContent
    {DEV && ReactQueryDevtools}      ← dev-only, see Decision 4
```

`QueryClientProvider` sits **outside `AuthProvider`** so queries can execute or be cleared independently of auth state. `App.tsx`'s internal provider tree is **not modified** by Phase 0 — Phase 0's only source change is `main.tsx`.

**Default options rationale:**

| Field                          | Chosen       | TanStack default | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queries.staleTime`            | `30_000`     | `0`              | Default-0 causes a refetch on every component mount and every window focus even if data was fetched seconds ago. 30s covers typical teacher-UI rapid navigation without masking real staleness. Realtime domains are invalidation-driven and unaffected; non-realtime domains (`useClassrooms`, `useBehaviors`, `useLayoutPresets`) lean on the 30s window to quiet mount/focus chatter.                                                                                                  |
| `queries.gcTime`               | `5 * 60_000` | `5 * 60_000`     | Explicit for readability. Unused queries stay cached for 5 minutes before GC.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `queries.refetchOnWindowFocus` | `true`       | `true`           | The PRD's designated freshness mechanism for non-realtime domains.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `queries.refetchOnReconnect`   | `true`       | `true`           | Complements the `onReconnect → invalidate` pattern on realtime hooks — not duplicative because `refetchOnReconnect` refetches currently-mounted queries, while `onReconnect → invalidate` also dirties unmounted cache entries for their next consumer.                                                                                                                                                                                                                                   |
| `queries.retry`                | `1`          | `3` w/ backoff   | Default-3 produces 3–10 second perceived hangs during network blips. One retry catches transient flakes without making sustained errors feel like a frozen app. Per-hook override allowed where justified.                                                                                                                                                                                                                                                                                |
| `queries.networkMode`          | `'online'`   | `'online'`       | **Explicit to prevent silent assumption.** When offline, queries pause until reconnect; when they resume, they re-run. Optimistic mutations apply their cache patch immediately (that is synchronous and local), then the network call pauses offline; the cache stays optimistic during the pause, and the actual mutation fires on reconnect.                                                                                                                                           |
| `queries.structuralSharing`    | `true`       | `true`           | **Load-bearing for the Phases 1–3 adapter bridge (PRD Risk 3).** With structural sharing, a refetch that returns deep-equal data produces the _same_ JavaScript reference for unchanged sub-objects. Any `useMemo`-based adapter that re-shapes the query result into the legacy `useApp()` shape can rely on input reference stability → its output is reference-stable → downstream `React.memo` / `useMemo` deps do not invalidate on meaningless refetches. Do not override per-hook. |
| `mutations.retry`              | `0`          | `0`              | Mutations may not be idempotent (awarding a point twice ≠ once). Per-mutation override only where the mutation is explicitly idempotent.                                                                                                                                                                                                                                                                                                                                                  |
| `mutations.networkMode`        | `'online'`   | `'online'`       | Same rationale as queries — explicit for visibility. Optimistic patch fires; network call defers until reconnect.                                                                                                                                                                                                                                                                                                                                                                         |

**Per-hook override policy** — **defer to empirical signal**, not speculation:

- Realtime domains (`useStudents`, `useTransactions`): no override needed at baseline. Defaults are correct.
- Rarely-changing non-realtime (`useClassrooms`, `useBehaviors`, `useLayoutPresets`): may raise `staleTime` to `5 * 60_000` _if the hook's PR surfaces real refetch chatter_ — not preemptively.
- RPC-backed reads (`get_student_time_totals` called inside `useStudents`): default acceptable; the RPC is server-aggregated so a 30s window is appropriate.

**[Phase 6 log — project-context.md update]:**

`project-context.md` documents the provider hierarchy as `AuthProvider → AuthGuard → SoundProvider → AppProvider → AppContent` — this is stale. The actual tree at `src/App.tsx:112–126` includes `ThemeProvider` between `AuthGuard` and `SoundProvider`. Update during Phase 6 doc cleanup:

```
AuthProvider → AuthGuard → ThemeProvider → SoundProvider → AppProvider → AppContent
(QueryClientProvider wraps App in main.tsx, outside AuthProvider)
```

### Cross-cutting phase notes

Items that emerge from one decision but land in a specific later phase. Recorded here so they are not lost between now and the phase that consumes them.

- **[Phase 1 or Phase 4 — AuthContext integration] Clear query cache on logout.** When the signed-in user logs out, call `queryClient.clear()` (from the imported singleton) to drop every cached query result. Without this, a subsequent sign-in on the same device can display the previous user's cached classroom/student data for up to one refetch cycle — a cross-user data leak. Implementation site: wherever the logout flow lives in `AuthContext` today (`supabase.auth.signOut()` call site). Integrated in whichever phase first touches `AuthContext` for migration work — Phase 1 if auth touches the pilot, Phase 4 at the latest.

### Query key conventions

**Rationale:** PRD Risk 1 names an exact failure mode — "invalidating `['students']` when the active query is `['students', classroomId]`." Mitigation: eliminate the possibility of ad-hoc key construction at call sites. Every query key flows through a single typed constant module.

**File — `src/lib/queryKeys.ts` (new):**

```ts
// src/lib/queryKeys.ts
// Single source of truth for TanStack Query keys. Callers MUST import from here;
// never construct query keys inline at call sites. Invalidation uses the same
// builders so read and write paths cannot drift.

export const queryKeys = {
  classrooms: {
    all: ['classrooms'] as const,
  },
  students: {
    all: ['students'] as const,
    byClassroom: (classroomId: string | null) => ['students', classroomId] as const,
    timeTotalsByClassroom: (classroomId: string | null) =>
      ['students', classroomId, 'timeTotals'] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    byClassroom: (classroomId: string | null) => ['transactions', classroomId] as const,
  },
  behaviors: {
    all: ['behaviors'] as const,
  },
  layoutPresets: {
    all: ['layoutPresets'] as const,
  },
  seatingChart: {
    all: ['seatingChart'] as const,
    metaByClassroom: (classroomId: string | null) => ['seatingChart', 'meta', classroomId] as const,
    groupsByChart: (chartId: string | null) => ['seatingChart', 'groups', chartId] as const,
    roomElementsByChart: (chartId: string | null) =>
      ['seatingChart', 'roomElements', chartId] as const,
  },
} as const;
```

**Conventions:**

- **Domain-first.** First tuple element is always the domain (`'students'`, `'transactions'`, etc.). TanStack Query supports hierarchical invalidation — `invalidateQueries({ queryKey: ['students'] })` invalidates every key starting with `['students']`, so broad invalidation at the domain root works without knowing the scope.
- **Scope params follow.** Filtered queries append scope params in stable order. `['students', classroomId]` not `[classroomId, 'students']`. A `null` classroomId produces `['students', null]` and is distinct from `['students']` — this is intentional; the `enabled: !!classroomId` guard on the hook prevents fetch, but the key itself is still shape-stable.
- **Sub-resources append a string tag** — and for multi-entity domains, the shared prefix carries the domain name followed by a sub-resource tag so broad-match invalidation works. Two examples:
  - `['students', classroomId, 'timeTotals']` identifies the RPC-backed time totals as a child of the students scope. Invalidating `['students', classroomId]` ALSO invalidates the `'timeTotals'` child.
  - Seating chart is a multi-entity domain spanning four DB tables. Keys share the `['seatingChart', ...]` prefix: `['seatingChart', 'meta', classroomId]`, `['seatingChart', 'groups', chartId]`, `['seatingChart', 'roomElements', chartId]`. A mutation that warrants broad invalidation of the seating region calls `invalidateQueries({ queryKey: queryKeys.seatingChart.all })` — matches all three children. This shared-prefix shape is **load-bearing**: flat keys (`['seatingGroups', ...]` / `['roomElements', ...]`) would break broad-match invalidation and force callers to invalidate each key individually.
- **`as const` throughout.** Produces readonly-tuple types so accidental mutation (`.push`) is a type error. Consumers get exact key types for `QueryFunctionContext` narrowing.
- **One builder per shape.** A domain exposes `.all` (the static root key), `.byScope(param)` (the filtered key). If a future caller needs a different scope shape, add a named builder — do NOT construct inline.

**Call-site pattern:**

```ts
// Read
const { data } = useQuery({
  queryKey: queryKeys.students.byClassroom(classroomId),
  queryFn: () => fetchStudents(classroomId),
  enabled: !!classroomId,
});

// Invalidate (in mutation or realtime callback)
await queryClient.invalidateQueries({
  queryKey: queryKeys.students.byClassroom(classroomId),
});

// Invalidate everything for this classroom's student region (includes timeTotals)
await queryClient.invalidateQueries({
  queryKey: queryKeys.students.byClassroom(classroomId),
  // No exact: true → matches timeTotalsByClassroom(classroomId) too
});
```

**Greppable acceptance hooks — enforced at every migration phase and on Phase 6:**

- `rg "queryKey:\s*\[" src/` → **zero matches** outside `src/lib/queryKeys.ts`. Every `queryKey` at a call site must reference a `queryKeys.*` builder, not a literal tuple.
- `rg "invalidateQueries\(\{\s*queryKey:\s*\[" src/` → **zero matches**. Same rule applies to invalidation call sites.
- `rg "queryKeys\." src/` → matches at every `useQuery` / `useMutation` invalidation site; serves as a positive-verification inventory.

A PR that fails either zero-match check is a migration-rule violation and must be rewritten to use a `queryKeys.*` builder.

**Time-totals split — Phase 3 decision point, recommended shape documented here:**

Legacy `useStudents` performs two fetches: `supabase.from('students').select('*')` (rows + stored totals) and `supabase.rpc('get_student_time_totals', ...)` (today/this-week aggregates). Post-Phase-3 recommendation: keep them as **two separate queries**, keyed `['students', classroomId]` and `['students', classroomId, 'timeTotals']` respectively. This lets each have its own staleness / refetch behavior without conflating table data with RPC data. A mutation that affects totals (e.g., awarding a point) invalidates both via the broad `['students', classroomId]` match. If Phase 3 empirics show the two-query pattern produces visible chatter, consolidate into a single `queryFn` that calls both; the key convention accommodates either shape.

### `useMutation` lifecycle pattern

**Canonical template** — applied at every migrated mutation site. Replaces the legacy 5-step manual rollback contract (`const previous = ...` → `setX(new)` → `await` → `setX(previous)` on error) and the two `updateStudentPointsOptimistically` / `updateClassroomPointsOptimistically` helpers currently defined at `src/hooks/useStudents.ts:383` and `src/hooks/useClassrooms.ts:395`.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { dbToStudent } from '../types/transforms'; // per §Type boundary
import type { Student, DbStudent, UpdateStudent } from '../types';

interface UpdateStudentInput {
  studentId: string;
  updates: UpdateStudent;
}

export function useUpdateStudent(classroomId: string | null) {
  const queryClient = useQueryClient();
  const key = queryKeys.students.byClassroom(classroomId);

  return useMutation({
    mutationFn: async ({ studentId, updates }: UpdateStudentInput): Promise<Student> => {
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', studentId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return dbToStudent(data as DbStudent);
    },

    onMutate: async ({ studentId, updates }) => {
      // 1. Cancel in-flight refetches so they don't overwrite the optimistic patch
      await queryClient.cancelQueries({ queryKey: key });

      // 2. Snapshot the current cache for rollback
      const previous = queryClient.getQueryData<Student[]>(key);

      // 3. Apply optimistic patch
      queryClient.setQueryData<Student[]>(key, (old) =>
        (old ?? []).map((s) => (s.id === studentId ? { ...s, ...applyOptimistic(updates) } : s))
      );

      // Return rollback context
      return { previous };
    },

    onError: (_err, _input, ctx) => {
      // 4. Rollback via cache restore; no local setX() call
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(key, ctx.previous);
      }
    },

    onSettled: () => {
      // 5. Invalidate to sync with server; matches optimistic patch on success,
      // overwrites on error (after the onError rollback above)
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
```

**Field contract — every mutation in the new shape MUST include:**

| Field        | Required when                                                                  | Purpose                                                                                          |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `mutationFn` | always                                                                         | Perform the Supabase call; throw `new Error(error.message)` on failure.                          |
| `onMutate`   | optimistic mutations only (the majority)                                       | Cancel in-flight queries, snapshot cache, apply optimistic patch, return `{ previous }` context. |
| `onError`    | if `onMutate` applied an optimistic patch                                      | Restore `ctx.previous` via `setQueryData`. Never write `setX()` or local-state rollback.         |
| `onSettled`  | always, for optimistic mutations                                               | Invalidate the query key so the post-mutation server truth lands in cache.                       |
| `onSuccess`  | only if specific side effects must happen (e.g., reset a form; notify a toast) | Do NOT use for cache updates — `onSettled` + realtime `onChange` handle that.                    |

**Input shape:** `mutationFn` takes a single input argument. For multi-parameter mutations (e.g., `awardPoints(classroomId, studentId, behaviorId, note?)`), the input is a typed object literal — not positional args — so callers invoke `mutation.mutate({ classroomId, studentId, behaviorId, note })`. This is stricter than the legacy `awardPointsHook(studentId, classroomId, behavior, note)` signature at `AppContext.tsx:320` and is intentional: object literals are explicit at the call site and survive parameter reorders.

**Batch mutations** (e.g., legacy `awardClassPoints` at `AppContext.tsx:337` which inserts N rows via `crypto.randomUUID()` batch_id):

- `mutationFn` still takes one input (`{ classroomId, behaviorId, studentIds, note? }`).
- `onMutate` iterates `studentIds` and applies per-student optimistic patches inside a **single** `setQueryData` call, preserving atomicity.
- `batch_id` generation stays inside `mutationFn` (not in `onMutate`) — it's part of the server-side grouping identity; optimistic patches don't need it.

**Idempotency and retry:**

Mutations default to `retry: 0` (per §QueryClient topology). Per-mutation override only where genuine idempotency exists. `awardPoints` is NOT idempotent (awarding +2 twice produces +4). `undoTransaction(id)` IS idempotent at the DB layer (deleting an already-deleted row is a no-op). Case-by-case.

**Greppable acceptance hooks — enforced per phase:**

- `rg "const previous\s*=" src/hooks/` → **zero matches** in a migrated hook file. Legacy 5-step contract has exactly this shape.
- `rg "updateStudentPointsOptimistically\|updateClassroomPointsOptimistically" src/` → at end of Phase 3, **zero matches**. Both helpers disappear; their work moves into `onMutate`/`onError`.
- `rg "useState.*loading\|useState.*error\b" src/hooks/` for a migrated hook → **zero matches** inside the migrated file (per PRD's §Success Criteria structural invariants).

### `useRealtimeSubscription` — canonical reference

**Target signature** (post-Phase-3, after legacy callbacks deleted) — unified `{ channel, bindings[] }` shape. Single-binding callers pass a 1-element `bindings` array. Originally driven by the seating-chart's four-table single-channel requirement; with seating-chart no longer a realtime domain (cross-device sync use case dropped 2026-05-13), there is no current in-tree multi-binding consumer. The shape is preserved for forward-compatibility but the multi-binding refactor of `useRealtimeSubscription.ts` is no longer load-bearing for FR5.

```ts
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type RealtimeConnectionStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

interface RealtimeBinding<T extends Record<string, unknown> = Record<string, unknown>> {
  table: string;
  schema?: string; // default 'public'
  event?: PostgresChangeEvent; // default '*'
  filter?: string; // PostgREST filter, e.g. `classroom_id=eq.${id}`
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
}

interface UseRealtimeSubscriptionOptions {
  channel: string; // human-readable channel id; used as Supabase channel name prefix
  bindings: ReadonlyArray<RealtimeBinding>; // one or more postgres_changes bindings that share this channel
  enabled?: boolean; // default true
  onStatusChange?: (status: RealtimeConnectionStatus, err?: Error) => void;
  onReconnect?: () => void; // fires once per reconnect regardless of binding count
}

export function useRealtimeSubscription(options: UseRealtimeSubscriptionOptions): void;
```

**Single-binding idiom — the common case** (students, point_transactions):

```ts
// src/hooks/useStudents.ts (Phase 3, post-migration)
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import type { DbStudent } from '../types';

// inside useStudents(classroomId):
const queryClient = useQueryClient();
const invalidate = () => {
  queryClient.invalidateQueries({
    queryKey: queryKeys.students.byClassroom(classroomId),
  });
};

useRealtimeSubscription({
  channel: 'students',
  enabled: !!classroomId,
  bindings: [
    {
      table: 'students',
      filter: classroomId ? `classroom_id=eq.${classroomId}` : undefined,
      onChange: invalidate,
    },
  ],
  onReconnect: invalidate,
});
```

**Load-bearing invariants:**

- **`RealtimePostgresChangesPayload<T>` is imported from `@supabase/supabase-js`** (already at `useRealtimeSubscription.ts:3`) — not invented. Payload shape includes `eventType`, `new`, `old`, `errors`, `table`, `schema`, `commit_timestamp`.
- **Per-binding `onChange`.** Each `RealtimeBinding` has its own `onChange`; the hook dispatches each Postgres event to the binding whose table matches. Callers that need to invalidate multiple query keys from the same event compose multiple `invalidate*()` calls inside a single `onChange` (rather than registering duplicate bindings on the same table).
- **`onReconnect` is channel-level, not binding-level.** One `onReconnect` per channel fires once on recovery. Callers typically invalidate every query key touched by any binding on that channel. (With seating-chart dropped from the realtime list 2026-05-13, no current channel has multi-table bindings, so each channel's `onReconnect` invalidates a single domain's keys.)
- **The hook does NOT internally route `onReconnect` through `onChange`** — explicit separation avoids hidden control flow.
- **Ref-based callback storage preserved.** The internal implementation continues the `useRef` + effect-sync pattern at `useRealtimeSubscription.ts:47–60` so binding `onChange` identity does not trigger re-subscription on every parent render. Applies across all bindings.
- **Effect dependency array.** Re-subscribe on changes to: `channel` name, `bindings.length`, per-binding `table` / `schema` / `event` / `filter`, and top-level `enabled`. Callback identity (per-binding `onChange`, channel-level `onReconnect`, `onStatusChange`) is ref-stored and does NOT trigger re-subscription. Implementation guidance: derive a stable dependency signature by joining binding configs (e.g., `bindings.map(b => ` `${b.table}|${b.schema ?? 'public'}|${b.event ?? '*'}|${b.filter ?? ''}`).join(',')`) and include it plus `channel`and`enabled` in the effect deps.
- **Cleanup is mandatory and handled by the hook** (extending `useRealtimeSubscription.ts:131–137`). NFR6 invariant: "no subscription outlives its component tree." A Phase 1 Vitest test against the pilot (`useBehaviors`) asserts `supabase.removeChannel` is called with the channel instance on unmount. The multi-binding extension means one `removeChannel` call per channel cleans up all bindings on it atomically.

**Scope table — tables and runtime channels post-migration:**

| Table                | Subscription?       | Channel (runtime)                   | Owning hook                                                                              | Invalidation target                                                                                                     |
| -------------------- | ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `students`           | yes                 | **Channel 1: `students`**           | `useStudents`                                                                            | `queryKeys.students.byClassroom(classroomId)`                                                                           |
| `point_transactions` | yes                 | **Channel 2: `point_transactions`** | `useTransactions` (sole subscriber)                                                      | Fans out: `queryKeys.transactions.byClassroom(classroomId)` AND `queryKeys.students.timeTotalsByClassroom(classroomId)` |
| `seating_charts`     | **no** (2026-05-13) | —                                   | `useSeatingChart` — on-demand `invalidateQueries` after mutations                        | —                                                                                                                       |
| `seating_groups`     | **no** (2026-05-13) | —                                   | same                                                                                     | —                                                                                                                       |
| `seating_seats`      | **no** (2026-05-13) | —                                   | same                                                                                     | —                                                                                                                       |
| `room_elements`      | **no** (2026-05-13) | —                                   | same                                                                                     | —                                                                                                                       |
| `classrooms`         | **no** (Phase 2)    | —                                   | `useClassrooms` — relies on `refetchOnWindowFocus` + `invalidateQueries` after mutations | —                                                                                                                       |
| `behaviors`          | **no** (Phase 1)    | —                                   | `useBehaviors` — same                                                                    | —                                                                                                                       |
| `layout_presets`     | **no** (Phase 2)    | —                                   | `useLayoutPresets` — same                                                                | —                                                                                                                       |

**Seating-chart row note (2026-05-13):** seating-chart was originally scoped as Channel 3 with four multi-binding rows (`seating_charts`, `seating_groups`, `seating_seats`, `room_elements`) for cross-device drag sync. That use case was dropped; seating-chart joins the non-realtime bucket and uses on-demand invalidation after mutations.

**Eliminated at Phase 3** — the legacy `useStudents.ts:207` subscription on `point_transactions` (delete-only, for time-total refresh) is **deleted, not migrated**. Its invalidation target — `queryKeys.students.timeTotalsByClassroom(classroomId)` — is folded into `useTransactions`'s `onChange` (see row 2 above), which invalidates both the transactions key and the students-time-totals key on any point_transactions event. This consolidation is what takes `point_transactions` from two subscriptions to one.

Matches FR5 ("realtime live-sync on exactly two table sets") at both the logical (two sets) AND runtime (two Supabase channels) levels.

### Runtime channel count

**Requirement.** Runtime Supabase channel count at steady state (one classroom actively viewed) must equal **2** — one per logical realtime domain. FR5 at the channel level, not just the table-set level.

**History — multi-binding API was originally driven by the seating-chart use case.** With seating-chart no longer a realtime domain (cross-device drag sync use case dropped 2026-05-13), each remaining realtime domain (`students`, `point_transactions`) is single-table. The `useRealtimeSubscription` helper can stay on its existing single-binding API — the planned `{ channel, bindings[] }` multi-binding refactor has no in-tree consumer, so it is **deferred** and out of scope until a future multi-table realtime domain materializes.

**Students and point_transactions — each one channel, one table.** Each hook (`useStudents`, `useTransactions`) calls `useRealtimeSubscription` with a single `table`. They share no channel with each other (different logical domains; different invalidation targets; separate lifecycle per mounted hook).

**Acceptance hook — runtime channel count:**

A Vitest test instantiates the full realtime graph (render an app tree with an active classroom) and asserts:

```ts
// Pseudocode — exact Supabase test harness shape TBD by Phase 1 pattern note
expect(supabase.getChannels()).toHaveLength(2);
expect(supabase.getChannels().map((c) => c.topic)).toEqual(
  expect.arrayContaining(['students', 'point_transactions'])
);
```

Supabase's `supabase.getChannels()` returns the current channel set. The length-2 assertion is the canonical acceptance hook for this decision.

**Fallback acceptance** (if the Vitest harness is deferred): a manual smoke test with the browser DevTools WebSocket frame inspector — open an active classroom, count the `postgres_changes` subscription frames sent on the WebSocket. Expect two `phx_join` messages (one per channel) at steady state.

**Phase 3 semantic delta — referenced from Decision 3, for acceptance visibility:** `useStudents.ts:207–228` today merges incoming DELETE payloads for `point_transactions` into local state synchronously, producing an instant UI update for both the local undoer AND remote users. Post-Phase-3, the local user's path is `useMutation.onMutate` (immediate cache patch, same visible speed); the remote-user path is `onChange → invalidateQueries → refetch`, which adds one network roundtrip. Correct post-migration shape — cache is single source of truth, time-based totals come from the `get_student_time_totals` RPC rather than client-side subtraction from the DELETE payload. Documented in Phase 3 acceptance so it does not read as regressed functionality. Two-tab manual smoke test (teacher awards in tab A → smartboard tab B reflects within ~1 second; undo in tab A → tab B reverts within ~1 second) covers the post-migration timing window; NFR1 intact.

**End-of-Phase-3 deletion acceptance** (moves the hook signature from transitional to target):

- `rg "onInsert|onUpdate|onDelete" src/hooks/useRealtimeSubscription.ts` → **zero matches**
- `rg "onInsert:|onUpdate:|onDelete:" src/` → **zero matches**
- The transitional `D = { id: string }` second generic at `useRealtimeSubscription.ts:32` is removed alongside the legacy callbacks — `RealtimePostgresChangesPayload<T>` carries old and new row data in its own type union.

### Adapter-bridge contract (Phases 1–3)

**Problem statement** — PRD Risk 3: During Phases 1–3, migrated hooks become TanStack Query-backed while the 45 component files still consume server data via `useApp()`. `AppContext` must re-expose cache-backed results through its existing interface (`AppContextValue` at `src/contexts/AppContext.tsx:47–115`) — with reference-stable output, or `useMemo`-keyed consumers downstream re-render unnecessarily or stop memoizing entirely.

**Load-bearing requirement — structural sharing.** `structuralSharing: true` (QueryClient default, explicit in `queryClient.ts`) guarantees a refetch returning deep-equal data produces the _same_ JavaScript reference for unchanged sub-objects. The adapter chain depends on this; do NOT override it per-hook.

**Adapter shape** — applied inside `AppProvider` per migrated domain:

```ts
// src/contexts/AppContext.tsx (Phase 1–3 transitional)
import { useBehaviors } from '../hooks/useBehaviors';          // now useQuery-backed
import { dbToBehavior } from '../types/transforms';
import type { AppBehavior } from '../types';

export function AppProvider({ children }) {
  // ... existing non-data state (activeClassroomId, etc.) unchanged ...

  // Migrated domain — TanStack Query result read directly
  const behaviorsQuery = useBehaviors();

  // Adapter: reshape to legacy `AppBehavior[]` shape expected by useApp() consumers.
  // `behaviorsQuery.data` is ref-stable (structuralSharing). `useMemo` produces
  // a ref-stable AppBehavior[] when the input is ref-stable — downstream
  // `useMemo`-keyed consumers see stability.
  const mappedBehaviors: AppBehavior[] = useMemo(
    () => (behaviorsQuery.data ?? []).map(dbToBehavior),
    [behaviorsQuery.data],
  );

  const behaviorsLoading = behaviorsQuery.isPending;
  const behaviorsError = behaviorsQuery.error ?? null;

  // ... other domains (non-migrated ones continue using legacy hooks unchanged) ...

  // Combined loading/error follows existing pattern at AppContext.tsx:173–174
  const loading = behaviorsLoading || /* ...other domains... */;
  const error = behaviorsError || /* ...other domains... */;

  // Legacy-shape value object. Field identities are ref-stable per mapped array;
  // the value object itself is reconstructed each render (unchanged from today —
  // legitimate cost of a context composing many states; Phase 4 eliminates it).
  const value: AppContextValue = {
    // ... unchanged fields ...
    behaviors: mappedBehaviors,
    loading,
    error,
    // ... mutation functions adapted via useCallback wrapping mutation.mutateAsync ...
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
```

**Mutation adapter — `useMutation` result → legacy callback API:**

Legacy `AppContext` exposes `addBehavior(behavior): Promise<DbBehavior | null>` (line 77 in interface; line 256 in implementation). Callers await it and read the result. Post-migration, `useBehaviors` exposes a `useMutation` result whose `mutateAsync(input): Promise<Behavior>` has a slightly different throw semantic.

Adapter pattern inside `AppContext`:

```ts
const addBehaviorMutation = useAddBehavior();

const addBehavior = useCallback(
  async (input: Omit<DbBehavior, 'id' | 'created_at'>): Promise<DbBehavior | null> => {
    try {
      return await addBehaviorMutation.mutateAsync(input);
    } catch {
      // Legacy shape returned `null` on error; preserve for Phase 1–3 consumers
      return null;
    }
  },
  [addBehaviorMutation]
);
```

**Reference stability guarantees the adapter must preserve:**

1. **Array ref stability.** `mappedX` arrays are `useMemo`-backed with the query result as sole dep. Same input → same output reference.
2. **Item-identity stability within arrays.** Because `dbToX` is pure and produces new objects per row, identity across refetches is NOT preserved per-item — even with unchanged data, each refetch that fires its `useMemo` re-runs `dbToX`. Consumers that key `useMemo`-on-item-reference will invalidate. Mitigation: consumers that need this use `.map((item) => ({ ...item }))` inside their own `useMemo` keyed on `item.id`, OR the adapter memoizes per-item via a stable `id → AppX` map.
   - **For Phases 1–3, accept the per-item churn.** Simpler. Consumers key memos on `item.id`, not object reference. Legacy code already does this (see `DashboardView.tsx:68` pattern: `activeClassroom.students.filter((s) => selectedStudentIds.has(s.id))` keys on `.id`).
   - **If a specific component surfaces a performance regression during Phase 1–3**, patch THAT component with a stable `id → AppX` keyed memo. Do not preemptively introduce a per-item identity map in the adapter.
3. **Callback identity stability.** Adapter functions (`addBehavior`, `updateBehavior`, etc.) are `useCallback`-wrapped with the underlying mutation as the sole dep. Mutation identity is stable across renders (TanStack Query returns a stable mutation object).

**Adapter deletion at Phase 4:**

Adapter code and mapped-value `useMemo`s are **deleted**, not commented out. The `value: AppContextValue` object shrinks to only UI/session fields (`activeClassroomId`, `setActiveClassroom`, sound preference, modal flags, etc.). The 45 component files that currently read `useApp().students` / `.classrooms` / `.behaviors` / `.transactions` migrate to direct `useStudents(...).data` / `useClassrooms().data` / etc. calls. Per-phase mapping of which components touch which domain lives in the Phase 4 PR description, not here.

**Greppable acceptance hook (Phase 4 end-state):**

- `rg "useApp\(\)\.(students|classrooms|behaviors|transactions|seatingChart|layoutPresets)" src/components/` → **zero matches**.
- `rg "import.*useStudents\|useClassrooms\|useBehaviors\|useTransactions" src/contexts/AppContext.tsx` → **zero matches** (confirms `AppContext` no longer imports feature data hooks).

### Type boundary / transform location

**Current state** (verified at decision time):

- **`src/types/database.ts`** — DB row types. Unusual naming: exports `Behavior`, `Student`, `Classroom`, `PointTransaction` (and insert/update variants) directly — NOT `DbBehavior` / `DbStudent` / etc. Imported via aliased rename in call sites (e.g., `AppContext.tsx:7–14` uses `import type { Classroom as DbClassroom, Student as DbStudent, ... }`).
- **`src/types/index.ts`** — App types. Also exports `Behavior`, `Student`, `Classroom`, `PointTransaction` — camelCase field shape, ms-timestamp `createdAt: number`. Aliases `AppBehavior = Behavior`, `AppClassroom = Classroom`, `AppStudent = Student` at lines 63–65.
- **`src/types/seatingChart.ts`** — uses the consistent `Db*` prefix: `DbSeatingChart`, `DbSeatingGroup`, `DbSeatingSeat`, `DbRoomElement`, `DbLayoutPreset`. Also provides forward-direction transform functions co-located in the same file: `dbToSeatingChart` (`:156`), `dbToSeatingGroup` (`:176`), `dbToRoomElement` (`:193`), `dbToLayoutPreset` (`:206`). **This is the pattern.**
- **Non-seating domains currently lack forward-direction transforms.** The DB→App conversion happens inline via `useMemo` in `AppContext.tsx` at `mappedClassrooms` (`:690–740`), `mappedBehaviors` (`:743–753`), `mappedStudents` (`:756–767`). The `transform*` functions in `src/utils/migrateToSupabase.ts:101–150` are the REVERSE direction (app→db) used only by the one-time localStorage-to-Supabase migration wizard — not relevant to ongoing DB↔App.

**PRD/context-doc assumption vs. code reality — gap to flag:**

PRD line 281 and `project-context.md` line 127 describe transforms as "existing" (`transformStudent`, etc.) called at the hook boundary. This is accurate for the seating chart domain (`dbToX` helpers exist); it is **NOT** accurate for `Student` / `Behavior` / `Classroom` / `PointTransaction`, where no forward-direction transform function exists today. The migration must **create** these.

**Decision — where transforms live:**

- **New file:** `src/types/transforms.ts`. Exports `dbToBehavior`, `dbToStudent`, `dbToClassroom`, `dbToPointTransaction`. Imports DB types from `./database` and App types from `./index`. This file does NOT re-export types; it exists solely for the forward-direction conversion functions.
- **Naming follows the existing `dbToX` convention** from `seatingChart.ts` (not the PRD's `transformX` naming) — consistency with the code the developer already reads every day outweighs consistency with the PRD's unimplemented naming. Flag: if the team later prefers `transformX`, rename `seatingChart.ts`'s existing helpers and `transforms.ts` together. Not in scope for this initiative.
- **Seating chart transforms stay where they are** (`src/types/seatingChart.ts`). Do not move; re-homing for symmetry is gratuitous churn.

**File stub** (to be filled phase-by-phase as each hook migrates; each domain lands its transform in the phase that first needs it):

```ts
// src/types/transforms.ts
// Forward-direction (DB → App) transforms. Called inside TanStack Query `queryFn`
// to produce camelCase, ms-timestamp app types from snake_case Postgres rows.

import type {
  Behavior as DbBehavior,
  Student as DbStudent,
  Classroom as DbClassroom,
  PointTransaction as DbPointTransaction,
} from './database';
import type {
  Behavior as AppBehavior,
  Student as AppStudent,
  Classroom as AppClassroom,
  PointTransaction as AppPointTransaction,
} from './index';

// Phase 1 — behaviors pilot
export function dbToBehavior(row: DbBehavior): AppBehavior {
  return {
    id: row.id,
    name: row.name,
    points: row.points,
    icon: row.icon,
    category: row.category,
    isCustom: row.is_custom,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Phase 2 — classrooms, transactions land here
// Phase 3 — students lands here
// (add per-phase; do not speculate shapes before the phase's mapping is validated)
```

The Phase-by-phase acceptance criterion for each migrated hook: `rg "transform\|dbTo" src/hooks/{hookFile}` matches exactly **one** import, from `src/types/transforms` (or `src/types/seatingChart` for seating hooks). Inline `useMemo` mapping inside the hook is a red flag — it means the transform hasn't been factored out.

**Naming-collision hazard — disambiguation pattern:**

Because `src/types/database.ts` and `src/types/index.ts` both export a type called `Behavior` (and same for Student / Classroom / PointTransaction), every importer must alias one side. Current disambiguation pattern at `AppContext.tsx:7–14` — `import type { Classroom as DbClassroom, ... }` — is the convention for migrated hooks too. `src/types/transforms.ts` follows this. A future polish initiative could rename the DB exports to `DbBehavior` / `DbStudent` / `DbClassroom` / `DbPointTransaction` at `types/database.ts` for consistency with seating chart types; that is **out of scope** here (a cross-file rename touching every hook and context file for a naming nit). Logged as:

**[Future polish — out of scope]** Normalize `src/types/database.ts` to export `Db*`-prefixed types for the four non-seating domains, matching `src/types/seatingChart.ts`'s naming convention.

### Seating-chart Phase 5 file plan

**Ground truth** (`src/hooks/useSeatingChart.ts`, 1117 lines):

- Single export: `useSeatingChart(classroomId: string | null): UseSeatingChartReturn` at `:77`. Return shape at `:23–75` composes chart + groups + seats + room elements into one `SeatingChart | null` object plus 20+ mutation functions.
- One internal fetch at `:83` (`fetchChart`) reads four tables sequentially: `seating_charts`, `seating_groups`, `seating_seats` (scoped by group IDs), `room_elements`.
- Mutation methods for chart (`createChart`, `updateSettings`, `deleteChart`), groups (`addGroup`, `moveGroup`, `deleteGroup`, `rotateGroup`), seats (`assignStudent`, `unassignStudent`, `swapStudents`, `randomizeAssignments`), room elements (`addRoomElement`, `moveRoomElement`, `resizeRoomElement`, `deleteRoomElement`, `rotateRoomElement`), presets (`applyPreset`), plus derived `unassignedStudents`, `assignedStudentIds`.
- Four manual `const previous = ...` rollback captures for optimistic moves (confirmed — PRD §Success Criteria calls out exactly four).
- Single consumer: `src/components/seating/SeatingChartView.tsx:3,:46` — this is the only place `useSeatingChart` is imported outside its own file.
- Transform helpers already exist and are correct: `dbToSeatingChart`, `dbToSeatingGroup`, `dbToRoomElement` at `src/types/seatingChart.ts:156/176/193`. Phase 5 reuses them unchanged.

**Post-Phase-5 file layout — four new files, plus thin facade:**

```
src/hooks/
├── useSeatingChartMeta.ts        NEW — chart row + chart mutations (createChart, updateSettings, deleteChart)
├── useSeatingGroups.ts           NEW — groups + embedded seats + group mutations + seat assignment mutations
├── useRoomElements.ts            NEW — room elements + room-element mutations
├── useLayoutPresets.ts           EXISTS (Phase 2 migration). applyPreset mutation moves here if not already.
└── useSeatingChart.ts            FACADE — composes the above into the legacy `SeatingChart` shape
```

**Why keep `useSeatingChart.ts` as a facade** (rather than deleting and migrating `SeatingChartView.tsx`):

Per Decision 1, `SeatingChartEditor.tsx` is not split in this initiative. `SeatingChartView.tsx` destructures `useSeatingChart(classroomId)` and passes the composed `chart` (plus mutation functions) down to `SeatingChartEditor` as props. If we deleted the composed hook, `SeatingChartView.tsx` would need to call four hooks and compose in-place — a change to a file that otherwise has no migration reason to be touched. The facade keeps `SeatingChartView`'s integration surface unchanged while the underlying server-state concerns sit on TanStack Query primitives. Phase 5 scope stays bounded.

**File contracts:**

`src/hooks/useSeatingChartMeta.ts`:

```ts
// useSeatingChartMeta(classroomId: string | null)
//   - useQuery: ['seatingChart', 'meta', classroomId] → SeatingChartMeta | null
//     queryFn: supabase.from('seating_charts').select().eq('classroom_id', ...).maybeSingle()
//     returns: { id, classroomId, name, snapEnabled, gridSize, canvasWidth, canvasHeight, createdAt, updatedAt }
//   - NO realtime subscription. Seating-chart was dropped from the realtime domain list 2026-05-13;
//     freshness comes from on-demand invalidation via the mutation onSettled handlers below.
//   - useMutation: createChart, updateSettings, deleteChart (each with onMutate/onError/onSettled
//     invalidating queryKeys.seatingChart.metaByClassroom(classroomId))
```

`src/hooks/useSeatingGroups.ts`:

```ts
// useSeatingGroups(chartId: string | null)
//   - useQuery: ['seatingChart', 'groups', chartId] → SeatingGroup[]  (groups + embedded seats per dbToSeatingGroup)
//     queryFn: fetch groups by seating_chart_id, then fetch seats by group IDs, compose via dbToSeatingGroup
//   - NO realtime subscription. Freshness comes from each mutation's onSettled invalidation of
//     queryKeys.seatingChart.groupsByChart(chartId).
//   - useMutation: addGroup, moveGroup, deleteGroup, rotateGroup, assignStudent, unassignStudent, swapStudents,
//     randomizeAssignments — each with onMutate/onError/onSettled invalidating
//     queryKeys.seatingChart.groupsByChart(chartId).
//   - The four legacy manual rollback captures collapse into onMutate/onError pairs in moveGroup / moveRoomElement
//     mutations (moveRoomElement lives in useRoomElements.ts; same pattern).
```

`src/hooks/useRoomElements.ts`:

```ts
// useRoomElements(chartId: string | null)
//   - useQuery: ['seatingChart', 'roomElements', chartId] → RoomElement[]
//     queryFn: supabase.from('room_elements').select().eq('seating_chart_id', chartId), map via dbToRoomElement
//   - NO realtime subscription. Freshness comes from each mutation's onSettled invalidation of
//     queryKeys.seatingChart.roomElementsByChart(chartId).
//   - useMutation: addRoomElement, moveRoomElement, resizeRoomElement, deleteRoomElement, rotateRoomElement —
//     each with onMutate/onError/onSettled invalidating queryKeys.seatingChart.roomElementsByChart(chartId).
```

`src/hooks/useSeatingChart.ts` (facade — post-Phase-5 shape):

```ts
// useSeatingChart(classroomId: string | null): UseSeatingChartReturn (existing interface, unchanged)
//   - Composes the three read hooks:
//       const meta = useSeatingChartMeta(classroomId);
//       const groups = useSeatingGroups(meta.data?.id ?? null);
//       const roomElements = useRoomElements(meta.data?.id ?? null);
//   - NO realtime subscription. Seating-chart was dropped from the realtime domain list 2026-05-13;
//     freshness is driven by each split hook's mutation onSettled invalidations. The facade owns no
//     Supabase channel.
//   - Composes the UseSeatingChartReturn object — combining the three queries' data via
//     dbToSeatingChart(metaRow, groups, roomElements), plus mutation functions re-exported from
//     useSeatingChartMeta / useSeatingGroups / useRoomElements.
//   - Exposes the existing UseSeatingChartReturn shape so SeatingChartView.tsx:46 call site is unchanged.
//   - File size target: UNDER 200 lines. Composition and dbToSeatingChart call only — no fetch logic,
//     no mutation logic, no rollback captures, no realtime wiring.
```

**Drag-state separation** (Decision 1 preserved): local `useState` in `SeatingChartEditor.tsx:602–615` is untouched. No seating-chart state lives in a `useQuery` cache entry.

**Greppable Phase 5 acceptance hooks** — augmenting the PRD's Phase 5 acceptance:

- `rg "useState.*loading\|useState.*error\b\|const previous\s*=" src/hooks/useSeatingChart*.ts src/hooks/useSeatingGroups.ts src/hooks/useRoomElements.ts` → **zero matches**.
- `wc -l src/hooks/useSeatingChart.ts` → **under 200 lines** (composition facade only).
- `rg "queryKey:\s*\[" src/hooks/useSeatingChart*.ts src/hooks/useSeatingGroups.ts src/hooks/useRoomElements.ts` → **zero matches** (keys only via `queryKeys.seatingChart.*` builders).
- `rg "setQueryData\|invalidateQueries" src/components/seating/` → **zero matches** (cache manipulation stays inside hooks, not components).
- `rg "supabase\.channel\(" src/hooks/` → **exactly one match** — inside `useRealtimeSubscription.ts`. No hook opens a raw Supabase channel; all realtime access routes through the hook. Combined with the runtime channel-count acceptance (`supabase.getChannels()` length = 2), confirms no rogue subscriptions.

### Devtools mount wiring

Consolidates Decision 4 into the Infrastructure block for reference. No new decisions.

- **Mount site:** `src/main.tsx`, inside `<QueryClientProvider>`, gated by `import.meta.env.DEV`. See Decision 4 code block.
- **Install:** `npm install -D @tanstack/react-query-devtools`. Install as devDependency (defense in depth — production install without dev deps fails loudly if module-graph removal ever breaks).
- **Primary mechanism:** env-branched static import + `{import.meta.env.DEV && <ReactQueryDevtools />}`. Vite replaces `import.meta.env.DEV` with `false` in prod; Rollup DCE removes the JSX; static import tree-shaken given `@tanstack/react-query-devtools`'s `"sideEffects": false`.
- **Contingency:** async `mountApp()` with dynamic `import()` inside `if (import.meta.env.DEV)` branch. Zero top-level static import; tree-shaking cannot fail open.
- **Acceptance (Phase 0, authoritative):**

  ```bash
  npm run build
  rg 'tanstack/react-query-devtools' dist/   # → 0 matches
  rg 'ReactQueryDevtools' dist/              # → 0 matches
  ```

  `dist/` is gitignored; `npm run build` is required before the grep. The grep subsumes any package-level `sideEffects` spot-check — a leak is detected regardless of mechanism.

### New files introduced

Canonical list of net-new files this initiative adds to `src/`. Does not include files modified in place (every migrated hook file is modified, not new).

| File                               | Introduced in                                              | Role                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/queryClient.ts`           | Phase 0                                                    | `QueryClient` singleton with all default options (queries + mutations). Exported for import by `main.tsx` and tests.                     |
| `src/lib/queryKeys.ts`             | Phase 0                                                    | Typed query-key builders. Single source of truth for every `queryKey:` reference in the codebase.                                        |
| `src/types/transforms.ts`          | Phase 1 onward (one transform per phase's migrated domain) | Forward-direction `dbToX` transforms for non-seating domains. Seating transforms remain in `src/types/seatingChart.ts` (unchanged).      |
| `src/hooks/useSeatingChartMeta.ts` | Phase 5                                                    | Seating chart row query + chart-level mutations.                                                                                         |
| `src/hooks/useSeatingGroups.ts`    | Phase 5                                                    | Groups + embedded seats query + group/seat mutations. Includes the four-rollback-capture-collapse into `useMutation.onMutate`/`onError`. |
| `src/hooks/useRoomElements.ts`     | Phase 5                                                    | Room elements query + room-element mutations.                                                                                            |

Files that are **NOT** net-new, clarified for avoidance-of-doubt:

- `src/main.tsx` — modified (adds `QueryClientProvider`, devtools), not new.
- `src/hooks/useSeatingChart.ts` — refactored to facade, not deleted. Same export name, same return shape; internals rewritten.
- `src/contexts/AppContext.tsx` — progressively slimmed through Phases 1–4, ends under 200 lines. Not new, not deleted.
- No new test files are introduced by this initiative. The Vitest NFR6 test for `useRealtimeSubscription` subscription cleanup is added to the existing `src/hooks/__tests__/useRealtimeSubscription.test.ts` as a new `it('should ...')` case (Phase 1 per PRD NFR6). Broader test expansion is deferred to the separate BMAD TEA initiative explicitly scoped out per `prd.md` §Testing.

### Cross-cutting phase notes (continued)

Additional items accumulated through this block:

- **[Phase 6 — project-context.md update]** Update the provider-hierarchy listing to include `ThemeProvider` between `AuthGuard` and `SoundProvider`. Current file at `src/App.tsx:112–126` shows `AuthProvider → AuthGuard → ThemeProvider → SoundProvider → AppProvider`; `project-context.md` line 146 omits `ThemeProvider`.
- **[Phase 6 or future polish — out of scope]** Normalize `src/types/database.ts` to export `Db*`-prefixed types for `Behavior` / `Student` / `Classroom` / `PointTransaction`, matching `src/types/seatingChart.ts` convention. Eliminates the aliased-rename pattern at every importer (`AppContext.tsx:7–14`, all hook files). Not in scope for this initiative — a pure naming rename touching every hook/context file.
- **[Phase 3 — useStudents migration]** The bespoke `visibilitychange` listener at `src/hooks/useStudents.ts:146` is removed; refetch-on-window-focus delegates to TanStack Query's `refetchOnWindowFocus` default.
- **[Phase 3 — useStudents migration]** Eliminate client-side aggregation of lifetime/time totals from DELETE payloads (`useStudents.ts:207–255`). The RPC `get_student_time_totals` inside a `useQuery` with key `queryKeys.students.timeTotalsByClassroom(classroomId)` provides authoritative time totals; the students-table query provides authoritative lifetime totals. DELETE events invalidate; refetch produces canonical values. See §`useRealtimeSubscription` for the semantic delta.

## Architecture Validation

### Coherence — inter-section dependency checks

Real cross-references between decisions and infrastructure; each arrow is a load-bearing dependency that would break the whole if either side shifted:

- **Decision 3 (`onChange` migration timing) ⇄ Query key conventions.** `onChange`'s body is `() => invalidateQueries({ queryKey: queryKeys.X(scope) })`. The key only exists once the hook is migrated; the phased rollout makes the alongside variant the only coherent option. Coherent.
- **Decision 4 (devtools grep) ⇄ §QueryClient topology instantiation site.** `main.tsx` is both the `QueryClient` mount point AND the devtools mount point; single file, single render root. Coherent.
- **QueryClient `structuralSharing: true` ⇄ Adapter bridge (PRD Risk 3).** The adapter's `useMemo`-chain reference stability depends on this being default-on and not overridden. Noted explicitly in §Adapter bridge and in `queryClient.ts` config comment. Coherent.
- **Query-key shared-prefix convention ⇄ Seating chart split hooks.** The three split read hooks (`useSeatingChartMeta`, `useSeatingGroups`, `useRoomElements`) and their mutations invalidate via `queryKeys.seatingChart.{metaByClassroom,groupsByChart,roomElementsByChart}(...)`, all sharing the `['seatingChart', ...]` prefix. A mutation that warrants broad invalidation of the seating region calls `invalidateQueries({ queryKey: queryKeys.seatingChart.all })` — matches all three children. With seating-chart no longer a realtime domain (2026-05-13), the previous facade-owned multi-binding channel and its `invalidateAllSeatingKeys` `onReconnect` are obsolete; the shared-prefix shape now serves only mutation-side invalidation. Coherent.
- **Decision 2 (AppContext-resident ID) ⇄ Adapter bridge (Phase 4 slim).** `activeClassroomId` stays on `useApp()` post-Phase-4; derived `activeClassroom` composite dissolves because `AppContext` no longer holds students. Migration per-component pattern: `useStudents(useApp().activeClassroomId).data`. Coherent.
- **Decision 1 (no Zustand) ⇄ Decision 2 ownership options.** Option (iii) "dedicated small store" rejected on Decision-1 consistency grounds, not independently. Coherent.
- **Transform location (§6) ⇄ Naming inconsistency flag.** §Type boundary acknowledges `database.ts` does NOT use `Db*` prefix for non-seating types; the aliased-rename pattern at every importer is the documented workaround. Not pretending the gap doesn't exist. Coherent.

No contradictions found between sections.

### Requirements coverage — PRD FRs and NFRs mapped to sections

Every PRD FR1–FR25 and NFR1–NFR9 is architecturally addressed or explicitly locked-as-is:

| Requirement                                                                                    | Addressed in                                                             | Mechanism                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| FR1 (new hook: useQuery/useMutation, no useState for data/loading/error)                       | §useMutation lifecycle; §useRealtimeSubscription                         | Canonical templates + greppable acceptance hooks                                                                            |
| FR2 (queryFn as pure async, testable)                                                          | §Type boundary; §QueryClient topology                                    | `dbToX` transforms called inside `queryFn`; test-local QueryClient harness pattern noted                                    |
| FR3 (per-hook overrides for staleTime/retry/etc.)                                              | §QueryClient topology                                                    | Per-hook override policy; defer-to-signal                                                                                   |
| FR4 (new features without AppContext edits)                                                    | §Adapter bridge                                                          | Phase 4 adapter deletion + greppable hook on feature-hook imports                                                           |
| FR5 (exactly two realtime domains)                                                             | §useRealtimeSubscription scope table + §Runtime channel count            | 2 logical + 2 runtime channels; acceptance hook on `supabase.getChannels().length`. Seating-chart dropped 2026-05-13.       |
| FR6 (single-line realtime callback wiring)                                                     | §useRealtimeSubscription canonical idiom                                 | Single-binding example; `const invalidate = () => ...`                                                                      |
| FR7 (setQueryData for hot-path mutations)                                                      | §useMutation lifecycle                                                   | `onMutate` optimistic `setQueryData` is the canonical path                                                                  |
| FR8 (no hand-rolled event-type state merges)                                                   | §useRealtimeSubscription; Decision 3                                     | Legacy `onInsert/onUpdate/onDelete` removed at Phase 3; `onChange` is the only data callback                                |
| FR9 (non-realtime → refetchOnWindowFocus + invalidate)                                         | §QueryClient topology defaults + §useRealtimeSubscription scope table    | `refetchOnWindowFocus: true`; scope table shows non-realtime domains explicitly                                             |
| FR10–FR12 (optimistic mutation + rollback + cross-component consistency)                       | §useMutation lifecycle + §QueryClient `structuralSharing`                | Canonical 5-callback template; cache is single source of truth; structural sharing ensures ref-stable fan-out               |
| FR13–FR15 (AppContext = UI/session only; no feature-hook imports; direct component hook calls) | §Adapter bridge Phase 4 teardown                                         | Deletion criterion + two grep acceptance hooks                                                                              |
| FR16 (seating server state via `useQuery` hooks)                                               | §Phase 5 file plan                                                       | `useSeatingChartMeta` / `useSeatingGroups` / `useRoomElements` split                                                        |
| FR17 (drag state not in cache; greppable)                                                      | Decision 1                                                               | Already structurally satisfied; not re-architected; acceptance greps in §Phase 5 file plan                                  |
| FR18 (mid-drag realtime event doesn't interrupt) — obsolete 2026-05-13                         | n/a                                                                      | Seating-chart is no longer a realtime domain; no "mid-drag realtime event" can occur. FR18 retired alongside FR5 reduction. |
| FR19 (DB layer unchanged)                                                                      | Locked (PRD non-goal); not touched                                       | —                                                                                                                           |
| FR20 (Supabase Realtime as transport)                                                          | Locked; preserved in §useRealtimeSubscription (same hook, new signature) | —                                                                                                                           |
| FR21 (E2E infra unchanged)                                                                     | Locked; not touched                                                      | —                                                                                                                           |
| FR22 (type transform at hook boundary via transformX)                                          | §Type boundary                                                           | `src/types/transforms.ts` new file; gap flagged (non-seating transforms must be CREATED)                                    |
| FR23–FR25 (pattern discoverability; single-file self-describing)                               | Entire document                                                          | Canonical templates + greppable hooks as external/verifiable signals                                                        |
| NFR1 (realtime propagation latency equivalent)                                                 | §useRealtimeSubscription + Phase 3 semantic-delta note                   | Cache invalidation + optimistic mutation path; two-tab smoke test preserved                                                 |
| NFR2 (optimistic visible within one render)                                                    | §useMutation lifecycle                                                   | `onMutate` synchronous `setQueryData`                                                                                       |
| NFR3 (cache dedup cross-component)                                                             | §QueryClient topology                                                    | Singleton client; shared cache by query key                                                                                 |
| NFR4 (devtools not in prod bundle)                                                             | Decision 4 + §Devtools wiring                                            | Env-branched static import + contingency dynamic import; authoritative grep on `dist/`                                      |
| NFR5 (bundle size ≤ TanStack Query's contribution)                                             | §QueryClient topology                                                    | No additional runtime libraries adopted (Decision 1 no Zustand; Decision 4 devtools is devDependency)                       |
| NFR6 (subscription lifecycle: mount→subscribe, unmount→removeChannel)                          | §useRealtimeSubscription load-bearing invariants                         | Hook-managed cleanup + Phase 1 Vitest test                                                                                  |
| NFR7 (query cancellation on unmount)                                                           | §QueryClient topology                                                    | TanStack default behavior; no override introduced                                                                           |
| NFR8 (`AppContext.tsx` < 200 lines post-Phase-4)                                               | §Adapter bridge teardown                                                 | Phase 4 deletion scope; measurable on PR                                                                                    |
| NFR9 (each migrated hook < pre-migration line count)                                           | §useMutation lifecycle + §Phase 5 file plan                              | Thin wrapper shape + facade under 200 lines                                                                                 |

No FR or NFR is un-addressed.

### Gap analysis

**Critical** (blocks or materially shapes Phase 1+ work):

- **Non-seating `dbToX` transforms must be CREATED; PRD's "continue to exist" wording is inaccurate.** `src/types/seatingChart.ts` has `dbToSeatingChart` etc.; `src/types/database.ts` does NOT have equivalents for `Behavior` / `Student` / `Classroom` / `PointTransaction`. Transform logic lives inline in `AppContext.tsx` `useMemo` blocks at `:690–767`. Migration must create `src/types/transforms.ts` with `dbToBehavior` / `dbToStudent` / `dbToClassroom` / `dbToPointTransaction`. Documented in §Type boundary. Not a blocker — the fix is part of each migration phase's work — but the contributor must not assume the transforms exist.

**Important** (worth noting, not blocking):

- **DB type naming inconsistency.** `src/types/database.ts` exports `Behavior` / `Student` / `Classroom` / `PointTransaction` (no `Db` prefix), colliding with `src/types/index.ts`'s app-side exports. Workaround: aliased imports at every call site (`import type { Classroom as DbClassroom, ... }`). Normalization to `Db*` prefix is a future polish initiative, out of scope. Documented in §Type boundary and Cross-cutting phase notes.
- **`project-context.md` provider-hierarchy listing is stale** — missing `ThemeProvider`. Logged for Phase 6 doc cleanup (Cross-cutting phase notes).

**Nice-to-have** (possible future refinement, not required):

- `invalidateOnReconnect` convenience flag on `useRealtimeSubscription` — can be added later if the `onChange + onReconnect` separate-wiring idiom proves noisy. Deferred.
- Vitest harness for runtime channel count assertion (`supabase.getChannels().length === 2`) — exact shape TBD by Phase 1's pattern note. Until then, the manual DevTools WebSocket-frame smoke test covers the assertion.

### Greppable acceptance hook inventory

Canonical list of verifiable post-migration invariants, consolidated from per-section acceptance blocks. Each hook is either `rg`-based (static inspection) or `wc -l`-based (size invariant) or a runtime assertion (Vitest/Supabase API):

| #   | Phase     | Check                                                                                                                                                    | Pass condition                                                      |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Phase 0   | `npm run build && rg 'tanstack/react-query-devtools' dist/`                                                                                              | 0 matches                                                           |
| 2   | Phase 0   | `npm run build && rg 'ReactQueryDevtools' dist/`                                                                                                         | 0 matches                                                           |
| 3   | Phase 0 + | `rg "queryKey:\s*\[" src/` excluding `src/lib/queryKeys.ts`                                                                                              | 0 matches                                                           |
| 4   | Phase 0 + | `rg "invalidateQueries\(\{\s*queryKey:\s*\[" src/`                                                                                                       | 0 matches                                                           |
| 5   | Phase 1 + | `rg "const previous\s*=" src/hooks/{migrated hook}`                                                                                                      | 0 matches                                                           |
| 6   | Phase 1 + | `rg "useState.*loading\|useState.*error\b" src/hooks/{migrated hook}`                                                                                    | 0 matches                                                           |
| 7   | Phase 1 + | `rg "transform\|dbTo" src/hooks/{migrated hook}`                                                                                                         | Exactly 1 import line                                               |
| 8   | Phase 3   | `rg "onInsert\|onUpdate\|onDelete" src/hooks/useRealtimeSubscription.ts`                                                                                 | 0 matches                                                           |
| 9   | Phase 3   | `rg "onInsert:\|onUpdate:\|onDelete:" src/`                                                                                                              | 0 matches                                                           |
| 10  | Phase 3   | `rg "updateStudentPointsOptimistically\|updateClassroomPointsOptimistically" src/`                                                                       | 0 matches                                                           |
| 11  | Phase 4   | `rg "useApp\(\)\.(students\|classrooms\|behaviors\|transactions\|seatingChart\|layoutPresets)" src/components/`                                          | 0 matches                                                           |
| 12  | Phase 4   | `rg "import.*useStudents\|useClassrooms\|useBehaviors\|useTransactions" src/contexts/AppContext.tsx`                                                     | 0 matches                                                           |
| 13  | Phase 4   | `rg "\bactiveClassroom\b" src/contexts/AppContext.tsx`                                                                                                   | Matches only the ID identifier; no bare `activeClassroom` composite |
| 14  | Phase 4   | `wc -l src/contexts/AppContext.tsx`                                                                                                                      | < 200 (NFR8)                                                        |
| 15  | Phase 5   | `rg "useState.*loading\|useState.*error\b\|const previous\s*=" src/hooks/useSeatingChart*.ts src/hooks/useSeatingGroups.ts src/hooks/useRoomElements.ts` | 0 matches                                                           |
| 16  | Phase 5   | `wc -l src/hooks/useSeatingChart.ts`                                                                                                                     | < 200 (facade only)                                                 |
| 17  | Phase 5   | `rg "supabase\.channel\(" src/hooks/`                                                                                                                    | Exactly 1 match (inside `useRealtimeSubscription.ts`)               |
| 18  | Phase 5   | Runtime: `supabase.getChannels().length === 2` at steady state (active classroom). Seating-chart dropped 2026-05-13 so a 3rd channel must NOT appear.    | true                                                                |
| 19  | Phase 5   | `rg "setQueryData\|invalidateQueries" src/components/seating/`                                                                                           | 0 matches                                                           |

Every check is mechanically verifiable. A PR that fails any check for its phase is a migration-rule violation.

### Readiness assessment

**Overall status: READY FOR IMPLEMENTATION.**

- All four PRD-deferred decisions resolved with rationale and rejected-alternatives recorded.
- Infrastructure contracts (QueryClient config, query keys, mutation lifecycle, realtime signature, adapter bridge, transform location, seating split, devtools wiring, new-files list) specified concretely enough that a contributor (human or AI agent) can produce a migration PR without re-deriving architectural decisions from first principles.
- Greppable acceptance hooks provide mechanical per-phase verification.
- Cross-cutting phase notes surface items (auth-transition `queryClient.clear()`, `project-context.md` update, `visibilitychange` listener removal, time-totals aggregation elimination, type-naming polish) with explicit phase assignment.
- Known gaps (non-seating `dbToX` transforms must be created; DB-type naming inconsistency) are flagged in-context, not hidden.

**First implementation step:** Phase 0 — add `@tanstack/react-query` and `@tanstack/react-query-devtools` to `package.json` per §QueryClient topology installation notes; create `src/lib/queryClient.ts` and `src/lib/queryKeys.ts` from the templates in §QueryClient topology and §Query key conventions; wire `main.tsx` per the §QueryClient topology provider-layering block; verify NFR4 via the `dist/` grep (§Devtools mount wiring). No existing source is modified beyond `src/main.tsx`.

**What the architecture does NOT cover** (by design, per workflow scope):

- No UX design (PRD has no UX surface; separate future DP workflow).
- No schema/migration design (DB layer unchanged; PRD non-goal).
- No deployment/infra changes (single-tenant solo-contributor; PRD non-goal).
- No test-framework expansion (separate BMAD TEA initiative explicitly scoped as its own PRD).
- No time estimates / staffing plan / rollback strategy beyond `git revert` (PRD non-goals).

### Workflow state

Frontmatter `stepsCompleted` reflects the option-2-hybrid flow: `step-01-init`, `step-02-context`, `consolidated-decisions-patterns-structure`, `step-07-validation`, `step-08-complete`. `status: complete`. `completedAt: 2026-04-21`. Workflow closed.

## Handoff

Architecture workflow complete. The doc above is the single source of truth for the state-management modernization — every Phase 0 through Phase 6 PR reads from here rather than re-deriving decisions from the PRD.

**Implementation entry point:** Phase 0 per §QueryClient topology. Install `@tanstack/react-query` (runtime) and `@tanstack/react-query-devtools` (devDependency); create `src/lib/queryClient.ts` and `src/lib/queryKeys.ts` from the templates; modify `src/main.tsx` per the provider-layering block; run `npm run build && rg 'tanstack/react-query-devtools' dist/` for NFR4. No other source files touched.

**For any contributor (human or AI) working on a migration PR:**

- Read the Decision for context on the relevant design choice; read the Infrastructure section for the canonical pattern; run the greppable acceptance hooks in the PR's phase column (see §Architecture Validation, hook inventory table).
- If the PR needs to deviate, update this document with the rationale before landing the code. The doc is the authority.

**Follow-up initiatives flagged here but intentionally out of scope:**

- Future test-hardening via BMAD TEA (separate PRD).
- `src/types/database.ts` `Db*`-prefix normalization (cross-cutting naming polish; touches every hook and context file).
- `SeatingChartEditor.tsx` sub-component split + seating-scoped Zustand adoption (Decision 1 deferred direction).
- URL-shareable classroom selection (Decision 2 reconsider trigger: requires router adoption).

Ready for implementation.
