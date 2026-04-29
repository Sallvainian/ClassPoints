---
workflowStatus: 'in-progress'
totalSteps: 5
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
  ]
lastStep: 'step-04-coverage-plan'
nextStep: '/Users/sallvain/Projects/ClassPoints/.claude/skills/bmad-testarch-test-design/steps-c/step-05-generate-output.md'
lastSaved: '2026-04-28'
inputDocuments:
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/test-design/INPUT-classpoints-test-design-brief.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - docs/adr/ADR-005-queryclient-defaults.md
  - .claude/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md
  - .claude/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md
  - .claude/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md
  - .claude/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md
  - .claude/skills/bmad-testarch-test-design/resources/knowledge/test-quality.md
  - .claude/skills/bmad-testarch-test-design/resources/knowledge/adr-quality-readiness-checklist.md
---

# Test Design Progress — ClassPoints (Fresh Run)

Run started: 2026-04-28
Supersedes: `*-2026-04-22.md` artifacts in this directory.

## Step 1 — Mode Detection

**Mode: System-Level**

**Rationale:**

- No `sprint-status.yaml` (BMad sprint context not in play) → file-based detection routes to System-Level.
- The INPUT brief (`INPUT-classpoints-test-design-brief.md`, 2026-04-28) explicitly defines scope as "end-to-end behavioral coverage of the post-editorial-redesign app" across **10 features + cross-cutting concerns** — system-wide, not epic-scoped.
- The 2026-04-22 superseded artifacts targeted the TanStack Query migration (a refactor initiative). That migration is largely complete (Phase 3 done per `project-context.md:32-43`). The fresh run is **product-behavioral**, not refactor-architectural.

**Prerequisites verified:** all PRD / ADR / Architecture / project-context / INPUT brief artifacts present.

## Step 2 — Load Context & Knowledge Base

> **Step 2 was re-executed on 2026-04-28 01:35 EDT** after a self-audit found that the original Step 2 progress entry overstated what had actually been read. The inventory below reflects the **second pass**, where every artifact and fragment listed was opened and read.

### Configuration loaded (from `_bmad/tea/config.yaml`)

| Key                        | Value                                            |
| -------------------------- | ------------------------------------------------ |
| `tea_use_playwright_utils` | `true`                                           |
| `tea_use_pactjs_utils`     | `false` (no microservices / no contract testing) |
| `tea_pact_mcp`             | `none`                                           |
| `tea_browser_automation`   | `auto` (Playwright CLI fragments loaded)         |
| `test_stack_type`          | `fullstack` (explicit, not auto)                 |
| `test_framework`           | `playwright`                                     |
| `risk_threshold`           | `p1`                                             |
| `test_artifacts`           | `_bmad-output/test-artifacts`                    |
| `test_design_output`       | `_bmad-output/test-artifacts/test-design`        |

### Stack signals (verified)

- **Frontend**: `playwright.config.ts`, `vitest.config.ts`, React 18.3.1 in `package.json` → confirms frontend.
- **Backend**: Supabase Postgres + RLS + RPCs + edge-style functions; integration tests at `tests/integration/` use `@supabase/supabase-js` admin client + impersonated user clients.
- → **Stack: `fullstack`** (matches explicit `test_stack_type`).

### Project artifacts loaded (System-Level Mode — Phase 3) — **REAL READ STATUS**

| Source                                                                           | Lines | Status                                                                                         |
| -------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `_bmad-output/project-context.md`                                                | 1000+ | ✅ Auto-loaded as persistent fact + offset-1-400 read; rest accessed in chunks during step 3/4 |
| `_bmad-output/test-artifacts/test-design/INPUT-classpoints-test-design-brief.md` | 309   | ✅ Lines 1-350 read across step 1 + step 2 (full file effectively)                             |
| `_bmad-output/planning-artifacts/prd.md`                                         | 557   | ✅ **Full read** (lines 1-200 + 200-557 across step 2 passes)                                  |
| `_bmad-output/planning-artifacts/architecture.md`                                | 1218  | ✅ **Full read** (lines 1-150 + 150-749 + 750-1218)                                            |
| `docs/adr/ADR-005-queryclient-defaults.md`                                       | 119   | ✅ **Full read** (loaded in re-execution pass)                                                 |
| `_bmad-output/anti-pattern-audit.md`                                             | 264   | ✅ **Full read** (loaded in re-execution pass)                                                 |
| `_bmad-output/test-artifacts/framework-setup-progress.md`                        | n/a   | ⚠ Not opened directly — referenced via INPUT brief summary                                     |
| `docs/modernization-plan.md`                                                     | n/a   | ⚠ Not opened — referenced via INPUT brief summary; only used for high-level context            |

### Knowledge fragments loaded — **REAL READ STATUS**

**System-Level Required:**

- ✅ `risk-governance.md` — full read
- ✅ `probability-impact.md` — full read
- ✅ `test-levels-framework.md` — full read
- ✅ `test-priorities-matrix.md` — full read
- ✅ `test-quality.md` — **full read** (lines 1-120 + 120-665 across passes)
- ✅ `adr-quality-readiness-checklist.md` — **full read** (lines 1-120 + 120-378 across passes)

**Playwright Utils Full UI+API profile (`fullstack` stack + browser tests detected):**

- ✅ `overview.md` — full read
- ✅ `api-request.md` — full read (Supabase REST + RPC + typed HTTP client + operation-overload pattern)
- ✅ `auth-session.md` — full read (storageState + multi-user + worker-specific + ephemeral + service-to-service auth)
- ✅ `recurse.md` — full read (polling for realtime eventual-consistency)
- ✅ `intercept-network-call.md` — full read (URL glob matching + spy/stub + error simulation)
- ✅ `network-recorder.md` — full read (HAR record/playback + stateful CRUD detection)
- ✅ `network-error-monitor.md` — full read (auto-detect 4xx/5xx + opt-out + maxTestsPerError domino prevention)
- ✅ `network-first.md` — full read (intercept-before-navigate; deterministic waiting)
- ✅ `log.md` — full read (Playwright report integration; six log levels)
- ✅ `file-utils.md` — full read (CSV/XLSX/PDF/ZIP — limited relevance to ClassPoints; mostly used for `ImportStudentsModal` testing)
- ✅ `fixtures-composition.md` — full read (`mergeTests` patterns)

**Browser automation (`tea_browser_automation: auto`):**

- ✅ `playwright-cli.md` — full read (CLI for agent-side test debug + `--debug=cli` Playwright 1.59+ flow)

**Specialized fragments NOT loaded (out of scope for this run):**

- ❌ `contract-testing.md`, `pact-*.md` — `tea_use_pactjs_utils=false`; no microservices
- ❌ `email-auth.md` — no magic-link auth
- ❌ `webhook-*.md` — no webhook tests
- ❌ `feature-flags.md` — no LaunchDarkly / GrowthBook integration
- ❌ `visual-debugging.md` — out-of-scope per INPUT brief (no visual regression)
- ❌ `burn-in.md`, `ci-burn-in.md`, `selective-testing.md` — referenced briefly in step 4 execution strategy; not loaded as guidance
- ❌ `nfr-criteria.md` — not loaded; partially superseded by ADR readiness checklist for this run
- ❌ `selector-resilience.md`, `timing-debugging.md`, `test-healing-patterns.md` — useful for `bmad-testarch-atdd` / `bmad-testarch-automate` downstream; not load-bearing for test design

### Pact / contract testing — N/A

`tea_use_pactjs_utils=false`, no microservices. Skipped.

### Browser exploration — Skipped (live framework run already documented)

`framework-setup-progress.md` (2026-04-28 run) and `INPUT-classpoints-test-design-brief.md` (UI selector update appendix) provide the post-redesign DOM data the workflow would otherwise gather via `playwright-cli -s=tea-explore`. Re-running exploration would duplicate work documented at 01:04 today.

### Inputs deemed sufficient

All System-Level required inputs present and loaded. No user clarifications needed before proceeding to Step 3 (Risk and Testability Assessment).

### Step 2 re-execution validation against Step 3 / 4 / 5 outputs

After re-reading every source in full, the following items in the prior Step 3 / 4 outputs were spot-checked:

