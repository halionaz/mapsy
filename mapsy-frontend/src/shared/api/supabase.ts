import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

/**
 * Supabase 클라이언트 — mapsy가 말을 거는 유일한 백엔드 (PRD §8.3).
 *
 * publishable 키(`sb_publishable_...`)는 브라우저로 나가도록 설계된 것이다. 로그아웃
 * 상태에서 `anon`, 세션이 있으면 `authenticated` 역할을 주고, 그 위를 모든 테이블과
 * 스토리지 객체의 RLS가 지킨다. 데이터를 지키는 것은 비밀이 아니므로 번들에 들어가도 된다.
 * RLS를 우회하는 secret 키(`sb_secret_...`)는 이 파일에 절대 오면 안 된다.
 *
 * 모듈 로드가 아니라 지연 생성인 것은, import 시점에 던지면 앱이 그려지기도 전에 죽어
 * `.env.local`이 없는 것이 설정 단계가 아니라 빌드 실패로 보이기 때문이다.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && publishableKey)

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  // 위 boolean이 아니라 값을 직접 본다 — 그래야 컴파일러가 아래 createClient 앞에서
  // `string`으로 좁힌다.
  if (!url || !publishableKey) {
    throw new Error(
      'Supabase 환경변수가 없음. .env.example을 .env.local로 복사한 뒤 ' +
        'VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 채워야 함.',
    )
  }

  client ??= createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Google OAuth가 리다이렉트 URL로 세션을 돌려준다.
      detectSessionInUrl: true,
    },
  })

  return client
}

/** 모든 옷 사진이 들어가는 비공개 버킷. 경로는 `{userId}/{itemId}/…`. */
export const STORAGE_BUCKET = 'wardrobe'
