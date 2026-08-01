import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client — the only backend mapsy talks to (PRD §8.3).
 *
 * The anon key is public by design; every table and storage object is guarded by
 * row-level security keyed on `auth.uid()`, so the key alone grants nothing.
 *
 * The client is created lazily rather than at module load. Throwing at import
 * time would take the whole app down before it renders, which makes a missing
 * `.env.local` look like a build failure instead of a setup step — and it would
 * block anyone from running the UI shell before a Supabase project exists.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase 환경변수가 없음. .env.example을 .env.local로 복사한 뒤 ' +
        'VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 채워야 함.',
    )
  }

  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Google OAuth hands the session back in the redirect URL.
      detectSessionInUrl: true,
    },
  })

  return client
}

/** Private bucket holding every garment photo, pathed `{userId}/{itemId}/…`. */
export const STORAGE_BUCKET = 'wardrobe'
