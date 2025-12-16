# ClassPoints Source Tree

## Project Structure Overview

```
ClassPoints/
├── src/                          # Application source code
│   ├── App.tsx                   # Main app entry point with provider hierarchy
│   ├── main.tsx                  # React DOM entry point
│   ├── index.css                 # Global styles (Tailwind imports)
│   ├── vite-env.d.ts             # Vite type declarations
│   │
│   ├── components/               # React UI components (29 components)
│   │   ├── auth/                 # Authentication components
│   │   │   ├── AuthGuard.tsx     # Route protection wrapper
│   │   │   ├── AuthPage.tsx      # Auth page container
│   │   │   ├── LoginForm.tsx     # Sign-in form
│   │   │   ├── SignupForm.tsx    # Registration form
│   │   │   ├── ForgotPasswordForm.tsx
│   │   │   └── index.ts          # Barrel export
│   │   │
│   │   ├── behaviors/            # Behavior selection UI
│   │   │   ├── BehaviorButton.tsx # Individual behavior button
│   │   │   ├── BehaviorPicker.tsx # Behavior selection panel
│   │   │   └── index.ts
│   │   │
│   │   ├── classes/              # Classroom management
│   │   │   ├── ImportStudentsModal.tsx # CSV/JSON import
│   │   │   └── index.ts
│   │   │
│   │   ├── common/               # Shared components
│   │   │   └── SyncStatus.tsx    # Online/offline indicator
│   │   │
│   │   ├── dashboard/            # Main dashboard view
│   │   │   ├── DashboardView.tsx # Primary app screen
│   │   │   ├── BottomToolbar.tsx # Selection mode toolbar
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── Layout.tsx        # App shell layout
│   │   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   │   └── index.ts
│   │   │
│   │   ├── migration/            # Data migration wizard
│   │   │   └── MigrationWizard.tsx # localStorage → Supabase
│   │   │
│   │   ├── points/               # Points management
│   │   │   ├── AwardPointsModal.tsx  # Single student points
│   │   │   ├── ClassAwardModal.tsx   # Class-wide points
│   │   │   ├── MultiAwardModal.tsx   # Multi-select points
│   │   │   ├── ClassPointsBox.tsx    # Class totals display
│   │   │   ├── TodaySummary.tsx      # Recent activity
│   │   │   ├── UndoToast.tsx         # Undo notification (10s window)
│   │   │   └── index.ts
│   │   │
│   │   ├── settings/             # Settings views
│   │   │   ├── ClassSettingsView.tsx # Main settings panel
│   │   │   ├── SoundSettings.tsx     # Sound config form
│   │   │   ├── SoundSettingsModal.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── students/             # Student display
│   │   │   ├── StudentGrid.tsx       # Grid layout with selection
│   │   │   ├── StudentPointCard.tsx  # Individual student card
│   │   │   └── index.ts
│   │   │
│   │   └── ui/                   # Base UI components
│   │       ├── Button.tsx        # Styled button variants
│   │       ├── Input.tsx         # Form input component
│   │       ├── Modal.tsx         # Modal dialog wrapper
│   │       ├── ErrorToast.tsx    # Error notification
│   │       └── index.ts
│   │
│   ├── contexts/                 # React Context providers (5 contexts)
│   │   ├── AppContext.tsx        # Main app context facade (useApp hook)
│   │   ├── AuthContext.tsx       # Supabase authentication
│   │   ├── HybridAppContext.tsx  # Online/offline hybrid state
│   │   ├── SoundContext.tsx      # Sound effects settings (Web Audio API)
│   │   └── SupabaseAppContext.tsx # Full Supabase data layer (791 lines)
│   │
│   ├── hooks/                    # Custom React hooks (9 hooks)
│   │   ├── index.ts              # Hook exports
│   │   ├── useBehaviors.ts       # Behavior CRUD + realtime
│   │   ├── useClassrooms.ts      # Classroom management + realtime
│   │   ├── useDisplaySettings.ts # Card size and display prefs
│   │   ├── usePersistedState.ts  # localStorage persistence
│   │   ├── useRealtimeSubscription.ts # Generic Supabase realtime
│   │   ├── useSoundEffects.ts    # Sound effect playback
│   │   ├── useStudents.ts        # Student operations + realtime
│   │   ├── useTransactions.ts    # Point transactions + undo
│   │   └── __tests__/
│   │       └── useRealtimeSubscription.test.ts
│   │
│   ├── lib/                      # Library configurations
│   │   └── supabase.ts           # Supabase client init
│   │
│   ├── services/                 # Business services
│   │   └── SyncManager.ts        # Offline sync queue (last-write-wins)
│   │
│   ├── types/                    # TypeScript definitions
│   │   ├── index.ts              # Domain types (Behavior, Student, etc.)
│   │   └── database.ts           # Supabase-generated types
│   │
│   ├── assets/                   # Static assets
│   │   └── sounds/
│   │       └── index.ts          # Sound asset exports
│   │
│   ├── utils/                    # Utility functions (7 modules)
│   │   ├── index.ts              # Utility exports
│   │   ├── defaults.ts           # Default behaviors, avatar colors
│   │   ├── errorMessages.ts      # Centralized error messages
│   │   ├── migrations.ts         # State migration utilities
│   │   ├── migrateToSupabase.ts  # localStorage → Supabase migration
│   │   ├── studentParser.ts      # Student name parsing (CSV/JSON)
│   │   ├── validateAudioUrl.ts   # Custom audio URL validation
│   │   └── __tests__/
│   │       └── studentParser.test.ts
│   │
│   └── test/                     # Unit test setup
│       ├── setup.ts              # Vitest setup
│       └── sounds.test.ts        # Sound utility tests
│
├── supabase/                     # Database configuration
│   └── migrations/               # 7 migration files
│       ├── 001_initial_schema.sql     # Base schema + temporary RLS
│       ├── 002_add_user_auth.sql      # User auth + proper RLS
│       ├── 003_sync_default_behaviors.sql # Sync defaults on user create
│       ├── 004_enable_realtime.sql    # Enable realtime on all tables
│       ├── 005_replica_identity_full.sql # Full row data for DELETE events
│       ├── 006_add_batch_id.sql       # Batch transactions for class awards
│       └── 007_add_sound_settings.sql # user_sound_settings table
│
├── e2e/                          # End-to-end tests (Playwright)
│   ├── fixtures/
│   │   └── auth.fixture.ts       # Auth test fixtures
│   ├── page-objects/
│   │   └── SoundSettingsPage.ts  # POM for sound settings
│   ├── undo-points.spec.ts       # Undo functionality E2E
│   └── sound-settings.spec.ts    # Sound settings E2E
│
├── docs/                         # Project documentation
│   ├── project-scan-report.json  # Workflow state tracking
│   ├── source-tree.md            # This file
│   ├── architecture.md           # Architecture overview
│   ├── data-models.md            # Database and domain models
│   ├── tech-stack.md             # Technology stack details
│   ├── ci.md                     # CI/CD documentation
│   ├── project-context.md        # Project rules and context
│   ├── index.md                  # Documentation index
│   │
│   ├── archive/                  # Archived BMAD sprint artifacts
│   │   └── prd-1-code-quality-bmad/
│   │       ├── sprint-artifacts/ # Story files, tech specs, retros
│   │       ├── prd.md, epics.md  # Planning docs
│   │       └── ...
│   │
│   ├── patterns-and-rules/       # Development patterns (11 files)
│   │   ├── index.md
│   │   ├── architecture-patterns.md
│   │   ├── component-patterns.md
│   │   ├── data-access-patterns.md
│   │   ├── state-management-patterns.md
│   │   ├── database-rules.md
│   │   ├── file-organization-rules.md
│   │   ├── naming-conventions.md
│   │   ├── security-rules.md
│   │   ├── type-system-rules.md
│   │   └── quick-reference-checklist.md
│   │
│   ├── ux-design-specification/  # UX design docs (14 files)
│   │   ├── index.md
│   │   ├── executive-summary.md
│   │   ├── core-user-experience.md
│   │   ├── design-system.md
│   │   ├── visual-design-foundation.md
│   │   ├── component-strategy.md
│   │   ├── user-journey-flows.md
│   │   └── ...
│   │
│   ├── plans/                    # Feature design plans
│   │   └── 2025-01-22-seating-chart-design/
│   │       ├── index.md
│   │       └── 1-overview.md through 15-*.md
│   │
│   └── diagrams/
│       └── theme.json            # Diagram theme config
│
├── scripts/                      # Utility scripts
│   ├── migrate-data.ts           # Data migration script
│   └── browser-migrate.js        # Browser migration helper
│
├── .github/                      # GitHub configuration
│   ├── workflows/                # CI/CD pipelines (4 workflows)
│   │   ├── test.yml              # Lint + E2E (4 shards) + burn-in
│   │   ├── deploy.yml            # Build + deploy to GitHub Pages
│   │   ├── claude.yml            # Claude Code assistant config
│   │   └── claude-code-review.yml # Claude code review automation
│   │
│   ├── agents/                   # GitHub Copilot agents
│   │   └── bmd-custom-bmm-*.agent.md
│   │
│   └── dependabot.yml            # Dependency updates
│
├── .agent/workflows/             # BMAD workflow definitions
│   └── bmad-*.md                 # 50+ workflow definition files
│
├── bmad-custom-src/              # BMAD customization
│   └── custom.yaml               # Custom BMAD config
│
└── Configuration Files
    ├── package.json              # Dependencies and scripts
    ├── package-lock.json         # Lock file
    ├── vite.config.ts            # Vite configuration
    ├── tsconfig.json             # TypeScript config (references)
    ├── tsconfig.app.json         # App TypeScript config
    ├── tsconfig.node.json        # Node TypeScript config
    ├── tailwind.config.js        # Tailwind CSS config
    ├── postcss.config.js         # PostCSS config
    ├── playwright.config.ts      # Playwright E2E config
    ├── vitest.config.ts          # Vitest unit test config
    ├── eslint.config.js          # ESLint flat config
    ├── .mcp.json                 # MCP server configuration
    ├── .env.example              # Environment template
    ├── .env.local                # Local environment (encrypted)
    ├── CLAUDE.md                 # Claude Code instructions
    └── README.md                 # Project readme
```

