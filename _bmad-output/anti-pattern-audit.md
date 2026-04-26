# ClassPoints Anti-Pattern Audit

**Date:** 2026-04-25
**Branch:** main @ `613a010`
**Method:** 5 parallel category-specialist agents (hooks/effects, components, type-system, error-handling, structural/dead-code) scanning post-Phase-3 codebase, then a cynical adversarial review pass that verified every finding against the actual code at the cited file:line refs.

**Severity rubric:**

- 3 = anti-pattern, AI WILL replicate if shown
- 4 = bug-prone, AI replication = real issues
- 5 = production hazard / actively masks bugs

**Verdict tags:**

- ✅ **REAL** — finding stands as written
- ⚠️ **OVERSTATED** — issue exists, but severity/scope/recommendation is inflated
- ❌ **FALSE POSITIVE** — audit is wrong on the facts; do not act on it

---

## TL;DR

Post-refactor codebase is much cleaner than pre-refactor. After cynical review, ~70% of the original audit survives intact. Net work: **~3 hours** for the items that matter, not the originally-claimed 5.

| #   | Cluster                                      | Verdict               | Severity  | Fix effort                                      |
| --- | -------------------------------------------- | --------------------- | --------- | ----------------------------------------------- |
| 1   | Supabase error-code loss                     | ✅ REAL               | 4         | ~30 min                                         |
| 2   | Silent batch-failure swallows                | ✅ REAL (understated) | 5         | ~1 hr                                           |
| 3a  | `isBatch + isClassWide` discriminated union  | ⚠️ OVERSTATED         | 3 (style) | ~1 hr — defer                                   |
| 3b  | `as unknown as` in `useRealtimeSubscription` | ⚠️ OVERSTATED         | 3         | skip                                            |
| 3b' | `as unknown as` in test mocks                | ❌ FALSE POSITIVE     | —         | skip                                            |
| 3c  | Plain `as T` on realtime/JSONB payloads      | ✅ REAL (narrower)    | 4         | ~30 min                                         |
| 4a  | Legacy `useRealtimeSubscription` callbacks   | ⚠️ OVERSTATED         | 3         | opportunistic                                   |
| 4b  | DashboardView 1Hz polling                    | ✅ REAL               | 4         | tracked as deferred #6                          |
| 4c  | `ProfileView` direct supabase import         | ⚠️ OVERSTATED         | 3         | ~30 min when adding `useAuth.updateDisplayName` |
| 5   | Mega-files & mega-hooks                      | ✅ REAL               | 3-4       | 2-4 hr                                          |

---

## Cluster 1 — Supabase error-code loss [✅ REAL, sev 4]

**Pattern:** TanStack Query hooks do `if (error) throw new Error(error.message)`, dropping `error.code` (`PGRST116`, `42501`, etc.).

**Verified hits:**

- `src/hooks/useTransactions.ts:79`
- `src/hooks/useStudents.ts:192, 240, 265, 292, 309`
- `src/hooks/useBehaviors.ts:26, 37, 59, 71`
- `src/hooks/useClassrooms.ts:28, 29, 108, 132, 144`
- `src/hooks/useLayoutPresets.ts:38, 122, 148`

**Why it matters (proven, not hypothetical):** `src/contexts/SoundContext.tsx:148` already does `if (fetchError.code === 'PGRST116')`. The codebase is already paying for the lost code — anywhere else that wants to discriminate row-not-found from RLS-denied is locked out today.

**Correction from cynical review:** Audit originally cited `useSeatingChart.ts:145, 195, 327, 715, 801`. Those are NOT this pattern — those are `setError(err instanceof Error ? err : new Error('Failed to X'))` which preserves `err.message` when err is an Error. The `useSeatingChart` throws happen at lines 134, 176, 293, 714, 775. Also: `useSeatingChart` is not a TanStack hook; it's still `useState`+`useEffect`. Removed from cluster.

**Fix:** One-liner in `src/lib/supabase.ts`:

```ts
import type { PostgrestError } from '@supabase/supabase-js';

export function unwrap<T>(result: { data: T; error: PostgrestError | null }): T {
  if (result.error) throw result.error; // preserves .code, .details, .hint
  return result.data;
}
```

Then `const data = unwrap(await supabase.from(...).select())`.

---

## Cluster 2 — Silent batch-failure swallows [✅ REAL, sev 5 — UNDERSTATED]

**Pattern:** `Promise.all` with per-item `.catch(err => { console.error(err); return null })`. Caller filters nulls and reports "success" while N students silently got nothing.

