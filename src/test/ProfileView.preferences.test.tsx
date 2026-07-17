import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ProfileView imports the supabase client directly (auth.updateUser for the
// display-name form), so the module is mocked with the full-replacement shape
// per TeacherDashboard.test.tsx (CI's Unit Tests step runs credless;
// src/lib/supabase.ts throws at eval without creds).
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
}));

import { ProfileView } from '../components/profile/ProfileView';

// Data/context hooks are mocked at the hook-module level (TeacherDashboard
// precedent): AuthProvider would need a full supabase.auth surface, and the
// classroom hooks would pull the TanStack query chain — none of which the
// Preferences section touches.
const mockSignOut = vi.fn();
const mockToggleTheme = vi.fn();

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com', user_metadata: { name: 'Test Teacher' } },
    signOut: mockSignOut,
    updatePassword: vi.fn(),
  }),
}));

vi.mock('../contexts/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: mockToggleTheme, setTheme: vi.fn() }),
}));

vi.mock('../contexts/useApp', () => ({
  useApp: () => ({ activeClassroomId: null, setActiveClassroom: vi.fn() }),
}));

vi.mock('../hooks/useAppClassrooms', () => ({
  useAppClassrooms: () => ({ classrooms: [] }),
}));

vi.mock('../hooks/useClassrooms', () => ({
  useDeleteClassroom: () => ({ mutate: vi.fn() }),
}));

// ProfileView renders DeleteAccountModal, whose real useDeleteAccount would
// need a QueryClientProvider — mocked at the hook-module level like the rest.
vi.mock('../hooks/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ mutateAsync: vi.fn() }),
}));

describe('ProfileView phone-only Preferences section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Preferences section as phone-only (md:hidden) — at md+ these live in the sidebar footer', () => {
    render(<ProfileView onClose={vi.fn()} />);

    const section = screen.getByText('Preferences').closest('section');
    expect(section).not.toBeNull();
    // jsdom cannot evaluate media queries — assert the class contract.
    expect(section).toHaveClass('md:hidden');
    expect(screen.getByRole('button', { name: /Theme/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
  });

  it('Theme button calls toggleTheme', async () => {
    render(<ProfileView onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Theme/ }));

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('Sign out button calls signOut', async () => {
    render(<ProfileView onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Sign out/ }));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockToggleTheme).not.toHaveBeenCalled();
  });
});
