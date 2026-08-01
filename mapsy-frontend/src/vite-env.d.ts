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
  readonly VITE_SUPABASE_ANON_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
