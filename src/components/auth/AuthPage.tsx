import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type AuthView = 'login' | 'signup' | 'forgot-password';

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 dark:bg-blue-500 rounded-xl mb-4">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-50">ClassPoints</h1>
          <p className="text-gray-600 dark:text-zinc-400 mt-1">
            Classroom behavior tracking made easy
          </p>
        </div>

        {/* Auth Forms */}
        {view === 'login' && (
          <LoginForm
            onSwitchToSignup={() => setView('signup')}
            onForgotPassword={() => setView('forgot-password')}
          />
        )}

        {view === 'signup' && <SignupForm onSwitchToLogin={() => setView('login')} />}

        {view === 'forgot-password' && (
          <ForgotPasswordForm onBackToLogin={() => setView('login')} />
        )}
      </div>
    </div>
  );
}
