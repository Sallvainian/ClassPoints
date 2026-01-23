# Source Tree Analysis - ClassPoints

## Directory Structure

```
ClassPoints/
├── .claude/                    # Claude Code configuration
│   ├── rules/                  # Project-specific coding rules
│   │   ├── components.md       # Component patterns
│   │   ├── contexts.md         # Context patterns
│   │   ├── hooks.md            # Hook patterns
│   │   ├── state-management.md # State architecture
│   │   ├── testing.md          # Testing patterns
│   │   └── utils.md            # Utility patterns
│   ├── audio/                  # TTS audio cache
│   └── hooks/                  # Git hooks
│
├── docs/                       # 📚 Project documentation (AI-friendly)
│   ├── index.md                # Master index (entry point)
│   ├── architecture.md         # System architecture overview
│   ├── data-models.md          # Database schema
│   ├── state-management.md     # React Context architecture
│   ├── component-inventory.md  # UI component catalog
│   ├── source-tree-analysis.md # This file
│   ├── development-guide.md    # Development instructions
│   └── tech-stack.md           # Technology decisions
│
├── e2e/                        # 🧪 E2E tests (Playwright)
│   └── *.spec.ts               # E2E test files
│
├── public/                     # Static assets
│   └── vite.svg                # Favicon
│
├── src/                        # 📦 Source code
│   ├── assets/                 # Bundled assets
│   │   └── sounds/             # Audio files and index
│   │       └── index.ts        # Sound file exports
│   │
│   ├── components/             # ⚛️ React components (by feature)
│   │   ├── auth/               # Authentication UI
│   │   ├── behaviors/          # Behavior buttons/picker
│   │   ├── classes/            # Class management
│   │   ├── common/             # Shared components
│   │   ├── dashboard/          # Classroom dashboard
│   │   ├── home/               # Teacher home page
│   │   ├── layout/             # Layout/navigation
│   │   ├── migration/          # Data migration wizard
│   │   ├── points/             # Point awarding UI
│   │   ├── profile/            # User profile
│   │   ├── seating/            # Seating chart feature
│   │   ├── settings/           # Settings pages
│   │   ├── students/           # Student management
│   │   └── ui/                 # UI primitives (Button, Modal, etc.)
│   │
│   ├── contexts/               # 🔄 React Context providers
│   │   ├── AppContext.tsx      # Backwards-compat re-export
│   │   ├── AuthContext.tsx     # Supabase auth state
│   │   ├── HybridAppContext.tsx # Main app facade (use this)
│   │   ├── SoundContext.tsx    # Sound effects state
│   │   └── SupabaseAppContext.tsx # Full Supabase data layer
│   │
│   ├── hooks/                  # 🪝 Custom React hooks
│   │   ├── index.ts            # Barrel export
│   │   ├── useBehaviors.ts     # Behavior CRUD
│   │   ├── useClassrooms.ts    # Classroom CRUD
│   │   ├── useDisplaySettings.ts # UI preferences
│   │   ├── useLayoutPresets.ts # Saved layouts
│   │   ├── usePersistedState.ts # localStorage persistence
│   │   ├── useRealtimeSubscription.ts # Supabase realtime
│   │   ├── useRotatingCategory.ts # Behavior rotation
│   │   ├── useSeatingChart.ts  # Seating chart CRUD
│   │   ├── useSoundEffects.ts  # Audio playback
│   │   ├── useStudents.ts      # Student CRUD
│   │   └── useTransactions.ts  # Point transactions
│   │
│   ├── lib/                    # 📚 Library configuration
│   │   └── supabase.ts         # Supabase client init
│   │
│   ├── services/               # 🔧 Business logic services
│   │   └── SyncManager.ts      # Offline sync manager
│   │
│   ├── test/                   # 🧪 Unit tests (Vitest)
│   │   ├── setup.ts            # Test configuration
│   │   ├── *.test.ts           # Test files
│   │   └── *.test.tsx          # Component tests
│   │
│   ├── types/                  # 📝 TypeScript types
│   │   ├── database.ts         # Supabase/DB types
│   │   ├── index.ts            # Domain types
│   │   └── seatingChart.ts     # Seating chart types
│   │
│   ├── utils/                  # 🛠️ Utility functions
│   │   ├── index.ts            # Barrel export
│   │   ├── dateUtils.ts        # Date formatting
│   │   ├── defaults.ts         # Default values
│   │   ├── errorMessages.ts    # Error message constants
│   │   ├── leaderboardCalculations.ts # Ranking logic
│   │   ├── migrations.ts       # Data migration logic
│   │   ├── migrateToSupabase.ts # LocalStorage → Supabase
│   │   ├── studentParser.ts    # Bulk import parsing
│   │   └── validateAudioUrl.ts # Audio URL validation
│   │
│   ├── App.tsx                 # 🏠 Root component
│   ├── main.tsx                # ⚡ Entry point
│   └── vite-env.d.ts           # Vite type declarations
│
├── supabase/                   # 🗄️ Database
│   └── migrations/             # SQL migrations (001-011)
│       ├── 001_initial_schema.sql
│       ├── 002_add_user_auth.sql
│       ├── ...
│       └── 011_add_student_point_totals.sql
│
├── _bmad/                      # BMAD workflow system
│   ├── core/                   # Core workflow engine
│   └── bmm/                    # BMM module configuration
│
├── _bmad-output/               # Generated workflow artifacts
│
├── worktrees/                  # Git worktrees (feature branches)
│
├── .env.example                # Environment template
├── .env.local                  # Encrypted env vars (dotenvx)
├── .env.keys                   # Decryption keys (NEVER commit)
├── CLAUDE.md                   # Claude Code instructions
├── eslint.config.js            # ESLint configuration
├── index.html                  # HTML entry point
├── package.json                # Dependencies and scripts
├── playwright.config.ts        # E2E test configuration
├── postcss.config.js           # PostCSS configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration
└── vitest.config.ts            # Unit test configuration
```

