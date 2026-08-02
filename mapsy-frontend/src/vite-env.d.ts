/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Optional on purpose. These are the only runtime inputs the app cannot
 * guarantee, and typing them as plain `string` makes the guard in
 * `shared/lib/supabase.ts` a tautology the compiler will happily let someone
 * delete.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined
  /** Publishable key (`sb_publishable_...`) — never the secret key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
