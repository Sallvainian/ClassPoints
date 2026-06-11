import { describe, expect, it, vi } from 'vitest';
import { PostgrestError } from '@supabase/supabase-js';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';

// src/lib/supabase.ts validates env at module eval and THROWS without creds —
// exactly CI's Unit Tests step (no fnox, no .env.test in the checkout). Stub the
// env BEFORE importing the SUT so the module loads credless.
vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key');
const { unwrap, isPostgrestError } = await import('./supabase');

function ok<T>(data: T): PostgrestSingleResponse<T> {
  return { success: true, data, error: null, count: null, status: 200, statusText: 'OK' };
}

function failed<T>(error: PostgrestError): PostgrestSingleResponse<T> {
  return {
    success: false,
    data: null,
    error,
    count: null,
    status: 500,
    statusText: 'Internal Server Error',
  };
}

// What postgrest-js's non-throwOnError path ACTUALLY produces: a plain object
// literal (JSON.parse(body) for server errors), NOT a PostgrestError instance.
// The cast mirrors that reality for the hydration tests.
function plainLiteral(fields: {
  message: string;
  details: string;
  hint: string;
  code: string;
}): PostgrestError {
  return { ...fields } as PostgrestError;
}

describe('unwrap', () => {
  it('returns data on success', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(unwrap(ok(rows))).toBe(rows);
  });

  it('passes null data through on select-less mutations (delete with no .select())', () => {
    expect(unwrap(ok<null>(null))).toBeNull();
  });

  it('rethrows an Error-instance error BY IDENTITY (no re-wrap)', () => {
    const original = new PostgrestError({
      message: 'fk violation',
      details: 'Key (student_id)=(x) is not present',
      hint: '',
      code: '23503',
    });
    let caught: unknown;
    try {
      unwrap(failed(original));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(original); // identity, not a hydrated copy
  });

  it('hydrates a plain-object error into a real PostgrestError, preserving message/code/details/hint', () => {
    const literal = plainLiteral({
      message: 'duplicate key value violates unique constraint',
      details: 'Key (name)=(X) already exists.',
      hint: 'rename it',
      code: '23505',
    });
    let caught: unknown;
    try {
      unwrap(failed(literal));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PostgrestError);
    expect(caught).toBeInstanceOf(Error); // modal `instanceof Error` compat (CAP-3)
    const hydrated = caught as PostgrestError;
    expect(hydrated.message).toBe('duplicate key value violates unique constraint');
    expect(hydrated.details).toBe('Key (name)=(X) already exists.');
    expect(hydrated.hint).toBe('rename it');
    expect(hydrated.code).toBe('23505');
  });

  it("hydrates a bare non-JSON-body literal ({message} only) with code:'' and string details/hint", () => {
    // postgrest-js emits `{ message: body }` when the error response body is
    // NOT JSON (e.g. an HTML 502 from a proxy) — no code/details/hint at all.
    // Hydration must default the missing fields to '' so the result classifies
    // as network-class (`code !== ''` false), not server-reached (CAP-6).
    const bareLiteral = { message: 'html gateway error' } as PostgrestError;
    let caught: unknown;
    try {
      unwrap(failed(bareLiteral));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PostgrestError);
    const hydrated = caught as PostgrestError;
    expect(hydrated.message).toBe('html gateway error');
    expect(hydrated.code).toBe(''); // NOT undefined — `undefined !== ''` would misclassify
    expect(hydrated.details).toBe('');
    expect(hydrated.hint).toBe('');
  });

  it("preserves the fetch-failure literal's code:'' verbatim (CAP-6 network classification)", () => {
    const fetchFailure = plainLiteral({
      message: 'TypeError: Failed to fetch',
      details: '',
      hint: '',
      code: '',
    });
    let caught: unknown;
    try {
      unwrap(failed(fetchFailure));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PostgrestError);
    expect((caught as PostgrestError).code).toBe(''); // NOT normalized or invented
  });
});

describe('isPostgrestError', () => {
  it('accepts a real PostgrestError instance (instanceof fast-path)', () => {
    const instance = new PostgrestError({ message: 'm', details: 'd', hint: 'h', code: '42501' });
    expect(isPostgrestError(instance)).toBe(true);
  });

  it('accepts a plain error literal structurally (no `name` requirement)', () => {
    expect(isPostgrestError({ message: 'm', details: null, hint: null, code: '' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isPostgrestError(null)).toBe(false);
  });

  it('rejects a plain Error (no code/details/hint)', () => {
    expect(isPostgrestError(new Error('boom'))).toBe(false);
  });

  it('narrows to typed .code access', () => {
    const err: unknown = new PostgrestError({ message: 'm', details: '', hint: '', code: '23503' });
    if (isPostgrestError(err)) {
      // Type-level: `.code` reads without a cast.
      expect(err.code).toBe('23503');
    } else {
      expect.unreachable('guard must accept a real instance');
    }
  });
});
