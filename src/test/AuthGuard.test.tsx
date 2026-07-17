// Pins AuthGuard's branch precedence: loading beats everything; an
// authenticated recovery session shows ResetPasswordForm (never the app);
// authSuspended shows OfflineGate (never the login page); an unauthenticated
// user with no flags falls through to AuthPage; an authenticated user with no
// flags renders the app children. Child screens are stubbed so only the routing
// decision is under test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';

const mockUseAuth = vi.fn();

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Stub every child screen so AuthGuard's routing is the only thing exercised —
// notably keeps AuthPage's LoginForm subtree (and its supabase imports) out.
vi.mock('../components/auth/AuthPage', () => ({
  AuthPage: () => <div data-testid="auth-page" />,
}));
vi.mock('../components/auth/OfflineGate', () => ({
  OfflineGate: () => <div data-testid="offline-gate-stub" />,
}));
vi.mock('../components/auth/ResetPasswordForm', () => ({
  ResetPasswordForm: () => <div data-testid="reset-password-form" />,
}));

import { AuthGuard } from '../components/auth/AuthGuard';

const renderGuard = () =>
  render(
    <AuthGuard>
      <div data-testid="app-children" />
    </AuthGuard>
  );

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      authSuspended: false,
      passwordRecovery: false,
    });
  });

  it('shows the loading spinner and nothing else while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      authSuspended: false,
      passwordRecovery: false,
    });

    renderGuard();

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-children')).not.toBeInTheDocument();
  });

  it('shows the reset form (not the app) for an authenticated recovery session', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' } as unknown as User,
      loading: false,
      authSuspended: false,
      passwordRecovery: true,
    });

    renderGuard();

    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.queryByTestId('app-children')).not.toBeInTheDocument();
  });

  it('shows the offline gate (not the login page) when the session is suspended', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      authSuspended: true,
      passwordRecovery: false,
    });

    renderGuard();

    expect(screen.getByTestId('offline-gate-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();
  });

  it('shows the auth page for an unauthenticated user with no flags', () => {
    renderGuard();

    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.queryByTestId('app-children')).not.toBeInTheDocument();
  });

  it('renders the app children for an authenticated user with no flags', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' } as unknown as User,
      loading: false,
      authSuspended: false,
      passwordRecovery: false,
    });

    renderGuard();

    expect(screen.getByTestId('app-children')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();
  });

  it('lets loading win even when a user and other flags would route elsewhere', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' } as unknown as User,
      loading: true,
      authSuspended: false,
      passwordRecovery: false,
    });

    renderGuard();

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByTestId('app-children')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reset-password-form')).not.toBeInTheDocument();
  });
});
