/**
 * Tipos de la base de datos de Supabase.
 * Por ahora escritos a mano siguiendo el schema del documento técnico.
 * Más adelante se pueden regenerar con `supabase gen types typescript`.
 */

export type Role = 'student' | 'mentor' | 'admin';

export type EventType =
  | 'live_class'
  | 'practice'
  | 'mentoring'
  | 'review'
  | 'launch'
  | 'roleplay';

export type EventStatus = 'active' | 'cancelled' | 'finished';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          bio: string | null;
          role: Role;
          points: number;
          phone: string | null;
          city: string | null;
          country: string | null;
          website: string | null;
          instagram: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: Role;
          points?: number;
          phone?: string | null;
          city?: string | null;
          country?: string | null;
          website?: string | null;
          instagram?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          cover_image_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          cover_image_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['courses']['Insert']>;
        Relationships: [];
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          description: string | null;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          description?: string | null;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['modules']['Insert']>;
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          description: string | null;
          video_url: string | null;
          duration_minutes: number | null;
          order_index: number;
          is_locked: boolean;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          description?: string | null;
          video_url?: string | null;
          duration_minutes?: number | null;
          order_index?: number;
          is_locked?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['lessons']['Insert']>;
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['lesson_progress']['Insert']
        >;
        Relationships: [];
      };
      community_posts: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          title: string | null;
          content: string;
          image_url: string | null;
          media_url: string | null;
          media_type: string | null;
          youtube_url: string | null;
          is_pinned: boolean;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          title?: string | null;
          content: string;
          image_url?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          youtube_url?: string | null;
          is_pinned?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['community_posts']['Insert']
        >;
        Relationships: [];
      };
      community_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          content: string | null;
          media_url: string | null;
          media_type: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          content?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['community_comments']['Insert']
        >;
        Relationships: [];
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['post_likes']['Insert']>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          event_type: EventType;
          start_time: string;
          end_time: string | null;
          meeting_url: string | null;
          status: EventStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          event_type: EventType;
          start_time: string;
          end_time?: string | null;
          meeting_url?: string | null;
          status?: EventStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          file_url: string | null;
          external_url: string | null;
          category: string;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          file_url?: string | null;
          external_url?: string | null;
          category: string;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['resources']['Insert']>;
        Relationships: [];
      };
      chat_conversations: {
        Row: {
          id: string;
          type: 'dm' | 'group' | 'channel';
          name: string | null;
          avatar_url: string | null;
          description: string | null;
          created_by: string | null;
          last_message_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'dm' | 'group' | 'channel';
          name?: string | null;
          avatar_url?: string | null;
          description?: string | null;
          created_by?: string | null;
          last_message_at?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['chat_conversations']['Insert']>;
        Relationships: [];
      };
      chat_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member';
          joined_at: string;
          last_read_at: string;
          muted: boolean;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'member';
          joined_at?: string;
          last_read_at?: string;
          muted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['chat_members']['Insert']>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          content: string | null;
          media_url: string | null;
          media_type: 'image' | 'video' | 'audio' | 'file' | 'gif' | null;
          media_name: string | null;
          reply_to_id: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          content?: string | null;
          media_url?: string | null;
          media_type?: 'image' | 'video' | 'audio' | 'file' | 'gif' | null;
          media_name?: string | null;
          reply_to_id?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>;
        Relationships: [];
      };
      chat_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['chat_reactions']['Insert']>;
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: { user_id: string };
        Returns: boolean;
      };
      get_or_create_dm: {
        Args: { p_other: string };
        Returns: string;
      };
      leaderboard_window: {
        Args: { p_days: number };
        Returns: {
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          points: number;
          rank: number;
        }[];
      };
    };
    Views: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
