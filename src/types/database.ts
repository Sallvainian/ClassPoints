// Supabase Database Types - Auto-generated with convenience aliases
// Run: npx supabase gen types typescript --project-id hxclfwawibrtfjvptxno

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type BehaviorCategory = 'positive' | 'negative';

export interface Database {
  public: {
    Tables: {
      behaviors: {
        Row: {
          category: BehaviorCategory;
          created_at: string;
          icon: string;
          id: string;
          is_custom: boolean;
          name: string;
          points: number;
          user_id: string | null;
        };
        Insert: {
          category: BehaviorCategory;
          created_at?: string;
          icon: string;
          id?: string;
          is_custom?: boolean;
          name: string;
          points: number;
          user_id?: string | null;
        };
        Update: {
          category?: BehaviorCategory;
          created_at?: string;
          icon?: string;
          id?: string;
          is_custom?: boolean;
          name?: string;
          points?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      classrooms: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      point_transactions: {
        Row: {
          behavior_icon: string;
          behavior_id: string | null;
          behavior_name: string;
          classroom_id: string;
          created_at: string;
          id: string;
          note: string | null;
          points: number;
          student_id: string;
        };
        Insert: {
          behavior_icon: string;
          behavior_id?: string | null;
          behavior_name: string;
          classroom_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          points: number;
          student_id: string;
        };
        Update: {
          behavior_icon?: string;
          behavior_id?: string | null;
          behavior_name?: string;
          classroom_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          points?: number;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'point_transactions_behavior_id_fkey';
            columns: ['behavior_id'];
            isOneToOne: false;
            referencedRelation: 'behaviors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_transactions_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_transactions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          }
        ];
      };
      students: {
        Row: {
          avatar_color: string | null;
          classroom_id: string;
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          avatar_color?: string | null;
          classroom_id: string;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          avatar_color?: string | null;
          classroom_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'students_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      behavior_category: BehaviorCategory;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases for Row types
export type Classroom = Database['public']['Tables']['classrooms']['Row'];
export type Student = Database['public']['Tables']['students']['Row'];
export type Behavior = Database['public']['Tables']['behaviors']['Row'];
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row'];

// Convenience type aliases for Insert types
export type NewClassroom = Database['public']['Tables']['classrooms']['Insert'];
export type NewStudent = Database['public']['Tables']['students']['Insert'];
export type NewBehavior = Database['public']['Tables']['behaviors']['Insert'];
export type NewPointTransaction = Database['public']['Tables']['point_transactions']['Insert'];

// Convenience type aliases for Update types
export type UpdateClassroom = Database['public']['Tables']['classrooms']['Update'];
export type UpdateStudent = Database['public']['Tables']['students']['Update'];
export type UpdateBehavior = Database['public']['Tables']['behaviors']['Update'];
export type UpdatePointTransaction = Database['public']['Tables']['point_transactions']['Update'];