**Verified hits:**

- `src/contexts/AppContext.tsx:419-422` — `awardClassPoints` per-student `.catch`
- `src/contexts/AppContext.tsx:465-468` — `awardPointsToStudents` per-student `.catch`

**The audit missed the worst part — there are LIES in the codebase:**

- `src/components/points/ClassAwardModal.tsx:64` has `// awardClassPoints throws on error with automatic rollback`
- `src/components/points/MultiAwardModal.tsx:62` has the same comment

Both comments are false. The wrapper never throws — partial failures are filtered to nulls and "success" returns silently. Future maintainers reading those comments will trust them.

**`useDisplaySettings.ts:38-40, 44-49`** is REAL but a separate concern at sev 3-4 (localStorage failures are not the same severity as silent DB writes); pulling it out of this cluster.

**Fix:**

1. `Promise.allSettled` + explicit toast: "X of Y students received points. Z failed."
2. Delete the lying comments in `ClassAwardModal:64` and `MultiAwardModal:62`.

---

## Cluster 3 — Lying types & laundering casts

### 3a. `isBatch + isClassWide` flag pair [⚠️ OVERSTATED — sev 3 style improvement]

**`src/types/index.ts:86-97`** — `UndoableAction` encodes 3 mutually-exclusive states with 2 booleans. The combo `isBatch=false, isClassWide=true` is meaningless but compiles.

**Correction from cynical review:** Audit claimed "already burned us once (Phase 2.5 toast bug)." That's mis-attributed — the Phase 2.5 bug was that `batchKindRef` didn't exist at all (no kind tracking anywhere); a discriminated union wouldn't have prevented it. The fix that landed (adding the kind tag) IS the equivalent of the discriminated union. So the change is a style improvement, not a bug-prevention.

**Fix:** Optional refactor to `kind: 'single' | 'subset' | 'classwide'`. Defer.

### 3b. `as unknown as` laundering

**`src/hooks/useRealtimeSubscription.ts:118-126`** — ⚠️ **OVERSTATED, sev 3.** Supabase's `.on('postgres_changes', …)` signature genuinely requires literal-typed config; the cast works around an over-strict third-party type, not a real bug. The audit's "extract proper adapter types" recommendation may not actually compile against Supabase's signature. Skip.