## Critical Directories

### src/contexts/ - State Management

**Entry Point:** `HybridAppContext.tsx`

This is the heart of the application state. The context hierarchy is:

1. `AuthContext` → Authentication
2. `HybridAppContext` → Application data facade
3. `SupabaseAppContext` → Supabase operations (internal)

**Rule:** Components MUST use `useApp()` hook, never access contexts directly.

### src/hooks/ - Custom Hooks

Feature-specific hooks encapsulate data operations:

- `useRealtimeSubscription.ts` - Generic realtime pattern (most critical)
- `useSeatingChart.ts` - Complex feature hook example
- `useStudents.ts`, `useBehaviors.ts`, etc. - CRUD hooks

### src/components/ - UI Layer

Organized by feature domain. Each folder has:

- `*.tsx` - Component files
- `index.ts` - Barrel export

**Pattern:** PascalCase filenames, named exports.

### supabase/migrations/ - Database Schema

Sequential SQL migrations define the schema. Run in order:

- 001-006: Core schema (classrooms, students, behaviors, transactions)
- 007: Sound settings
- 008-010: Seating charts
- 011: Denormalized point totals

### docs/ - AI-Friendly Documentation

Markdown documentation optimized for AI retrieval. `index.md` is the primary entry point.

## Entry Points

| Entry Point     | Path                                | Purpose                      |
| --------------- | ----------------------------------- | ---------------------------- |
| React App       | `src/main.tsx`                      | DOM rendering                |
| Root Component  | `src/App.tsx`                       | Provider hierarchy + routing |
| Supabase Client | `src/lib/supabase.ts`               | Database connection          |
| State Facade    | `src/contexts/HybridAppContext.tsx` | `useApp()` hook              |

## Key Files by Purpose

### Configuration Files

| File                 | Purpose                           |
| -------------------- | --------------------------------- |
| `package.json`       | Dependencies, scripts, git hooks  |
| `vite.config.ts`     | Build configuration               |
| `tsconfig.json`      | TypeScript settings               |
| `tailwind.config.js` | Tailwind CSS theme                |
| `eslint.config.js`   | Linting rules                     |
| `.env.local`         | Environment variables (encrypted) |

### Test Configuration

| File                   | Purpose              |
| ---------------------- | -------------------- |
| `vitest.config.ts`     | Unit test runner     |
| `playwright.config.ts` | E2E test runner      |
| `src/test/setup.ts`    | Test utilities setup |

### Type Definitions

| File                        | Purpose               |
| --------------------------- | --------------------- |
| `src/types/database.ts`     | Supabase schema types |
| `src/types/index.ts`        | Domain model types    |
| `src/types/seatingChart.ts` | Seating feature types |

## File Counts by Directory

| Directory              | File Count          | Purpose          |
| ---------------------- | ------------------- | ---------------- |
| `src/components/`      | 53 .tsx files       | UI components    |
| `src/hooks/`           | 12 .ts files        | Custom hooks     |
| `src/contexts/`        | 5 .tsx files        | State providers  |
| `src/utils/`           | 9 .ts files         | Utilities        |
| `src/types/`           | 3 .ts files         | Type definitions |
| `supabase/migrations/` | 11 .sql files       | Database schema  |
| `e2e/`                 | Variable            | E2E tests        |
| `src/test/`            | 5 .test.ts(x) files | Unit tests       |
