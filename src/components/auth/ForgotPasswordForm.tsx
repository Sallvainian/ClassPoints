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
      setSuccessMessage('Check your email for password reset instructions.');
    } else if (resetError) {
      setFormError(resetError.message);
    }
  };

  const displayError = formError || error?.message;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Reset Password</h1>
          <p className="text-gray-600 dark:text-zinc-400 mt-2">
            Enter your email to receive reset instructions
          </p>
        </div>

        {successMessage ? (
          <div className="text-center">
            <div className="p-4 rounded-md bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 mb-6">
              <p className="text-green-700 dark:text-green-300">{successMessage}</p>
            </div>
            <Button onClick={onBackToLogin} className="w-full">
              Back to Login
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
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50">
                  <p className="text-sm text-red-600 dark:text-red-400">{displayError}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
              >
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
