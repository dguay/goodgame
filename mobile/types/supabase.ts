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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      game_external_ids: {
        Row: {
          created_at: string
          rawg_game_id: number
          steam_app_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          rawg_game_id: number
          steam_app_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          rawg_game_id?: number
          steam_app_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pcgamingwiki_features: {
        Row: {
          controller_support:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          created_at: string
          official_discord_url: string | null
          one_twenty_fps:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          pcgw_page_id: number | null
          pcgw_page_name: string | null
          perspectives: string[]
          rawg_game_id: number
          refreshed_at: string
          sixty_fps:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          steam_app_id: number | null
          ultrawidescreen:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          updated_at: string
          xbox_game_pass:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          xbox_game_pass_checked_at: string | null
        }
        Insert: {
          controller_support?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          created_at?: string
          official_discord_url?: string | null
          one_twenty_fps?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          pcgw_page_id?: number | null
          pcgw_page_name?: string | null
          perspectives?: string[]
          rawg_game_id: number
          refreshed_at?: string
          sixty_fps?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          steam_app_id?: number | null
          ultrawidescreen?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          updated_at?: string
          xbox_game_pass?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          xbox_game_pass_checked_at?: string | null
        }
        Update: {
          controller_support?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          created_at?: string
          official_discord_url?: string | null
          one_twenty_fps?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          pcgw_page_id?: number | null
          pcgw_page_name?: string | null
          perspectives?: string[]
          rawg_game_id?: number
          refreshed_at?: string
          sixty_fps?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          steam_app_id?: number | null
          ultrawidescreen?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          updated_at?: string
          xbox_game_pass?:
            | "always on"
            | "false"
            | "hackable"
            | "limited"
            | "true"
            | "unknown"
            | null
          xbox_game_pass_checked_at?: string | null
        }
        Relationships: []
      }
      library_entries: {
        Row: {
          created_at: string
          custom_order: number | null
          finished_at: string | null
          game_cover_url: string | null
          game_title: string
          id: string
          personal_notes: string | null
          personal_playtime_minutes: number | null
          personal_rating: number | null
          platforms: string[] | null
          rawg_game_id: number
          rawg_metadata_synced_at: string | null
          release_date: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_order?: number | null
          finished_at?: string | null
          game_cover_url?: string | null
          game_title: string
          id?: string
          personal_notes?: string | null
          personal_playtime_minutes?: number | null
          personal_rating?: number | null
          platforms?: string[] | null
          rawg_game_id: number
          rawg_metadata_synced_at?: string | null
          release_date?: string | null
          started_at?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_order?: number | null
          finished_at?: string | null
          game_cover_url?: string | null
          game_title?: string
          id?: string
          personal_notes?: string | null
          personal_playtime_minutes?: number | null
          personal_rating?: number | null
          platforms?: string[] | null
          rawg_game_id?: number
          rawg_metadata_synced_at?: string | null
          release_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_article_games: {
        Row: {
          article_id: string
          confidence: number
          created_at: string
          game_id: string
          match_method: string
        }
        Insert: {
          article_id: string
          confidence?: number
          created_at?: string
          game_id: string
          match_method: string
        }
        Update: {
          article_id?: string
          confidence?: number
          created_at?: string
          game_id?: string
          match_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_article_games_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_article_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "news_games"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author: string | null
          canonical_url: string | null
          cluster_id: string | null
          content_hash: string | null
          created_at: string
          excerpt: string | null
          fetched_at: string
          id: string
          image_url: string | null
          normalized_title: string
          published_at: string | null
          raw: Json | null
          source_id: string
          title: string
          url: string
        }
        Insert: {
          author?: string | null
          canonical_url?: string | null
          cluster_id?: string | null
          content_hash?: string | null
          created_at?: string
          excerpt?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          normalized_title: string
          published_at?: string | null
          raw?: Json | null
          source_id: string
          title: string
          url: string
        }
        Update: {
          author?: string | null
          canonical_url?: string | null
          cluster_id?: string | null
          content_hash?: string | null
          created_at?: string
          excerpt?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          normalized_title?: string
          published_at?: string | null
          raw?: Json | null
          source_id?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "news_story_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "news_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      news_game_aliases: {
        Row: {
          alias: string
          created_at: string
          game_id: string
          id: string
          normalized_alias: string
          source: string
        }
        Insert: {
          alias: string
          created_at?: string
          game_id: string
          id?: string
          normalized_alias: string
          source?: string
        }
        Update: {
          alias?: string
          created_at?: string
          game_id?: string
          id?: string
          normalized_alias?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_game_aliases_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "news_games"
            referencedColumns: ["id"]
          },
        ]
      }
      news_game_match_candidates: {
        Row: {
          article_id: string
          best_rawg_id: string | null
          best_rawg_name: string | null
          best_rawg_slug: string | null
          candidate: string
          confidence: number | null
          created_at: string
          id: string
          normalized_candidate: string
          rawg_results: Json
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          article_id: string
          best_rawg_id?: string | null
          best_rawg_name?: string | null
          best_rawg_slug?: string | null
          candidate: string
          confidence?: number | null
          created_at?: string
          id?: string
          normalized_candidate: string
          rawg_results?: Json
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          article_id?: string
          best_rawg_id?: string | null
          best_rawg_name?: string | null
          best_rawg_slug?: string | null
          candidate?: string
          confidence?: number | null
          created_at?: string
          id?: string
          normalized_candidate?: string
          rawg_results?: Json
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_game_match_candidates_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_game_trends: {
        Row: {
          calculated_at: string
          game_id: string
          mentions_24h: number
          mentions_72h: number
          mentions_7d: number
          official_mentions_72h: number
          trending_score: number
          unique_sources_72h: number
        }
        Insert: {
          calculated_at?: string
          game_id: string
          mentions_24h?: number
          mentions_72h?: number
          mentions_7d?: number
          official_mentions_72h?: number
          trending_score?: number
          unique_sources_72h?: number
        }
        Update: {
          calculated_at?: string
          game_id?: string
          mentions_24h?: number
          mentions_72h?: number
          mentions_7d?: number
          official_mentions_72h?: number
          trending_score?: number
          unique_sources_72h?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_game_trends_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "news_games"
            referencedColumns: ["id"]
          },
        ]
      }
      news_games: {
        Row: {
          created_at: string
          genres: string[]
          id: string
          image_url: string | null
          name: string
          platforms: string[]
          rawg_id: string | null
          released: string | null
          slug: string
          steam_app_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          genres?: string[]
          id?: string
          image_url?: string | null
          name: string
          platforms?: string[]
          rawg_id?: string | null
          released?: string | null
          slug: string
          steam_app_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          genres?: string[]
          id?: string
          image_url?: string | null
          name?: string
          platforms?: string[]
          rawg_id?: string | null
          released?: string | null
          slug?: string
          steam_app_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      news_sources: {
        Row: {
          category: string
          consecutive_failures: number
          created_at: string
          etag: string | null
          feed_url: string
          homepage_url: string | null
          id: string
          is_enabled: boolean
          last_fetched_at: string | null
          last_modified: string | null
          name: string
          next_fetch_at: string | null
          refresh_interval_minutes: number
          source_weight: number
          updated_at: string
        }
        Insert: {
          category: string
          consecutive_failures?: number
          created_at?: string
          etag?: string | null
          feed_url: string
          homepage_url?: string | null
          id: string
          is_enabled?: boolean
          last_fetched_at?: string | null
          last_modified?: string | null
          name: string
          next_fetch_at?: string | null
          refresh_interval_minutes?: number
          source_weight?: number
          updated_at?: string
        }
        Update: {
          category?: string
          consecutive_failures?: number
          created_at?: string
          etag?: string | null
          feed_url?: string
          homepage_url?: string | null
          id?: string
          is_enabled?: boolean
          last_fetched_at?: string | null
          last_modified?: string | null
          name?: string
          next_fetch_at?: string | null
          refresh_interval_minutes?: number
          source_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      news_story_clusters: {
        Row: {
          article_count: number
          created_at: string
          first_published_at: string | null
          id: string
          latest_published_at: string | null
          normalized_title: string
          primary_article_id: string | null
          representative_title: string
          story_score: number
          unique_source_count: number
          updated_at: string
        }
        Insert: {
          article_count?: number
          created_at?: string
          first_published_at?: string | null
          id?: string
          latest_published_at?: string | null
          normalized_title: string
          primary_article_id?: string | null
          representative_title: string
          story_score?: number
          unique_source_count?: number
          updated_at?: string
        }
        Update: {
          article_count?: number
          created_at?: string
          first_published_at?: string | null
          id?: string
          latest_published_at?: string | null
          normalized_title?: string
          primary_article_id?: string | null
          representative_title?: string
          story_score?: number
          unique_source_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_story_clusters_primary_article_id_fkey"
            columns: ["primary_article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          library_sort: string
          library_view: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          library_sort?: string
          library_view?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          library_sort?: string
          library_view?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
