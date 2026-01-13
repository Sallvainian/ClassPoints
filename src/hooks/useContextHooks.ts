/**
 * Context Consumer Hooks
 *
 * This file exports all React context consumer hooks to support React Fast Refresh.
 * Fast refresh only works when files export either components OR non-components.
 *
 * Components should import hooks from here, not directly from context files.
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { HybridAppContext } from '../contexts/HybridAppContext';
import { SoundContext } from '../contexts/SoundContext';
import { SupabaseAppContext } from '../contexts/SupabaseAppContext';

/**
 * Hook to access authentication state and methods
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to access the hybrid app context (Supabase + offline fallback)
 * @throws Error if used outside HybridAppProvider
 */
export function useHybridApp() {
  const context = useContext(HybridAppContext);
  if (!context) {
    throw new Error('useHybridApp must be used within HybridAppProvider');
  }
  return context;
}

/**
 * Alias for useHybridApp - use this in components for backwards compatibility
 */
export const useApp = useHybridApp;

/**
 * Hook to access sound settings and audio buffers
 * @throws Error if used outside SoundProvider
 */
export function useSoundContext() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSoundContext must be used within SoundProvider');
  }
  return context;
}

/**
 * Hook to access the Supabase app context directly
 * @throws Error if used outside SupabaseAppProvider
 */
export function useSupabaseApp() {
  const context = useContext(SupabaseAppContext);
  if (!context) {
    throw new Error('useSupabaseApp must be used within SupabaseAppProvider');
  }
  return context;
}
