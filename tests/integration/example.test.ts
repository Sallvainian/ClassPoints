import { describe, it, expect } from 'vitest';
import { supabaseAdmin } from '../support/helpers/supabase-admin';

describe('Supabase integration (smoke)', () => {
  it('Given a service-role admin client, When listing users, Then returns a paged list shape', async () => {
    // Given:
    const admin = supabaseAdmin();

    // When:
    const { data, error } = await admin.auth.admin.listUsers();

    // Then:
    expect(error).toBeNull();
    expect(data).toHaveProperty('users');
    expect(Array.isArray(data.users)).toBe(true);
  });

  it('Given the migrated schema, When selecting from public.classrooms, Then the canonical columns are queryable', async () => {
    // Given:
    const admin = supabaseAdmin();

    // When:
    const { error } = await admin
      .from('classrooms')
      .select('id, name, user_id, created_at')
      .limit(1);

    // Then: select succeeds (data may be empty if no rows yet — column shape matters here, not row count).
    expect(error).toBeNull();
  });
});
