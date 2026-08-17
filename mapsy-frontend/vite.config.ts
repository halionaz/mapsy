/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 확장자가 붙는 것은 이 파일이 node16 해석을 쓰는 tsconfig.node.json에 속하기 때문이다.
// src의 나머지는 번들러 해석이라 확장자가 없다.
import { PHOTO_CACHE_NAME } from './src/shared/api/photoCache.js'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 앱 셸은 스스로 갱신한다. 사용자가 동의해야 할 릴리스가 없고, 살아 있는 DB를
      // 상대하는 낡은 셸은 새로고침보다 나쁘다.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        runtimeCaching: [
          {
            /**
             * 서명된 사진.
             *
             * 아래 콜백들은 워커 파일로 **직렬화되어** 들어가므로 이 파일의 어떤 값도
             * 참조할 수 없다 — 호스트를 여기 적지 못하고 경로로만 알아보는 이유다.
             * `/storage/v1/object/sign/`은 Supabase Storage 서명 URL의 고정 접두사다.
             */
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/sign/'),
            handler: 'CacheFirst',
            options: {
              cacheName: PHOTO_CACHE_NAME,
              plugins: [
                {
                  /**
                   * 토큰을 키에서 뺀다. **이 캐시의 존재 이유 전부가 이 여섯 줄이다.**
                   *
                   * 브라우저 캐시는 쿼리까지 포함한 전체 URL로 키를 잡아, 재서명이
                   * 바이트 하나 바뀌지 않은 사진 전부를 미스로 만든다. 경로만 남기면
                   * 새 토큰으로 온 요청이 이미 받아둔 응답과 만난다.
                   *
                   * 서명을 우회하지는 않는다. 캐시에 없는 사진은 그대로 네트워크로 가고,
                   * 거기서 만료된 토큰은 여전히 거절당한다.
                   */
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const url = new URL(request.url)
                    url.search = ''
                    return url.href
                  },
                },
              ],
              expiration: {
                /**
                 * PRD §7의 용량 추산인 옷 500벌 × 사진 2장을 **객체 수로** 센 것.
                 *
                 * 엔트리는 사진이 아니라 객체라 사진 한 장이 둘을 쓴다(원본·썸네일).
                 * 1000으로 잡으면 격자 커버까지 같은 캐시에 들어가는 탓에 250벌쯤
                 * 열어본 사람이 상한에 닿아, 정작 매번 보는 커버 썸네일부터 밀려난다.
                 */
                maxEntries: 2000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                // 캐시가 스토리지 압박으로 통째로 날아가는 것을 막는다.
                purgeOnQuotaError: true,
              },
              /**
               * 200만. **0(opaque)을 넣으면 안 된다.**
               *
               * opaque 응답은 성공과 400을 구분할 방법이 없어서, 만료된 서명에 대한
               * 오류가 사진 행세를 하며 캐시에 앉는다. 위에서 캐시 키의 토큰을 떼므로
               * 재서명해도 같은 키를 쳐서 그 오류가 계속 나오고, 새로고침으로도 풀리지
               * 않는다 — 서비스워커 캐시는 새로고침이 지우지 않는다.
               *
               * 그래서 이 줄은 사진 `<img>`가 전부 `crossOrigin="anonymous"`라는 것에
               * 기댄다(`SquarePhoto`의 `PHOTO_CORS`). 그것이 빠진 `<img>`는 opaque를
               * 받아 캐시되지 않고 매번 네트워크를 탄다.
               */
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'mapsy — 내 옷장',
        short_name: 'mapsy',
        description: '내가 가진 옷을 한눈에 모아보는 옷장',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        // 매니페스트는 한 쌍만 실을 수 있고, 브라우저 탭용 theme-color는 index.html이
        // 이미 스킴별로 나눈다. 둘을 라이트 값으로 맞춘다 — 흰 background_color 위의
        // 어두운 theme_color는 설치된 앱에 흰 스플래시 위 검은 타이틀바를 준다.
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],

  test: {
    // jsdom이 구현하지 않은 브라우저 API. 모든 테스트 파일에서 돌고, node 환경
    // 파일에서는 스텁이 그냥 쓰이지 않는다.
    setupFiles: ['./vitest.setup.ts'],
  },

  resolve: {
    alias: {
      // Panda는 패키지 루트의 ./styled-system에 출력한다. 별칭을 두면 기능 폴더에서
      // ../../../로 기어오르지 않는다 — 같은 매핑이 tsconfig.app.json에도 있다.
      'styled-system': fileURLToPath(new URL('./styled-system', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
