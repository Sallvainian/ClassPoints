import { createContext, useContext } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
  /**
   * Storage holds a session that couldn't be hydrated because of a
   * network-class failure (offline boot with an expired access token, auth
   * server 5xx/429). Not "offline": the device may be online while Supabase is
   * down. AuthGuard renders the OfflineGate for this instead of the login form;
   * GoTrue's auto-refresh ticker (plus a reconnect kick) recovers the session,
   * and the state clears when onAuthStateChange delivers one.
   */
  authSuspended: boolean;
  /**
   * The app was opened from a password-reset email (boot-hash capture or a
   * PASSWORD_RECOVERY auth event). While set — and the user is authenticated —
   * AuthGuard renders ResetPasswordForm instead of the app.
   */
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ success: boolean; error?: AuthError }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: AuthError }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: AuthError }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: AuthError }>;
  /**
   * Requests an email-address change — success means "requested", not
   * "changed": the change completes when the emailed confirmation link(s) are
   * opened (one to the new address; also one to the current address when the
   * project's "secure email change" setting is on).
   */
  updateEmail: (email: string) => Promise<{ success: boolean; error?: AuthError }>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
