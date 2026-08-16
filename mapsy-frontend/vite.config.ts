/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 앱 셸은 스스로 갱신한다. 사용자가 동의해야 할 릴리스가 없고, 살아 있는 DB를
      // 상대하는 낡은 셸은 새로고침보다 나쁘다.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
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
