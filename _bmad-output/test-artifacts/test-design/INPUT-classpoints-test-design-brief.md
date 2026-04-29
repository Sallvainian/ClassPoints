---
title: 'Test Design Brief — INPUT to bmad-testarch-test-design'
project: ClassPoints
date: 2026-04-28
audience: 'fresh-context bmad-testarch-test-design run'
documentRole: INPUT
supersedes:
  - _bmad-output/test-artifacts/test-design-architecture-2026-04-22.md
  - _bmad-output/test-artifacts/test-design-progress-2026-04-22.md
  - _bmad-output/test-artifacts/test-design-qa-2026-04-22.md
  - _bmad-output/test-artifacts/test-design/classpoints-handoff-2026-04-22.md
---

# Purpose

This file is **input** to a fresh-context run of `bmad-testarch-test-design`. It is **not the test design itself**. It compresses the ClassPoints state into the prep work the workflow would otherwise have to redo: feature inventory, existing-coverage matrix, test-level conventions, risk anchors, scope guards, and a UI-selector update appendix from the live test-framework run on 2026-04-28.

When the workflow runs, it should read this brief first, then `_bmad-output/project-context.md` and `_bmad-output/planning-artifacts/prd.md` for depth. The 4 archived files (`*-2026-04-22.md`) are **superseded** — read for historical context only, not as a baseline to extend.

## Why supersede

The 2026-04-22 test design was scoped to the **TanStack Query migration** (a refactoring initiative): "Replace ~2,400 lines of hand-rolled server-state management... Zero UX, schema, or transport changes." The new test design has a different audience and scope: **end-to-end behavioral coverage of the post-editorial-redesign app**. The migration that the prior doc gated is largely complete (Phase 3 done per `project-context.md:32-43`). The new doc is product-behavioral, not refactor-architectural.

---

# Authoritative source map

The fresh workflow run should treat these as primary sources (read in priority order):

| Source                         | Path                                                                                                         | What it gives                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project context                | `_bmad-output/project-context.md`                                                                            | Complete codebase reference. Critical sections: `## Migration Status` (line 28), `### Testing Rules` (line 485), `### UI / Design System Rules` (line 690), realtime scope table (line 73), AppContext orchestrator silent-failure cluster (line 60–63) |
| PRD                            | `_bmad-output/planning-artifacts/prd.md`                                                                     | TanStack migration acceptance criteria + functional requirements. Section "Testing" notes a future test-hardening initiative — that's THIS workflow run                                                                                                 |
| Architecture                   | `_bmad-output/planning-artifacts/architecture.md`                                                            | 4 resolved decisions + infrastructure contracts                                                                                                                                                                                                         |
| ADR                            | `docs/adr/ADR-005-queryclient-defaults.md`                                                                   | QueryClient defaults rationale; sections §1 (defaults), §2 (adapter error contract), §4 (Phase 2 mutation AC), §6 (realtime scope) all authoritative                                                                                                    |
| Anti-pattern audit             | `_bmad-output/anti-pattern-audit.md`                                                                         | 10 clusters with REAL/OVERSTATED/FALSE-POSITIVE verdicts — DO consult before raising "rejected" concerns                                                                                                                                                |
| Modernization plan             | `docs/modernization-plan.md`                                                                                 | Strategy doc, refactor target architecture                                                                                                                                                                                                              |
| Live legacy specs              | `~/Backups/ClassPoints-framework-pre-scaffold-2026-04-28/e2e.legacy/{auth,classroom,points,student}.spec.ts` | 17 tests of pre-redesign behavioral coverage — the _behaviors_ matter; the selectors are stale (see appendix)                                                                                                                                           |
| Test framework progress        | `_bmad-output/test-artifacts/framework-setup-progress.md`                                                    | Today's framework scaffold + live-run results (109 tests passing)                                                                                                                                                                                       |
| Pathfinder reports (if useful) | `PATHFINDER-2026-04-27/`                                                                                     | Phase 1 per-feature flowcharts — uncommitted directory; fresh run can decide if it's worth consulting                                                                                                                                                   |

---

