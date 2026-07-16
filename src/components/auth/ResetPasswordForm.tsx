import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/**
 * The password-recovery landing, rendered by AuthGuard while the
 * `passwordRecovery` flag is set AND the recovery link authenticated the user
 * (Supabase implicit flow: the emailed link carries tokens in the URL hash and
 * signs the user in). "Skip for now" is safe: the link's one-time token is
 * already consumed — skipping the change leaves exactly the signed-in state
 * Supabase created.
 */
export function ResetPasswordForm() {
  const { updatePassword, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // Local, not context `loading`: updatePassword doesn't toggle the context flag.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!password) {
      setFormError('Password is required');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    const { success, error: updateError } = await updatePassword(password);
    setIsSubmitting(false);

    if (success) {
      // Clearing the flag falls through AuthGuard into the app, signed in.
      clearPasswordRecovery();
    } else if (updateError) {
      setFormError(updateError.message);
    }
  };

  return (
    <div className="min-h-dvh bg-surface-1 flex items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-fade-up">
        <div className="bg-surface-2 border border-hairline rounded-2xl p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_20px_50px_-30px_rgba(0,0,0,0.2)]">
          <div className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
              ⤺ Recover
            </p>
            <h1 className="font-display text-4xl leading-tight tracking-[-0.01em] text-ink-strong">
              Set a new password.
            </h1>
            <p className="text-sm text-ink-mid mt-2">
              You&apos;re signed in via your reset link — choose a new password to finish.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />

            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />

            {formError && (
              <div className="px-3 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40">
                <p className="text-xs text-red-700 dark:text-red-300">{formError}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Set new password →'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-hairline">
            <button
              type="button"
              onClick={clearPasswordRecovery}
              className="text-sm text-ink-mid hover:text-accent-600 transition-colors"
            >
              Skip for now →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
