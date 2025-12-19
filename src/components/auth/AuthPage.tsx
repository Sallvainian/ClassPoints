import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type AuthView = 'login' | 'signup' | 'forgot-password';

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login');
  const { isChristmas } = useTheme();

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-all duration-500 ${
      isChristmas
        ? 'bg-gradient-to-br from-red-900 via-green-900 to-red-900'
        : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    }`}>
      {/* Snowflakes for Christmas */}
      {isChristmas && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-white opacity-70 animate-snowfall"
              style={{
                left: `${Math.random() * 100}%`,
                fontSize: `${Math.random() * 16 + 8}px`,
                animationDuration: `${Math.random() * 10 + 10}s`,
                animationDelay: `${Math.random() * 10}s`,
              }}
            >
              ❄
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4 transition-all duration-300 ${
            isChristmas
              ? 'bg-gradient-to-br from-red-500 to-green-600 shadow-lg shadow-red-500/30'
              : 'bg-blue-600'
          }`}>
            <span className={`text-3xl ${isChristmas ? 'animate-jingle' : ''}`}>
              {isChristmas ? '🎅' : '🎯'}
            </span>
          </div>
          <h1 className={`text-3xl font-bold ${isChristmas ? 'text-white' : 'text-gray-900'}`}>
            ClassPoints
            {isChristmas && <span className="ml-2 animate-star-sparkle">⭐</span>}
          </h1>
          <p className={`mt-1 ${isChristmas ? 'text-green-200' : 'text-gray-600'}`}>
            {isChristmas
              ? "Spreading holiday cheer in the classroom!"
              : 'Classroom behavior tracking made easy'}
          </p>
          {isChristmas && (
            <div className="flex justify-center gap-2 mt-3">
              <span className="animate-ornament-swing inline-block">🎄</span>
              <span className="animate-twinkle inline-block">🎁</span>
              <span className="animate-ornament-swing inline-block" style={{ animationDelay: '0.5s' }}>🎄</span>
            </div>
          )}
        </div>

        {/* Auth Forms */}
        {view === 'login' && (
          <LoginForm
            onSwitchToSignup={() => setView('signup')}
            onForgotPassword={() => setView('forgot-password')}
          />
        )}

        {view === 'signup' && (
          <SignupForm
            onSwitchToLogin={() => setView('login')}
          />
        )}

        {view === 'forgot-password' && (
          <ForgotPasswordForm
            onBackToLogin={() => setView('login')}
          />
        )}
      </div>
    </div>
  );
}