# Feature inventory (10 features + cross-cutting concerns)

These are the testable behavioral surfaces. The fresh run should produce per-feature scenario lists for each.

| #   | Feature                                      | Owning code                                                                                                                                                              | Why it's a distinct test surface                                                                                                                                                                                                      |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Auth (login / logout / session)**          | `src/contexts/AuthContext.tsx`, `src/components/auth/AuthGuard.tsx`, `src/components/profile/ProfileView.tsx`                                                            | Gates ALL other features. Stale-JWT graceful-degrade was just fixed (commit `d652260`) — regression-prone surface.                                                                                                                    |
| 2   | **Classroom CRUD**                           | `src/hooks/useClassrooms.ts`, `src/components/classes/`, `src/components/home/TeacherDashboard.tsx`                                                                      | Core entity. Migration from AppContext wrappers in flight (Phase 4) — the wrappers throw on failure but the orchestrators silently swallow per-item failures (`AppContext.tsx:408-470`, anti-pattern cluster #2).                     |
| 3   | **Student CRUD**                             | `src/hooks/useStudents.ts`, `src/components/students/`, `src/components/classes/ImportStudentsModal.tsx`                                                                 | Per-classroom scope. Realtime subscription on `students` UPDATE/INSERT/DELETE (one of the 3 official realtime domains).                                                                                                               |
| 4   | **Behavior CRUD**                            | `src/hooks/useBehaviors.ts`, `src/components/behaviors/`                                                                                                                 | Per-user (NOT global — `behaviors` table has `user_id` column; RLS enforces ownership; defaults visible to all). Anti-pattern audit corrected an earlier assumption that these were global (see project-context.md migration status). |
| 5   | **Points awarding (single / class / multi)** | `src/hooks/useTransactions.ts`, `src/components/points/{AwardPointsModal, ClassAwardModal, MultiAwardModal}.tsx`, `AppContext.{awardClassPoints, awardPointsToStudents}` | Most-used feature; canonical optimistic-mutation site (`useAwardPoints` lines 86-95 implement ADR-005 §4 (a)–(e)). Class + multi orchestrators silently filter rejected per-student promises to nulls (cluster #2 — REAL bug).        |
| 6   | **Transaction history & undo**               | `src/hooks/useTransactions.ts:useUndoTransaction`, `useUndoBatchTransaction`, `useClearStudentPoints`, `useResetClassroomPoints`, `useAdjustStudentPoints`               | DELETE branch in realtime subscription decrements time totals — race-prone (REPLICA IDENTITY FULL required, see migration `005`).                                                                                                     |
| 7   | **Realtime cross-device sync**               | `src/hooks/useRealtimeSubscription.ts` + 3 official channels: `students`, `point_transactions`, `seating-chart`                                                          | ADR-005 §6 fixes scope at exactly 3 domains. PR-review block to add a 4th without ADR update.                                                                                                                                         |
| 8   | **Seating chart**                            | `src/components/seating/SeatingChartEditor.tsx` (1350 LOC mega-component), `src/hooks/useSeatingChart.ts` (legacy hand-rolled, migration target)                         | Cross-device drag → smartboard sync. `useSeatingChart` currently has zero realtime channels (project-context.md drift note line 83).                                                                                                  |
| 9   | **Settings & profile**                       | `src/contexts/SoundContext.tsx`, `src/components/settings/`, `src/components/profile/ProfileView.tsx`, `src/hooks/useLayoutPresets.ts`                                   | Per-user scope. Sound settings query depends on `useAuth()` → SoundProvider hierarchy fixed (project-context.md line 252).                                                                                                            |
| 10  | **RLS policies (cross-cutting backend)**     | `supabase/migrations/002_*.sql` (RLS) + `005_replica_identity_full.sql` + per-table policies                                                                             | Auth layer of the backend. P0 — any bypass = data exposure. Tested at integration level via service-role admin client + impersonated user clients.                                                                                    |

### Cross-cutting concerns

- **Migration wizard** (`src/components/migration/`) — one-time localStorage→Supabase flow. Low priority; legacy spec coverage absent.
- **Sound effects** — already covered at unit level (`src/test/sounds.test.ts`, 18 tests passing). Don't duplicate.
- **Layout presets** — legacy hand-rolled hook scheduled for migration. Test surface deferred until migration lands.
- **Devtools bundling (NFR4)** — covered by `npm run check:bundle`, not a behavioral test concern.

---

# Existing coverage matrix

### Unit tests (Vitest 4 + jsdom — `src/**/*.test.{ts,tsx}`)

| File                                                  | Tests                                                                               | Status                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| `src/test/leaderboardCalculations.test.ts`            | Pure-function calculations                                                          | ✅ passing (live-run) |
| `src/test/sounds.test.ts`                             | 18 — Sound definitions + `useSoundContext` + `useSoundEffects` + `validateAudioUrl` | ✅ passing            |
| `src/test/useRotatingCategory.test.ts`                | Hook with `vi.useFakeTimers()` (debt: missing `useRealTimers()` cleanup)            | ✅ passing            |
| `src/test/TeacherDashboard.test.tsx`                  | Component render                                                                    | ✅ passing            |
| `src/hooks/__tests__/useRealtimeSubscription.test.ts` | 5 — channel-status, reconnect, multi-binding                                        | ✅ passing            |
| `src/utils/__tests__/studentParser.test.ts`           | Parser unit tests                                                                   | ✅ passing            |

**Total: 104 unit tests passing across 6 files.**

### Backend integration (Vitest 4 + node — `tests/integration/**/*.test.ts`)

| File                                | Tests                                                              | Status     |
| ----------------------------------- | ------------------------------------------------------------------ | ---------- |
| `tests/integration/example.test.ts` | 2 smoke samples (admin listUsers, classrooms schema selectability) | ✅ passing |

**Total: 2 integration tests. The fresh run should propose ~12–20 more (RLS policies per table, RPC behavior, schema invariants).**

### E2E (Playwright + chromium — `tests/e2e/**/*.spec.ts`)

| File                        | Tests                                | Status     |
| --------------------------- | ------------------------------------ | ---------- |
| `tests/e2e/auth.setup.ts`   | 1 — login + storageState capture     | ✅ passing |
| `tests/e2e/example.spec.ts` | 2 — bootstrap, userFactory lifecycle | ✅ passing |

**Total: 3 E2E tests.**

### Legacy 17 (archived, behavior-baseline reference only)

`~/Backups/ClassPoints-framework-pre-scaffold-2026-04-28/e2e.legacy/`:

| Spec file           | Tests | Behavior covered                                                    | Selector status post-redesign                                         |
| ------------------- | ----- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `auth.spec.ts`      | 5     | login form, invalid creds, valid creds, dashboard render, logout    | partially broken (sidebar text changed)                               |
| `classroom.spec.ts` | 4     | New Classroom button, create, switch between, sidebar structure     | mostly broken ("New Classroom" → `Create classroom` icon-only button) |
| `points.spec.ts`    | 4     | open award modal, +points, -points, accumulate over multiple awards | unknown (modal redesigned in commit `ae7a9a8`)                        |
| `student.spec.ts`   | 4     | add student, display in grid, edit name, remove                     | partially broken (placeholder text + button labels likely changed)    |

**Treat the _behaviors_ as the floor of expected coverage.** The fresh run should produce scenario specs that cover the same behaviors (and more), but using the new fixtures + redesigned selectors.

---

# Test-level conventions for ClassPoints

The fresh workflow run should classify every proposed scenario into exactly one of three levels using these criteria:

### Unit (Vitest 4 + jsdom)

**Use when:**

- Pure logic (calculations, parsers, transforms — `src/utils/**`, `src/types/transforms.ts`)
- React hooks tested in isolation with mocked Supabase at the module boundary (`vi.mock('../lib/supabase', ...)`)
- Components rendered with mocked data + Testing Library queries (`getByRole`, `findByText`)

**Don't use for:**

- Behavior that depends on real Postgres (use integration)
- Behavior that depends on browser auth cookies / storage (use E2E)
- Realtime subscription integration (use integration)

**Reference patterns:** `src/test/sounds.test.ts:139` (mock cast pattern), `src/test/TeacherDashboard.test.tsx:7` (Supabase mock at module boundary, no `@/` alias).

### Backend integration (Vitest 4 + node + Supabase admin client)

**Use when:**

- RLS policy assertion (impersonate user → verify can't see other user's data)
- RPC behavior (output shape, error cases, edge inputs)
- Schema invariants (NOT NULL, FK cascade, REPLICA IDENTITY FULL coverage)
- Realtime channel subscription wire-level (reconnect, channel-status events, payload shape)
- Migration assumptions (e.g., does `student_point_totals` view return what consumers expect)

**Don't use for:**

- React component behavior (use unit + jsdom)
- Browser cookie / localStorage / auth-flow testing (use E2E)

**Reference patterns:** `tests/integration/example.test.ts`, `tests/support/helpers/supabase-admin.ts` (cached service-role client). Security guard: same allow-list as `playwright.config.ts` — refuses non-private hosts.

### E2E (Playwright + chromium + storageState + raw vite)

**Use when:**

- User-visible flow that crosses ≥ 2 components (auth → dashboard, award → optimistic update + transaction list)
- Realtime visual sync (open 2 tabs, award in one, see total update in other)
- Cross-classroom navigation
- Modal interactions where keyboard navigation / aria attributes matter

**Don't use for:**

- Anything that can be unit + integration. E2E is slow + flaky-prone; use it last.
- Visual regression (out of scope).
- Performance / load (out of scope).

**Reference patterns:** `tests/e2e/example.spec.ts` (Given/When/Then with fixtures), `tests/e2e/auth.setup.ts` (setup-project pattern). Auth via `setup` project + `storageState` — do NOT login per-test.

---

# Risk-priority anchors specific to ClassPoints

Use this rather than the generic P0/P1/P2/P3 from `risk-governance.md` when the project context disagrees.

| Priority                             | What qualifies for ClassPoints                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 — block release**               | Any RLS breach (User A sees User B's data). Auth flow regressions (can't sign in / session lost mid-flow / stale-JWT loops). Data corruption (point totals diverge from transaction log; student appears in wrong classroom; behavior visible to wrong user). Realtime DELETE without REPLICA IDENTITY FULL on the source table. The 4th-realtime-channel rule (any addition without ADR update). |
| **P1 — must fix before next sprint** | Award flow regressions (single award fails, optimistic rollback writes `undefined` into cache). Class-award / multi-award orchestrator silent partial failures (cluster #2). Realtime sync drift between devices. Mass-undo regressions. Cross-device divergence on seating chart.                                                                                                                |
| **P2 — fix this sprint**             | Edit / delete flows on non-critical entities (behaviors, layout presets). Settings + profile updates. Transaction history pagination / filtering. Empty-state behavior (e.g., dashboard staying on "Loading your dashboard..." forever for new users — see Known Issues).                                                                                                                         |
| **P3 — backlog**                     | UI polish (loading state shimmer, animation timing, dark-mode contrast). Toast styling. Migration wizard cosmetics.                                                                                                                                                                                                                                                                               |

### Probability anchors specific to ClassPoints

| Probability | Anchor                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| **High**    | Touches AppContext, optimistic-mutation hooks, realtime callbacks, RLS, or auth |
| **Medium**  | Touches CRUD hooks (TanStack-migrated), modal chrome, sidebar                   |
| **Low**     | Pure utility, sound effects, theme, devtools wiring, migration wizard           |

---

# Out of scope for the fresh test design

The fresh workflow run should EXPLICITLY exclude these from the catalog:

- Edge functions (`supabase/functions/` doesn't exist)
- Visual regression / Percy / Chromatic
- Performance / load testing
- Accessibility full audit (a separate concern; basic ARIA assertions in E2E are fine)
- Security audit beyond RLS coverage
- i18n / l10n (single-language app)
- Mobile / native testing
- Browser matrix beyond Chromium (current `playwright.config.ts` projects array has 1 entry)
- Component-level visual storybook
- Synthetic monitoring / production observability tests
- Anything covered by `npm run check:bundle` (devtools DCE NFR4)
- Migration wizard (one-time flow, low ROI for testing)

---

# UI selector update appendix (from 2026-04-28 live-run discoveries)

The editorial UI redesign (commits `ae7a9a8` + `fb3f239`) changed common selectors. The fresh workflow run will produce DECLARATIVE behaviors, not selectors — but when porting legacy specs, these mappings save discovery time:

| Legacy text / selector                                                                      | Status post-redesign                                                                                                            | Replacement (validated 2026-04-28)                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `getByText('New Classroom')`                                                                | ❌ removed                                                                                                                      | `aside button [name="Create classroom"]` (icon-only `+` in sidebar `Classrooms` section header)              |
| Empty-state CTA                                                                             | ➕ new                                                                                                                          | `aside getByRole('button', { name: 'Create your first' })`                                                   |
| Sidebar `CLASSROOMS` heading                                                                | ✅ visible, but DOM text is `Classrooms` (CSS `text-transform: uppercase`)                                                      | `aside.getByText('Classrooms', { exact: true })` (need `exact` — substring would match `No classrooms yet.`) |
| `getByRole('heading', { name: 'Welcome Back' })`                                            | ✅ unchanged                                                                                                                    | (same)                                                                                                       |
| `getByLabel('Email')`, `getByLabel('Password')`, `getByRole('button', { name: 'Sign In' })` | ✅ unchanged                                                                                                                    | (same)                                                                                                       |
| `aside.getByRole('heading', { name: /ClassPoints/ })`                                       | ✅ unchanged                                                                                                                    | (same)                                                                                                       |
| Settings button                                                                             | ⚠ likely redesigned to icon-only                                                                                                | re-validate when porting `student.spec.ts` / `points.spec.ts`                                                |
| Modal chrome                                                                                | ⚠ AwardPointsModal, ClassAwardModal, MultiAwardModal converted to `<Dialog>` in `ae7a9a8`; SoundSettingsModal still hand-rolled | re-validate per-test                                                                                         |
| `Add new student...` placeholder                                                            | ⚠ likely changed                                                                                                                | re-validate when porting `student.spec.ts`                                                                   |
| `Sign Out` button                                                                           | ⚠ likely renamed `Sign out` (lowercase)                                                                                         | check first — `auth.spec.ts:76`                                                                              |

**Selector strategy normative for new tests:**

1. `getByRole(...)` — preferred, accessibility-checked
2. `getByLabel(...)` — for labeled controls
3. `getByText(...)` with `exact: true` — for unique non-interactive content (avoid substring traps)
4. `getByTestId(...)` — when text/role aren't stable (developers should add `data-testid` to volatile UI; project context line 543 endorses)
5. `locator(cssSelector)` — last resort

**Common pitfall:** Playwright matches DOM text, NOT CSS-rendered text. `text-transform: uppercase` does NOT make `getByText('CLASSROOMS')` match `<p>Classrooms</p>`. Always test selectors against actual DOM, not visual rendering.

---

# Known issues to flag in the test design

The fresh workflow run should record these as risks / testability gaps, not just port them away:

### KI-1 — Dashboard infinite loading for empty-state users (P2)

**Observed 2026-04-28 in E2E run.** New user (no classrooms) signs in successfully → sidebar renders fully → main pane shows "Loading your dashboard..." indefinitely (≥ 30s observed, didn't resolve). Suggests the lazy `TeacherDashboard` chunk load or its initial query never settles when `classrooms.length === 0`.

**Test design implication:** New-user happy path test must NOT wait for dashboard load before storageState capture or first assertion. See `tests/e2e/auth.setup.ts` for the documented workaround.

**Bug-fix implication (separate from test design):** worth a dedicated investigation issue. The `LOADING YOUR DASHBOARD...` Suspense fallback should resolve regardless of empty state.

### KI-2 — Orchestrator silent partial failures (cluster #2, REAL severity 4)

`awardClassPoints` (`AppContext.tsx:408-424`) and `awardPointsToStudents` (`:454-470`) silently filter rejected per-student promises to `null`s. Caller cannot distinguish "5 succeeded" from "5 attempted, 2 failed." Two source comments (`ClassAwardModal.tsx:64`, `MultiAwardModal.tsx:62`) actively LIE about the contract.

**Test design implication:** Class-award and multi-award E2E tests MUST assert the failure-surfacing UX, not just the success count. Integration tests should verify per-row outcomes by querying `point_transactions` directly. When the cluster is fixed, remove the lying comments and update the tests' expectation of failure-display.

### KI-3 — `useSeatingChart` zero realtime channels (drift from ADR-005 §6 target)

Project context lines 81-83 flag this. `useSeatingChart` is migration-target territory; current state is hand-rolled with no realtime, even though the ADR scopes seating-chart as one of 3 official realtime domains.

**Test design implication:** Cross-device seating-chart sync tests are P1 _target_ but cannot pass against current code. Mark as P1-blocked-on-migration. When `useSeatingChart` migrates to TanStack + adds realtime, the tests unblock.

### KI-4 — `auth.setup.ts:33` waitForTimeout debt (FIXED 2026-04-28)

The legacy `await page.waitForTimeout(1000)` was removed in this scaffold. Document for traceability — don't reintroduce.

### KI-5 — `useRotatingCategory.test.ts` missing `useRealTimers()` cleanup

Pre-existing debt at `src/test/useRotatingCategory.test.ts:8-13`. Doesn't fail unit tests today but leaks fake-timer state. P3.

---

# Pointer notes for the fresh-context workflow run

When you run `bmad-testarch-test-design` in a fresh context:

1. **Read THIS brief first.** It's at `_bmad-output/test-artifacts/test-design/INPUT-classpoints-test-design-brief.md`.
2. **Then read** `_bmad-output/project-context.md` (full ~1000 lines — it's the canonical reference) and `_bmad-output/planning-artifacts/prd.md`.
3. **Don't read** the `*-2026-04-22.md` archived files except for historical context. They cover a different scope (TanStack migration) and are superseded.
4. **Workflow scope:** system-level test design for the post-redesign app. Audience: solo-contributor + future agents porting the legacy 17 specs.
5. **Output location:** new doc(s) under `_bmad-output/test-artifacts/test-design/` (alongside this brief). Prior outputs are out of the way (`-2026-04-22.md` suffix).
6. **Knowledge fragments to load:** `risk-governance.md`, `probability-impact.md`, `test-levels-framework.md`, `test-priorities-matrix.md`, `test-quality.md`, `adr-quality-readiness-checklist.md`. (These are TEA-canonical; the prior 2026-04-22 run loaded the same set.)
7. **Do NOT propose:**
   - New test framework files (already scaffolded — see `_bmad-output/test-artifacts/framework-setup-progress.md`)
   - Test scenarios for excluded surfaces (out-of-scope list above)
   - Test scenarios that depend on currently-broken state without flagging the dependency (KI-1, KI-3)
8. **DO produce:**
   - Per-feature scenario lists (10 features) at the appropriate test level + priority
   - Coverage gap summary
   - Risk-and-testability section (use the risk anchors above)
   - Port-mapping appendix (legacy spec → new spec target file + flagged selector updates)

---

# Workflow handoff checklist

For the user before running `bmad-testarch-test-design` in fresh context:

- [x] Brief is at `_bmad-output/test-artifacts/test-design/INPUT-classpoints-test-design-brief.md` (this file)
- [x] Prior artifacts archived with `-2026-04-22.md` suffix (4 files; git renames preserve history)
- [x] Framework scaffold in place (`_bmad-output/test-artifacts/framework-setup-progress.md` — 109 tests passing across 3 layers as of 2026-04-28)
- [x] Legacy 17 specs preserved at `~/Backups/ClassPoints-framework-pre-scaffold-2026-04-28/e2e.legacy/`
- [x] Local Supabase available for live verification (currently UP)
- [ ] Fresh context window opened
- [ ] User confirms `bmad-testarch-test-design` skill runs cleanly
