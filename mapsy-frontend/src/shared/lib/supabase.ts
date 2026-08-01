import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client — the only backend mapsy talks to (PRD §8.3).
 *
 * The publishable key (`sb_publishable_...`) is designed to be shipped to the
 * browser: it grants the `anon` Postgres role when signed out and `authenticated`
 * once a session exists, and every table and storage object is guarded by RLS on
 * top of that. Secrecy is not what protects the data, so bundling it is fine.
 *
 * Supabase's older `anon` JWT key does the same thing and still works, but is
 * deprecated by the end of 2026 — hence the newer name here. The secret key
 * (`sb_secret_...`) bypasses RLS and must never reach this file.
 *
 * The client is created lazily rather than at module load. Throwing at import
 * time would take the whole app down before it renders, which makes a missing
 * `.env.local` look like a build failure instead of a setup step — and it would
 * block anyone from running the UI shell before a Supabase project exists.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && publishableKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  // Checks the values directly rather than the boolean above, so the compiler
  // narrows them to `string` for the createClient call below. Going through
  // `isSupabaseConfigured` would leave them `string | undefined` and the guard
  // would only be a runtime convention.
  if (!url || !publishableKey) {
    throw new Error(
      'Supabase 환경변수가 없음. .env.example을 .env.local로 복사한 뒤 ' +
        'VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 채워야 함.',
    )
  }

  client ??= createClient(url, publishableKey, {
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
