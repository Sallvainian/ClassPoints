import { supabaseAdmin } from '../../helpers/supabase-admin';
import { uniqueSlug } from '../../helpers/unique';

export type SeededClassroom = {
  id: string;
  name: string;
  userId: string;
};

type ClassroomCreateInput = {
  userId: string;
  name?: string;
};

export class ClassroomFactory {
  private readonly created: string[] = [];

  async create(input: ClassroomCreateInput): Promise<SeededClassroom> {
    const name = input.name ?? `classroom-${uniqueSlug()}`;

    const { data, error } = await supabaseAdmin()
      .from('classrooms')
      .insert({ name, user_id: input.userId })
      .select('id, name, user_id')
      .single();

    if (error || !data) {
      throw new Error(
        `ClassroomFactory.create failed: ${error?.message ?? 'no classroom returned'}`
      );
    }

    this.created.push(data.id);
    return { id: data.id, name: data.name, userId: data.user_id as string };
  }

  async cleanup(): Promise<void> {
    if (this.created.length === 0) return;

    const { error } = await supabaseAdmin().from('classrooms').delete().in('id', this.created);
    this.created.length = 0;

    if (error) {
      throw new Error(`ClassroomFactory.cleanup failed: ${error.message}`);
    }
  }
}
