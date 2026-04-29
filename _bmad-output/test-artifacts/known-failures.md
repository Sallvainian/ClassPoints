---
title: 'Known Test Failures — Wave 1a inventory'
date: '2026-04-28'
status: 'documented; not yet investigated'
purpose: 'Factual record of failing tests for downstream review workflows. No diagnosis, no hypothesized causes, no fix suggestions.'
recordedDuring: 'bmad-testarch-automate Wave 1a'
recordedAt: 'HEAD cd0ad84 on branch redesign/editorial-engineering'
---

# Known Test Failures

This document records test failures observed during Wave 1a of `bmad-testarch-automate`. It records **what fails and where**, with verbatim error output. It does not analyze causes or propose fixes.

---

## Failure cluster #1 — `src/test/TeacherDashboard.test.tsx`

**File:** `src/test/TeacherDashboard.test.tsx`
**Test count:** 13 failing / 13 total in this file.
**Runner:** Vitest 4 (jsdom environment).
**Reproduction commands:**

```bash
npx vitest run src/test/TeacherDashboard.test.tsx
npx vitest run                # full suite — all 13 surface here as well
```

### Failing test names

```
TeacherDashboard > Loading State > should show loading spinner while data is loading
TeacherDashboard > Error State > should show error state when useApp() has error
TeacherDashboard > Error State > should show generic error message when error has no message
TeacherDashboard > Empty State > should show welcome screen when no classrooms exist
TeacherDashboard > Empty State > should call createClassroom when create button is clicked
TeacherDashboard > Empty State > should show error when createClassroom fails
TeacherDashboard > Dashboard with Classrooms > should display welcome message with teacher name
TeacherDashboard > Dashboard with Classrooms > should calculate and display correct aggregate statistics
TeacherDashboard > Dashboard with Classrooms > should display classroom cards
TeacherDashboard > Dashboard with Classrooms > should call onSelectClassroom when classroom card is clicked
TeacherDashboard > User Display Name > should use metadata name if available
TeacherDashboard > User Display Name > should fallback to email username if no metadata name
TeacherDashboard > User Display Name > should fallback to "Teacher" if no user info
```

### Verbatim error (identical for all 13)

```
TypeError: window.localStorage.getItem is not a function
 ❯ getInitialTheme src/contexts/ThemeContext.tsx:15:38
     13| function getInitialTheme(): Theme {
     14|   if (typeof window === 'undefined') return 'light';
     15|   const stored = window.localStorage.getItem('theme');
       |                                      ^
     16|   if (stored === 'light' || stored === 'dark') return stored;
     17|   return window.matchMedia('(prefers-color-scheme: dark)').matches ? '…
 ❯ mountState node_modules/react-dom/cjs/react-dom.development.js:16167:20
 ❯ Object.useState node_modules/react-dom/cjs/react-dom.development.js:16880:16
 ❯ useState node_modules/react/cjs/react.development.js:1622:21
 ❯ ThemeProvider src/contexts/ThemeContext.tsx:30:34
 ❯ renderWithHooks node_modules/react-dom/cjs/react-dom.development.js:15486:18
 ❯ mountIndeterminateComponent node_modules/react-dom/cjs/react-dom.development.js:20103:13
 ❯ beginWork node_modules/react-dom/cjs/react-dom.development.js:21626:16
 ❯ beginWork$1 node_modules/react-dom/cjs/react-dom.development.js:27465:14
 ❯ performUnitOfWork node_modules/react-dom/cjs/react-dom.development.js:26599:12
```

A console warning was also printed once during the run:

```
(node:44386) Warning: `--localstorage-file` was provided without a valid path
```

### Source locations referenced in the stack trace

- `src/contexts/ThemeContext.tsx:15` — `getInitialTheme()` body line that raised the `TypeError`
- `src/contexts/ThemeContext.tsx:20` — `ThemeProvider` declaration
- `src/contexts/ThemeContext.tsx:30` — `useState` call inside `ThemeProvider`

### Test-suite metadata at time of recording

- All 13 failures occur during component mount (in `mountIndeterminateComponent`/`mountState`), before any `it()` body code runs.
- File is exercised in two places: file-isolated (`vitest run src/test/TeacherDashboard.test.tsx`) and full-suite (`vitest run`) — same 13 failures in both.
- No other test file in the suite fails. Full-suite snapshot at recording: `1 failed | 6 passed (7 files)`, `13 failed | 95 passed (108 tests)`. The 95 passing includes Wave 1a's 4 new tests.

### Files NOT modified by Wave 1a

- `src/contexts/ThemeContext.tsx` — unchanged.
- `src/test/setup.ts` — unchanged.
- `src/test/TeacherDashboard.test.tsx` — unchanged.
- `vitest.config.ts` — unchanged.

Wave 1a only added `src/hooks/__tests__/useAwardPoints.test.ts` (new file) and the test-artifact docs under `_bmad-output/test-artifacts/`.

---

## Provenance

- Recorded by: `bmad-testarch-automate` Wave 1a step-04 validation.
- Output captured via: `npx vitest run src/test/TeacherDashboard.test.tsx --reporter=verbose 2>&1 | tail -200`.
- Not investigated, not analyzed, not fixed. Hand off to a review workflow (`bmad-testarch-test-review` or equivalent) for diagnosis.