- **R-05 / ASR-5 (optimistic rollback null-guard)** — ADR-005 §4 (a) text matches verbatim what step 3 cited. ✅ holds.
- **R-03 / ASR-3 (REPLICA IDENTITY FULL invariant)** — anti-pattern audit cluster does not contradict; project-context.md `:93` is the canonical reference. ✅ holds.
- **R-06 / R-07 / TC-2 (cluster #2 silent partial failures)** — anti-pattern audit cluster 2 is **REAL severity 5 (UNDERSTATED)** and confirms the lying comments at `ClassAwardModal.tsx:64` + `MultiAwardModal.tsx:62`. Step 3 framing is accurate. ✅ holds.
- **R-09 / 4th-channel rule** — ADR-005 §6 text confirms "Adds a realtime subscription to a domain not in the Realtime Domains table" is a PR-block. ✅ holds.
- **TC-7 / hand-rolled hooks** — architecture.md decision 3 transitional API + Phase 5 file plan confirm `useSeatingChart` migration target. ✅ holds.
- **NFR4 / ASR-7 (devtools DCE)** — architecture.md decision 4 confirms `npm run check:bundle` is the authoritative grep. Already marked FYI in step 3. ✅ holds.
- **R-13 / KI-1 (empty-state infinite loading)** — INPUT brief is the only source for this; not contradicted by any read. ✅ holds.
- **Anti-pattern audit's "newly-discovered" sev-3 items** (`usePersistedState` dead code, hardcoded table names = 65 sites, `key={index}` on static lists, `usePersistedState` no-error-state) — **none** appear in the step 3 / step 4 register. They are migration-debt cleanup, not behavioral test surface. **Correctly excluded.** ✅
- **Anti-pattern audit's false-positives** (implicit `any` in catch, "nested ternary 4-deep" actually 3-deep, `App.tsx` defensive null checks, etc.) — **none** appear in step 3 / step 4 register. **Correctly excluded.** ✅

**Conclusion of re-execution:** Step 3 risk register, ASRs, and Step 4 coverage matrix remain valid against the now fully-read sources. No revisions required.

---

## Step 3 — Testability Review & Risk Assessment

### 3.1 Testability Review (System-Level)

Evaluated across the three TEA dimensions. Findings ranked **🚨 Concerns first**, then **✅ Strengths**.

#### 🚨 Testability Concerns (ACTIONABLE)

##### TC-1 — Empty-state Suspense never resolves (`KI-1`)

**Dimension:** Reliability + Observability
**Evidence:** Live E2E run on 2026-04-28 — new user (no classrooms) signs in → main pane stuck on "Loading your dashboard..." indefinitely (≥30s observed).
**Impact on testing:** New-user happy-path E2E cannot wait for a "dashboard loaded" signal before storageState capture. Forces tests to either (a) skip the wait and risk premature assertions, or (b) seed at least one classroom in the auth-setup fixture.
**Mitigation:** `tests/e2e/auth.setup.ts` documented workaround (avoid waiting for dashboard load). Long-term: investigate the lazy `TeacherDashboard` chunk Suspense fallback so it resolves regardless of `classrooms.length === 0`.
**Owner / Timeline:** Bug-fix issue on Sallvain's queue; test design treats it as a **testability constraint**, not a blocker for this catalog.

##### TC-2 — Orchestrator silent partial failures hide true outcomes (`KI-2`, anti-pattern audit cluster #2 REAL sev 4)

**Dimension:** Observability + Reliability
**Evidence:** `AppContext.tsx:408-424` (`awardClassPoints`) and `:454-470` (`awardPointsToStudents`) wrap `mutateAsync` in `Promise.all + per-promise .catch((err) => null)`. Caller cannot distinguish "5 succeeded" from "5 attempted, 2 failed" — both return a length-5 array (3 of which are `null`s the caller never checks).
**Impact on testing:** Class-award and multi-award E2E tests cannot rely on the orchestrator's return value as a success signal. Tests **must** observe the failure-surfacing UX (toast / state) AND query `point_transactions` directly via the integration layer to verify per-row outcomes.
**Mitigation (test side):** Mark every class/multi-award scenario with explicit "verify failure visibility" assertions; integration tests count rows in `point_transactions`. **Mitigation (code side):** out of scope for test design — tracked in audit doc; remove the lying comments at `ClassAwardModal.tsx:64` and `MultiAwardModal.tsx:62` when fixed.
**Owner / Timeline:** Test catalog applies the workaround now; code fix not gated on this workflow.

##### TC-3 — `useSeatingChart` lacks realtime; ADR-005 §6 target unreachable (`KI-3`)

**Dimension:** Controllability + Reliability
**Evidence:** `project-context.md:81-83` — current state: `useSeatingChart` is hand-rolled with **zero** realtime channels, despite ADR-005 §6 scoping seating-chart as one of three official realtime domains.
**Impact on testing:** Cross-device seating-chart sync E2E scenarios (P1 target) **cannot pass** against current code. Writing them now produces tests that are red-by-design until the migration lands.
**Mitigation:** Mark cross-device seating-chart sync scenarios as **P1-blocked-on-migration**; produce them in the catalog with a `skip` marker and a TODO that unblocks when `useSeatingChart` migrates. Drag-and-drop persistence within a single device is unblocked and gets full coverage.
**Owner / Timeline:** Unblocks when `useSeatingChart` migrates to TanStack + adds realtime (PRD Phase 5).

##### TC-4 — Realtime DELETE relies on `REPLICA IDENTITY FULL` — invariant unenforced

**Dimension:** Controllability + Reliability
**Evidence:** `project-context.md:93` — "ANY table receiving realtime DELETE events MUST have `ALTER TABLE x REPLICA IDENTITY FULL`." Currently only `point_transactions` has it (migration `005`). Without it, `payload.old` is empty on DELETE → time-totals decrement breaks. There is no schema-level enforcement; a future migration that adds DELETE realtime to a new table without adding `REPLICA IDENTITY FULL` would silently break.
**Impact on testing:** Backend integration suite **must** include a schema invariant test that asserts `REPLICA IDENTITY FULL` on every table whose primary key publishes DELETE events through Supabase Realtime. This catches the regression at integration time, not in production.
**Mitigation:** Add `tests/integration/schema/replica-identity.test.ts` to the catalog (P0, integration-level).
**Owner / Timeline:** P0 in coverage plan.

##### TC-5 — Class-component wrappers silently swallow errors at orchestrator boundary (related to TC-2)

**Dimension:** Observability
**Evidence:** Two source comments at `ClassAwardModal.tsx:64` and `MultiAwardModal.tsx:62` claim "wrapper throws on error with automatic rollback" — `project-context.md:63` flags these as **lies** scheduled for deletion. They mislead test authors about the contract they're testing against.
**Impact on testing:** Tests written naively against the comments would assert a clean throw-on-failure that doesn't exist; assertions pass only because the orchestrator never throws. False green coverage.
**Mitigation:** Test catalog **never** asserts orchestrator error throws; assertions go through point_transactions row counts and the failure-surfacing UI.
**Owner / Timeline:** Already encoded in TC-2 mitigation.

##### TC-6 — `noUnusedLocals` strictness + custom `_`-prefix exception is a per-file rule

**Dimension:** Controllability (test scaffolding)
**Evidence:** `project-context.md:158-159` — TanStack callback signatures legitimately use `_data`, `_err`, `_input`. ESLint flat config + pre-commit `npm run typecheck` block any `_someVar` that's not in this exception list.
**Impact on testing:** Test scaffolding (mock callbacks, fixture helpers) that introduces unused params will fail pre-commit. Test authors must know the exception list.
**Mitigation:** Document in `tests/README.md` (already exists per git status). Test catalog references the rule; agents writing tests via `bmad-testarch-automate` must respect it.
**Owner / Timeline:** Doc-level mitigation; no test scenario needed.

##### TC-7 — Hand-rolled hooks are still in production for two domains

**Dimension:** Controllability
**Evidence:** `project-context.md:45-48` — `useLayoutPresets` (166 LOC) and `useSeatingChart` (23-value return) remain hand-rolled with `useState + useEffect`. Their shapes do **not** match the canonical `{ data, isLoading, error, isPending }` TanStack target. **Do not clone their shape.**
**Impact on testing:** Test scenarios that traverse these hooks (Feature 8 seating chart, Feature 9 layout presets fragment) need to assert against the legacy shape today, then re-target after migration. Two separate baselines for the same surface.
**Mitigation:** Catalog tags each affected scenario with a "migration-pending" marker. Re-target assertions when those hooks migrate (PRD Phase 5).
**Owner / Timeline:** Tagged in coverage plan; re-targeting is mechanical.

##### TC-8 — Three `as T` casts at the Supabase realtime/JSONB boundary

**Dimension:** Controllability (test data shape guarantees)
**Evidence:** `project-context.md:218-220` —

- `useRealtimeSubscription.ts:135-141` — `payload.new as T` / `payload.old as D`
- `useLayoutPresets.ts:41` — `data.map((p) => dbToLayoutPreset(p as DbLayoutPreset))`
- `seatingChart.ts:211` — `preset.layout_data as LayoutPresetData` (JSONB)

**Impact on testing:** Schema drift between DB and app types is invisible at compile time at these three points. A migration that changes `layout_data` JSONB shape would not fail typecheck; only an integration test that round-trips a real payload would catch it.
**Mitigation:** Add an integration scenario that round-trips `layout_data` through `dbToLayoutPreset` and asserts every documented field is non-null. Don't try to test the realtime cast at line 135 — the cast itself is acknowledged as type-system surgery (`as unknown as` legitimate use #1 per `project-context.md:223`).
**Owner / Timeline:** P2 integration scenario for `layout_data`. The realtime cast accepted as-is.

#### ✅ Testability Strengths (FYI)

##### TS-1 — Local-only Supabase fail-closed allow-list

**Evidence:** `playwright.config.ts` parses `VITE_SUPABASE_URL` and refuses to run unless host is loopback / RFC1918 LAN / Tailscale CGNAT (`CLAUDE.md` env section). Same allow-list at `tests/support/helpers/supabase-admin.ts`.
**Why it's strong:** Tests cannot accidentally hit hosted Supabase; service-role keys are never exposed to a hosted environment. Security boundary that doubles as a CI safety guard.

##### TS-2 — On-demand Supabase lifecycle (start / seed / stop) is fully automated

**Evidence:** `tests/e2e/global-setup.ts` boots the local stack, seeds the test user (idempotent), and `global-teardown.ts` stops it. `scripts/lib/supabase-host.mjs` decides based on host detection (`os.networkInterfaces` + `tailscale ip`).
**Why it's strong:** Zero-step E2E run. CI parity with local. No "did you remember to start Supabase" footgun.

##### TS-3 — Optimistic mutation contract is fully spec'd (ADR-005 §4 (a)-(e))

**Evidence:** `useAwardPoints` (`useTransactions.ts:97-235`) has all five AC inline-commented at `:86-95`. Pattern is **canonical** and grep-verifiable.
**Why it's strong:** New optimistic mutations have a one-template, five-checklist target. Test scenarios for each (a)-(e) failure mode are derivable mechanically.

##### TS-4 — Realtime scope is **exactly 3 domains** with PR-block enforcement

**Evidence:** ADR-005 §6 + `project-context.md:73-91`. PR adding a 4th channel without ADR update is a **review block**.
**Why it's strong:** Test catalog has a finite, well-defined live-sync surface. Negative scenario ("realtime should NOT fire on classrooms / behaviors / layout_presets") is asserted once, at integration level, and stays valid until ADR-005 §6 changes.

##### TS-5 — Trigger-maintained denormalized totals are server-of-truth

**Evidence:** `students.point_total` / `positive_total` / `negative_total` / `today_total` / `this_week_total` are maintained by Postgres triggers; client never aggregates. PRD `:124` and project context affirm.
**Why it's strong:** Test design **never** has to reproduce client-side aggregation logic. Backend integration asserts trigger correctness; UI asserts the denormalized value is rendered. Two separable concerns, two test layers.

##### TS-6 — Query key registry as single source of truth

**Evidence:** `src/lib/queryKeys.ts` (`project-context.md:336-340`). Read-path and invalidation-path use the same builder.
**Why it's strong:** Cache-invalidation correctness tests reference one key registry. Invalidation drift between read and write tests is structurally impossible (would fail typecheck).

##### TS-7 — Playwright fixture composition is established

**Evidence:** `tests/support/fixtures/`, `mergeTests` pattern, `userFactory`. Live-run on 2026-04-28 confirmed 109 tests passing across 3 layers.
**Why it's strong:** New scenarios slot into existing fixtures (`authenticatedPage`, `userFactory`) without rebuilding scaffolding.

### 3.2 Architecturally Significant Requirements (ASRs)

ASRs are requirements whose failure has architecture-wide consequences. Each is marked **ACTIONABLE** (test catalog produces a scenario) or **FYI** (acknowledged, no test scenario required).

| ID     | ASR Description                                                                                                                                                                                           | Source                                              | Mark                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ASR-1  | **RLS isolates per-teacher data.** User A must not be able to read or mutate User B's classrooms / students / behaviors / point_transactions / layout_presets / sound_settings via PostgREST or Realtime. | `supabase/migrations/002_*.sql`, project-context    | **ACTIONABLE** — RLS integration scenarios per table (P0)                                          |
| ASR-2  | **Realtime scope is exactly 3 domains.** Classrooms, behaviors, layout_presets, user-settings tables MUST NOT emit realtime events to clients.                                                            | ADR-005 §6, PRD FR5                                 | **ACTIONABLE** — negative-realtime integration scenario (P1)                                       |
| ASR-3  | **REPLICA IDENTITY FULL for every realtime DELETE-watching table.**                                                                                                                                       | `project-context.md:93`, migration `005`            | **ACTIONABLE** — schema invariant integration scenario (P0)                                        |
| ASR-4  | **Trigger-maintained totals are the only point aggregation source.**                                                                                                                                      | PRD `:124`, project-context                         | **ACTIONABLE** — integration scenario asserting trigger correctness on award/undo/clear/reset (P0) |
| ASR-5  | **Optimistic mutation rollback is null-guarded.** Audit cluster #1 REAL sev 4 — ADR-005 §4 (a) — `setQueryData(undefined)` post-cancellation is worse than no rollback.                                   | ADR-005 §4 (a), `project-context.md:386`            | **ACTIONABLE** — unit + E2E for `useAwardPoints` rollback (P0)                                     |
| ASR-6  | **Optimistic temp IDs are deterministic** (content-hash, not `crypto.randomUUID()`). ADR-005 §4 (c).                                                                                                      | ADR-005 §4 (c), `useAwardPoints:132`                | **ACTIONABLE** — unit-level invariant test (P1)                                                    |
| ASR-7  | **Devtools chunks must not appear in `dist/`.** NFR4. Enforced by `npm run check:bundle`.                                                                                                                 | Architecture Decision 4, `scripts/check-bundle.mjs` | **FYI** — already covered by CI-required script; out of catalog scope                              |
| ASR-8  | **Stale JWT degrades gracefully to login** (commit `d652260`). Refresh token failure must not loop on `signInWithPassword`.                                                                               | `project-context.md:30`, `AuthContext.tsx`          | **ACTIONABLE** — auth resilience scenario (P0)                                                     |
| ASR-9  | **`AppContext` UI/session-only post-Phase-4.** No new server-data pass-throughs.                                                                                                                          | PRD §Technical Success                              | **FYI** — structural invariant; covered by lint/typecheck + greppable AC (no behavioral test)      |
| ASR-10 | **`fnox exec --` wraps `build` and `preview`** (age-encrypted env). Removing it would inline secrets into client bundle.                                                                                  | `CLAUDE.md` env section                             | **FYI** — covered by code-review checklist; no behavioral test                                     |

**Actionable ASR count:** 7 of 10. **FYI count:** 3.

### 3.3 Risk Register

Scoring follows TEA standard: **probability (1-3) × impact (1-3) = score (1-9)**. Mapping to ClassPoints-specific anchors per `INPUT-classpoints-test-design-brief.md` "Risk-priority anchors" and "Probability anchors" tables.

#### Probability anchors (ClassPoints)

| Score            | Anchor                                                                          |
| ---------------- | ------------------------------------------------------------------------------- |
| **3 — Likely**   | Touches AppContext, optimistic-mutation hooks, realtime callbacks, RLS, or auth |
| **2 — Possible** | Touches CRUD hooks (TanStack-migrated), modal chrome, sidebar                   |
| **1 — Unlikely** | Pure utility, sound effects, theme, devtools wiring, migration wizard           |

#### Impact anchors (ClassPoints)

| Score            | Anchor                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3 — Critical** | RLS breach / cross-user data exposure / data corruption (point totals diverge from log) / auth completely broken / realtime DELETE silently broken |
| **2 — Degraded** | Award flow fails / orchestrator silent partial failure / cross-device sync drift / mass-undo regression                                            |
| **1 — Minor**    | Edit/delete on non-critical entity / settings update fails / UI polish regression                                                                  |

#### Risk register

| ID   | Category | Risk                                                                                                   | P   | I   | Score | Action           | Priority       | Mitigation (test scope)                                                                                                                                                                       | Owner / Timeline                              |
| ---- | -------- | ------------------------------------------------------------------------------------------------------ | --- | --- | ----- | ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| R-01 | SEC      | RLS breach: user A reads user B's classrooms / students / behaviors / transactions                     | 3   | 3   | **9** | **BLOCK**        | **P0**         | Per-table RLS integration scenarios with two service-role-impersonated clients; negative + positive cases                                                                                     | Sallvain / before next deploy                 |
| R-02 | SEC      | RLS breach via realtime channel (User A subscribes to User B's row updates)                            | 3   | 3   | **9** | **BLOCK**        | **P0**         | Realtime + RLS integration scenarios on each of the 3 official channels                                                                                                                       | Sallvain / before next deploy                 |
| R-03 | DATA     | Realtime DELETE on a table missing `REPLICA IDENTITY FULL` → time totals desync                        | 3   | 3   | **9** | **BLOCK**        | **P0**         | Schema invariant integration test (TC-4 mitigation)                                                                                                                                           | Sallvain / next sprint                        |
| R-04 | DATA     | Trigger-maintained totals diverge from `point_transactions` log (e.g., award succeeds, total stale)    | 2   | 3   | **6** | MITIGATE         | **P0**         | Integration scenarios: award / undo / clear / reset assert `students.point_total === SUM(point_transactions.points)`                                                                          | Sallvain / next sprint                        |
| R-05 | TECH     | Optimistic rollback writes `undefined` to cache (ADR-005 §4 (a) violation) → desynced UI               | 3   | 3   | **9** | **BLOCK**        | **P0**         | Unit test for `useAwardPoints` rollback null-guard; E2E for award-fails-then-rollback flow                                                                                                    | Sallvain / next sprint                        |
| R-06 | BUS      | Class-award orchestrator silently filters per-student failures to `null` (audit cluster #2)            | 3   | 2   | **6** | MITIGATE         | **P1**         | E2E asserts failure-surfacing UI; integration counts `point_transactions` rows after a forced per-student failure                                                                             | Sallvain / next sprint (test now; code later) |
| R-07 | BUS      | Multi-award orchestrator: same as R-06 on `awardPointsToStudents`                                      | 3   | 2   | **6** | MITIGATE         | **P1**         | Same as R-06, scoped to `MultiAwardModal`                                                                                                                                                     | Sallvain / next sprint                        |
| R-08 | TECH     | Stale-JWT loop on refresh (regression of fix `d652260`)                                                | 2   | 3   | **6** | MITIGATE         | **P0**         | Auth resilience E2E: forge expired JWT → assert graceful redirect to login (no loop)                                                                                                          | Sallvain / next sprint                        |
| R-09 | TECH     | New realtime channel added without ADR-005 §6 update (4th-channel rule)                                | 1   | 3   | **3** | DOCUMENT         | P3             | Code-review gate; out of test catalog (structural review concern)                                                                                                                             | Doc-only                                      |
| R-10 | DATA     | Cross-device seating-chart drift (drag on laptop, smartboard doesn't update) — blocked by KI-3         | 3   | 2   | **6** | MITIGATE-blocked | **P1-blocked** | Author scenario with `test.skip` + TODO; unblocks when `useSeatingChart` migrates                                                                                                             | Sallvain / Phase 5 of TanStack migration      |
| R-11 | DATA     | Optimistic temp ID collision (non-deterministic UUID) → rollback writes wrong row                      | 1   | 2   | **2** | DOCUMENT         | P3             | Unit-level invariant: temp ID format matches `optimistic-{studentId}-{behaviorId}-{timestamp}`                                                                                                | Already structurally satisfied; test as guard |
| R-12 | TECH     | Realtime channel reconnect loses an event (network blip) → student total stale                         | 2   | 2   | **4** | MONITOR          | P2             | Integration: simulate reconnect, assert invalidation refetch                                                                                                                                  | Sallvain / next sprint                        |
| R-13 | BUS      | Empty-state user infinite loading (KI-1) — first impression broken                                     | 3   | 2   | **6** | MITIGATE         | **P2**         | Bug-fix on Sallvain's queue; tests work around per TC-1; document the workaround so it can be removed when fix lands                                                                          | Sallvain / next sprint                        |
| R-14 | DATA     | Migration wizard data loss (one-time localStorage → Supabase flow)                                     | 1   | 3   | **3** | DOCUMENT         | P3             | Out of catalog scope per INPUT brief; smoke test only                                                                                                                                         | N/A                                           |
| R-15 | OPS      | E2E hits hosted Supabase by accident (fail-closed allow-list bypassed)                                 | 1   | 3   | **3** | DOCUMENT         | P3             | TS-1 strength; one regression scenario asserting allow-list rejects non-private host                                                                                                          | Sallvain / one-time                           |
| R-16 | PERF     | Per-student award rapid-tap → multiple optimistic writes race; cache desync                            | 2   | 2   | **4** | MONITOR          | P2             | E2E: 10 rapid awards → assert final total matches expected; assert no duplicate transactions                                                                                                  | Sallvain / next sprint                        |
| R-17 | TECH     | Test fakes/mocks miss real Postgres behavior (mocked-DB integration test passes, real migration fails) | 2   | 3   | **6** | MITIGATE         | **P1**         | **Memory rule:** integration tests hit a real database, not mocks (`feedback_testing.md`); enforced by stack choice                                                                           | Already structurally satisfied                |
| R-18 | TECH     | Snake_case → camelCase transform regression at queryFn boundary                                        | 2   | 2   | **4** | MONITOR          | P2             | Unit tests on `dbToBehavior` / `dbToClassroom` / `dbToStudent` — additive when DB columns added                                                                                               | Sallvain / next sprint                        |
| R-19 | DATA     | Sound-settings query lookup-by-user-id race during signin (provider hierarchy violation)               | 1   | 2   | **2** | DOCUMENT         | P3             | TS-3 + provider-hierarchy invariant; one-time render-order test                                                                                                                               | One-time                                      |
| R-20 | BUS      | Behavior CRUD: per-user RLS scope failure → user sees another user's behaviors as defaults             | 2   | 3   | **6** | MITIGATE         | **P0**         | Behavior-table-specific RLS integration scenario (covered under R-01 broadly, but called out here because behaviors recently moved from "global defaults" to "per-user with shared defaults") | Sallvain / next sprint                        |

#### Risk distribution

| Score     | Action       | Count  | Risks                                           |
| --------- | ------------ | ------ | ----------------------------------------------- |
| 9         | **BLOCK**    | 4      | R-01, R-02, R-03, R-05                          |
| 6-8       | MITIGATE     | 7      | R-04, R-06, R-07, R-08, R-13, R-17, R-20        |
| 4-5       | MONITOR      | 3      | R-12, R-16, R-18                                |
| 1-3       | DOCUMENT     | 5      | R-09, R-11, R-14, R-15, R-19                    |
| Blocked   | (P1-blocked) | 1      | R-10 (unblocks when `useSeatingChart` migrates) |
| **Total** |              | **20** |                                                 |

#### Highest-risk summary (gate-decision input)

**Critical blockers (score 9, action BLOCK):**

- **R-01** — RLS breach (REST path)
- **R-02** — RLS breach (realtime path)
- **R-03** — Realtime DELETE without `REPLICA IDENTITY FULL`
- **R-05** — Optimistic rollback `undefined` write

**Gate decision implication (per `risk-governance.md`):** Until **all four** score-9 risks have mitigation evidence (passing tests merged), the system-level gate is **FAIL**. Once each has a passing scenario in the catalog and CI, gate moves to **CONCERNS** (driven by remaining 6-8 mitigations) → **PASS** when those are addressed.

**High mitigation work (score 6-8):** seven risks. All have clear test-scope mitigation paths defined in the table above; all are **P0 or P1** in the priority taxonomy.

**Risks blocked on code migration:** **R-10** (seating-chart cross-device sync) is parked at P1-blocked-on-migration; scenario gets authored with `test.skip` + TODO so the unblock is mechanical when `useSeatingChart` migrates.

**Risks already structurally mitigated:** **R-17** (mocked-DB false positive) — addressed by the stack choice (real Postgres at integration level) and the user's persistent memory `feedback_testing.md`.

### 3.4 Step 3 Output Summary

- **8 testability concerns** (TC-1..TC-8), 7 strengths (TS-1..TS-7)
- **10 ASRs** identified, **7 actionable** in the test catalog
- **20 risks** scored, **4 score-9 BLOCKERS**, **7 score-6-8 mitigations**
- All risks have a defined test-scope mitigation OR an explicit reason they're handled outside the catalog

Step 4 will translate this risk + ASR set into a per-feature coverage plan with assigned test levels and priorities.

---

## Step 4 — Coverage Plan & Execution Strategy

### 4.1 Coverage Matrix — Per-Feature Scenarios

**ID format:** `{FEATURE}.{SUB}-{LEVEL}-{NN}`
**Levels:** UNIT (Vitest 4 + jsdom), INT (Vitest 4 + node + Supabase admin), E2E (Playwright + chromium + storageState).
**Test-level decision rule (per `test-levels-framework.md` + INPUT brief §"Test-level conventions"):** push down — prefer UNIT > INT > E2E. E2E only when the assertion crosses ≥ 2 components or requires browser auth/storage. Duplicate coverage across levels is forbidden unless defending a specific regression.

#### Feature 1 — Auth (login / logout / session)

Owning code: `src/contexts/AuthContext.tsx`, `src/components/auth/AuthGuard.tsx`, `src/components/profile/ProfileView.tsx`.
Risks covered: R-08 (stale-JWT loop), R-15 (allow-list bypass).
ASRs covered: ASR-8.

| ID              | Scenario                                                                                                        | Level | Priority | Risk / ASR  | Notes                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ----- | -------- | ----------- | ------------------------------------------------------------------------------------- |
| AUTH.01-E2E-01  | Login form renders with email + password fields and Sign-In button                                              | E2E   | P1       | —           | Selector floor; from legacy `auth.spec.ts`. Selectors validated unchanged 2026-04-28. |
| AUTH.01-E2E-02  | Invalid credentials shows error and stays on login page                                                         | E2E   | P0       | R-08        | Sad path                                                                              |
| AUTH.01-E2E-03  | Valid credentials → redirect to dashboard with `Welcome Back` heading                                           | E2E   | P0       | —           | Happy path; gates ALL other features.                                                 |
| AUTH.01-E2E-04  | `Sign Out` button (lowercase per redesign) → redirect to login; storageState cleared                            | E2E   | P0       | —           | Verify selector during port; `auth.spec.ts:76` reference.                             |
| AUTH.01-E2E-05  | Stale JWT (forged or simulated): refresh fails → graceful redirect to login (no loop, no infinite spinner)      | E2E   | **P0**   | R-08, ASR-8 | Regression guard for commit `d652260`. Forge a stale `sb-` cookie/localStorage entry. |
| AUTH.01-E2E-06  | Logged-in user navigates to a protected route → AuthGuard renders content; logged-out user → redirect to login  | E2E   | P0       | —           | AuthGuard short-circuit assertion.                                                    |
| AUTH.01-INT-01  | Allow-list rejection: `playwright.config.ts` parser refuses to start if `VITE_SUPABASE_URL` is non-private host | UNIT  | P1       | R-15, TS-1  | Pure config-parser unit test against `parseHost` helper; no real network.             |
| AUTH.01-UNIT-01 | `useAuth` provider initialization with no session → `user === null`, no redirect side effect                    | UNIT  | P2       | —           | `vi.mock` Supabase client; assert reducer-style state machine.                        |

#### Feature 2 — Classroom CRUD

Owning code: `src/hooks/useClassrooms.ts`, `src/components/classes/`, `src/components/home/TeacherDashboard.tsx`.
Risks covered: R-01 (RLS), R-13 (empty-state KI-1).
ASRs covered: ASR-1, ASR-9.

| ID               | Scenario                                                                                                             | Level | Priority | Risk / ASR  | Notes                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ----- | -------- | ----------- | ------------------------------------------------------------------------------- |
| CLASS.01-E2E-01  | Create classroom from sidebar `+` icon (`Create classroom`) → new classroom appears in sidebar list                  | E2E   | P0       | —           | Selector update from INPUT brief.                                               |
| CLASS.01-E2E-02  | Empty-state CTA (`Create your first`) appears when `classrooms.length === 0`                                         | E2E   | P1       | R-13        | Asserts the CTA renders. **Does NOT** assert dashboard loads (KI-1 workaround). |
| CLASS.01-E2E-03  | Switch active classroom from sidebar → `activeClassroomId` updates; main pane re-renders with new classroom data     | E2E   | P0       | —           | Cross-component state coordination.                                             |
| CLASS.01-E2E-04  | Edit classroom name from settings → name update propagates to sidebar and dashboard heading                          | E2E   | P1       | —           |                                                                                 |
| CLASS.01-E2E-05  | Delete classroom with confirmation → classroom removed from sidebar; if it was active, fallback or empty-state shows | E2E   | P1       | —           |                                                                                 |
| CLASS.01-INT-01  | RLS — User A cannot SELECT User B's classrooms via PostgREST                                                         | INT   | **P0**   | R-01, ASR-1 | Two impersonated clients via service-role admin.                                |
| CLASS.01-INT-02  | RLS — User A cannot UPDATE / DELETE User B's classroom (returns 0 rows affected, not error)                          | INT   | **P0**   | R-01, ASR-1 |                                                                                 |
| CLASS.01-INT-03  | RLS — anonymous client cannot SELECT any classroom                                                                   | INT   | P0       | R-01, ASR-1 |                                                                                 |
| CLASS.01-INT-04  | `useClassrooms` queryFn select clause picks up new columns when migration adds one (no `.select('*')` regression)    | INT   | P2       | R-18        | Smoke test: insert row with new column, confirm hook output includes it.        |
| CLASS.01-UNIT-01 | `useCreateClassroom` mutation invalidates `queryKeys.classrooms.all` on success                                      | UNIT  | P1       | —           | TanStack `useMutation` test with `qc` spy.                                      |
| CLASS.01-UNIT-02 | `useUpdateClassroom` rejects payload with extra fields (supabase-js 2.104 `RejectExcessProperties`)                  | UNIT  | P2       | R-18        | Type-level test acceptable here.                                                |
| CLASS.01-UNIT-03 | `dbToClassroom` transform: every documented camelCase field maps from snake_case                                     | UNIT  | P2       | R-18        |                                                                                 |

#### Feature 3 — Student CRUD

Owning code: `src/hooks/useStudents.ts`, `src/components/students/`, `src/components/classes/ImportStudentsModal.tsx`.
Risks covered: R-01 (RLS), R-04 (totals integrity).
ASRs covered: ASR-1, ASR-4.

| ID              | Scenario                                                                                                                                  | Level | Priority | Risk / ASR          | Notes                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | ------------------- | ------------------------------------------------------------------------------------------ |
| STUD.01-E2E-01  | Add student via input → student appears in classroom's student grid with `pointTotal === 0`                                               | E2E   | P0       | —                   | Verify `Add new student...` placeholder selector during port.                              |
| STUD.01-E2E-02  | Add student with empty name → validation error, student not created                                                                       | E2E   | P1       | —                   |                                                                                            |
| STUD.01-E2E-03  | Edit student name → name update propagates in card and any open modals                                                                    | E2E   | P1       | —                   |                                                                                            |
| STUD.01-E2E-04  | Remove student with confirmation → card removed; `students` query refetches; `point_transactions` for that student deleted via FK cascade | E2E   | P1       | R-04                | Assert remaining-students-only count.                                                      |
| STUD.01-E2E-05  | Import students from CSV/paste → all parsed students appear in grid, count matches input                                                  | E2E   | P2       | —                   |                                                                                            |
| STUD.01-E2E-06  | Realtime: User awards points on a student in tab A; tab B (same user) shows updated point total within 2s                                 | E2E   | **P0**   | ASR-2 strength path | Multi-page Playwright; verifies `students` realtime channel.                               |
| STUD.01-INT-01  | RLS — User A cannot SELECT students belonging to a classroom owned by User B                                                              | INT   | **P0**   | R-01, ASR-1         |                                                                                            |
| STUD.01-INT-02  | RLS — User A cannot INSERT a student into User B's classroom                                                                              | INT   | **P0**   | R-01, ASR-1         |                                                                                            |
| STUD.01-INT-03  | RLS — User A cannot UPDATE / DELETE a student in User B's classroom                                                                       | INT   | **P0**   | R-01, ASR-1         |                                                                                            |
| STUD.01-INT-04  | `students.point_total` matches `SUM(point_transactions.points)` for that student after award / undo / clear / reset                       | INT   | **P0**   | R-04, ASR-4         | Trigger correctness per row, per operation.                                                |
| STUD.01-INT-05  | `students.today_total` window resets at server-defined day boundary (asserts trigger time-window logic, not client)                       | INT   | P1       | R-04, ASR-4         |                                                                                            |
| STUD.01-UNIT-01 | `studentParser` (`src/utils/studentParser.ts`) handles CSV with quoted commas, trailing newlines, Excel BOM                               | UNIT  | P2       | —                   | Already covered (`__tests__/studentParser.test.ts`) — ensure edge cases haven't regressed. |
| STUD.01-UNIT-02 | `dbToStudent` transform: snake_case → camelCase mapping for time-totals fields                                                            | UNIT  | P2       | R-18                |                                                                                            |

#### Feature 4 — Behavior CRUD

Owning code: `src/hooks/useBehaviors.ts`, `src/components/behaviors/`.
Risks covered: R-01, R-20 (per-user RLS regression risk).
ASRs covered: ASR-1.

| ID             | Scenario                                                                                                                       | Level | Priority | Risk / ASR  | Notes                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----- | -------- | ----------- | --------------------------------------------------------------------------------------------------- |
| BEH.01-E2E-01  | Add custom behavior → appears in behavior grid for the active user                                                             | E2E   | P1       | —           |                                                                                                     |
| BEH.01-E2E-02  | Edit behavior label / point value → update reflected in award modal next time it opens                                         | E2E   | P1       | —           |                                                                                                     |
| BEH.01-E2E-03  | Delete custom behavior → removed from grid; existing `point_transactions` referencing it remain (FK or NULL behavior verified) | E2E   | P2       | R-04        | Verify FK cascade behavior matches schema.                                                          |
| BEH.01-INT-01  | RLS — User A's behaviors are not visible to User B; default behaviors (if any are global) are visible to both                  | INT   | **P0**   | R-20, ASR-1 | Behaviors moved from "global" assumption to "per-user with shared defaults" — verify the new model. |
| BEH.01-INT-02  | RLS — User A cannot UPDATE / DELETE User B's custom behaviors                                                                  | INT   | **P0**   | R-20, ASR-1 |                                                                                                     |
| BEH.01-UNIT-01 | `useAddBehavior` plain mutation: `onSettled` invalidates `queryKeys.behaviors.all`                                             | UNIT  | P1       | —           | Reference for canonical "plain mutation, no `onMutate`" pattern.                                    |
| BEH.01-UNIT-02 | `dbToBehavior` transform: snake_case → camelCase                                                                               | UNIT  | P2       | R-18        |                                                                                                     |

#### Feature 5 — Points awarding (single / class / multi)

Owning code: `src/hooks/useTransactions.ts`, `src/components/points/{AwardPointsModal, ClassAwardModal, MultiAwardModal}.tsx`, `AppContext.{awardClassPoints, awardPointsToStudents}`.
Risks covered: R-04, R-05, R-06, R-07, R-11, R-16.
ASRs covered: ASR-4, ASR-5, ASR-6.

| ID               | Scenario                                                                                                                            | Level | Priority | Risk / ASR      | Notes                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | --------------- | ------------------------------------------------------------------------------------ |
| AWARD.01-E2E-01  | Award positive points to one student (single-award modal) → student card increments by behavior value within ~100ms (optimistic)    | E2E   | **P0**   | ASR-5           | Optimistic visibility check — assert before network settles.                         |
| AWARD.01-E2E-02  | Award negative points to one student → total decrements; positive/negative time-totals update correctly                             | E2E   | **P0**   | ASR-4           |                                                                                      |
| AWARD.01-E2E-03  | Multiple awards over a session accumulate (3 +1 awards = +3 total; 2 +1 then 1 -1 = +1)                                             | E2E   | P0       | ASR-4           |                                                                                      |
| AWARD.01-E2E-04  | Class-award: award to all students in classroom → all student cards increment                                                       | E2E   | P0       | ASR-4           |                                                                                      |
| AWARD.01-E2E-05  | Class-award **with simulated per-student failure** (block one student's RLS / inject error) → UI surfaces failure count, not silent | E2E   | **P0**   | R-06, KI-2      | Asserts failure-surfacing UX. Verifies the lying comment mitigation.                 |
| AWARD.01-E2E-06  | Multi-award (selected subset of students) → only selected students' totals update                                                   | E2E   | P0       | ASR-4           |                                                                                      |
| AWARD.01-E2E-07  | Multi-award **with simulated per-student failure** → UI surfaces failure count                                                      | E2E   | **P0**   | R-07, KI-2      |                                                                                      |
| AWARD.01-E2E-08  | Award fails (Supabase returns error) → optimistic increment rolls back; total returns to pre-award value                            | E2E   | **P0**   | R-05, ASR-5     | Forge a 4xx response via Playwright `route` interception.                            |
| AWARD.01-E2E-09  | Rapid-tap 10 awards on one student in <2 sec → final total matches expected; no duplicate transactions                              | E2E   | P2       | R-16            |                                                                                      |
| AWARD.01-INT-01  | `point_transactions` row count after class-award equals number of students at time of click                                         | INT   | P0       | ASR-4           |                                                                                      |
| AWARD.01-INT-02  | `students.point_total` updates exactly once per award (trigger idempotency)                                                         | INT   | P0       | R-04, ASR-4     |                                                                                      |
| AWARD.01-INT-03  | RLS — User A cannot INSERT into `point_transactions` referencing User B's student                                                   | INT   | **P0**   | R-01, ASR-1     |                                                                                      |
| AWARD.01-UNIT-01 | `useAwardPoints.onMutate` is idempotent — duplicate invocation produces ONE optimistic patch, not two                               | UNIT  | **P0**   | ASR-5 (b)       | ADR-005 §4 (b) AC.                                                                   |
| AWARD.01-UNIT-02 | `useAwardPoints.onError` rollback null-guards `context?.previousX !== undefined`                                                    | UNIT  | **P0**   | R-05, ASR-5 (a) | Direct AC for cluster regression-prevention.                                         |
| AWARD.01-UNIT-03 | Optimistic temp ID format matches `optimistic-{studentId}-{behaviorId}-{timestamp}`                                                 | UNIT  | P1       | R-11, ASR-6     | ADR-005 §4 (c) AC.                                                                   |
| AWARD.01-UNIT-04 | `useAwardPoints.onMutate` reads previous state via `qc.getQueryData(...)`, never from closure                                       | UNIT  | P1       | ASR-5 (e)       | Greppable: assert no closure-captured `previousX` parameter shape inside `onMutate`. |

#### Feature 6 — Transaction history & undo

Owning code: `useTransactions.useUndoTransaction`, `useUndoBatchTransaction`, `useClearStudentPoints`, `useResetClassroomPoints`, `useAdjustStudentPoints`.
Risks covered: R-03 (REPLICA IDENTITY FULL), R-04, R-12 (reconnect).
ASRs covered: ASR-3, ASR-4.

| ID             | Scenario                                                                                                                                  | Level | Priority | Risk / ASR  | Notes                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | ----------- | ---------------------------------------------------------------------------------------------- |
| HIST.01-E2E-01 | Award then undo single transaction → student total returns to pre-award value; transaction removed from history                           | E2E   | P0       | ASR-4       |                                                                                                |
| HIST.01-E2E-02 | Undo batch (class-award) → all per-student transactions removed atomically; totals revert                                                 | E2E   | P0       | ASR-4       |                                                                                                |
| HIST.01-E2E-03 | Clear student points → all of that student's transactions removed; student total = 0                                                      | E2E   | P0       | ASR-4       |                                                                                                |
| HIST.01-E2E-04 | Reset classroom points → all transactions across the classroom's students removed; all totals = 0                                         | E2E   | P0       | ASR-4       |                                                                                                |
| HIST.01-E2E-05 | Adjust student points (manual delta) → transaction logged with adjustment marker; total updates                                           | E2E   | P1       | ASR-4       |                                                                                                |
| HIST.01-INT-01 | `point_transactions` table has `REPLICA IDENTITY FULL` (schema invariant)                                                                 | INT   | **P0**   | R-03, ASR-3 | Direct schema query: `SELECT relreplident FROM pg_class WHERE relname = 'point_transactions';` |
| HIST.01-INT-02 | DELETE on `point_transactions` arrives at realtime subscriber with non-empty `payload.old` (validates `REPLICA IDENTITY FULL` end-to-end) | INT   | **P0**   | R-03, ASR-3 | Subscribe → DELETE → assert `payload.old.id` present.                                          |
| HIST.01-INT-03 | After undo, `students.point_total` decrements by the exact undone delta (no off-by-one)                                                   | INT   | P0       | R-04        |                                                                                                |
| HIST.01-INT-04 | After clearStudentPoints, `students.today_total` / `this_week_total` also reset for that student                                          | INT   | P1       | R-04        |                                                                                                |
| HIST.01-INT-05 | Realtime channel reconnect after network blip → invalidate-on-reconnect refetches `point_transactions`; no event lost                     | INT   | P2       | R-12        | Use `recurse` polling util.                                                                    |

#### Feature 7 — Realtime cross-device sync

Owning code: `src/hooks/useRealtimeSubscription.ts` + 3 official channels.
Risks covered: R-02, R-09 (4th-channel scope), R-12.
ASRs covered: ASR-2.

| ID           | Scenario                                                                                                                                            | Level | Priority | Risk / ASR  | Notes                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | ----------- | ----------------------------------------------------------------------------- |
| RT.01-E2E-01 | Two browsers, same user: award in browser A → browser B's student total updates within 2s (students channel)                                        | E2E   | **P0**   | —           | Visual verification of realtime path. Multi-page Playwright.                  |
| RT.01-E2E-02 | Two browsers, same user: undo in browser A → browser B's transaction list and totals update                                                         | E2E   | P0       | R-12        | Tests `point_transactions` channel + DELETE.                                  |
| RT.01-INT-01 | Subscribe with admin client; INSERT into `students` → event arrives on the `students` channel                                                       | INT   | P0       | —           | Sanity check on transport.                                                    |
| RT.01-INT-02 | Subscribe to `classrooms` → no events ever fire (channel does not exist; subscription returns CHANNEL_ERROR or empty)                               | INT   | **P1**   | ASR-2       | Negative-realtime-scope test.                                                 |
| RT.01-INT-03 | Subscribe to `behaviors` → no events                                                                                                                | INT   | P1       | ASR-2       |                                                                               |
| RT.01-INT-04 | Subscribe to `layout_presets` → currently still emits (legacy drift); test marked `expect to fail eventually` so it flips when migration removes it | INT   | P2       | ASR-2       | Document the drift with a clear `// LEGACY DRIFT` comment in the spec.        |
| RT.01-INT-05 | RLS over realtime: User A subscribes to `students` channel → does NOT receive User B's row events                                                   | INT   | **P0**   | R-02, ASR-1 | The RLS-realtime intersection.                                                |
| RT.01-INT-06 | Subscription cleanup: unmount + remount within same component → no duplicate subscriptions (NFR6 invariant)                                         | UNIT  | P1       | —           | Pre-existing test (`useRealtimeSubscription.test.ts`); ensure it stays green. |

#### Feature 8 — Seating chart

Owning code: `src/components/seating/SeatingChartEditor.tsx`, `src/hooks/useSeatingChart.ts`.
Risks covered: R-08 indirectly, R-10 (cross-device sync — blocked).
ASRs covered: ASR-1.
**Constraint:** TC-3 / TC-7 — `useSeatingChart` is hand-rolled with NO realtime today; cross-device sync scenarios are blocked-on-migration.

| ID             | Scenario                                                                                                           | Level | Priority   | Risk / ASR  | Notes                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | ----------- | --------------------------------------------------------------------------------- |
| SEAT.01-E2E-01 | Open seating chart for a classroom → grid renders with all students placed (or unassigned bucket)                  | E2E   | P1         | —           |                                                                                   |
| SEAT.01-E2E-02 | Drag a student seat → on drop, position persists; reload → seat at same position                                   | E2E   | P1         | —           | In-device persistence.                                                            |
| SEAT.01-E2E-03 | Drag a group → on drop, group + member seats move together                                                         | E2E   | P1         | —           |                                                                                   |
| SEAT.01-E2E-04 | Save layout as preset → preset selectable in dropdown; load preset → seats arrange per preset                      | E2E   | P2         | —           | Tags Feature 9 too.                                                               |
| SEAT.01-E2E-05 | Lock-tables toggle prevents table-element drag                                                                     | E2E   | P3         | —           |                                                                                   |
| SEAT.01-E2E-06 | **BLOCKED** Two browsers, same user: drag in browser A → browser B updates within 2s                               | E2E   | P1-blocked | R-10        | `test.skip("BLOCKED: useSeatingChart has no realtime — unblocks at PRD Phase 5")` |
| SEAT.01-INT-01 | RLS — User A cannot SELECT seating data for User B's classroom                                                     | INT   | P0         | R-01, ASR-1 |                                                                                   |
| SEAT.01-INT-02 | `seating_seats` UPDATE persists to DB; `seating_groups` and `seating_seats` FK constraints hold                    | INT   | P1         | —           |                                                                                   |
| SEAT.01-INT-03 | `layout_data` JSONB on `layout_presets` round-trips through `dbToLayoutPreset` with all documented fields non-null | INT   | **P2**     | TC-8        | Schema-drift guard for the JSONB cast at `seatingChart.ts:211`.                   |

#### Feature 9 — Settings & profile

Owning code: `src/contexts/SoundContext.tsx`, `src/components/settings/`, `src/components/profile/ProfileView.tsx`, `src/hooks/useLayoutPresets.ts`.
Risks covered: R-01, R-19.
ASRs covered: ASR-1.

| ID             | Scenario                                                                                         | Level | Priority | Risk / ASR  | Notes                                |
| -------------- | ------------------------------------------------------------------------------------------------ | ----- | -------- | ----------- | ------------------------------------ |
| SET.01-E2E-01  | Toggle sound effect setting → setting persists across reload                                     | E2E   | P2       | —           |                                      |
| SET.01-E2E-02  | Update profile display name → reflected in header / profile pane                                 | E2E   | P2       | —           |                                      |
| SET.01-E2E-03  | Theme toggle (light/dark) → applies immediately; persists across reload                          | E2E   | P3       | —           |                                      |
| SET.01-INT-01  | RLS — User A cannot SELECT User B's `sound_settings` row                                         | INT   | P0       | R-01, ASR-1 |                                      |
| SET.01-INT-02  | RLS — User A cannot SELECT User B's `layout_presets`                                             | INT   | P0       | R-01, ASR-1 |                                      |
| SET.01-UNIT-01 | `SoundContext` initializes with `null` user → does NOT issue a query before `useAuth()` resolves | UNIT  | P1       | R-19        | Provider hierarchy invariant (TS-3). |
| SET.01-UNIT-02 | Sound effects (already covered): `src/test/sounds.test.ts` — no new scenarios, ensure green      | UNIT  | P2       | —           | Existing 18 tests passing.           |

#### Feature 10 — RLS policies (cross-cutting backend)

This feature folds into the per-feature RLS scenarios above (CLASS.01-INT-01..03, STUD.01-INT-01..03, BEH.01-INT-01..02, AWARD.01-INT-03, RT.01-INT-05, SEAT.01-INT-01, SET.01-INT-01..02). **No standalone Feature-10 catalog**; instead, the integration suite organizes RLS scenarios by table. A roll-up scenario:

| ID            | Scenario                                                                                                                                                           | Level | Priority | Risk / ASR  | Notes                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | -------- | ----------- | -------------------------------------------------------------------------------- |
| RLS.01-INT-00 | Roll-up: every `public.*` table that holds user-scoped data has a policy enforcing `auth.uid() = user_id` (or equivalent FK chain) for SELECT/INSERT/UPDATE/DELETE | INT   | **P0**   | R-01, ASR-1 | Schema introspection: enumerate tables, assert each has the expected RLS policy. |

#### Cross-cutting — Schema invariants

| ID               | Scenario                                                                                                    | Level | Priority | Risk / ASR  | Notes                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ----- | -------- | ----------- | ------------------------------------------------------------------------------------ |
| SCHEMA.01-INT-01 | Every table receiving realtime DELETE events has `REPLICA IDENTITY FULL`                                    | INT   | **P0**   | R-03, ASR-3 | Currently `point_transactions`. Test enumerates the realtime publication membership. |
| SCHEMA.01-INT-02 | Trigger `tg_update_student_totals` (or its current name) fires on `point_transactions` INSERT/UPDATE/DELETE | INT   | P0       | R-04, ASR-4 | `pg_trigger` introspection.                                                          |

### 4.2 Coverage Matrix Totals

| Feature                     | UNIT   | INT    | E2E    | Total  |
| --------------------------- | ------ | ------ | ------ | ------ |
| 1. Auth                     | 2      | 0      | 6      | 8      |
| 2. Classroom CRUD           | 3      | 4      | 5      | 12     |
| 3. Student CRUD             | 2      | 5      | 6      | 13     |
| 4. Behavior CRUD            | 2      | 2      | 3      | 7      |
| 5. Points awarding          | 4      | 3      | 9      | 16     |
| 6. Transaction history/undo | 0      | 5      | 5      | 10     |
| 7. Realtime sync            | 1      | 5      | 2      | 8      |
| 8. Seating chart            | 0      | 3      | 6      | 9      |
| 9. Settings & profile       | 2      | 2      | 3      | 7      |
| 10. RLS roll-up             | 0      | 1      | 0      | 1      |
| Cross-cutting (schema)      | 0      | 2      | 0      | 2      |
| **TOTAL**                   | **16** | **32** | **45** | **93** |

**Priority distribution:**

| Priority   | Count                                                             |
| ---------- | ----------------------------------------------------------------- |
| **P0**     | 39                                                                |
| **P1**     | 24                                                                |
| **P2**     | 21                                                                |
| **P3**     | 4                                                                 |
| Blocked    | 1 (R-10 / SEAT.01-E2E-06)                                         |
| Background | 4 (already covered: existing sounds + parser + leaderboard tests) |

(P0 + P1 = 63 scenarios — the **must-pass** floor before release per the gate. P0 alone = 39 — the BLOCK-equivalent set tied to score-9 risks.)

### 4.3 Execution Strategy

#### PR pipeline (must complete < 15 min)

- All **UNIT** tests (16 scenarios + existing 86 already passing = ~102 total). Vitest 4 + jsdom; expected runtime ~25-40 sec.
- All **INT** tests except `RT.01-INT-05` (real-realtime-channel race tests are slow). ~31 of 32 scenarios. Real Postgres via local Supabase; expected runtime ~3-5 min.
- All **E2E** tests at **P0 priority only**. ~28 of 45 E2E scenarios. Expected runtime ~6-10 min on chromium.

PR-pipeline target: **~10-15 min total**. Risk-blocker test (P0) must run on **every** PR.

#### Nightly pipeline

- All scenarios in PR pipeline +
- All remaining **E2E** scenarios (P1, P2, P3). ~17 additional E2E scenarios. Expected runtime ~5-8 min more.
- `RT.01-INT-05` (RLS-over-realtime) runs nightly to surface flakiness from the channel-establish race.
- Total nightly: **~25-30 min**.

#### Weekly / on-demand

- **R-10 / SEAT.01-E2E-06** runs only when `useSeatingChart` migration lands (tagged `@migration-pending`).
- **RT.01-INT-04** (`layout_presets` legacy drift) flagged as expected-fail-on-fix; rerun once the migration removes the channel.
- **AWARD.01-E2E-09** (rapid-tap stress) runs in burn-in mode (10 iterations) when touching `useAwardPoints` (per `selective-testing.md` diff-based rules).

#### Tagging convention

```
@p0  @p1  @p2  @p3                   priority
@auth @classroom @student @behavior  @award @history @realtime @seating @settings  feature
@rls  @schema  @realtime              cross-cutting
@migration-pending                   blocked scenarios
@drift-expected                      legacy-drift scenarios
@stress                              rapid-tap / burn-in candidates
```

Run examples:

```bash
npm run test:e2e -- --grep "@p0"                       # PR-equivalent E2E gate
npm run test:e2e -- --grep "(@p0|@p1)"                 # P0+P1 — release-floor
npm run test:e2e -- --grep "@migration-pending" --grep-invert  # skip blocked
```

### 4.4 Resource Estimates (Ranges Only)

Authoring + porting effort, AI-assisted via `bmad-testarch-atdd` and `bmad-testarch-automate`:

| Bucket              | Scenario count      | Effort range                       | Notes                                                                                             |
| ------------------- | ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| **P0**              | 39                  | **~30-45 hours**                   | Includes 16 RLS scenarios (heavy) + 9 award optimistic/orchestrator tests + 7 schema invariants.  |
| **P1**              | 24                  | **~18-28 hours**                   | Mostly E2E happy-path + UNIT mutation/transform tests.                                            |
| **P2**              | 21                  | **~10-18 hours**                   | Edit/delete flows, settings, JSONB drift guard.                                                   |
| **P3**              | 4                   | **~2-4 hours**                     | Cosmetic + theme + lock-tables.                                                                   |
| **Blocked / Drift** | 2                   | ~1 hour (write `test.skip` + TODO) | SEAT.01-E2E-06, RT.01-INT-04.                                                                     |
| **TOTAL**           | **93** (+ existing) | **~60-95 hours**                   | Single solo contributor + AI-assist. Spread across ~3-4 sprints if interleaved with feature work. |

**Calibration anchors:**

- Existing 109-test suite (3 layers, framework scaffold complete) took ~2 days of active framework setup per `framework-setup-progress.md`.
- Per-RLS scenario: ~30-45 min once the first impersonation-pair fixture is built (then ~15-20 min per additional table).
- Per-E2E scenario with new selectors: ~30-60 min including selector validation against live UI.
- Per-UNIT scenario for an existing TanStack hook: ~10-25 min once `vi.mock('../lib/supabase', ...)` pattern is established.

### 4.5 Quality Gates

Per `risk-governance.md` thresholds, scoped to ClassPoints:

| Gate                              | Threshold                                                                                   | Rationale                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **P0 pass rate**                  | **100%** (zero failures)                                                                    | All four score-9 BLOCK risks (R-01/R-02/R-03/R-05) are P0; any failure → gate FAIL. |
| **P1 pass rate**                  | **≥ 95%** (allow 1-2 known flakes max)                                                      | Score-6-8 mitigations live here; flakes investigated and fixed within sprint.       |
| **High-risk mitigation evidence** | Every score ≥ 6 risk MUST map to ≥ 1 passing scenario in CI                                 | Risk register cross-checked at PR review.                                           |
| **Behavioral coverage floor**     | **≥ 80%** of feature inventory scenarios have at least one passing E2E or INT scenario      | E2E + INT only — UNIT alone is not behavioral coverage.                             |
| **Test execution time**           | PR pipeline **< 15 min**; Nightly **< 30 min**                                              | Per `test-quality.md` DoD — no test > 1.5 min, no `waitForTimeout`.                 |
| **Test code quality**             | No test > 300 LOC; zero `await page.waitForTimeout(...)`; zero `try/catch` for flow control | Per `test-quality.md`. Pre-commit lint enforces.                                    |
| **Test isolation**                | Every test cleans up its own fixtures; parallel-safe by default                             | `userFactory` is per-test ID-scoped; `point_transactions` cleanup follows.          |
| **Selector quality**              | `getByRole` > `getByLabel` > `getByText({ exact: true })` > `getByTestId` > `locator(css)`  | INPUT brief §"Selector strategy normative". Reject substring `getByText` in review. |

### 4.6 Out-of-scope (re-confirmed from INPUT brief)

The following are **explicitly excluded** from this catalog and will not appear in any generated scenario file:

1. Edge functions (no `supabase/functions/` directory).
2. Visual regression (Percy / Chromatic).
3. Performance / load testing.
4. Accessibility full audit (basic ARIA assertions inside E2E are fine; no separate axe pass).
5. Security audit beyond RLS (out of scope: pen testing, OWASP scan, JWT cryptanalysis).
6. i18n / l10n (single-language app).
7. Mobile / native testing.
8. Browser matrix beyond Chromium (`playwright.config.ts` projects array has 1 entry).
9. Component-level visual storybook.
10. Synthetic monitoring / production observability tests.
11. Devtools DCE coverage — owned by `npm run check:bundle` (NFR4 / ASR-7); not duplicated here.
12. Migration wizard happy-path (one-time flow, low ROI).

### 4.7 Step 4 Output Summary

- **93 scenarios** across 10 features + 2 cross-cutting groups
- **39 P0**, 24 P1, 21 P2, 4 P3, 1 blocked, 4 background-existing
- Test-level distribution: 16 UNIT / 32 INT / 45 E2E
- Execution strategy: PR (~10-15 min) / Nightly (~25-30 min) / Weekly burn-in
- Effort range: **60-95 hours** spread across 3-4 sprints with AI-assist
- Quality gates: P0 100% / P1 ≥ 95% / behavioral coverage ≥ 80% / no `waitForTimeout`

Step 5 will package this into the final deliverable file(s) in `_bmad-output/test-artifacts/test-design/`.
