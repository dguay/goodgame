import type { Database } from './supabase'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type LibraryEntry = Database['public']['Tables']['library_entries']['Row']
export type LibraryEntryInsert = Database['public']['Tables']['library_entries']['Insert']
export type LibraryEntryUpdate = Database['public']['Tables']['library_entries']['Update']
