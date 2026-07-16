import { describe, expect, it } from 'vitest';
import { parseRecoveryFromHash, resolveAuthEmailRedirectUrl } from '../appUrl';

// appUrl.ts is dependency-free (no supabase import), so no env stub is needed.
// Only the pure functions are exercised here: `bootRequestedPasswordRecovery` is
// a module-eval constant (jsdom's boot hash is always empty) and
// `getPasswordResetRedirectUrl` reads the non-configurable jsdom `location` glue.

describe('parseRecoveryFromHash', () => {
  it('is true for a full implicit-flow recovery hash', () => {
    expect(
      parseRecoveryFromHash(
        '#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery'
      )
    ).toBe(true);
  });

  it('is false when type=recovery has no access_token (crafted/token-less link)', () => {
    // Not a callback GoTrueClient will process (or clear) — treating it as
    // recovery would park a signed-in user on the reset form indefinitely.
    expect(parseRecoveryFromHash('#type=recovery')).toBe(false);
  });

  it('is false for a non-recovery type (signup)', () => {
    expect(parseRecoveryFromHash('#access_token=abc&type=signup')).toBe(false);
  });

  it('is false for an empty hash', () => {
    expect(parseRecoveryFromHash('')).toBe(false);
  });

  it('is false for an OTP-expired error hash (no type param)', () => {
    expect(parseRecoveryFromHash('#error=access_denied&error_code=otp_expired')).toBe(false);
  });
});

describe('resolveAuthEmailRedirectUrl', () => {
  it('resolves the deployed GitHub Pages base against its origin (https)', () => {
    expect(
      resolveAuthEmailRedirectUrl('https:', 'https://sallvainian.github.io', '/ClassPoints/')
    ).toBe('https://sallvainian.github.io/ClassPoints/');
  });

  it('resolves the local dev base against localhost (http)', () => {
    expect(resolveAuthEmailRedirectUrl('http:', 'http://localhost:5173', '/ClassPoints/')).toBe(
      'http://localhost:5173/ClassPoints/'
    );
  });

  it('falls back to the hardcoded production web URL for non-http(s) shells (capacitor)', () => {
    // Mail clients open reset links in a browser, so the Capacitor shell can never
    // be the redirect target — native builds send the link to the deployed web app.
    expect(resolveAuthEmailRedirectUrl('capacitor:', 'capacitor://localhost', './')).toBe(
      'https://sallvainian.github.io/ClassPoints/'
    );
  });
});
