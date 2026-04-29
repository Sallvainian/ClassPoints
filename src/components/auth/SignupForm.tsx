import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface SignupFormProps {
  onSwitchToLogin: () => void;
  onSuccess?: () => void;
}

export function SignupForm({ onSwitchToLogin, onSuccess }: SignupFormProps) {
  const { signUp, loading, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    clearError();

    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }

    if (!email.trim()) {
      setFormError('Email is required');
      return;
    }

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

    const { success, error: signUpError } = await signUp(email, password, name);

    if (success) {
      setSuccessMessage('Account created. Check your email to confirm.');
      onSuccess?.();
    } else if (signUpError) {
      setFormError(signUpError.message);
    }
  };

  const displayError = formError || error?.message;

  return (
    <div className="bg-surface-2 border border-hairline rounded-2xl p-8 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_20px_50px_-30px_rgba(0,0,0,0.2)]">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
          02 / Create
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.01em] text-ink-strong">
          Start fresh.
        </h1>
        <p className="text-sm text-ink-mid mt-2">A few details and you're tracking points.</p>
      </div>

      {successMessage ? (
        <div className="space-y-6">
          <div className="px-3 py-2.5 rounded-[10px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{successMessage}</p>
          </div>
          <Button onClick={onSwitchToLogin} className="w-full">
            Back to sign in →
          </Button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              disabled={loading}
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              disabled={loading}
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={loading}
            />

            {displayError && (
              <div className="px-3 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40">
                <p className="text-xs text-red-700 dark:text-red-300">{displayError}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account →'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-hairline">
            <p className="text-sm text-ink-mid">
              Already a teacher here?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-accent-600 hover:text-accent-700 font-medium underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
