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
│   ├── components/               # React UI components (37 components)
│   │   ├── auth/                 # Authentication components
│   │   │   ├── AuthGuard.tsx     # Route protection wrapper
│   │   │   ├── AuthPage.tsx      # Auth page container
│   │   │   ├── LoginForm.tsx     # Sign-in form
│   │   │   ├── SignupForm.tsx    # Registration form
│   │   │   └── ForgotPasswordForm.tsx
│   │   │
│   │   ├── behaviors/            # Behavior selection UI
│   │   │   ├── BehaviorButton.tsx
│   │   │   └── BehaviorPicker.tsx
│   │   │
│   │   ├── classes/              # Classroom management
│   │   │   └── ImportStudentsModal.tsx
│   │   │
│   │   ├── common/               # Shared components
│   │   │   └── SyncStatus.tsx    # Online/offline indicator
│   │   │
│   │   ├── dashboard/            # Main dashboard view
│   │   │   ├── DashboardView.tsx # Primary app screen
│   │   │   └── BottomToolbar.tsx # Selection mode toolbar
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── Layout.tsx        # App shell layout
│   │   │   └── Sidebar.tsx       # Navigation sidebar
│   │   │
│   │   ├── migration/            # Data migration wizard
│   │   │   └── MigrationWizard.tsx
│   │   │
│   │   ├── points/               # Points management
│   │   │   ├── AwardPointsModal.tsx  # Single student points
│   │   │   ├── ClassAwardModal.tsx   # Class-wide points
│   │   │   ├── MultiAwardModal.tsx   # Multi-select points
│   │   │   ├── ClassPointsBox.tsx    # Class totals display
│   │   │   ├── TodaySummary.tsx      # Recent activity
│   │   │   └── UndoToast.tsx         # Undo notification
│   │   │
│   │   ├── seating/              # Seating chart feature (NEW)
│   │   │   ├── SeatingChartView.tsx     # Main seating chart display
│   │   │   ├── SeatingChartEditor.tsx   # Edit mode with drag-drop
│   │   │   ├── SeatingChartCanvas.tsx   # Canvas/viewport container
│   │   │   ├── TableGroup.tsx           # 4-seat table group component
│   │   │   ├── SeatCard.tsx             # Individual seat with student
│   │   │   ├── RoomElementDisplay.tsx   # Teacher desk, doors, etc.
│   │   │   ├── EmptyChartPrompt.tsx     # Create chart CTA
│   │   │   └── ViewModeToggle.tsx       # Alphabetical/seating toggle
│   │   │
│   │   ├── settings/             # Settings views
│   │   │   ├── ClassSettingsView.tsx
│   │   │   ├── SoundSettings.tsx
│   │   │   └── SoundSettingsModal.tsx
│   │   │
│   │   ├── students/             # Student display
│   │   │   ├── StudentGrid.tsx
│   │   │   └── StudentPointCard.tsx
│   │   │
│   │   └── ui/                   # Base UI components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── ErrorToast.tsx
│   │
│   ├── contexts/                 # React Context providers (5 contexts)
│   │   ├── AppContext.tsx        # Main app context facade (re-exports HybridAppContext)
│   │   ├── AuthContext.tsx       # Supabase authentication
│   │   ├── HybridAppContext.tsx  # Online/offline hybrid state
│   │   ├── SoundContext.tsx      # Sound effects settings
│   │   └── SupabaseAppContext.tsx # Full Supabase data layer
│   │
│   ├── hooks/                    # Custom React hooks (11 hooks)
│   │   ├── index.ts              # Hook exports
│   │   ├── useBehaviors.ts       # Behavior CRUD operations
│   │   ├── useClassrooms.ts      # Classroom management with point totals
│   │   ├── useDisplaySettings.ts # Card size and display prefs
│   │   ├── useLayoutPresets.ts   # Seating chart layout presets (NEW)
│   │   ├── usePersistedState.ts  # localStorage persistence
│   │   ├── useRealtimeSubscription.ts # Supabase realtime subscription
│   │   ├── useSeatingChart.ts    # Seating chart CRUD + drag-drop (NEW)
│   │   ├── useSoundEffects.ts    # Sound effect playback
│   │   ├── useStudents.ts        # Student operations with point totals
│   │   └── useTransactions.ts    # Point transaction operations
│   │
│   ├── lib/                      # Library configurations
│   │   └── supabase.ts           # Supabase client init
│   │
│   ├── services/                 # Business services
│   │   └── SyncManager.ts        # Offline sync manager
│   │
│   ├── types/                    # TypeScript definitions
│   │   ├── index.ts              # Domain types (Behavior, Student, etc.)
│   │   ├── database.ts           # Supabase-generated types
│   │   └── seatingChart.ts       # Seating chart types + helpers (NEW)
│   │
│   ├── assets/                   # Static assets
│   │   └── sounds/               # Sound effect definitions
│   │       └── index.ts          # Sound synthesis definitions
│   │
│   ├── utils/                    # Utility functions (7 modules)
│   │   ├── index.ts              # Utility exports
│   │   ├── defaults.ts           # Default behaviors, avatar colors
│   │   ├── errorMessages.ts      # Centralized error messages
│   │   ├── migrations.ts         # State migration utilities
│   │   ├── migrateToSupabase.ts  # localStorage to Supabase migration
│   │   ├── studentParser.ts      # Student name parsing (CSV/JSON)
│   │   └── validateAudioUrl.ts   # Custom audio URL validation
│   │
│   └── test/                     # Unit tests
│       └── ...
│
├── supabase/                     # Database configuration
│   └── migrations/               # 10 migration files
│       ├── 001_initial_schema.sql     # Base schema + temporary RLS
│       ├── 002_add_user_auth.sql      # User auth + proper RLS
│       ├── 003_sync_default_behaviors.sql
│       ├── 004_enable_realtime.sql    # Enable realtime on tables
│       ├── 005_replica_identity_full.sql # Full row data for DELETE events
│       ├── 006_add_batch_id.sql       # Batch transactions for class-wide awards
│       ├── 007_add_sound_settings.sql # User sound preferences
│       ├── 008_add_seating_charts.sql # Seating charts + groups + seats + elements (NEW)
│       ├── 009_fix_room_element_dimensions.sql # Room element default sizes (NEW)
│       └── 010_add_room_element_types.sql # Additional room element types (NEW)
│
├── docs/                         # Generated documentation
│   ├── index.md                  # Documentation index
│   ├── architecture.md           # System architecture
│   ├── data-models.md            # Database schema
│   ├── tech-stack.md             # Technology stack
│   ├── source-tree.md            # This file
│   ├── patterns-and-rules/       # Coding patterns
│   ├── ux-design-specification/  # UX design system
│   └── plans/                    # Feature plans
│
├── public/                       # Static assets
│   └── vite.svg
│
├── scripts/                      # Utility scripts
│
├── .github/                      # GitHub Actions
│   └── workflows/
│
├── dist/                         # Build output
│
└── Configuration Files
    ├── package.json              # Dependencies and scripts
    ├── vite.config.ts            # Vite configuration
    ├── tsconfig.json             # TypeScript config (references)
    ├── tsconfig.app.json         # App TypeScript config
    ├── tsconfig.node.json        # Node TypeScript config
    ├── tailwind.config.js        # Tailwind CSS config
    ├── postcss.config.js         # PostCSS config
    ├── playwright.config.ts      # Playwright E2E config
    ├── vitest.config.ts          # Vitest unit test config
    ├── eslint.config.js          # ESLint config
    ├── .env.example              # Environment template
    └── .env.local                # Local environment (encrypted via dotenvx)
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
│                       ├── <UndoToast>
│                       ├── <SyncStatus>
│                       └── <ClassSettingsView>
│                           ├── <ImportStudentsModal>
│                           └── <SoundSettingsModal>
│                               └── <SoundSettings>
```

## File Statistics

| Category            | Count |
| ------------------- | ----- |
| React Components    | 29    |
| React Contexts      | 5     |
| Custom Hooks        | 9     |
| Utility Modules     | 7     |
| Type Definitions    | 2     |
| Services            | 1     |
| Database Migrations | 7     |
| E2E Test Files      | 2     |
| E2E Page Objects    | 1     |
| Config Files        | 10    |

_Last updated: 2026-01-12_

## Key Entry Points

| File                                         | Purpose                                |
| -------------------------------------------- | -------------------------------------- |
| `src/main.tsx`                               | React DOM mount point                  |
| `src/App.tsx`                                | Root component with provider hierarchy |
| `src/contexts/AppContext.tsx`                | Main state management facade           |
| `src/lib/supabase.ts`                        | Supabase client initialization         |
| `supabase/migrations/001_initial_schema.sql` | Database schema                        |