**`src/test/sounds.test.ts:139, 323, 341`** — ❌ **FALSE POSITIVE.** (Audit had wrong path: `tests/sounds.test.ts` doesn't exist.) `new MockAudioContext() as unknown as AudioContext` and `vi.fn() as unknown as typeof fetch` are standard vitest practice. `class MockAudioContext implements AudioContext` would force implementing every method on `AudioContext`/`Response`/`Headers` for tests that touch 2-3 of them. Skip.

### 3c. Plain `as T` on untrusted data [✅ REAL — narrower scope]

**Verified real:**

- `src/hooks/useRealtimeSubscription.ts:135-141` — `payload.new as T`, `payload.old as D` — generic cast on realtime payloads with no schema check
- `src/hooks/useLayoutPresets.ts:41` — `data.map((p) => dbToLayoutPreset(p as DbLayoutPreset))` on raw query rows
- `src/types/seatingChart.ts:211` — `preset.layout_data as LayoutPresetData` on opaque JSONB column (the most legitimate concern; JSONB has zero type guarantees)

**Removed from cluster:** `src/utils/migrateToSupabase.ts:223, 272, 300, 327`. The Supabase client is `createClient<Database>(...)` (see `src/lib/supabase.ts:11`) — `.from('classrooms').insert(...).select().single()` already returns typed `data`. Those casts are redundant, not unsafe laundering. Fix is to delete the cast, not validate.

**Fix:** Schema validator (zod / valibot) at the `queryFn` boundary for the 3 sites above. The transforms layer (`src/types/transforms.ts`) is the natural place. JSONB is the priority.

---

## Cluster 4 — Legacy dual-mode patterns

### 4a. `useRealtimeSubscription` legacy callbacks [⚠️ OVERSTATED, sev 3]

`src/hooks/useRealtimeSubscription.ts:17, 22-24` exposes `onInsert/onUpdate/onDelete` legacy alongside the new `onChange`. `useLayoutPresets:58-74` is the last consumer.

**Correction:** The file already has a dev-mode warning at lines 78-83 when both legacy and new are supplied. AI-replication risk is bounded by the warning. Sev 3, not 4. Migrate `useLayoutPresets` opportunistically; deletion of the legacy interface can wait.

### 4b. DashboardView 1Hz polling [✅ REAL, sev 4]

`src/components/dashboard/DashboardView.tsx:57-63` `setInterval(1000ms)` + `setTimeout(100ms)` in 3 modal close handlers (lines 115-117, 123-125, 133-135). All confirmed. Already deferred-work entry #6.

### 4c. `ProfileView` direct supabase import [⚠️ OVERSTATED, sev 3]

`src/components/profile/ProfileView.tsx:4` imports supabase directly.

**Correction:** Only DB-ish call is `ProfileView.tsx:67`: `supabase.auth.updateUser({ data: { name } })` — that's an **auth** call, not a classroom-DB call. Audit's "license to reach for the DB anywhere" framing was rhetorical; actual scope is one auth call. The fix is to add `updateDisplayName` to `useAuth` first, then route. Defer until next auth touch.

---

## Cluster 5 — Mega-files & mega-hooks [✅ REAL, sev 3-4]

**`src/hooks/useSeatingChart.ts`** returns **23 values** (audit said 24): 3 query state + 17 op functions + 3 computed (`chart, loading, error, createChart, updateSettings, deleteChart, addGroup, moveGroup, deleteGroup, rotateGroup, assignStudent, unassignStudent, swapStudents, randomizeAssignments, addRoomElement, moveRoomElement, resizeRoomElement, deleteRoomElement, rotateRoomElement, unassignedStudents, assignedStudentIds, applyPreset, refetch`). AI will take this as the template for every feature hook.

**Other 5+ return hooks (verified counts):**

- `useDisplaySettings.ts` — 6 values
- `useSoundEffects.ts` — 7 values
- `useLayoutPresets.ts` — 6 values

**Mega components:**

- `src/components/seating/SeatingChartEditor.tsx` — 1350 LOC mixing drag/drop + state + UI + 17 prop callbacks
- `src/components/dashboard/DashboardView.tsx` — 419 LOC, borderline

**Fix:** Reshape `useSeatingChart` to grouped-object return `{ data, ops, computed }` or split into co-located feature hooks (`useSeatingChartGroups`, `useSeatingChartElements`, `useSeatingChartAssignments`). Component refactor is bigger work — defer.

---

## Lower-impact patterns (post cynical review)

### ✅ Real

| Pattern                                                               | Hits (verified)                                             | Fix                                                                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Hardcoded table names — actual count is **65** in `src/`, not "22+"   | All hooks                                                   | `src/lib/tableNames.ts` constants                                                                                                            |
| Magic `'theme'` localStorage key                                      | `ThemeContext.tsx:15, 37, 44`                               | `THEME_STORAGE_KEY` const                                                                                                                    |
| Modal duplication: 3 modals reimplement fixed-inset/escape/overflow   | `ClassAwardModal`, `AwardPointsModal`, `SoundSettingsModal` | Use existing `ui/Modal` wrapper                                                                                                              |
| `key={index}` on static lists                                         | `ImportStudentsModal:181, 206`, `MigrationWizard:250, 286`  | Stable keys (note: student names CAN duplicate, so `key={name}` is wrong — use composite or DB id)                                           |
| Cargo-cult `useCallback` in non-memo contexts                         | `ClassroomCard:10`, `StudentPointCard:67`                   | Drop the useCallback (the `memo` wrappers don't help inner-function stability)                                                               |
| `usePersistedState.ts:16-19` exposes no error state for parse failure | 1 site                                                      | Expose `loadError` from hook (audit was wrong that it "swallows silently" — it does `console.error`; only the "no exposed error" part holds) |
| `Partial<T>` as "fill in later"                                       | 13 sites in `src/` (audit said 14)                          | Strict input types, especially in test factories                                                                                             |
| Wildcard re-export                                                    | `src/types/index.ts:6` (`export * from './seatingChart'`)   | Explicit `export type {...}`                                                                                                                 |

### ❌ False positives — do NOT act on

| Pattern                                                                                                   | Why it's wrong                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implicit `any` in catch blocks (`SoundContext.tsx:96, 156`, `AppContext.tsx:269, 281, 293, 305, 645`)     | `tsconfig.app.json:19` has `strict: true`, which since TS 4.4 includes `useUnknownInCatchVariables`. Catch params are already `unknown`. Recommended fix is a no-op.     |
| `SoundContext` sets `error` state nobody reads (`:157-158, 188-189`)                                      | `SoundSettings.tsx:16` destructures `error` from `useSoundContext()`, lines 100-102 render it. Consumer exists.                                                          |
| `LeaderboardCard.tsx:138` "nested ternary 4-deep"                                                         | It's 3-deep (`rank===1 ? '🥇' : rank===2 ? '🥈' : rank===3 ? '🥉' : null`). Inline lookup is the right call here.                                                        |
| `App.tsx:78, 91` "defensive null checks for impossible states"                                            | Those handle a real cross-device race (classroom deleted while user is mid-click). Not impossible.                                                                       |
| Generic `'Failed to X'` errors at `useSeatingChart.ts:145/195/327/715/801`, `useLayoutPresets.ts:133/153` | These use `err instanceof Error ? err : new Error('Failed to X')` — original `err.message` IS preserved when err is an Error. Fallback only for non-Error throws (rare). |
| Orphaned files `e2e.legacy/`, `playwright-legacy-config.ts`                                               | `tests/README.md` keeps them as in-flight port reference. Don't `git rm`.                                                                                                |

### 🆕 Findings the audit MISSED

| Finding                                                                                | Severity | Notes                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `App.tsx:112` is a default export                                                      | —        | Audit's "zero default exports" claim was wrong. (CLAUDE.md doesn't actually mandate against defaults — that part of the audit's framing was invented.) |
| `usePersistedState` exported from `hooks/index.ts:1` with **zero importers** in `src/` | sev 3    | Real dead code. `git rm` candidate.                                                                                                                    |

---

## What WAS verified clean

- Zero `any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`
- Zero conditional hooks (rule-of-hooks clean)
- Zero `console.log` in production paths (only in guarded test/dev branches)
- Zero direct DOM manipulation (no `document.getElementById`, no `.innerHTML`)
- Zero unused npm dependencies
- Zero config drift between vite/tsconfig/playwright/vitest
- Zero prop drilling 3+ levels deep
- Zero render-time side effects
- Zero unhandled promises in event handlers
- Zero stale-closure handlers
- Zero controlled/uncontrolled input mismatches
- Zero `useState` that should be `useRef`
- Zero TODO/FIXME/HACK/XXX without context

---

## Recommended fix order (revised post cynical review)

~3 hours total for items that actually matter:

1. **Cluster 1 — Supabase `unwrap()` helper** (~30 min). Single largest win; consumer already exists at `SoundContext:148`.
2. **Cluster 2 — Batch-failure surfacing** (~1 hr). Includes deleting the LYING comments at `ClassAwardModal:64` and `MultiAwardModal:62`.
3. **Cluster 3c — Realtime/JSONB validation** (~30 min). Schema-validate the 3 narrow sites (realtime payloads, layout_presets row, layout_data JSONB).
4. **Hardcoded table names → const** (~30 min). 65 hits, batch-replaceable.
5. **Cluster 5 — `useSeatingChart` reshape** (~2-4 hr). Biggest template hazard. Defer to its own PR.

**Optional batch cleanup PR (1-2 hr opportunistically):**

- `usePersistedState` removal (verified dead code)
- Modal duplication → `ui/Modal`
- Magic theme key → const
- Cargo-cult `useCallback` removal
- Wildcard re-export → explicit

**Defer:**

- 3a discriminated union (style only, no bug prevention)
- 4a kill legacy `useRealtimeSubscription` callbacks (warning is in place)
- 4c `ProfileView` (do when next touching auth flow)

---

## Audit-quality notes

The structural critiques mostly survived. The numbers and citations did not all hold up:

- `tests/sounds.test.ts` cited 3x — actual path is `src/test/sounds.test.ts`
- `useSeatingChart` returns 23, not 24
- `Partial<T>` count is 13, not 14
- Hardcoded table names: 65, not "22+" (audit was _under_-counted)
- `LeaderboardCard` ternary: 3-deep, not 4
- "Zero default exports" was wrong (App.tsx:112)

When triaging future audits, verify file:line refs and counts before acting. Roughly 30% of the lower-impact table was false-positive noise that would have wasted effort.

---

## Methodology notes

- 5 parallel `Explore` agents on team `classpoints-pattern-audit`, each scanning one independent category
- Cynical adversarial review pass after consolidation, verifying every claim against the actual code at HEAD `613a010`
- Severity ≥3 only — sev 1-2 nitpicks intentionally suppressed
- Excluded from scan: `node_modules/`, `dist/`, `_bmad-output/`, `_bmad/`, `.bmad/`, `.agents/`, `.claude/`, `playwright-report/`, `test-results/`, ADRs, prior-phase specs, deferred-work.md, CLAUDE.md, AGENTS.md
