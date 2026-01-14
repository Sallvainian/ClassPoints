/**
 * AppContext - Backwards compatibility layer
 *
 * This file re-exports from HybridAppContext for backwards compatibility.
 * Components importing `useApp` from this file will automatically use
 * the Supabase-backed implementation with offline fallback.
 *
 * For new code, prefer importing directly from HybridAppContext:
 * import { useApp } from './contexts/HybridAppContext';
 */

// Re-export hooks from hooks file (non-components in separate re-export)
export { useApp, useHybridApp } from '../hooks/useContextHooks';

// Re-export provider components
export { HybridAppProvider } from './HybridAppContext';

// Re-export the provider as AppProvider for backwards compatibility
export { HybridAppProvider as AppProvider } from './HybridAppContext';
