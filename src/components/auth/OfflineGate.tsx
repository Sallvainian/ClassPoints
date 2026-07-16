/**
 * Rendered by AuthGuard when `authSuspended`: storage holds a session that
 * couldn't be hydrated because of a network-class failure (offline cold start
 * with an expired access token, auth server 5xx/429). Showing the login form
 * here would invite the teacher to re-enter credentials that can't work —
 * GoTrue's auto-refresh ticker (plus AuthContext's reconnect kick) restores
 * the session automatically, and onAuthStateChange flips the app to signed-in.
 */
export function OfflineGate() {
  return (
    <div
      data-testid="offline-gate"
      className="min-h-dvh flex items-center justify-center bg-surface-1 p-8"
    >
      <div className="text-center max-w-md animate-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted mb-4 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" aria-hidden="true" />↳
          Reconnecting
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.01em] text-ink-strong mb-3">
          You&apos;re offline.
        </h1>
        <p className="text-sm text-ink-mid">
          Your session is saved — the app reconnects automatically when you&apos;re back online.
        </p>
      </div>
    </div>
  );
}
