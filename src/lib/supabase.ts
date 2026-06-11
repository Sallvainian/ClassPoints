// PostgrestError is a RUNTIME import (needed for `instanceof` and the hydration
// constructor in unwrap) — `import type` would break under isolatedModules.
import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';
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