## Component Hierarchy

```
<App>
├── <AuthProvider>               # Authentication context
│   └── <AuthGuard>              # Route protection
│       └── <SoundProvider>      # Sound effects context
│           └── <HybridAppProvider>  # Hybrid online/offline state
│               └── <AppContent>
│                   └── <Layout>
│                       ├── <Sidebar>              # Navigation
│                       ├── <DashboardView>        # Main content
│                       │   ├── <ClassPointsBox>
│                       │   ├── <StudentGrid>
│                       │   │   └── <StudentPointCard>
│                       │   └── <TodaySummary>
│                       ├── <AwardPointsModal>
│                       │   └── <BehaviorPicker>
│                       │       └── <BehaviorButton>
│                       ├── <ClassAwardModal>
│                       ├── <MultiAwardModal>
│                       ├── <UndoToast>
│                       ├── <SyncStatus>
│                       └── <ClassSettingsView>
│                           ├── <ImportStudentsModal>
│                           └── <SoundSettingsModal>
│                               └── <SoundSettings>
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Components                            │
│  (StudentGrid, DashboardView, AwardPointsModal, etc.)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ useApp() hook
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AppContext (Facade)                           │
│  Provides unified API: classrooms, students, behaviors,         │
│  transactions, awardPoints, undoTransaction, etc.               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  HybridAppContext                                │
│  Wraps SupabaseAppContext + SyncManager for offline support     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SupabaseAppContext                               │
│  Uses hooks: useClassrooms, useStudents, useBehaviors,          │
│  useTransactions - all with optimistic updates + realtime       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│             useRealtimeSubscription (generic hook)               │
│  Supabase postgres_changes: INSERT, UPDATE, DELETE events       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Client                               │
│  supabase.from(table).select/insert/update/delete               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Supabase)                      │
│  Tables: classrooms, students, behaviors, point_transactions,   │
│  user_sound_settings - all with RLS enabled                     │
└─────────────────────────────────────────────────────────────────┘
```

