# ClassPoints Documentation

> A classroom behavior management application for tracking student points and behaviors.

**Generated:** January 12, 2026 (updated from December 12, 2025)
**Project Type:** Web Application (React + Supabase)
**Scan Level:** Exhaustive (Full Rescan)

---

## Quick Links

| Document                                          | Description                                           |
| ------------------------------------------------- | ----------------------------------------------------- |
| [Architecture](./architecture.md)                 | System architecture and design patterns               |
| [Patterns & Rules](./patterns-and-rules/index.md) | **Comprehensive patterns and coding rules reference** |
| [Data Models](./data-models.md)                   | Database schema and TypeScript types                  |
| [Tech Stack](./tech-stack.md)                     | Technologies, dependencies, and configuration         |
| [Source Tree](./source-tree.md)                   | File structure and component hierarchy                |
| [UX Design](./ux-design-specification/index.md)   | UX specification and design system                    |
| [PRD](./prd.md)                                   | Product requirements document                         |

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

**Key Patterns:**

- Layered architecture with clear separation of concerns
- React Context for state management
- Custom hooks for data operations
- Supabase for backend (auth, database, realtime)
- Row Level Security for multi-tenant isolation

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

| Entity               | Description                         |
| -------------------- | ----------------------------------- |
| **Classroom**        | A class period with students        |
| **Student**          | A student within a classroom        |
| **Behavior**         | Positive/negative behavior template |
| **PointTransaction** | Record of points awarded            |

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

| Command            | Description          |
| ------------------ | -------------------- |
| `npm run dev`      | Start dev server     |
| `npm run build`    | Production build     |
| `npm run preview`  | Preview build        |
| `npm run lint`     | Run ESLint           |
| `npm run test`     | Run unit tests       |
| `npm run test:e2e` | Run Playwright tests |

---

## Documentation Index

### Architecture & Design

- [Architecture Overview](./architecture.md) - System design, patterns, and data flow
- [Architecture Decisions](./architecture-decisions.md) - Technical decisions and debt audit
- [Patterns & Rules](./patterns-and-rules/index.md) - **Authoritative guide for code patterns and conventions**
- [Data Models](./data-models.md) - Database schema, types, and relationships

### UX & Product

- [PRD](./prd.md) - Product requirements document
- [UX Design Specification](./ux-design-specification/index.md) - Complete UX design system
- [Project Context](./project_context.md) - AI agent context with 42 rules

### Technical Reference

- [Tech Stack](./tech-stack.md) - Dependencies, configuration, and tooling
- [Source Tree](./source-tree.md) - File structure and component hierarchy

### Plans & Specs

- [Seating Chart Design](./plans/2025-01-22-seating-chart-design/index.md) - Feature design specification
- [Seating Chart Implementation](./plans/2025-01-22-seating-chart-implementation.md) - Implementation plan

### Sprint Artifacts

- [Sound Effects Tech Spec](./sprint-artifacts/tech-spec-sound-effects.md) - Audio feedback system
- [Student Grid Enhancements](./sprint-artifacts/tech-spec-student-grid-enhancements.md) - Multi-select, card sizes

### Diagrams

- `diagrams/wireframe-classpoints.excalidraw` - App wireframe (8 screens)

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

_Documentation generated by BMAD Document Project workflow_
