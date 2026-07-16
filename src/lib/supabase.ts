// PostgrestError is a RUNTIME import (needed for `instanceof` and the hydration
// constructor in unwrap) — `import type` would break under isolatedModules.
import {
  AuthUnknownError,
  createClient,
  isAuthApiError,
  isAuthRetryableFetchError,
  PostgrestError,
  SupabaseClient,
} from '@supabase/supabase-js';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Expose Supabase client globally for migration scripts (browser console)
declare global {
  interface Window {
    __SUPABASE_CLIENT__?: SupabaseClient<Database>;
  }
}

if (typeof window !== 'undefined') {
  window.__SUPABASE_CLIENT__ = supabase;
}

/**
 * Result-or-throw for PostgREST responses (table queries, mutations, and RPCs).
 * The canonical call shape (verbatim from useLayoutPresets' queryFn):
 *
 *   const data = unwrap(
 *     await supabase.from('layout_presets').select('*').order('name', { ascending: true })
 *   );
 *
 * Only `data` comes back — `count`/`status` are not returned, so callers that
 * need `{ count: 'exact' }` must destructure the raw response instead.
 *
 * Typed against the library's `PostgrestSingleResponse<T>` discriminated union —
 * a hand-rolled `{ data: T; error: ... }` shape would lose null-narrowing at every
 * `.single()` site. PostgREST-only: auth results (`AuthError`, `data` never null)
 * must NOT pass through it.
 */
export function unwrap<T>(result: PostgrestSingleResponse<T>): T {
  if (result.error) {
    // postgrest-js's non-throwOnError path produces PLAIN-OBJECT error literals,
    // not Error instances (`JSON.parse(body)` for server errors; a
    // `{message, details, hint, code: ''}` literal for fetch failures; a bare
    // `{message: body}` literal when the response body is NOT JSON, e.g. an
    // HTML 502 from a proxy). Rethrow Error instances BY IDENTITY; hydrate
    // plain objects into a real PostgrestError so metadata survives
    // field-for-field AND `instanceof Error` consumers (the modal catch sites)
    // keep working. Missing fields default to '' — the library's own no-code
    // sentinel (its fetch-failure literal uses `code: ''`), not an invented
    // code; without the default, a bare non-JSON literal would hydrate with
    // `code: undefined` and useBatchAward's `code !== ''` network-vs-server
    // classification (CAP-6) would misclassify it as server-reached. Present
    // values are preserved verbatim, never normalized.
    if (result.error instanceof Error) throw result.error;
    // Statically `result.error: PostgrestError` extends Error, so TS narrows the
    // non-instance branch to `never`; at runtime it is the plain literal — widen
    // to the literal's true (partial) shape for the field defaults.
    const literal = result.error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    throw new PostgrestError({
      message: literal.message ?? '',
      details: literal.details ?? '',
      hint: literal.hint ?? '',
      code: literal.code ?? '',
    });
  }
  return result.data;
}

/**
 * The shape the guard below can actually promise. `details`/`hint` are
 * nullable here — PostgREST emits null for both in RAISE-error JSON, and the
 * structural fallback deliberately accepts that. Everything unwrap() throws
 * is hydrated to strings, so for post-unwrap errors the fields are plain
 * strings in practice; the nullable type keeps the predicate sound for raw
 * literals that never passed through unwrap().
 */
export type PostgrestErrorLike = {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
};

/**
 * Typed guard for PostgREST errors — gives `.code`/`details`/`hint` access
 * without casts. `instanceof` fast-path plus a structural fallback with NO
 * `name` requirement: plain error literals from postgrest-js carry
 * message/details/hint/code but no `name`.
 */
export function isPostgrestError(err: unknown): err is PostgrestErrorLike {
  if (err instanceof PostgrestError) return true;
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    (typeof candidate.details === 'string' || candidate.details === null) &&
    (typeof candidate.hint === 'string' || candidate.hint === null)
  );
}

/**
 * Sentinel for AuthContext's bounded session validation: `getUser()` accepts no
 * AbortSignal, so boot races it against a timer and rejects with this class.
 * A named class (vs the old anonymous `new Error('auth validation timeout')`)
 * lets `isNetworkClassAuthError` recognize "the auth endpoint hung" as a
 * transient failure instead of a session rejection.
 */
export class AuthValidationTimeoutError extends Error {
  constructor() {
    super('auth validation timeout');
    this.name = 'AuthValidationTimeoutError';
  }
}

/**
 * Transient/network-class auth failure — the session was NOT proven invalid,
 * so callers must keep it (in state and in storage) and let GoTrue's
 * auto-refresh ticker recover once connectivity returns. Destroying a session
 * on one of these logs a teacher out for being offline.
 *
 * WHITELIST semantics: anything unclassified is a genuine rejection (401/403
 * AuthApiError, AuthSessionMissingError, unknown errors) and the caller purges.
 * Defaulting the unknown case to "purge" preserves the original defense this
 * validation exists for — a stale JWT must never brick boot in a refresh loop.
 * The one deliberate fuzzy edge: TypeError (fetch's network-failure class) from
 * our own code would be misread as transient, but that failure mode is "kept a
 * session we couldn't validate", which the reconnect revalidation then settles.
 */
export function isNetworkClassAuthError(err: unknown): boolean {
  if (err instanceof AuthValidationTimeoutError) return true;
  if (err instanceof TypeError) return true;
  if (isAuthRetryableFetchError(err)) return true;
  // Server-side trouble (5xx) or throttling (429) says nothing about the
  // session's validity.
  if (isAuthApiError(err) && (err.status >= 500 || err.status === 429)) return true;
  // Unparseable response body. auth-js only wraps 5xx as retryable BEFORE
  // parsing; any other status with a non-JSON body (an HTML 403/429 block or
  // challenge page from a school content filter or CDN WAF — infrastructure
  // in FRONT of Supabase, not Supabase's verdict) lands here. GoTrue's own
  // rejections are always JSON → AuthApiError, so genuine 401/403s still purge.
  if (err instanceof AuthUnknownError) return true;
  return false;
}
