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
│   ├── components/               # React UI components (24 components)
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
│   │   │   └── DashboardView.tsx # Primary app screen
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── Layout.tsx        # App shell layout
│   │   │   └── Sidebar.tsx       # Navigation sidebar
│   │   │
│   │   ├── migration/            # Data migration wizard
│   │   │   └── MigrationWizard.tsx
│   │   │
│   │   ├── points/               # Points management
│   │   │   ├── AwardPointsModal.tsx
│   │   │   ├── ClassAwardModal.tsx
│   │   │   ├── ClassPointsBox.tsx
│   │   │   ├── TodaySummary.tsx
│   │   │   └── UndoToast.tsx
│   │   │
│   │   ├── settings/             # Settings views
│   │   │   └── ClassSettingsView.tsx
│   │   │
│   │   ├── students/             # Student display
│   │   │   ├── StudentGrid.tsx
│   │   │   └── StudentPointCard.tsx
│   │   │
│   │   └── ui/                   # Base UI components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   │
│   ├── contexts/                 # React Context providers (4 contexts)
│   │   ├── AppContext.tsx        # Main app context facade
│   │   ├── AuthContext.tsx       # Supabase authentication
│   │   ├── HybridAppContext.tsx  # Online/offline hybrid state
│   │   └── SupabaseAppContext.tsx # Full Supabase data layer
│   │
│   ├── hooks/                    # Custom React hooks (7 hooks)
│   │   ├── index.ts              # Hook exports
│   │   ├── useBehaviors.ts       # Behavior CRUD operations
│   │   ├── useClassrooms.ts      # Classroom management
│   │   ├── usePersistedState.ts  # localStorage persistence
│   │   ├── useRealtimeSubscription.ts # Supabase realtime
│   │   ├── useStudents.ts        # Student operations
│   │   └── useTransactions.ts    # Point transaction ops
│   │
│   ├── lib/                      # Library configurations
│   │   └── supabase.ts           # Supabase client init
│   │
│   ├── services/                 # Business services
│   │   └── SyncManager.ts        # Offline sync manager
│   │
│   ├── types/                    # TypeScript definitions
│   │   ├── index.ts              # Domain types (Behavior, Student, etc.)
│   │   └── database.ts           # Supabase-generated types
│   │
│   ├── utils/                    # Utility functions
│   │   ├── index.ts              # Utility exports
│   │   ├── defaults.ts           # Default behaviors, avatar colors
│   │   ├── migrations.ts         # State migration utilities
│   │   ├── migrateToSupabase.ts  # localStorage to Supabase migration
│   │   └── studentParser.ts      # Student name parsing (CSV/JSON)
│   │
│   └── test/                     # Unit tests
│       └── ...
│
├── supabase/                     # Database configuration
│   └── migrations/
│       └── 001_initial_schema.sql # Database schema + RLS policies
│
├── e2e/                          # End-to-end tests
│   └── undo-points.spec.ts       # Playwright E2E tests
│
├── docs/                         # Generated documentation
│   ├── project-scan-report.json
│   └── ...
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
    └── .env.local                # Local environment (gitignored)
```

## Component Hierarchy

```
<App>
├── <AuthProvider>           # Authentication context
│   └── <AuthGuard>          # Route protection
│       └── <HybridAppProvider>  # Hybrid online/offline state
│           └── <AppContent>
│               └── <Layout>
│                   ├── <Sidebar>            # Navigation
│                   ├── <DashboardView>      # Main content
│                   │   ├── <ClassPointsBox>
│                   │   ├── <StudentGrid>
│                   │   │   └── <StudentPointCard>
│                   │   └── <TodaySummary>
│                   ├── <AwardPointsModal>
│                   │   └── <BehaviorPicker>
│                   │       └── <BehaviorButton>
│                   ├── <ClassAwardModal>
│                   ├── <UndoToast>
│                   └── <ClassSettingsView>
│                       └── <ImportStudentsModal>
```

## File Statistics

| Category | Count |
|----------|-------|
| React Components | 24 |
| React Contexts | 4 |
| Custom Hooks | 7 |
| Utility Modules | 5 |
| Type Definitions | 2 |
| Services | 1 |
| Database Migrations | 1 |
| E2E Test Files | 1 |
| Config Files | 10 |

## Key Entry Points

| File | Purpose |
|------|---------|
| `src/main.tsx` | React DOM mount point |
| `src/App.tsx` | Root component with provider hierarchy |
| `src/contexts/AppContext.tsx` | Main state management facade |
| `src/lib/supabase.ts` | Supabase client initialization |
| `supabase/migrations/001_initial_schema.sql` | Database schema |
