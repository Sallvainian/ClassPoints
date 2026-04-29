import { supabaseAdmin } from '../../helpers/supabase-admin';
import { uniqueSlug } from '../../helpers/unique';

export type SeededUser = {
  id: string;
  email: string;
  password: string;
};

type UserOverrides = Partial<{ email: string; password: string }>;

export class UserFactory {
  private readonly created: string[] = [];

  async create(overrides: UserOverrides = {}): Promise<SeededUser> {
    const slug = uniqueSlug();
    const email = overrides.email ?? `e2e-user-${slug}@classpoints.local`;
    const password = overrides.password ?? `pw-${slug}`;

    const { data, error } = await supabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`UserFactory.create failed: ${error?.message ?? 'no user returned'}`);
    }

    this.created.push(data.user.id);
    return { id: data.user.id, email, password };
  }

  async cleanup(): Promise<void> {
    if (this.created.length === 0) return;
    const admin = supabaseAdmin();
    const errors: string[] = [];
    for (const id of this.created) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) errors.push(`${id}: ${error.message}`);
    }
    this.created.length = 0;
    if (errors.length > 0) {
      throw new Error(`UserFactory.cleanup partial failure:\n${errors.join('\n')}`);
    }
  }
}
