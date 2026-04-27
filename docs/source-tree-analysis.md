# ClassPoints Source Tree Analysis

_Generated: 2026-04-26 via BMad document-project full rescan, exhaustive scan._

## Top-Level Layout

```text
ClassPoints/
  AGENTS.md                         # Codex/project rules
  CLAUDE.md                         # Claude/project rules
  package.json                      # npm scripts and dependency ranges
  package-lock.json                 # resolved dependency versions
  vite.config.ts                    # Vite app config, base /ClassPoints/
  vitest.config.ts                  # Vitest jsdom config
  playwright.config.ts              # E2E config and Supabase host guard
  eslint.config.js                  # ESLint flat config
  postcss.config.js                 # Tailwind v4 PostCSS plugin
  tailwind.config.js                # Vestigial v3-style stub
  fnox.toml                         # age-encrypted env provider config
  mise.toml                         # fnox tooling setup
  src/                              # React app source
  supabase/                         # local Supabase config and migrations
  tests/                            # Playwright E2E and support fixtures
  scripts/                          # Node/shell utility scripts
  docs/                             # generated and hand-authored docs
  _bmad-output/                     # BMAD planning, implementation, test artifacts
  .github/                          # CI, deploy, assistant workflows, dependabot
```

## `src/`

```text
src/
  main.tsx                          # React root, QueryClientProvider, DevtoolsGate
  App.tsx                           # provider hierarchy and view switching
  index.css                         # Tailwind v4 import and global CSS
  vite-env.d.ts                     # Vite type declarations
  assets/
    sounds/index.ts                 # synthesized Web Audio definitions
  components/
    auth/                           # auth guard and forms
    behaviors/                      # behavior template UI
    classes/                        # student import modal
    common/                         # sync status
    dashboard/                      # active classroom view
    home/                           # teacher home dashboard
    layout/                         # app shell and sidebar
    migration/                      # localStorage-to-Supabase wizard
    points/                         # award/undo/summary UI
    profile/                        # profile and delete-classroom UI
    seating/                        # seating chart view/editor/canvas
    settings/                       # classroom, point, sound settings
    students/                       # student grid/cards
    ui/                             # shared primitives
  contexts/
    AuthContext.tsx                 # Supabase auth/session
    ThemeContext.tsx                # local theme state
    SoundContext.tsx                # sound settings/audio context
    AppContext.tsx                  # legacy app facade and UI/session state
  hooks/
    useClassrooms.ts                # TanStack classrooms hook
    useStudents.ts                  # TanStack students hook + realtime
    useTransactions.ts              # TanStack transaction hooks + optimistic award
    useBehaviors.ts                 # TanStack behavior hooks
    useRealtimeSubscription.ts      # Supabase realtime lifecycle helper
    useLayoutPresets.ts             # legacy layout preset hook
    useSeatingChart.ts              # legacy seating chart hook
    ...                             # local UI/audio/display helpers
  lib/
    supabase.ts                     # typed Supabase client
    queryClient.ts                  # QueryClient defaults
    queryKeys.ts                    # query key registry
    manualAdjustmentConstants.ts    # manual adjustment behavior labels
  services/
    NetworkStatus.ts                # online/offline listener service
  test/
    setup.ts                        # Vitest setup
    *.test.ts(x)                    # legacy unit tests
  types/
    database.ts                     # Supabase database types
    index.ts                        # app-facing types
    transforms.ts                   # DB-to-app transforms
    seatingChart.ts                 # seating chart types/transforms/defaults
  utils/
    defaults.ts                     # default behaviors and avatar colors
    dateUtils.ts                    # UTC day/week boundaries
    errorMessages.ts                # user-facing messages
    leaderboardCalculations.ts      # pure leaderboard logic
    migrateToSupabase.ts            # browser-side migration utility
    migrations.ts                   # legacy localStorage state migration
    studentParser.ts                # CSV/JSON roster parser
    validateAudioUrl.ts             # custom sound URL validation/loading
```

## Critical Source Files

