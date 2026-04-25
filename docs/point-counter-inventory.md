# Point Counter Inventory

Reference map of every point-counter rendered or computed in the UI, with its data source and code location. Use this before any migration that touches `students.point_total`, the `get_student_time_totals` RPC, or related fields.

**Sweep method:** exhaustive ripgrep over `src/` for all 10 field-name variants (`pointTotal`/`point_total`, `todayTotal`/`today_total`, `thisWeekTotal`/`this_week_total`, `positiveTotal`/`positive_total`, `negativeTotal`/`negative_total`) plus indirect refs (`classPoints.total`, `points.total`). Test files excluded; type defs and comments excluded from render count.

Last swept: 2026-04-24 against commit `9c7205e` (branch `phase-2-tanstack-classrooms-transactions`).

Screenshots of every counter type rendered with seeded data live in `docs/screenshots/counters/`. Each counter type below names the file(s) where it's visible. To re-capture, run the dev server against local Supabase, seed via `npx tsx scripts/seed-counter-data.ts`, log in as `test@classpoints.local`, and walk the same paths.

---

## Counter types (by scope)

### Student-scoped

**A. Student lifetime net** — big signed number, green when ≥ 0, red when < 0.
Render sites:

- `src/components/students/StudentPointCard.tsx:143-146` (class view) — see `screenshots/counters/02-class-view-default.png`
- `src/components/seating/SeatCard.tsx:103-104` (seating chart seat) — see `screenshots/counters/10-seating-chart.png`
- `src/components/seating/SeatingChartCanvas.tsx:178-181` (chart canvas) — same screenshot
- `src/components/seating/SeatingChartEditor.tsx:1339-1342` (drag indicator) — not captured (transient, only visible during drag)
- `src/components/settings/ClassSettingsView.tsx:222-223` (management list, " pts" suffix) — see `screenshots/counters/08-class-settings.png`
- `src/components/settings/AdjustPointsModal.tsx:26,34` (modal default value) — see `screenshots/counters/09-adjust-points-modal.png`
- `src/components/points/AwardPointsModal.tsx:117-118` (modal header) — see `screenshots/counters/06-award-points-modal.png`

**B. Student lifetime +/- split** — paired green `+positiveTotal` / red `negativeTotal`.
Render sites:

- `src/components/students/StudentPointCard.tsx:116,122` (corner badges — gated by `showPointTotals && !isSelectable`, toggled via `+/-` button in toolbar) — see `screenshots/counters/03-student-card-corner-badges.png`
- `src/components/seating/SeatCard.tsx:79,83` — see `screenshots/counters/10-seating-chart.png`

**C. Student today delta** — small `Today: +X` under the lifetime net.
Render sites:

- `src/components/students/StudentPointCard.tsx:149-154` — **hides entirely when `todayTotal === 0`** — see `screenshots/counters/02-class-view-default.png`

### Classroom-scoped

**D. Classroom lifetime net** — classroom-wide sum, displayed large or small depending on context.
Render sites:

- `src/components/points/ClassPointsBox.tsx:39` (Class Total banner — very large, via `activeClassroom.pointTotal` fed from `src/components/dashboard/DashboardView.tsx:315-328, 393-405`) — see `screenshots/counters/02-class-view-default.png`
- `src/components/home/ClassroomCard.tsx:37-38` (home grid tile) — see `screenshots/counters/04-home-dashboard.png`
- `src/components/layout/Sidebar.tsx:104-110` (sidebar per-classroom row) — see `screenshots/counters/01-sidebar-classroom-list.png`
- `src/components/profile/ProfileView.tsx:288-302` (profile view, " points" suffix) — see `screenshots/counters/05-profile-view.png`
- `src/components/points/ClassAwardModal.tsx:123-124` (class award modal header) — see `screenshots/counters/07-class-award-modal.png`

**E. Classroom lifetime +/- split** — paired green `+674` / red `-202`.
Render sites:

- `src/components/points/ClassPointsBox.tsx:34-35` (Class Total banner) — see `screenshots/counters/02-class-view-default.png`
- `src/components/home/ClassroomCard.tsx:41-42` (home grid tile) — see `screenshots/counters/04-home-dashboard.png`
- `src/components/layout/Sidebar.tsx:119-121` — **gated by `isActive && hasBreakdown`** (only selected classroom shows it) — see `screenshots/counters/02-class-view-default.png`

