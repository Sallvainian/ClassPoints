import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type AuthView = 'login' | 'signup' | 'forgot-password';

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="min-h-screen bg-surface-1 grid lg:grid-cols-[1.05fr_1fr]">
      {/* Editorial brand panel — desktop only */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-hairline">
        <div className="absolute inset-0 dot-grid opacity-60" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent-50/40 dark:to-accent-950/20"
          aria-hidden="true"
        />

        <div className="relative p-10 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-500" aria-hidden="true" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mid">
            ClassPoints
          </span>
        </div>

        <div className="relative p-10 lg:p-14 max-w-xl animate-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-600 mb-6">
            For teachers, by intent
          </p>
          <h2 className="font-display text-5xl xl:text-6xl leading-[1.05] tracking-[-0.02em] text-ink-strong">
            A quieter way
            <br />
            to keep classroom
            <br />
            <em className="text-accent-600">momentum.</em>
          </h2>
          <p className="mt-6 text-base text-ink-mid max-w-md leading-relaxed">
            Track behavior, award points, and read the room — without the chaos of sticker charts or
            spreadsheets.
          </p>
        </div>

        <div className="relative p-10 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          <span>↳ Real-time sync</span>
          <span>K-12 / built simple</span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md animate-fade-up [animation-delay:120ms]">
          {/* Compact brand for mobile + form panel header */}
          <div className="lg:hidden text-center mb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-600 mb-3">
              ClassPoints
            </p>
            <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.02em] text-ink-strong">
              A quieter way to keep <em className="text-accent-600">classroom momentum.</em>
            </h1>
          </div>

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
      </main>
    </div>
  );
}