## File Statistics

| Category               | Count | Notes                           |
| ---------------------- | ----- | ------------------------------- |
| React Components       | 29    | Organized in 10 feature folders |
| React Contexts         | 5     | Hierarchical providers          |
| Custom Hooks           | 9     | All with realtime support       |
| Utility Modules        | 7     | Plus 2 test files               |
| Type Definitions       | 2     | Domain + database types         |
| Services               | 1     | SyncManager for offline         |
| Database Migrations    | 7     | Progressive schema evolution    |
| E2E Test Files         | 2     | Playwright specs                |
| E2E Page Objects       | 1     | Sound settings POM              |
| Unit Test Files        | 3     | Vitest tests                    |
| CI/CD Workflows        | 4     | GitHub Actions                  |
| Documentation Files    | 50+   | Patterns, UX, plans             |
| Config Files           | 15    | Build, lint, test configs       |
| Total Source Files     | 71    | TypeScript (.ts, .tsx)          |

## Key Entry Points

| File                                         | Purpose                                    |
| -------------------------------------------- | ------------------------------------------ |
| `src/main.tsx`                               | React DOM mount point                      |
| `src/App.tsx`                                | Root component with provider hierarchy     |
| `src/contexts/AppContext.tsx`                | Main state management facade (useApp)      |
| `src/contexts/SupabaseAppContext.tsx`        | Full data layer with optimistic updates    |
| `src/hooks/useRealtimeSubscription.ts`       | Generic realtime subscription pattern      |
| `src/lib/supabase.ts`                        | Supabase client initialization             |
| `src/services/SyncManager.ts`                | Offline queue with last-write-wins         |
| `supabase/migrations/001_initial_schema.sql` | Database schema foundation                 |

## CI/CD Pipeline Flow

```
push/PR to main
       │
       ▼
┌──────────────┐    ┌──────────────┐
│   test.yml   │    │  deploy.yml  │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  ESLint      │    │  ESLint      │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ E2E Tests    │    │  TypeCheck   │
│ (4 shards)   │    └──────┬───────┘
└──────┬───────┘           │
       │                   ▼
       ▼           ┌──────────────┐
┌──────────────┐   │  Unit Tests  │
│ Burn-in Loop │   └──────┬───────┘
│ (10 iters)   │          │
└──────────────┘          ▼
                   ┌──────────────┐
                   │  Vite Build  │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ GitHub Pages │
                   └──────────────┘
```

_Last updated: 2025-12-15 (Exhaustive scan)_