**F. Classroom today delta** — `Today: +X` on the Class Total banner.
Render sites:

- `src/components/points/ClassPointsBox.tsx:39` (always visible, shows `+0` when zero) — see `screenshots/counters/02-class-view-default.png`

**G. Classroom week delta** — `Week: +X` on the Class Total banner.
Render sites:

- `src/components/points/ClassPointsBox.tsx:39-40` (always visible) — see `screenshots/counters/02-class-view-default.png`

### Cross-classroom (home dashboard)

**H. All-classrooms aggregate lifetime net** — sum of `pointTotal` across every classroom the teacher owns.
Render site:

- `src/components/home/TeacherDashboard.tsx:27` (computed in `stats.totalPoints` useMemo; displayed on home landing) — see `screenshots/counters/04-home-dashboard.png` (green "Total Points" tile)

**I. All-classrooms aggregate today delta** — sum of `todayTotal` across every classroom.
Render site:

- `src/components/home/TeacherDashboard.tsx:29` (computed in `stats.todayPoints` useMemo) — see `screenshots/counters/04-home-dashboard.png` (purple "Points Today" tile)

### Leaderboard (derived rankings)

**J. Leaderboard ranked values** — per-student values displayed inside ranked lists (4 category tabs: Today, This Week, Best Behaved, Rising Stars).
Compute site:

- `src/utils/leaderboardCalculations.ts` — `getTodayLeaders` (line 35-40 sorts by `todayTotal`), `getThisWeekLeaders` (68-73 sorts by `thisWeekTotal`), `getBestBehaved` (84-88 uses `positiveTotal`/`negativeTotal` ratio), `getMilestoneAchievers` (105-110 filters on `pointTotal`).
  Render site:
- `src/components/home/LeaderboardCard.tsx` (displays `entries[].value` from above) — see `screenshots/counters/04-home-dashboard.png` ("Today's Stars" panel — only the Today category is captured)

---

## Data sources

| Counter                                      | DB source                                     | Maintained by                                                                            | Client read path                                                                        |
| -------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Student lifetime net (`point_total`)         | `students.point_total` column                 | DB trigger on `point_transactions` INSERT/DELETE                                         | `useStudents.queryFn` → `students[i].point_total`                                       |
| Student lifetime positive (`positive_total`) | `students.positive_total` column              | Same DB trigger                                                                          | Same path                                                                               |
| Student lifetime negative (`negative_total`) | `students.negative_total` column              | Same DB trigger                                                                          | Same path                                                                               |
| Student today delta (`today_total`)          | **Computed** by RPC `get_student_time_totals` | Returned fresh per query from `point_transactions` in today's window                     | `useStudents.fetchStudents` calls the RPC; also called in `useClassrooms.queryFn:50-58` |
| Student week delta (`this_week_total`)       | **Computed** by the same RPC                  | Same                                                                                     | Same                                                                                    |
| Classroom lifetime net/+/-                   | Aggregated client-side from students          | Summed in `useClassrooms.queryFn:72-98`                                                  | `classrooms.all` cache → `ClassroomWithCount`                                           |
| Classroom today/week                         | Aggregated client-side                        | Summed in `AppContext.tsx:662-693` (`todayTotal`/`thisWeekTotal` reduce over `students`) | `activeClassroom` useMemo                                                               |
| All-classrooms aggregates (H, I)             | Aggregated client-side                        | Summed in `TeacherDashboard.tsx:27-31` reduce over `classrooms`                          | Home view only                                                                          |

**Key asymmetry:** lifetime values live in columns (trigger-maintained, autoreactive to transaction changes via realtime). Time-windowed values (today/week) are RPC-computed on each fetch and require **explicit refetch invalidation** — they don't self-update when transactions change.

---

## Write paths

1. **Server-authoritative writes**
   - `point_transactions.INSERT` → DB trigger bumps `students.point_total`/`positive_total`/`negative_total`
   - `point_transactions.DELETE` → DB trigger decrements same columns
   - Today/week totals are never written; they're always derived at read time by the RPC

2. **Optimistic client writes (Phase 2)**
   - `src/hooks/useTransactions.ts:132-160` — `useAwardPoints.onMutate` patches `classrooms.all` cache (bumps classroom-aggregate +/- / today / week)
   - `src/hooks/useStudents.ts:389-393` — `updateStudentPointsOptimistically` patches `useStudents` local state (bumps all five fields)

