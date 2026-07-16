/**
 * Boot-URL facts and app-URL resolution.
 *
 * MUST stay dependency-free (no supabase import): `bootRequestedPasswordRecovery`
 * relies on this module evaluating during the synchronous entry module graph
 * (AuthContext → App → main), i.e. before ANY microtask runs. GoTrueClient's
 * async `_initialize` consumes implicit-flow recovery links itself — it clears
 * the hash (`window.location.hash = ''`) and emits PASSWORD_RECOVERY on a
 * setTimeout(0), both of which can beat AuthProvider's post-commit
 * `onAuthStateChange` registration. Module-eval capture always wins that race.
 */

/**
 * True when a URL hash carries Supabase implicit-flow recovery TOKENS — not
 * merely a `type=recovery` marker. Requiring `access_token` mirrors
 * GoTrueClient's own callback detection: a token-less `#type=recovery` is not
 * a callback auth-js will process (or clear), so treating it as recovery would
 * let a crafted link park a signed-in user on the reset form indefinitely.
 */
export function parseRecoveryFromHash(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('type') === 'recovery' && params.has('access_token');
}

/**
 * Captured once at module evaluation — see the header comment for why reading
 * `window.location.hash` any later is racy against GoTrueClient's cleanup.
 */
export const bootRequestedPasswordRecovery =
  typeof window !== 'undefined' && parseRecoveryFromHash(window.location.hash);

/**
 * Where auth emails (password reset, email-change confirmations) should land.
 * The links must open the deployed web app root: GitHub Pages 404s unknown SPA
 * paths (no /reset-password route can ever load), and the boot-hash capture
 * above keys recovery off the root URL's hash instead.
 */
const PRODUCTION_WEB_URL = 'https://sallvainian.github.io/ClassPoints/';

/**
 * Pure core (unit-testable — jsdom's `location` is non-configurable, so the
 * wrapper below stays untested glue).
 *
 * Non-http(s) protocols (the Capacitor `capacitor://localhost` shell) cannot be
 * email-redirect targets — mail clients open links in a browser — so native
 * builds send auth-email links to the production web app: the teacher finishes
 * the flow in the browser, then signs in inside the app. Hardcoded rather than
 * falling back to Supabase's Site URL so behavior is deterministic.
 */
export function resolveAuthEmailRedirectUrl(
  protocol: string,
  origin: string,
  baseUrl: string
): string {
  if (!/^https?:$/.test(protocol)) return PRODUCTION_WEB_URL;
  return new URL(baseUrl, origin).href;
}

export function getAuthEmailRedirectUrl(): string {
  return resolveAuthEmailRedirectUrl(
    window.location.protocol,
    window.location.origin,
    import.meta.env.BASE_URL
  );
}
