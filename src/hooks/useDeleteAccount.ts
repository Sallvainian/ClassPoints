import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Invoke the delete-account Edge Function. The function derives the target
 * user from the caller's JWT — there is nothing to pass. On success the
 * account and every cascade-owned row are already gone server-side; the
 * caller is responsible for local teardown via the AuthContext signOut()
 * (auth-js tolerates the dead session's 401/403 on the sign-out endpoint and
 * still clears local storage + emits SIGNED_OUT; signOut also clears the
 * query cache). No unwrap(): that helper is PostgREST-only — functions.invoke
 * returns { data, error } with FunctionsError instances.
 */
export function useDeleteAccount() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
    },
  });
}