3. **Optimistic rollback**
   - `src/hooks/useTransactions.ts:168-178` — `useAwardPoints.onError` restores `context.previousTransactions` / `context.previousClassrooms` snapshots (⚠ known partial-batch race, see recent investigation)
   - `src/contexts/AppContext.tsx:345, 385, 430` — `awardPoints` wrappers call `updateStudentPointsOptimistically(-points)` to unwind student state

4. **Realtime-driven writes**
   - `src/hooks/useStudents.ts:215-253` — `point_transactions` DELETE subscription decrements student time-based totals
   - `src/hooks/useStudents.ts:176-201` — `students` UPDATE subscription refreshes lifetime totals (**preserves** today/week, per line 188 comment)
   - `src/hooks/useClassrooms.ts:25-30` — `students` subscription invalidates `classrooms.all` via `onChange`

5. **Explicit refetch (Phase 2 bug fix, commit `9c7205e`)**
   - `src/contexts/AppContext.tsx:442-465` — `undoTransaction` / `undoBatchTransaction` force `refetchStudents()` because the realtime DELETE handler was unreliable
   - Same pattern in `clearStudentPoints` (577-582) and `resetClassroomPoints` (630-646)

---

## Migration impact map

If a future migration touches...

- **`students.point_total` column name or semantics:** audit all 7 render sites under **A** + both under **B** + all 5 under **D** + both under **E** + **H** + leaderboard `pointTotal` calculations. Plus the type chain: `src/types/transforms.ts:29,39,49,63` and `src/types/index.ts:41,55`.
- **`students.positive_total` / `negative_total`:** audit **B** (2 sites), **E** (3 sites), and leaderboard `getBestBehaved` compute.
- **`get_student_time_totals` RPC signature or output:** audit **C** (student today render), **F**, **G**, **I**, plus leaderboard `getTodayLeaders` / `getThisWeekLeaders`. Also the two callers: `useStudents.fetchStudents:93-113` and `useClassrooms.queryFn:50-70`.
- **Transaction trigger behavior:** the column writes AND the realtime event shapes change together. Re-verify the unreliable DELETE handler path at `useStudents.ts:215-253` if REPLICA IDENTITY is modified.

---

## How to re-run the sweep

```sh
# Find every field reference (render, read, write, type):
rg -n "pointTotal|point_total|todayTotal|today_total|thisWeekTotal|this_week_total|positiveTotal|positive_total|negativeTotal|negative_total" src/

# Find indirect references via structural destructure:
rg -n "classPoints\.|points\.(total|today|thisWeek|positiveTotal|negativeTotal)" src/components/
```

Cross-check against this doc; any new hit that isn't in the tables above is a new render site or compute site and should be appended.

---

## Simplification Opportunities

The render sites above show three patterns repeating with only cosmetic variation. The opportunities below collapse those repetitions without changing data flow, schema, or RPC contracts. Each is scoped to leaf presentation or a small util; none touches the useStudents fetch path, so all are independent of the upcoming Phase 3 hook rewrite — except where noted.

### Summary

| ID  | Opportunity                                  | Effort     | Sites collapsed          | Sequencing                                            |
| --- | -------------------------------------------- | ---------- | ------------------------ | ----------------------------------------------------- |
| S1  | `<SignedPoints>` formatter                   | Low (~1h)  | 14 spans across 11 files | Land any time                                         |
| S2  | `<PointsSplitBadges>` paired-badge component | Low (~1h)  | 5 sites                  | Land any time                                         |
| S3  | `sumBy` helper for classroom/student rollups | Low (~30m) | 2 reduce blocks          | Split: TeacherDashboard now, AppContext after Phase 3 |

### S1. Extract `<SignedPoints>` formatter

The expression `{value >= 0 ? '+' : ''}{value}` — usually paired with a green/red color ternary — appears in every site that renders a signed point count.

**Sites to collapse:**

