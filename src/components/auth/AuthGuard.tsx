import { type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthPage } from './AuthPage';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-hairline border-t-accent-500 mx-auto"></div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            Loading
          </p>
        </div>
      </div>
    );
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />;
  }

  // User is authenticated, render children
  return <>{children}</>;
}
