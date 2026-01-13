// Supabase Database Types - Auto-generated with convenience aliases
// Run: npx supabase gen types typescript --project-id hxclfwawibrtfjvptxno

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BehaviorCategory = 'positive' | 'negative';
export type RoomElementType = 'teacher_desk' | 'door' | 'window' | 'countertop' | 'sink';

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
          batch_id: string | null;
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
          batch_id?: string | null;
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
          batch_id?: string | null;
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
          },
        ];
      };
      students: {
        Row: {
          avatar_color: string | null;
          classroom_id: string;
          created_at: string;
          id: string;
          name: string;
          // Stored point totals (maintained by DB trigger)
          point_total: number;
          positive_total: number;
          negative_total: number;
        };
        Insert: {
          avatar_color?: string | null;
          classroom_id: string;
          created_at?: string;
          id?: string;
          name: string;
          // Defaults to 0 in DB
          point_total?: number;
          positive_total?: number;
          negative_total?: number;
        };
        Update: {
          avatar_color?: string | null;
          classroom_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          point_total?: number;
          positive_total?: number;
          negative_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'students_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
        ];
      };
      user_sound_settings: {
        Row: {
          id: string;
          user_id: string;
          enabled: boolean;
          volume: number;
          positive_sound: string;
          negative_sound: string;
          custom_positive_url: string | null;
          custom_negative_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          enabled?: boolean;
          volume?: number;
          positive_sound?: string;
          negative_sound?: string;
          custom_positive_url?: string | null;
          custom_negative_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          enabled?: boolean;
          volume?: number;
          positive_sound?: string;
          negative_sound?: string;
          custom_positive_url?: string | null;
          custom_negative_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seating_charts: {
        Row: {
          id: string;
          classroom_id: string;
          name: string;
          snap_enabled: boolean;
          grid_size: number;
          canvas_width: number;
          canvas_height: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          name?: string;
          snap_enabled?: boolean;
          grid_size?: number;
          canvas_width?: number;
          canvas_height?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          name?: string;
          snap_enabled?: boolean;
          grid_size?: number;
          canvas_width?: number;
          canvas_height?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'seating_charts_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: true;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
        ];
      };
      seating_groups: {
        Row: {
          id: string;
          seating_chart_id: string;
          letter: string;
          position_x: number;
          position_y: number;
          rotation: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          seating_chart_id: string;
          letter: string;
          position_x: number;
          position_y: number;
          rotation?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          seating_chart_id?: string;
          letter?: string;
          position_x?: number;
          position_y?: number;
          rotation?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'seating_groups_seating_chart_id_fkey';
            columns: ['seating_chart_id'];
            isOneToOne: false;
            referencedRelation: 'seating_charts';
            referencedColumns: ['id'];
          },
        ];
      };
      seating_seats: {
        Row: {
          id: string;
          seating_group_id: string;
          position_in_group: number;
          student_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seating_group_id: string;
          position_in_group: number;
          student_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          seating_group_id?: string;
          position_in_group?: number;
          student_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'seating_seats_seating_group_id_fkey';
            columns: ['seating_group_id'];
            isOneToOne: false;
            referencedRelation: 'seating_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'seating_seats_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      room_elements: {
        Row: {
          id: string;
          seating_chart_id: string;
          element_type: RoomElementType;
          label: string | null;
          position_x: number;
          position_y: number;
          width: number;
          height: number;
          rotation: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          seating_chart_id: string;
          element_type: RoomElementType;
          label?: string | null;
          position_x: number;
          position_y: number;
          width?: number;
          height?: number;
          rotation?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          seating_chart_id?: string;
          element_type?: RoomElementType;
          label?: string | null;
          position_x?: number;
          position_y?: number;
          width?: number;
          height?: number;
          rotation?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'room_elements_seating_chart_id_fkey';
            columns: ['seating_chart_id'];
            isOneToOne: false;
            referencedRelation: 'seating_charts';
            referencedColumns: ['id'];
          },
        ];
      };
      layout_presets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          layout_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          layout_data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          layout_data?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_student_time_totals: {
        Args: {
          p_classroom_id: string;
          p_start_of_today: string;
          p_start_of_week: string;
        };
        Returns: {
          student_id: string;
          today_total: number;
          this_week_total: number;
        }[];
      };
    };
    Enums: {
      behavior_category: BehaviorCategory;
      room_element_type: RoomElementType;
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

// Sound settings types
export type UserSoundSettings = Database['public']['Tables']['user_sound_settings']['Row'];
export type NewUserSoundSettings = Database['public']['Tables']['user_sound_settings']['Insert'];
export type UpdateUserSoundSettings = Database['public']['Tables']['user_sound_settings']['Update'];

// Seating chart types
export type SeatingChartRow = Database['public']['Tables']['seating_charts']['Row'];
export type NewSeatingChart = Database['public']['Tables']['seating_charts']['Insert'];
export type UpdateSeatingChart = Database['public']['Tables']['seating_charts']['Update'];

export type SeatingGroupRow = Database['public']['Tables']['seating_groups']['Row'];
export type NewSeatingGroup = Database['public']['Tables']['seating_groups']['Insert'];
export type UpdateSeatingGroup = Database['public']['Tables']['seating_groups']['Update'];

export type SeatingSeatRow = Database['public']['Tables']['seating_seats']['Row'];
export type NewSeatingSeat = Database['public']['Tables']['seating_seats']['Insert'];
export type UpdateSeatingSeat = Database['public']['Tables']['seating_seats']['Update'];

export type RoomElementRow = Database['public']['Tables']['room_elements']['Row'];
export type NewRoomElement = Database['public']['Tables']['room_elements']['Insert'];
export type UpdateRoomElement = Database['public']['Tables']['room_elements']['Update'];

export type LayoutPresetRow = Database['public']['Tables']['layout_presets']['Row'];
export type NewLayoutPreset = Database['public']['Tables']['layout_presets']['Insert'];
export type UpdateLayoutPreset = Database['public']['Tables']['layout_presets']['Update'];
