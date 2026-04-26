import { createClient } from '@supabase/supabase-js';

/**
 * Seed the E2E test user into a Supabase auth instance. Idempotent — returns
 * silently if the user already exists. Throws on real failures.
 *
 * @param {{url: string; serviceRoleKey: string; email: string; password: string}} config
 */
export async function seedTestUser(config) {
  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email: config.email,
    password: config.password,
    email_confirm: true,
  });

  if (!error) return;
  // Supabase variants: "already registered", "already been registered", "already exists".
  if (/already (been )?(registered|exists)/i.test(error.message)) return;
  throw new Error(`Failed to seed test user ${config.email}: ${error.message}`);
}