| File                                            | Why it matters                                     |
| ----------------------------------------------- | -------------------------------------------------- |
| `src/main.tsx`                                  | Devtools DCE pattern and root provider             |
| `src/App.tsx`                                   | Provider order and lazy view map                   |
| `src/contexts/AppContext.tsx`                   | Legacy facade, active classroom, mutation wrappers |
| `src/hooks/useTransactions.ts`                  | Canonical optimistic mutation implementation       |
| `src/hooks/useStudents.ts`                      | Realtime cache merge and time-total preservation   |
| `src/hooks/useClassrooms.ts`                    | Classroom aggregates and RPC time totals           |
| `src/hooks/useRealtimeSubscription.ts`          | Channel lifecycle and reconnect behavior           |
| `src/hooks/useSeatingChart.ts`                  | Large legacy seating chart operation hook          |
| `src/components/seating/SeatingChartEditor.tsx` | Largest interactive UI component                   |
| `src/types/database.ts`                         | Typed Supabase schema                              |
| `src/types/transforms.ts`                       | DB-to-app data boundary                            |

## `supabase/`

```text
supabase/
  config.toml                       # local Supabase config, Postgres 17 local stack
  migrations/
    001_initial_schema.sql
    002_add_user_auth.sql
    003_sync_default_behaviors.sql
    004_enable_realtime.sql
    005_replica_identity_full.sql
    006_add_batch_id.sql
    007_add_sound_settings.sql
    008_add_seating_charts.sql
    009_fix_room_element_dimensions.sql
    010_add_room_element_types.sql
    011_add_student_point_totals.sql
  snippets/                         # ad-hoc SQL snippets
```

## `tests/`

```text
tests/
    README.md                         # E2E guidance, partially stale in follow-up section
  e2e/
    auth.setup.ts                   # storageState setup project
    example.spec.ts                 # bootstrap/factory scaffold
  support/
    fixtures/
      index.ts                      # merged Playwright fixtures
      factories/user.factory.ts     # service-role user factory
    helpers/
      auth.ts                       # UI login helper
      supabase-admin.ts             # service-role client
    page-objects/.gitkeep
```

Playwright runs only against loopback/private/Tailscale Supabase hosts. `auth.setup.ts` now exists
and stores `.auth/user.json`, even though `tests/README.md` still contains a stale follow-up note
about porting it.

## `scripts/`

| Script                   | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `check-bundle.mjs`       | Verifies production bundle has no React Query Devtools leakage |
| `seed-test-user.ts`      | Creates local E2E test user from `.env.test`                   |
| `seed-test-classroom.ts` | Seeds a demo local classroom                                   |
| `seed-counter-data.ts`   | Seeds richer counter/dashboard data                            |
| `migrate-data.ts`        | CLI localStorage-to-Supabase migration                         |
| `browser-migrate.js`     | Browser console migration helper                               |
| `verify-undo-fix.ts`     | Local verification script for undo totals                      |
| `ci-local.sh`            | Local CI mirror                                                |
| `burn-in.sh`             | Repeated E2E run helper                                        |
| `test-changed.sh`        | Selective test runner for changed files                        |

## `.github/`

| File                               | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `workflows/test.yml`               | Lint/typecheck, bundle DCE, sharded E2E, burn-in |
| `workflows/deploy.yml`             | GitHub Pages deploy                              |
| `workflows/claude.yml`             | Claude issue/comment automation                  |
| `workflows/claude-code-review.yml` | Claude PR review automation                      |
| `dependabot.yml`                   | npm and GitHub Actions dependency updates        |

## Documentation Areas

```text
docs/
  index.md
  project-overview.md
  architecture.md
  data-models.md
  state-management.md
  component-inventory.md
  source-tree-analysis.md
  development-guide.md
  modernization-plan.md
  point-counter-inventory.md
  rules-review-category-3.md
  adr/ADR-005-queryclient-defaults.md
  legacy/legacy-*.md
  screenshots/counters/*.png
```

`docs/legacy/` files are historical inventories and refactor targets, not current implementation
rules. `_bmad-output/project-context.md` is the densest AI-context file and should be checked for
staleness against HEAD before relying on line-specific claims.
