# ClassPoints Architecture

## Overview

ClassPoints is a classroom behavior management application built with a modern React + Supabase stack. The architecture follows a layered pattern with clear separation of concerns between UI, state management, and data access layers.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              UI Layer                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │
│  │ Dashboard  │ │  Students  │ │  Settings  │ │   Auth Components  │   │
│  │   View     │ │    Grid    │ │    View    │ │  (Login, Signup)   │   │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────────┬──────────┘   │
└────────┼──────────────┼──────────────┼──────────────────┼──────────────┘
         │              │              │                  │
         ▼              ▼              ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Context Layer                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      AppContext (Facade)                         │   │
│  │  - Provides unified API to components                            │   │
│  │  - Delegates to HybridAppContext                                 │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                         │
│  ┌─────────────────────────────▼───────────────────────────────────┐   │
│  │                    HybridAppContext                              │   │
│  │  - Online: delegates to SupabaseAppContext                       │   │
│  │  - Offline: uses localStorage (legacy mode)                      │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                         │
│  ┌────────────────┐  ┌─────────▼─────────┐  ┌────────────────────┐     │
│  │  AuthContext   │  │SupabaseAppContext │  │   SyncManager      │     │
│  │  - User auth   │  │  - Full Supabase  │  │  - Offline queue   │     │
│  │  - Session     │  │    data layer     │  │  - Sync on connect │     │
│  └────────────────┘  └───────────────────┘  └────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Hooks Layer                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │useClassrooms │ │ useStudents  │ │useBehaviors  │ │useTransactions│  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │              useRealtimeSubscription                               │  │
│  │  - Generic hook for Supabase postgres_changes                      │  │
│  │  - Handles INSERT, UPDATE, DELETE events                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Access Layer                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Supabase Client (src/lib/supabase.ts)          │  │
│  │  - PostgreSQL database                                             │  │
│  │  - Row Level Security (RLS)                                        │  │
│  │  - Realtime subscriptions                                          │  │
│  │  - Authentication                                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Architectural Patterns

### 1. Context Provider Hierarchy

The app uses a nested provider pattern where each layer adds specific functionality:

```tsx
<AuthProvider>          // Authentication state
  <AuthGuard>           // Route protection
    <HybridAppProvider> // Online/Offline mode selection
      <AppContent />    // Main app with unified context
    </HybridAppProvider>
  </AuthGuard>
</AuthProvider>
```

### 2. Hybrid Online/Offline Architecture

The `HybridAppContext` switches between:
- **Online Mode**: Uses `SupabaseAppContext` for real-time cloud sync
- **Offline Mode**: Falls back to localStorage for data persistence

This enables:
- Development without Supabase credentials
- Offline functionality with sync on reconnect
- Migration path from legacy localStorage data

### 3. Real-time Updates

The app uses Supabase Realtime for live updates:

```typescript
// useRealtimeSubscription hook pattern
const channel = supabase
  .channel('table_changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'point_transactions' },
    (payload) => {
      // Handle INSERT, UPDATE, DELETE
    }
  )
  .subscribe();
```

Key features:
- `REPLICA IDENTITY FULL` on tables for complete DELETE payloads
- Optimistic UI updates with server reconciliation
- Automatic reconnection handling

### 4. Row Level Security (RLS)

All database tables have RLS policies:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own classrooms" ON classrooms
  FOR SELECT USING (user_id = auth.uid());

-- Similar policies for INSERT, UPDATE, DELETE
```

This ensures:
- Multi-tenant data isolation
- Server-side access control
- No client-side security dependencies

## Data Flow

### Point Award Flow

```
User clicks student → AwardPointsModal opens
     ↓
User selects behavior → awardPoints() called
     ↓
SupabaseAppContext.awardPoints()
     ↓
1. Insert into point_transactions table
2. Supabase Realtime broadcasts change
3. useRealtimeSubscription receives event
4. UI updates optimistically
5. UndoToast appears for 10 seconds
```

### Undo Flow

```
User clicks Undo → undoTransaction() called
     ↓
SupabaseAppContext.undoTransaction()
     ↓
1. DELETE from point_transactions
2. Realtime broadcasts DELETE with full payload
3. Sidebar and student totals update
4. Toast dismisses
```

## State Management

### Context Structure

| Context | Purpose | Key State |
|---------|---------|-----------|
| `AuthContext` | User authentication | `user`, `loading`, `session` |
| `AppContext` | Unified API facade | Delegates to HybridAppContext |
| `HybridAppContext` | Mode switching | `isOnline`, `mode` |
| `SupabaseAppContext` | Cloud data layer | `classrooms`, `behaviors`, `transactions` |

### Hook Responsibilities

| Hook | Purpose |
|------|---------|
| `useClassrooms` | Classroom CRUD with realtime sync |
| `useStudents` | Student management within classrooms |
| `useBehaviors` | Behavior templates (positive/negative) |
| `useTransactions` | Point transaction history |
| `useRealtimeSubscription` | Generic realtime postgres_changes |

## Security Architecture

### Authentication Flow

1. User signs up/in via Supabase Auth
2. Session stored in Supabase client
3. AuthGuard checks `user` before rendering app
4. All API calls include auth token automatically
5. RLS policies enforce server-side access control

### Data Protection

- All tables have RLS enabled
- `user_id` foreign key on all user-owned tables
- No direct database access from client
- Supabase client handles token refresh

## Deployment Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────────┐
│   GitHub    │────▶│  GitHub Actions │────▶│   GitHub Pages    │
│  (source)   │     │   (build/test)  │     │  (static hosting) │
└─────────────┘     └─────────────────┘     └───────────────────┘
                                                      │
                                                      ▼
                                            ┌───────────────────┐
                                            │    Supabase       │
                                            │  - Database       │
                                            │  - Auth           │
                                            │  - Realtime       │
                                            └───────────────────┘
```

## Technology Choices Rationale

| Choice | Rationale |
|--------|-----------|
| React 18 | Modern React with Concurrent features |
| Vite | Fast HMR, optimized builds |
| TypeScript | Type safety, better DX |
| Tailwind CSS | Utility-first, consistent styling |
| Supabase | Full backend (auth, DB, realtime) without custom server |
| React Context | Simple state management for app complexity level |
| Playwright | Real browser E2E testing |
| Vitest | Fast unit testing with Vite integration |
