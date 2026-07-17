// Pins ResetPasswordForm's client-side validation gates and the submit
// contract: empty / too-short / mismatched passwords are rejected locally
// (updatePassword never fires); a valid, matching password calls
// updatePassword(password) then clears recovery on success but NOT on failure;
// "Skip for now" clears recovery without touching updatePassword.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthError } from '@supabase/supabase-js';

import { ResetPasswordForm } from '../components/auth/ResetPasswordForm';

const mockUpdatePassword = vi.fn();
const mockClearPasswordRecovery = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdatePassword.mockResolvedValue({ success: true });
    mockUseAuth.mockReturnValue({
      updatePassword: mockUpdatePassword,
      clearPasswordRecovery: mockClearPasswordRecovery,
    });
  });

  const setup = () => {
    render(<ResetPasswordForm />);
    return {
      newPassword: screen.getByLabelText('New password'),
      confirmPassword: screen.getByLabelText('Confirm password'),
      submit: screen.getByRole('button', { name: 'Set new password →' }),
      skip: screen.getByRole('button', { name: 'Skip for now →' }),
    };
  };

  it('rejects an empty password without calling updatePassword', async () => {
    const { submit } = setup();

    await userEvent.click(submit);

    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 6 characters', async () => {
    const { newPassword, confirmPassword, submit } = setup();

    await userEvent.type(newPassword, 'abc');
    await userEvent.type(confirmPassword, 'abc');
    await userEvent.click(submit);

    expect(await screen.findByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    const { newPassword, confirmPassword, submit } = setup();

    await userEvent.type(newPassword, 'abcdef');
    await userEvent.type(confirmPassword, 'abcdeg');
    await userEvent.click(submit);

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('submits a valid, matching password then clears recovery on success', async () => {
    const { newPassword, confirmPassword, submit } = setup();

    await userEvent.type(newPassword, 'abcdef');
    await userEvent.type(confirmPassword, 'abcdef');
    await userEvent.click(submit);

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledWith('abcdef'));
    await waitFor(() => expect(mockClearPasswordRecovery).toHaveBeenCalled());
  });

  it('surfaces the update error and does not clear recovery on failure', async () => {
    mockUpdatePassword.mockResolvedValue({
      success: false,
      error: {
        message: 'New password should be different from the old password.',
      } as unknown as AuthError,
    });
    const { newPassword, confirmPassword, submit } = setup();

    await userEvent.type(newPassword, 'abcdef');
    await userEvent.type(confirmPassword, 'abcdef');
    await userEvent.click(submit);

    expect(
      await screen.findByText('New password should be different from the old password.')
    ).toBeInTheDocument();
    expect(mockClearPasswordRecovery).not.toHaveBeenCalled();
  });

  it('clears recovery without updating the password when skipped', async () => {
    const { skip } = setup();

    await userEvent.click(skip);

    expect(mockClearPasswordRecovery).toHaveBeenCalledTimes(1);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});
