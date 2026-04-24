# ClassPoints Documentation

_Last generated: 2026-04-21 — regenerated via BMad document-project (full rescan, exhaustive)._

ClassPoints is a React classroom-management app for teachers to track student behavior points. Supabase-backed, Realtime-synced, deployed to GitHub Pages.

| Attribute        | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | Single-Page Application (SPA), monolith           |
| Architecture     | Client-only React + Supabase BaaS                 |
| Primary language | TypeScript 5.9 (strict)                           |
| Framework        | React 18.3                                        |
| Build            | Vite 6.0 (subpath deploy `/ClassPoints/`)         |
| Styling          | Tailwind CSS 4.1                                  |
| Backend          | Supabase 2.90 — Postgres 15+, Auth, Realtime, RLS |
| Test             | Vitest 4 (unit) + Playwright 1.57 (E2E)           |

---

## Start Here

Pick the doc that matches what you're doing:

| I want to...                     | Read                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Understand the system end-to-end | **[Architecture](./architecture.md)** — master overview with cross-links                           |
| Make a code change               | [Development Guide](./development-guide.md) — setup, daily commands, conventions                   |
| Touch the database schema        | [Data Models](./data-models.md) — tables, RLS, triggers, migrations                                |
| Add a context / hook / state     | [State Management](./state-management.md) — context hierarchy, data-hook shape, optimistic updates |
| Find a component                 | [Component Inventory](./component-inventory.md) — all 45 components, grouped by feature            |
| Navigate the repo                | [Source Tree Analysis](./source-tree-analysis.md) — annotated directory layout                     |

---

## Quick Reference

**Daily commands** (always via npm scripts — they wrap `fnox exec` for secrets):

```bash
npm run dev                # http://localhost:5173/ClassPoints/
npm run build              # tsc -b && vite build → dist/
npm run lint
npm run typecheck
npm test                   # Vitest watch
npm run test:e2e:local     # Playwright against LOCAL Supabase
```

**Entry points:**

- Application: `src/main.tsx` → `src/App.tsx`
- State facade: `useApp()` from `src/contexts/AppContext.tsx`
- Supabase client: `src/lib/supabase.ts`

**Database tables** (see [`data-models.md`](./data-models.md) for full schema):

| Table                 | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `classrooms`          | Teacher-owned classroom containers                         |
| `students`            | Students with trigger-maintained point totals              |
| `behaviors`           | Point templates — 14 defaults (user_id NULL) + user custom |
| `point_transactions`  | Append-only audit log; drives student totals via trigger   |
| `user_sound_settings` | Per-user sound preferences (syncs via realtime)            |
| `seating_charts`      | One per classroom (canvas config)                          |
| `seating_groups`      | Letter-labeled table clusters                              |
| `seating_seats`       | 4 per group; optional student_id                           |
| `room_elements`       | Teacher desk, door, window, countertop, sink               |
| `layout_presets`      | User-owned saved canvas layouts                            |

**Context provider tree** (`src/App.tsx`):

```
AuthProvider → AuthGuard → ThemeProvider → SoundProvider → AppProvider → AppContent
```

---

## Feature Domains

| Folder under `src/components/` | Components                                                                                         | Primary hooks consumed                |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `auth/`                        | 5 (AuthGuard, AuthPage, LoginForm, SignupForm, ForgotPasswordForm)                                 | `useAuth`                             |
| `behaviors/`                   | 2 (BehaviorButton, BehaviorPicker)                                                                 | —                                     |
| `classes/`                     | 1 (ImportStudentsModal)                                                                            | —                                     |
| `common/`                      | 1 (SyncStatus singleton)                                                                           | —                                     |
| `dashboard/`                   | 2 (DashboardView, BottomToolbar)                                                                   | `useApp`, `useDisplaySettings`        |
| `home/`                        | 4 (TeacherDashboard, ClassroomCard, StatsCard, LeaderboardCard)                                    | `useApp`, `useRotatingCategory`       |
| `layout/`                      | 2 (Layout, Sidebar)                                                                                | `useApp`, `useAuth`, `useTheme`       |
| `migration/`                   | 1 (MigrationWizard, lazy)                                                                          | —                                     |
| `points/`                      | 6 (AwardPointsModal, ClassAwardModal, MultiAwardModal, ClassPointsBox, TodaySummary, UndoToast)    | `useApp`, `useSoundEffects`           |
| `profile/`                     | 2 (ProfileView lazy, DeleteClassroomModal)                                                         | `useApp`, `useAuth`                   |
| `seating/`                     | 8 (SeatingChartView, SeatingChartEditor lazy, + 6 others)                                          | `useSeatingChart`, `useLayoutPresets` |
| `settings/`                    | 5 (ClassSettingsView lazy, AdjustPointsModal, ResetPointsModal, SoundSettings, SoundSettingsModal) | `useApp`                              |
| `students/`                    | 2 (StudentGrid, StudentPointCard)                                                                  | —                                     |
| `ui/`                          | 4 (Button, Input, Modal, ErrorToast) — design-system primitives                                    | —                                     |

---

## AI-Instruction Docs (not generated)

- [`CLAUDE.md`](../CLAUDE.md) — project-root rules for Claude Code. Commands + secret management + E2E safety.
- [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) — GitHub Copilot rules.
- [`_bmad-output/project-context.md`](../_bmad-output/project-context.md) — detailed AI context. **Note: sections on state management are aspirational (TanStack Query migration not installed).** The docs in this directory are the source of truth.

## Archived

- [`docs/legacy/`](./legacy/) — 8 `legacy-*.md` files that used to live at `.claude/rules/`. `.claude/rules/` no longer exists; kept as historical reference.
- [`docs/.archive/`](./.archive/) — prior `project-scan-report.json` snapshots.

---

## For AI Agents

1. Start with this index.
2. Read [architecture.md](./architecture.md) for system-level context.
3. Read [CLAUDE.md](../CLAUDE.md) for the rules and commands.
4. For specific work, follow the "Start Here" table above.
5. Before editing `src/**` or `supabase/migrations/**`, read [state-management.md](./state-management.md) and [data-models.md](./data-models.md) — they encode invariants the code relies on.

---

## Generated-Doc Provenance

Regenerated 2026-04-21 via BMad document-project (full rescan, exhaustive scan level). Previous run was 2026-01-23.

State file: `docs/project-scan-report.json` (current run) + `docs/.archive/` (prior).
