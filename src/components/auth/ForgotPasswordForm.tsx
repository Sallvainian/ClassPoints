import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const { resetPassword, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    clearError();

    if (!email.trim()) {
      setFormError('Email is required');
      return;
    }

    const { success, error: resetError } = await resetPassword(email);

    if (success) {
      setSuccessMessage('Check your email for reset instructions.');
    } else if (resetError) {
      setFormError(resetError.message);
    }
  };

  const displayError = formError || error?.message;

  return (
    <div className="bg-surface-2 border border-hairline rounded-2xl p-8 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_20px_50px_-30px_rgba(0,0,0,0.2)]">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
          ⤺ Recover
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.01em] text-ink-strong">
          Reset password.
        </h1>
        <p className="text-sm text-ink-mid mt-2">We'll email you a link to set a new one.</p>
      </div>

      {successMessage ? (
        <div className="space-y-6">
          <div className="px-3 py-2.5 rounded-[10px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{successMessage}</p>
          </div>
          <Button onClick={onBackToLogin} className="w-full">
            Back to sign in →
          </Button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />

            {displayError && (
              <div className="px-3 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40">
                <p className="text-xs text-red-700 dark:text-red-300">{displayError}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link →'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-hairline">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-sm text-ink-mid hover:text-accent-600 transition-colors"
            >
              ← Back to sign in
            </button>
          </div>
        </>
      )}
    </div>
  );
}
