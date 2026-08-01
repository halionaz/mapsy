import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app shell updates itself; there is no release the user needs to
      // consent to, and a stale shell against a live database is worse than a
      // reload.
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
        // A manifest can only carry one pair, and index.html already varies
        // theme-color per scheme for the browser tab. Both are kept on the light
        // values so they agree with each other — a dark theme_color over a white
        // background_color gives an installed app a black title bar above a
        // white splash.
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

  resolve: {
    alias: {
      // Panda writes its output to ./styled-system at the package root. Aliasing
      // it keeps imports readable instead of climbing ../../../ from feature
      // folders — and the same mapping is mirrored in tsconfig.app.json.
      'styled-system': fileURLToPath(new URL('./styled-system', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
