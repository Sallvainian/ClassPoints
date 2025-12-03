// Supabase Database Types
// Generated from schema - keep in sync with migrations

export type BehaviorCategory = 'positive' | 'negative';

export interface Database {
  public: {
    Tables: {
      classrooms: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          classroom_id: string;
          name: string;
          avatar_color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          name: string;
          avatar_color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          name?: string;
          avatar_color?: string | null;
          created_at?: string;
        };
      };
      behaviors: {
        Row: {
          id: string;
          name: string;
          points: number;
          icon: string;
          category: BehaviorCategory;
          is_custom: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          points: number;
          icon: string;
          category: BehaviorCategory;
          is_custom?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          points?: number;
          icon?: string;
          category?: BehaviorCategory;
          is_custom?: boolean;
          created_at?: string;
        };
      };
      point_transactions: {
        Row: {
          id: string;
          student_id: string;
          classroom_id: string;
          behavior_id: string | null;
          behavior_name: string;
          behavior_icon: string;
          points: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          classroom_id: string;
          behavior_id?: string | null;
          behavior_name: string;
          behavior_icon: string;
          points: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          classroom_id?: string;
          behavior_id?: string | null;
          behavior_name?: string;
          behavior_icon?: string;
          points?: number;
          note?: string | null;
          created_at?: string;
        };
      };
    };
    Enums: {
      behavior_category: BehaviorCategory;
    };
  };
}

// Convenience type aliases
export type Classroom = Database['public']['Tables']['classrooms']['Row'];
export type Student = Database['public']['Tables']['students']['Row'];
export type Behavior = Database['public']['Tables']['behaviors']['Row'];
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row'];

export type NewClassroom = Database['public']['Tables']['classrooms']['Insert'];
export type NewStudent = Database['public']['Tables']['students']['Insert'];
export type NewBehavior = Database['public']['Tables']['behaviors']['Insert'];
export type NewPointTransaction = Database['public']['Tables']['point_transactions']['Insert'];
