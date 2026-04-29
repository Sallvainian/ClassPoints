import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { UserFactory, type SeededUser } from '../fixtures/factories/user.factory';

export type ImpersonationPair = {
  /** Anon-key Supabase client signed in as the first test user. RLS sees auth.uid() === userARecord.id. */
  userA: SupabaseClient;
  /** Anon-key Supabase client signed in as the second test user. RLS sees auth.uid() === userBRecord.id. */
  userB: SupabaseClient;
  userARecord: SeededUser;
  userBRecord: SeededUser;
  /** Sign both clients out and delete both users via the service-role admin client. Always call in `finally`. */
  cleanup: () => Promise<void>;
};

function anonClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'createImpersonationPair() requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
        'Set them in .env.test (values come from `supabase status`).'
    );
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Create a pair of anon-key Supabase clients, each signed in as a distinct
 * freshly-seeded test user. Used for RLS integration tests where the boundary
 * `User A cannot see User B's data` must be exercised with two real auth
 * contexts in the same test.
 *
 * Always wrap usage in `try/finally` and call `cleanup()` from the `finally`:
 *
 * ```ts
 * const pair = await createImpersonationPair();
 * try {
 *   await pair.userB.from('classrooms').insert({ name: 'B-only' });
 *   const { data } = await pair.userA.from('classrooms').select('*');
 *   expect(data?.find((r) => r.name === 'B-only')).toBeUndefined();
 * } finally {
 *   await pair.cleanup();
 * }
 * ```
 */
export async function createImpersonationPair(): Promise<ImpersonationPair> {
  const factory = new UserFactory();

  const userARecord = await factory.create();
  const userBRecord = await factory.create();

  const userA = anonClient();
  const userB = anonClient();

  const aSignIn = await userA.auth.signInWithPassword({
    email: userARecord.email,
    password: userARecord.password,
  });
  if (aSignIn.error) {
    await factory.cleanup();
    throw new Error(`createImpersonationPair: userA sign-in failed: ${aSignIn.error.message}`);
  }

  const bSignIn = await userB.auth.signInWithPassword({
    email: userBRecord.email,
    password: userBRecord.password,
  });
  if (bSignIn.error) {
    await factory.cleanup();
    throw new Error(`createImpersonationPair: userB sign-in failed: ${bSignIn.error.message}`);
  }

  return {
    userA,
    userB,
    userARecord,
    userBRecord,
    cleanup: async () => {
      // Sign each client out so in-memory tokens drop before we delete the users.
      await Promise.all([
        userA.auth.signOut().catch(() => undefined),
        userB.auth.signOut().catch(() => undefined),
      ]);
      await factory.cleanup();
    },
  };
}
