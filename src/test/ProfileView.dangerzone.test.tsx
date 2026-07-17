/**
 * ProfileView — Legal + Danger zone sections (App Store 5.1.1(v) account
 * deletion entry point and the privacy-policy link).
 *
 * Mock scaffold cloned from ProfileView.preferences.test.tsx: supabase is
 * full-replacement mocked (credless CI), context/data hooks are mocked at the
 * hook-module level. The REAL DeleteAccountModal mounts (its useAuth /
 * useDeleteAccount deps resolve to the same mocks), so "opens the modal" is
 * pinned against the real dialog, not a stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  },
}));

import { ProfileView } from '../components/profile/ProfileView';

const mockSignOut = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com', user_metadata: { name: 'Test Teacher' } },
    signOut: mockSignOut,
    updatePassword: vi.fn(),
  }),
}));

vi.mock('../contexts/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn(), setTheme: vi.fn() }),
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

vi.mock('../hooks/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ mutateAsync: mockMutateAsync }),
}));

describe('ProfileView Legal + Danger zone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Danger zone with a Delete Account button', () => {
    render(<ProfileView onClose={vi.fn()} />);

    expect(screen.getByText('Danger zone')).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Account…' })).toBeInTheDocument();
  });

  it('Delete Account opens the type-to-confirm modal', async () => {
    render(<ProfileView onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Account…' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete account?')).toBeInTheDocument();
    // Type-to-confirm gate arrives disabled.
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeDisabled();
  });

  it('links the privacy policy as a real page under the app base, in a new tab', () => {
    render(<ProfileView onClose={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'Privacy Policy →' });
    // vitest serves BASE_URL '/' — production resolves under /ClassPoints/
    // via import.meta.env.BASE_URL (never hardcode the Pages base).
    expect(link).toHaveAttribute('href', '/privacy.html');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
