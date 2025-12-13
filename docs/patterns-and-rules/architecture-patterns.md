# Architecture Patterns

## Provider Hierarchy Pattern

The app uses a strict nested provider pattern. **Order matters** - providers must be nested in this exact sequence:

```tsx
<AuthProvider>
  {' '}
  // 1. Authentication state (user, session)
  <AuthGuard>
    {' '}
    // 2. Route protection (redirects unauthenticated)
    <SoundProvider>
      {' '}
      // 3. Sound effects settings
      <HybridAppProvider>
        // 4. App data layer (online/offline)
        <AppContent /> // 5. Main application
      </HybridAppProvider>
    </SoundProvider>
  </AuthGuard>
</AuthProvider>
```

**Rules:**

- Never access a context from a component that's not wrapped by that provider
- If adding a new provider, determine where it fits in the hierarchy
- Providers that depend on others must be nested inside them

## Facade Pattern (AppContext)

Components access data through `useApp()` hook, which is a facade over the underlying data layer:

```
Component → useApp() → HybridAppContext → SupabaseAppContext → Supabase Hooks → Supabase Client
```

**Rules:**

- Components **MUST** use `useApp()` for all data operations
- Never import `SupabaseAppContext` directly in components
- Never use `supabase` client directly in components (only in hooks/contexts)

## Hybrid Online/Offline Pattern

The app supports both online (Supabase) and offline (localStorage) modes:

```tsx
// HybridAppContext decides which implementation to use
const value = {
  ...supabaseApp, // Online: delegates to Supabase
  syncStatus, // Tracks sync state
};
```

**Rules:**

- All data operations must go through `HybridAppContext`
- Future offline support will queue operations in `SyncManager`
- Don't assume network connectivity in any component

---
