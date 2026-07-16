import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthError } from '@supabase/supabase-js';

// ── ProfileView Email section ─────────────────────────────────────────────────
// Pins the change-email flow: updateEmail is a REQUEST (secure email change
// sends confirmation links to both inboxes), so success shows a persistent
// pending message, and requesting the current address is rejected locally.

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

const mockUpdateEmail = vi.fn();

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'teacher@school.edu', user_metadata: { name: 'Test Teacher' } },
    signOut: vi.fn(),
    updatePassword: vi.fn(),
    updateEmail: (email: string) => mockUpdateEmail(email),
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

async function openEmailForm() {
  render(<ProfileView onClose={vi.fn()} />);
  // The Email block's Change button — the Password block has its own; scope by
  // the block content: current email + adjacent Change.
  const emailBlock = screen.getByText('Email').closest('div');
  const changeButton = emailBlock?.querySelector('button');
  expect(changeButton).not.toBeNull();
  await userEvent.click(changeButton!);
  return screen.getByPlaceholderText('new@example.com');
}

describe('ProfileView Email section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEmail.mockResolvedValue({ success: true });
  });

  it('shows the current email with a Change affordance', () => {
    render(<ProfileView onClose={vi.fn()} />);

    // Appears twice (identity header + email block) — both should carry it.
    expect(screen.getAllByText('teacher@school.edu').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('requests the change with the trimmed address and shows the persistent pending message', async () => {
    const input = await openEmailForm();

    await userEvent.type(input, '  new.teacher@school.edu  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send confirmation' }));

    expect(mockUpdateEmail).toHaveBeenCalledWith('new.teacher@school.edu');
    expect(
      await screen.findByText(/Confirmation email sent — open the link to complete the change/)
    ).toBeInTheDocument();
    // Form closed back to display state.
    expect(screen.queryByPlaceholderText('new@example.com')).not.toBeInTheDocument();
  });

  it('rejects the current address locally without calling updateEmail', async () => {
    const input = await openEmailForm();

    await userEvent.type(input, 'Teacher@School.edu'); // case-insensitive match
    await userEvent.click(screen.getByRole('button', { name: 'Send confirmation' }));

    expect(await screen.findByText('That is already your email address')).toBeInTheDocument();
    expect(mockUpdateEmail).not.toHaveBeenCalled();
  });

  it('surfaces the API error and keeps the form open (no pending message)', async () => {
    mockUpdateEmail.mockResolvedValue({
      success: false,
      error: { message: 'Email rate limit exceeded' } as unknown as AuthError,
    });
    const input = await openEmailForm();

    await userEvent.type(input, 'new.teacher@school.edu');
    await userEvent.click(screen.getByRole('button', { name: 'Send confirmation' }));

    expect(await screen.findByText('Email rate limit exceeded')).toBeInTheDocument();
    expect(screen.queryByText(/Confirmation email sent/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('new@example.com')).toBeInTheDocument();
  });

  it('Cancel closes the form and clears the draft', async () => {
    const input = await openEmailForm();

    await userEvent.type(input, 'draft@school.edu');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByPlaceholderText('new@example.com')).not.toBeInTheDocument();
    expect(mockUpdateEmail).not.toHaveBeenCalled();
  });
});
