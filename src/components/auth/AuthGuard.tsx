import { type ReactNode } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { AuthPage } from './AuthPage';
import { OfflineGate } from './OfflineGate';
import { ResetPasswordForm } from './ResetPasswordForm';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, authSuspended, passwordRecovery } = useAuth();

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

  // Recovery must precede children: the reset link SIGNS THE USER IN (implicit
  // flow), so without this branch the app would swallow the recovery and show
  // the dashboard instead of the set-new-password form.
  if (user && passwordRecovery) {
    return <ResetPasswordForm />;
  }

  // Suspended must precede !user (suspended ⇒ user is null): a stored session
  // couldn't be hydrated for network-class reasons — show the reconnect gate,
  // not a login form the teacher's real credentials couldn't satisfy offline.
  if (authSuspended) {
    return <OfflineGate />;
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />;
  }

  // User is authenticated, render children
  return <>{children}</>;
}
