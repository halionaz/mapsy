/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * optional인 것은 의도다. 앱이 보장할 수 없는 유일한 런타임 입력이고, 이것을 그냥
 * `string`으로 타이핑하면 `shared/api/supabase.ts`의 가드가 컴파일러가 기꺼이 지우게
 * 둘 항진명제가 된다.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined
  /** publishable 키(`sb_publishable_...`) — secret 키는 절대 아니다. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
