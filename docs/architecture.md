# Architecture - ClassPoints

## System Overview

ClassPoints is a **classroom behavior management web application** built as a Single Page Application (SPA) with Backend-as-a-Service (BaaS).

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   React SPA (Vite)                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │   │
│  │  │ Components │←→│  Context  │←→│  Custom Hooks     │   │   │
│  │  └───────────┘  │  (State)  │  │  (Data Access)    │   │   │
│  │                 └─────┬─────┘  └─────────┬─────────┘   │   │
│  │                       │                  │              │   │
│  │                 ┌─────┴──────────────────┴─────┐       │   │
│  │                 │     Supabase JS Client       │       │   │
│  │                 └─────────────┬────────────────┘       │   │
│  └──────────────────────────────│────────────────────────┘   │
└──────────────────────────────────│────────────────────────────┘
                                   │ HTTPS/WSS
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Cloud (BaaS)                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │   Auth        │  │   PostgREST   │  │   Realtime        │   │
│  │   (GoTrue)    │  │   (REST API)  │  │   (WebSocket)     │   │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘   │
│          │                  │                    │              │
│          └──────────────────┴────────────────────┘              │
│                             │                                   │
│                    ┌────────┴────────┐                         │
│                    │   PostgreSQL    │                         │
│                    │   (Database)    │                         │
│                    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture Pattern

**Component-Based SPA with BaaS**

| Layer            | Technology           | Responsibility                     |
| ---------------- | -------------------- | ---------------------------------- |
| **Presentation** | React + Tailwind CSS | UI rendering, user interaction     |
| **State**        | React Context        | Application state, caching         |
| **Data Access**  | Custom Hooks         | Supabase operations, realtime sync |
| **Backend**      | Supabase (BaaS)      | Auth, database, realtime           |
| **Storage**      | PostgreSQL           | Persistent data                    |

## Key Architectural Decisions

### 1. BaaS over Custom Backend

**Decision:** Use Supabase instead of building a custom API.

**Rationale:**

- Rapid development with built-in auth, database, and realtime
- No server infrastructure to maintain
- Row Level Security for data isolation
- Automatic REST API from schema

**Trade-offs:**

- Vendor dependency on Supabase
- Limited custom business logic (handled in frontend)
- Database migrations managed via SQL

### 2. React Context over Redux/Zustand

**Decision:** Use React Context + hooks for state management.

**Rationale:**

- Simpler mental model for team
- Sufficient for app scale (<100 students per classroom)
- No additional dependencies
- Tight integration with React lifecycle

**Trade-offs:**

- Re-render optimization requires manual memoization
- No time-travel debugging
- State structure locked to provider hierarchy

### 3. Optimistic Updates

**Decision:** Update UI immediately, then sync with server.

**Rationale:**

- Instant feedback improves UX
- Works well with reliable Supabase backend
- Realtime confirms or corrects optimistic updates

**Implementation:**

1. Update local state immediately
2. Send mutation to Supabase
3. On error: rollback local state, show error
4. Realtime event confirms final state

### 4. Denormalized Point Totals

**Decision:** Store point totals in `students` table instead of calculating from transactions.

**Rationale:**

- Fast reads for leaderboards and dashboards
- Avoids expensive aggregation queries
- Database triggers maintain consistency

**Implementation:**

- `point_total`, `positive_total`, `negative_total` columns on students
- Trigger on `point_transactions` INSERT/DELETE updates totals
- Time-based totals (today, this week) calculated client-side

### 5. Seating Chart as Separate Domain

**Decision:** Model seating charts with its own entity hierarchy.

**Rationale:**

- Complex feature with own state (canvas, drag-drop, groups)
- One-to-one relationship with classroom
- Independent realtime subscriptions
- Reusable layout presets

**Structure:**

```
seating_charts (1:1 with classroom)
├── seating_groups (table groupings)
│   └── seating_seats (individual seats)
└── room_elements (static furniture)
```

## Data Flow

### Read Path

```
Component → useApp() → Context State → Render
                ↑
                └── useRealtimeSubscription ← Supabase Realtime
```

### Write Path

```
User Action
    │
    ▼
Component calls useApp().awardPoints()
    │
    ▼
HybridAppContext
    │
    ├──→ Optimistic update (setState)
    │
    └──→ SupabaseAppContext
            │
            ▼
        supabase.from('point_transactions').insert(...)
            │
            ▼
        PostgreSQL (with RLS check)
            │
            ▼
        Trigger updates student point totals
            │
            ▼
        Realtime broadcasts change
            │
            ▼
        useRealtimeSubscription receives event
            │
            ▼
        State updated (confirms optimistic update)
            │
            ▼
        React re-renders
```

## Security Model

### Row Level Security (RLS)

All tables enforce user-scoped access:

```sql
CREATE POLICY "Users can only view own classrooms"
  ON classrooms FOR SELECT
  USING (user_id = auth.uid());
```

**Access Rules:**

- Users can only see their own data
- System behaviors (is_custom = false) visible to all
- Cascading deletes clean up related data

### Authentication

Supabase Auth (GoTrue) handles:

- Email/password authentication
- Session management
- Password reset
- (Future: OAuth providers)

## Performance Considerations

### Current Optimizations

1. **Denormalized totals** - No aggregation queries for point totals
2. **Optimistic updates** - Instant UI feedback
3. **Indexed queries** - Strategic indexes on foreign keys and timestamps
4. **Selective subscriptions** - Realtime filtered by classroom_id

### Scalability Limits

| Metric                          | Current Limit       | Mitigation                 |
| ------------------------------- | ------------------- | -------------------------- |
| Students per classroom          | ~100                | Virtualized list if needed |
| Concurrent realtime connections | Supabase plan limit | Upgrade plan               |
| Transaction history             | All-time            | Add pagination/archival    |

## Offline Support (Planned)

Current architecture supports future offline mode:

1. `HybridAppContext` abstracts data access
2. `SyncManager` service exists (basic implementation)
3. localStorage can cache data
4. Mutations can queue for sync

**Not yet implemented:** Full offline queue, conflict resolution.

## Technology Stack Summary

| Category         | Technology   | Version |
| ---------------- | ------------ | ------- |
| **Framework**    | React        | 18.3    |
| **Language**     | TypeScript   | 5.9     |
| **Build Tool**   | Vite         | 6.0     |
| **Styling**      | Tailwind CSS | 4.1     |
| **Backend**      | Supabase     | -       |
| **Database**     | PostgreSQL   | 15+     |
| **Unit Testing** | Vitest       | 4.0     |
| **E2E Testing**  | Playwright   | 1.57    |
| **Drag & Drop**  | @dnd-kit     | 6.3     |

## Future Considerations

1. **State Library Migration** - Consider Zustand if Context performance issues arise
2. **Server-Side Rendering** - Not needed currently, but possible with React Router
3. **PWA Support** - Service worker for offline caching
4. **Multi-tenancy** - School-level organization above classrooms
