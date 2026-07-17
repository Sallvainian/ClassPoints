/**
 * DeleteAccountModal — type-to-confirm account deletion (App Store 5.1.1(v)).
 *
 * The contract under test: the danger button stays disabled until the typed
 * string EXACTLY matches the account email; confirm invokes the delete
 * mutation and only after it resolves calls signOut() (which flips AuthGuard
 * to the login page — the modal never closes itself on success); a failed
 * invocation surfaces the error, re-enables the form, and never signs out
 * (the account still exists — signing out would just look like data loss).
 *
 * useAuth and useDeleteAccount are mocked (ProfileView.preferences.test.tsx
 * pattern), so the real supabase module is never evaluated — no env stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const EMAIL = 'teacher@example.com';
const mockMutateAsync = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { email: EMAIL, user_metadata: {} },
    signOut: mockSignOut,
  }),
}));

vi.mock('../hooks/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ mutateAsync: mockMutateAsync }),
}));

import { DeleteAccountModal } from '../components/profile/DeleteAccountModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
});

function renderModal() {
  return render(<DeleteAccountModal isOpen={true} onClose={vi.fn()} />);
}

describe('DeleteAccountModal', () => {
  it('keeps Delete Account disabled until the typed text matches the email exactly', async () => {
    const user = userEvent.setup();
    renderModal();

    const confirmBtn = screen.getByRole('button', { name: 'Delete Account' });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText(EMAIL), 'teacher@example');
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText(EMAIL), '.com');
    expect(confirmBtn).toBeEnabled();
  });

  it('confirm runs the deletion and signs out only after it resolves', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(EMAIL), EMAIL);
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledOnce());
    expect(mockMutateAsync).toHaveBeenCalledOnce();
    // Deletion strictly precedes local teardown.
    expect(mockMutateAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0]
    );
  });

  it('shows the error and does NOT sign out when the deletion fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Edge Function returned a non-2xx status'));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(EMAIL), EMAIL);
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(await screen.findByText('Edge Function returned a non-2xx status')).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
    // Form recovers: the button is enabled for a retry.
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeEnabled();
  });

  it('disables the form while the deletion is in flight', async () => {
    let resolveDelete!: () => void;
    mockMutateAsync.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveDelete = resolve))
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(EMAIL), EMAIL);
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolveDelete();
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledOnce());
  });

  it('Enter in the input confirms when the text matches', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(EMAIL), `${EMAIL}{Enter}`);

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
  });
});
