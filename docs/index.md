# ClassPoints Documentation

> A classroom behavior management application for tracking student points and behaviors.

**Generated:** December 15, 2025 (Exhaustive rescan)
**Project Type:** Web Application (React + Supabase)
**Scan Level:** Exhaustive

---

## Quick Links

| Document                                          | Description                                           |
| ------------------------------------------------- | ----------------------------------------------------- |
| [Architecture](./architecture.md)                 | System architecture and design patterns               |
| [Patterns & Rules](./patterns-and-rules/index.md) | **Comprehensive patterns and coding rules reference** |
| [Data Models](./data-models.md)                   | Database schema and TypeScript types                  |
| [Tech Stack](./tech-stack.md)                     | Technologies, dependencies, and configuration         |
| [Source Tree](./source-tree.md)                   | File structure and component hierarchy                |
| [CI/CD Pipeline](./ci.md)                         | GitHub Actions, testing, and deployment               |
| [UX Design](./ux-design-specification/index.md)   | UX specification and design system                    |

---

## Project Overview

**ClassPoints** is a web application designed for teachers to track student behavior and award points in real-time. It features:

- **Classroom Management** - Create and manage multiple classrooms
- **Student Tracking** - Add students individually or import from CSV/JSON
- **Behavior System** - Pre-defined and custom positive/negative behaviors
- **Point Awards** - Award points to individuals or entire classes
- **Undo Support** - Undo recent actions with batch support for class-wide awards
- **Real-time Sync** - Live updates across devices via Supabase Realtime
- **Offline Support** - Works offline with localStorage fallback

---

## Architecture Summary

```
UI Components → React Context → Custom Hooks → Supabase Client → PostgreSQL
```

**Provider Hierarchy:**
```
AuthProvider → AuthGuard → SoundProvider → HybridAppProvider → AppContent
```

**Key Patterns:**

- Layered architecture with clear separation of concerns
- React Context for state management (5 contexts)
- Custom hooks for data operations (9 hooks)
- Supabase for backend (auth, database, realtime)
- Row Level Security for multi-tenant isolation
- Optimistic UI with rollback on error
- Offline queue with last-write-wins sync

---

## Technology Stack

| Category       | Technology                            |
| -------------- | ------------------------------------- |
| **Frontend**   | React 18, TypeScript, Vite            |
| **Styling**    | Tailwind CSS                          |
| **Backend**    | Supabase (PostgreSQL, Auth, Realtime) |
| **Testing**    | Vitest (unit), Playwright (E2E)       |
| **Deployment** | GitHub Pages                          |

---

## Core Entities

| Entity                 | Description                         |
| ---------------------- | ----------------------------------- |
| **Classroom**          | A class period with students        |
| **Student**            | A student within a classroom        |
| **Behavior**           | Positive/negative behavior template |
| **PointTransaction**   | Record of points awarded            |
| **UserSoundSettings**  | User sound preferences (5th table)  |

---

## Project Structure

```
ClassPoints/
├── src/
│   ├── components/    # React UI components (29)
│   ├── contexts/      # React Context providers (5)
│   ├── hooks/         # Custom React hooks (9)
│   ├── services/      # Business services (1)
│   ├── lib/           # External configs
│   ├── types/         # TypeScript definitions
│   └── utils/         # Utility functions
├── supabase/
│   └── migrations/    # Database schema (7 migrations)
├── e2e/               # Playwright E2E tests
└── docs/              # This documentation
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (for cloud features)

### Installation

```bash
# Clone repository
git clone https://github.com/[username]/ClassPoints.git
cd ClassPoints

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with Supabase credentials

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Scripts

| Command              | Description               |
| -------------------- | ------------------------- |
| `npm run dev`        | Start dev server          |
| `npm run dev:host`   | Dev server on network     |
| `npm run build`      | Production build          |
| `npm run lint`       | Run ESLint                |
| `npm run lint:fix`   | ESLint with auto-fix      |
| `npm run format`     | Format with Prettier      |
| `npm run typecheck`  | TypeScript check only     |
| `npm run test`       | Run unit tests (Vitest)   |
| `npm run test:e2e`   | Run Playwright tests      |
| `npm run test:e2e:ui`| E2E tests with UI         |

---

## Documentation Index

### Architecture & Design

- [Architecture Overview](./architecture.md) - System design, patterns, and data flow
- [Architecture Decisions](./architecture-decisions.md) - Technical decisions and debt audit
- [Patterns & Rules](./patterns-and-rules/index.md) - **Authoritative guide for code patterns and conventions**
- [Data Models](./data-models.md) - Database schema, types, and relationships

### Technical Reference

- [Tech Stack](./tech-stack.md) - Dependencies, configuration, and tooling
- [Source Tree](./source-tree.md) - File structure and component hierarchy
- [CI/CD Pipeline](./ci.md) - GitHub Actions workflows and testing strategy
- [CI Secrets Checklist](./ci-secrets-checklist.md) - Required secrets for CI

### UX & Product

- [UX Design Specification](./ux-design-specification/index.md) - Complete UX design system
- [Project Context](./project-context.md) - AI agent context and project rules

### Plans & Specs

- [Seating Chart Design](./plans/2025-01-22-seating-chart-design/index.md) - Feature design specification
- [Seating Chart Implementation](./plans/2025-01-22-seating-chart-implementation.md) - Implementation plan

### Archived Sprint Artifacts

Sprint artifacts from PRD-1 (Code Quality & BMAD Integration) are archived:

- [Archive Index](./archive/prd-1-code-quality-bmad/) - Contains PRD, epics, stories, tech specs, and retrospectives

---

## Key Features

### Real-time Updates

Uses Supabase Realtime with `postgres_changes` for live synchronization:

- Points update instantly across devices
- Sidebar totals refresh on every change
- Optimistic UI with server reconciliation

### Offline Support

Hybrid architecture supports offline operation:

- Falls back to localStorage when offline
- Migration wizard transfers data to cloud
- SyncManager queues operations for sync

### Multi-tenant Security

Row Level Security ensures data isolation:

- Users only see their own classrooms
- No client-side security dependencies
- Server-enforced access control

---

## Component Map

| Feature Area  | Components                                                                |
| ------------- | ------------------------------------------------------------------------- |
| **Auth**      | AuthGuard, AuthPage, LoginForm, SignupForm, ForgotPasswordForm            |
| **Dashboard** | DashboardView, BottomToolbar, ClassPointsBox, TodaySummary                |
| **Students**  | StudentGrid, StudentPointCard                                             |
| **Points**    | AwardPointsModal, ClassAwardModal, MultiAwardModal, UndoToast             |
| **Settings**  | ClassSettingsView, ImportStudentsModal, SoundSettings, SoundSettingsModal |
| **Behaviors** | BehaviorPicker, BehaviorButton                                            |
| **Layout**    | Layout, Sidebar, SyncStatus, Modal, Button, Input, ErrorToast             |

---

## File Statistics

| Category            | Count |
| ------------------- | ----- |
| React Components    | 29    |
| React Contexts      | 5     |
| Custom Hooks        | 9     |
| Utility Modules     | 7     |
| Database Migrations | 7     |
| E2E Tests           | 2     |

---

_Documentation generated by BMAD Document Project workflow (December 15, 2025)_
