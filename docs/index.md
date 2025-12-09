# ClassPoints Documentation

> A classroom behavior management application for tracking student points and behaviors.

**Generated:** December 9, 2025
**Project Type:** Web Application (React + Supabase)
**Scan Level:** Exhaustive

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture and design patterns |
| [Patterns & Rules](./patterns-and-rules.md) | **Comprehensive patterns and coding rules reference** |
| [Data Models](./data-models.md) | Database schema and TypeScript types |
| [Tech Stack](./tech-stack.md) | Technologies, dependencies, and configuration |
| [Source Tree](./source-tree.md) | File structure and component hierarchy |

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

| Category | Technology |
|----------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime) |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **Deployment** | GitHub Pages |

---

## Core Entities

| Entity | Description |
|--------|-------------|
| **Classroom** | A class period with students |
| **Student** | A student within a classroom |
| **Behavior** | Positive/negative behavior template |
| **PointTransaction** | Record of points awarded |

---

## Project Structure

```
ClassPoints/
├── src/
│   ├── components/    # React UI components (27)
│   ├── contexts/      # React Context providers (5)
│   ├── hooks/         # Custom React hooks (8)
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

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run Playwright tests |

---

## Documentation Index

### Architecture & Design
- [Architecture Overview](./architecture.md) - System design, patterns, and data flow
- [Patterns & Rules](./patterns-and-rules.md) - **Authoritative guide for code patterns and conventions**
- [Data Models](./data-models.md) - Database schema, types, and relationships

### Technical Reference
- [Tech Stack](./tech-stack.md) - Dependencies, configuration, and tooling
- [Source Tree](./source-tree.md) - File structure and component hierarchy

### State File
- [Scan Report](./project-scan-report.json) - Raw scan data and findings

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

| Feature Area | Components |
|--------------|------------|
| **Auth** | AuthGuard, AuthPage, LoginForm, SignupForm, ForgotPasswordForm |
| **Dashboard** | DashboardView, ClassPointsBox, TodaySummary |
| **Students** | StudentGrid, StudentPointCard |
| **Points** | AwardPointsModal, ClassAwardModal, UndoToast |
| **Settings** | ClassSettingsView, ImportStudentsModal, SoundSettings, SoundSettingsModal |
| **Behaviors** | BehaviorPicker, BehaviorButton |
| **Layout** | Layout, Sidebar, SyncStatus, Modal, Button, Input |

---

## File Statistics

| Category | Count |
|----------|-------|
| React Components | 27 |
| React Contexts | 5 |
| Custom Hooks | 8 |
| Utility Modules | 6 |
| Database Migrations | 7 |
| E2E Tests | 2 |

---

*Documentation generated by BMAD Document Project workflow*