- `src/components/students/StudentPointCard.tsx:143-146` (lifetime, `${config.points} font-bold`)
- `src/components/students/StudentPointCard.tsx:149-154` (`Today: ` prefix; **keep the `todayTotal !== 0` gate at the call site**)
- `src/components/seating/SeatCard.tsx:102-105` (xs)
- `src/components/seating/SeatingChartCanvas.tsx:177-182` (xs, inline color ternary)
- `src/components/seating/SeatingChartEditor.tsx:1338-1343` (drag overlay, sm)
- `src/components/settings/ClassSettingsView.tsx:222-223` (` pts` suffix; **wrap call site preserves the `sr-only` "positive"/"negative" label — don't bake accessibility into the component**)
- `src/components/points/AwardPointsModal.tsx:117-118` (modal header, `font-semibold`)
- `src/components/points/ClassAwardModal.tsx:123-124` (same shape)
- `src/components/points/ClassPointsBox.tsx:30-31` (classroom net, large white)
- `src/components/points/ClassPointsBox.tsx:38-40` (`Today: ` and `Week: ` prefixes — both signed, both always-visible, no zero hide)
- `src/components/home/ClassroomCard.tsx:37-38` (lifetime, white)
- `src/components/layout/Sidebar.tsx:104-110` (lifetime, color ternary based on sign)
- `src/components/profile/ProfileView.tsx:301-302` (` points` suffix + `sr-only` label, same wrap policy as ClassSettingsView)

**Shape:** `<SignedPoints value={n} prefix?="Today: " suffix?=" pts" colorize?: boolean className?: string />` rendering `<span>{prefix}{sign}{value}{suffix}</span>`. Default `colorize=true` applies `text-emerald-*` / `text-red-*` based on `value >= 0`; pass `colorize={false}` for Sidebar (which uses different green/red shades) and the white-on-gradient sites (ClassPointsBox, ClassroomCard, AwardPointsModal, ClassAwardModal). Caller-supplied `className` controls size/weight.

**Do not** also migrate `src/components/settings/AdjustPointsModal.tsx:26,34`. That site references `student.pointTotal` as a numeric form value (`String(...)`, `parseInt(targetPoints, 10)`), not a signed render. The inventory lists it under counter type **A** because the field is the same column, but the use is structurally different.

**Effort:** Low, ~1h. Add `src/components/ui/SignedPoints.tsx` plus 14 call-site rewrites. No state, no data dependencies. Verify visually — the risk surface is purely cosmetic.

**Sequencing:** Land any time. Phase 3's useStudents rewrite changes the queryFn and cache shape, not the `AppStudent.pointTotal` consumption surface that these leaves depend on, so merge risk is minimal.

### S2. Extract `<PointsSplitBadges>` paired-badge component

The pair `<span class="...emerald...">+{positiveTotal}</span>` / `<span class="...red...">{negativeTotal}</span>` appears with two stylistic variants: corner-positioned pill badges (student-scoped) and inline color tokens (classroom-scoped).

**Sites to collapse:**

- `src/components/students/StudentPointCard.tsx:113-124` — corner badges, `bg-emerald-100/text-emerald-700` + `bg-red-100/text-red-700`, gated by `showPointTotals && !isSelectable`
- `src/components/seating/SeatCard.tsx:77-85` — identical corner-badge shape, gated by `showPointBreakdown`
- `src/components/points/ClassPointsBox.tsx:33-36` — inline `text-emerald-300` / `text-red-300` on purple gradient
- `src/components/home/ClassroomCard.tsx:40-43` — inline `text-emerald-300` / `text-red-300` on blue gradient
- `src/components/layout/Sidebar.tsx:117-124` — inline `text-emerald-300/80` / `text-red-300/80` with `' / '` separator, gated by `isActive && hasBreakdown`

**Shape:** `<PointsSplitBadges positive={p} negative={n} variant="pill" | "inline" separator?: string />`. Two variants are sufficient; don't add per-shade props. Keep the visibility gates (`showPointTotals`, `showPointBreakdown`, `isActive && hasBreakdown`) at the call site — those are policy decisions, not styling.

**Effort:** Low, ~1h. Add `src/components/ui/PointsSplitBadges.tsx` plus 5 call-site rewrites.

**Sequencing:** Land any time. Same Phase-3 reasoning as S1.

### S3. Co-locate `sumBy` helper for classroom/student rollups

Two `.reduce()` blocks aggregate point fields across arrays. Both are trivial sums but written longhand.

**Sites to collapse:**

- `src/components/home/TeacherDashboard.tsx:27-31` — `totalPoints` and `todayPoints` reduce over `classrooms`. Stat tiles on the home view.
- `src/contexts/AppContext.tsx:679-680` — `todayTotal` and `thisWeekTotal` reduce over `students` inside the `mappedClassrooms` useMemo. Drives counter type **F** / **G** when the classroom is active.

**Shape:** `sumBy<T, K extends keyof T>(items: T[], key: K): number` in `src/utils/aggregates.ts`, treating `undefined` / `null` as 0 to preserve the current `?? 0` semantics at TeacherDashboard. Two-argument generic; no callback variant.

**Effort:** Low, ~30m for the helper plus both call sites — but split across two PRs:

1. **Now:** TeacherDashboard.tsx. Reduces over `classrooms` (already on the Phase 2 useClassrooms TanStack hook). Safe.
2. **After Phase 3:** AppContext.tsx:679-680. Reduces over `students`, which Phase 3 will rewrite into the useStudents TanStack hook. The aggregation may move into the hook's `select` or a derived selector entirely, which would delete this reduce rather than refactor it. Defer until Phase 3 lands and decides where the sum lives.

### Out of scope (intentional non-opportunities)

- **Leaderboard compute consolidation.** The four functions in `src/utils/leaderboardCalculations.ts` (`getTodayLeaders`, `getThisWeekLeaders`, `getBestBehaved`, `getMilestoneAchievers`) share visual presentation but use different sort keys, secondary criteria, and filters. The duplication is shallow; collapsing them would force a flag-driven mega-function.
- **Lifetime vs. time-window asymmetry.** The "Key asymmetry" note above documents that lifetime values are trigger-maintained columns and today/week values are RPC-computed at read time. Resolving that asymmetry is structural and out of scope for this section.
- **`AdjustPointsModal.tsx` migration to `<SignedPoints>`.** That file uses `pointTotal` as a numeric form value, not a signed render — see S1.

---

## Simplification opportunities (original draft)

The 20+ render sites converge on 3 patterns repeated with minor variation. A targeted refactor (recommended: after Phase 3 migrates `useStudents`) would collapse them.

1. **`<PointCounter>` component** — takes a signed number and size variant (`sm`/`md`/`lg`/`xl`), handles the `value >= 0 ? '+' : ''` prefix and the green/red colorization. Collapses ~12 render sites of manual sign-prefixing and ternary colors (A × 7, D × 5).

2. **`<PointBreakdown>` component** — paired `+positiveTotal` / `negativeTotal` with consistent green/red badges. Collapses **B** (2 sites) + **E** (3 sites).

3. **Aggregation in the transform/hook layer** — `TeacherDashboard.tsx:27-31` and `AppContext.tsx:662-693` both re-sum data client-side. Move the reductions into `useClassrooms`'s transform so consumers receive `ClassroomWithCount.todayTotal` and a `TeacherStats` shape fully computed. Drops **H**, **I** as manual reductions.

Estimated cost: ~1 day once Phase 3 is in. Don't attempt before Phase 3 — `useStudents` rewrite will touch many of the same files and cause merge churn.

---

## `/simplify` review findings (2026-04-24, against commit `9c7205e`)

Three parallel reviews (reuse, quality, efficiency) run over the Phase 2 branch diff. Findings deduplicated across agents. No code changes were made — this is a report for later action.

### High severity

**A. Batch insert regression — `awardClassPoints` / `awardPointsToStudents` lost atomic single-insert semantics**

- Site: `src/contexts/AppContext.tsx:373-390` (awardClassPoints), `:418-435` (awardPointsToStudents)
- Pre-Phase-2, a single `insert([rows])` sent all N student awards in one round-trip (all-or-nothing). Phase 2 replaced this with `Promise.all(... .catch(() => null))` loops — N HTTP requests, N DB trigger invocations, N realtime echoes, N classroom invalidations. A 30-student class award now costs 30× network + cascade overhead.
- Fix direction: add a `useAwardPointsBatch` mutation that wraps a single batched insert with coordinated optimistic patches; keep single-student `useAwardPoints` for point-awards from a student card. Non-trivial; treat as its own PR.

**B. Realtime refetch storm on own-device awards**

- Sites: `src/hooks/useTransactions.ts:95-183` (useAwardPoints), `src/hooks/useClassrooms.ts:17-22` (students onChange invalidation)
- On any award: `onSettled` invalidates `transactions.list(id)` + `classrooms.all`, the `point_transactions` realtime echoes the server INSERT back and invalidates again, AND the students-table UPDATE (from the DB trigger) triggers `classrooms.all` invalidate a third time. One tap = 3-4 refetches of the two keys. Rapid tapping thrashes the network; combined with **A**'s N-insert pattern, a class-wide award can fire tens of overlapping fetches.
- Fix direction: dedupe the realtime echo against own optimistic rows (skip invalidate when the incoming row is already in cache), or drop the `onSettled` invalidations in `useAwardPoints` and rely solely on realtime as the cross-device sync path. Needs design decision before code.

### Medium severity

**C. Near-duplicate batch wrappers**

- Sites: `src/contexts/AppContext.tsx:353-396` (awardClassPoints), `:398-441` (awardPointsToStudents)
- The two wrappers are line-for-line identical except the input source (`students` vs `validStudents = students.filter(...)`) and a console message prefix. Extract a shared `awardPointsToMany(classroomId, targets, behavior, note, logLabel)` helper.
- Effort: ~1h.

**D. Three raw-Supabase callbacks bypass the new hook layer**

- Sites: `src/contexts/AppContext.tsx:455-472` (undoBatchTransaction), `:586-629` (adjustStudentPoints), `:631-648` (resetClassroomPoints)
- Phase 2 migrated `useUndoTransaction` / `useClearStudentPoints` to hooks but left these three as direct `supabase.from('point_transactions').delete()/.insert()` + manual `qc.invalidateQueries` calls. Perpetuates the exact dual-ownership Phase 2 tried to remove.
- Fix direction: add `useUndoBatchTransaction`, `useAdjustStudentPoints`, `useResetClassroomPoints` mirroring Phase 2's pattern. "Phase 2.5" cleanup PR.

**E. `await refetchStudents()` serializes every undo / clear / reset**

- Sites: `src/contexts/AppContext.tsx:450`, `:469`, `:580`, `:645`
- Added by commit `9c7205e` as a bug-fix bridge until Phase 3. Each callsite awaits the refetch before returning, adding ~150-300ms of serial latency per undo. Callers (toast dismissal, button re-enable) don't need the data synchronously — DB trigger + realtime reconcile regardless.
- Fix direction: change `await refetchStudents()` → `void refetchStudents()` at all four sites. One-line changes.
- This was independently identified in my own self-critique of `9c7205e` earlier in the session, then re-identified by the efficiency agent. Double-flagged.

### Low severity (noted, skip unless convenient)

- `dbToPointTransaction` at `src/types/transforms.ts:74-87` is an identity function that field-by-field copies a row. Body could be `return row` or `return { ...row }`. Cosmetic.
- `dbToClassroom` at `src/types/transforms.ts:55-68` takes an awkward `ClassroomAggregate` second argument used only by its one call site. The indirection adds little over inlining the spread in `useClassrooms.queryFn`. Cosmetic.
- Comment in `src/hooks/useClassrooms.ts` (inside `useUpdateClassroom.mutationFn`) references commit SHA `cd67ada`. SHAs rot across rebases; drop the qualifier.
- `queryKeys.transactions.student(studentId)` at `src/lib/queryKeys.ts:19` is defined but unused. Dead key until a consumer exists.
- `useUndoTransaction.onSettled` at `src/hooks/useTransactions.ts:194` invalidates `transactions.all` (over-broad) because the mutation input doesn't carry `classroomId`. Thread it through or accept the broader match. Negligible cost today.
- `getStudentTransactions` / `getClassPoints` at `AppContext.tsx:474-480` / `:502-521` re-filter or re-find on every call. Pre-existing; `useMemo`-backed `Map<studentId, ...>` if it ever shows up in profiling.
- Phase-tracking comments (`// §4`, `// Decision 3`, `// Phase 2 adapter bridge`) scattered across the diff will become archaeological debris once Phase 4 lands. Sweep candidate, not urgent.

### Cross-reference

`/simplify` finding **E** (awaited refetchStudents) overlaps with the "Simplification opportunities (original draft)" section above, but is more specific: the draft proposed moving aggregation into the transform layer, while this finding targets the four specific callsites added by `9c7205e`. They are independent items.
