export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          code: string
          created_at: string
          description: string
          emoji: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          emoji?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      characters: {
        Row: {
          created_at: string
          id: string
          image_paths: string[]
          image_urls: string[]
          name: string
          owner_id: string
          role_description: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_paths?: string[]
          image_urls?: string[]
          name: string
          owner_id: string
          role_description?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_paths?: string[]
          image_urls?: string[]
          name?: string
          owner_id?: string
          role_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          follow_ups: Json
          id: string
          image_urls: string[]
          metadata: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          follow_ups?: Json
          id?: string
          image_urls?: string[]
          metadata?: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          follow_ups?: Json
          id?: string
          image_urls?: string[]
          metadata?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          last_opened_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_opened_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_opened_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      episode_questions: {
        Row: {
          answer_text: string | null
          correct_index: number | null
          created_at: string
          episode_id: string
          explanation: string
          id: string
          kind: string
          options: Json
          order_index: number
          prompt: string
          seconds: number
        }
        Insert: {
          answer_text?: string | null
          correct_index?: number | null
          created_at?: string
          episode_id: string
          explanation?: string
          id?: string
          kind?: string
          options?: Json
          order_index?: number
          prompt: string
          seconds?: number
        }
        Update: {
          answer_text?: string | null
          correct_index?: number | null
          created_at?: string
          episode_id?: string
          explanation?: string
          id?: string
          kind?: string
          options?: Json
          order_index?: number
          prompt?: string
          seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "episode_questions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_slides: {
        Row: {
          bullets: Json
          created_at: string
          episode_id: string
          id: string
          order_index: number
          takeaway: string | null
          title: string
        }
        Insert: {
          bullets?: Json
          created_at?: string
          episode_id: string
          id?: string
          order_index?: number
          takeaway?: string | null
          title: string
        }
        Update: {
          bullets?: Json
          created_at?: string
          episode_id?: string
          id?: string
          order_index?: number
          takeaway?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_slides_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          order_index: number
          owner_id: string
          series_id: string
          status: string
          synopsis: string | null
          title: string
          updated_at: string
          video_job_id: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          order_index?: number
          owner_id: string
          series_id: string
          status?: string
          synopsis?: string | null
          title: string
          updated_at?: string
          video_job_id?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          order_index?: number
          owner_id?: string
          series_id?: string
          status?: string
          synopsis?: string | null
          title?: string
          updated_at?: string
          video_job_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_decks: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          source: string
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          source?: string
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          source?: string
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck_id: string
          front: string
          id: string
          known: boolean
          order_index: number
          owner_id: string
          reviews: number
        }
        Insert: {
          back: string
          created_at?: string
          deck_id: string
          front: string
          id?: string
          known?: boolean
          order_index?: number
          owner_id: string
          reviews?: number
        }
        Update: {
          back?: string
          created_at?: string
          deck_id?: string
          front?: string
          id?: string
          known?: boolean
          order_index?: number
          owner_id?: string
          reviews?: number
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          created_at: string
          episode_titles: Json
          episodes_done: number
          error: string | null
          id: string
          input_context: Json
          owner_id: string
          progress: number
          series_id: string | null
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          episode_titles?: Json
          episodes_done?: number
          error?: string | null
          id?: string
          input_context?: Json
          owner_id: string
          progress?: number
          series_id?: string | null
          stage?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          episode_titles?: Json
          episodes_done?: number
          error?: string | null
          id?: string
          input_context?: Json
          owner_id?: string
          progress?: number
          series_id?: string | null
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          celebrated: boolean
          created_at: string
          demoted: boolean
          id: string
          league_id: string
          promoted: boolean
          rank: number | null
          season_id: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          celebrated?: boolean
          created_at?: string
          demoted?: boolean
          id?: string
          league_id: string
          promoted?: boolean
          rank?: number | null
          season_id: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          celebrated?: boolean
          created_at?: string
          demoted?: boolean
          id?: string
          league_id?: string
          promoted?: boolean
          rank?: number | null
          season_id?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "league_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
        }
        Relationships: []
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          tier: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          tier: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tier?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          bio: string | null
          correct_answers: number
          created_at: string
          display_name: string | null
          episodes_completed: number
          hidden_from_rankings: boolean
          id: string
          league_id: string | null
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          correct_answers?: number
          created_at?: string
          display_name?: string | null
          episodes_completed?: number
          hidden_from_rankings?: boolean
          id: string
          league_id?: string | null
          updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          correct_answers?: number
          created_at?: string
          display_name?: string | null
          episodes_completed?: number
          hidden_from_rankings?: boolean
          id?: string
          league_id?: string | null
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          episode_id: string
          id: string
          last_slide_index: number
          perfect_quiz: boolean
          series_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          episode_id: string
          id?: string
          last_slide_index?: number
          perfect_quiz?: boolean
          series_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          episode_id?: string
          id?: string
          last_slide_index?: number
          perfect_quiz?: boolean
          series_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          created_at: string
          episode_id: string | null
          id: string
          is_correct: boolean
          question_id: string | null
          question_text: string
          selected_answer: string | null
          time_taken_ms: number | null
          timed_out: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string | null
          question_text?: string
          selected_answer?: string | null
          time_taken_ms?: number | null
          timed_out?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string | null
          question_text?: string
          selected_answer?: string | null
          time_taken_ms?: number | null
          timed_out?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "episode_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          cover_gradient: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          episode_count: number
          id: string
          is_public: boolean
          owner_id: string
          status: string
          subject: string | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          cover_gradient?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          episode_count?: number
          id?: string
          is_public?: boolean
          owner_id: string
          status?: string
          subject?: string | null
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          cover_gradient?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          episode_count?: number
          id?: string
          is_public?: boolean
          owner_id?: string
          status?: string
          subject?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      series_characters: {
        Row: {
          character_id: string
          created_at: string
          id: string
          series_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          series_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_characters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_days: {
        Row: {
          created_at: string
          day: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          mime_type: string | null
          owner_id: string
          series_id: string | null
          size_bytes: number | null
          source_url: string | null
          text_content: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          owner_id: string
          series_id?: string | null
          size_bytes?: number | null
          source_url?: string | null
          text_content?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          owner_id?: string
          series_id?: string | null
          size_bytes?: number | null
          source_url?: string | null
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_materials_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          celebrated: boolean
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          celebrated?: boolean
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          celebrated?: boolean
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          source_key: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          source_key?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          source_key?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_xp: {
        Args: { _amount: number; _kind: string; _source_key?: string }
        Returns: {
          awarded: number
          current_streak: number
          streak_incremented: boolean
          total_xp: number
        }[]
      }
      ensure_profile: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
    },
  },
} as const
