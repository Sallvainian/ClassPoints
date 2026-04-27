import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
}

export function LoginForm({ onSwitchToSignup, onForgotPassword }: LoginFormProps) {
  const { signIn, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email.trim()) {
      setFormError('Email is required');
      return;
    }

    if (!password) {
      setFormError('Password is required');
      return;
    }

    const { success, error: signInError } = await signIn(email, password);

    if (!success && signInError) {
      setFormError(signInError.message);
    }
  };

  const displayError = formError || error?.message;

  return (
    <div className="bg-surface-2 border border-hairline rounded-2xl p-8 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_20px_50px_-30px_rgba(0,0,0,0.2)]">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">
          01 / Sign in
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.01em] text-ink-strong">
          Welcome back.
        </h1>
        <p className="text-sm text-ink-mid mt-2">Continue where you left off with your classes.</p>
      </div>

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

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
        />

        {displayError && (
          <div className="px-3 py-2.5 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40">
            <p className="text-xs text-red-700 dark:text-red-300">{displayError}</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in →'}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-hairline space-y-3 text-sm">
        <button
          type="button"
          onClick={onForgotPassword}
          className="block w-full text-left text-ink-mid hover:text-accent-600 transition-colors"
        >
          Forgot your password?
        </button>

        <p className="text-ink-mid">
          New to ClassPoints?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-accent-600 hover:text-accent-700 font-medium underline-offset-4 hover:underline"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
