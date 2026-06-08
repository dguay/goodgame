import type { Database } from './supabase'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type LibraryEntry = Database['public']['Tables']['library_entries']['Row']
export type LibraryEntryInsert = Database['public']['Tables']['library_entries']['Insert']
export type LibraryEntryUpdate = Database['public']['Tables']['library_entries']['Update']
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']
export type PcGamingWikiFeatures = Database['public']['Tables']['pcgamingwiki_features']['Row']
