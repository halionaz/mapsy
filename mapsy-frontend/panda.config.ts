import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  jsxFramework: 'react',

  // mapsy follows the OS colour scheme and deliberately ships no manual toggle
  // (PRD §9), so `_dark` is re-pointed from Panda's default class-based selector
  // to the media query. Every semantic token below then inherits OS-driven dark
  // mode for free, and no component ever needs its own theme conditional.
  conditions: {
    extend: {
      dark: '@media (prefers-color-scheme: dark)',
    },
  },

  theme: {
    extend: {
      tokens: {
        fonts: {
          body: {
            value:
              "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', Pretendard, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
          },
        },

        colors: {
          // Neutral ramp — the only greys the UI chrome is allowed to draw from.
          neutral: {
            0: { value: '#FFFFFF' },
            50: { value: '#FAFAF9' },
            100: { value: '#F5F5F4' },
            200: { value: '#E7E5E4' },
            300: { value: '#D6D3D1' },
            400: { value: '#A8A29E' },
            500: { value: '#78716C' },
            600: { value: '#57534E' },
            700: { value: '#44403C' },
            800: { value: '#292524' },
            900: { value: '#1C1917' },
            950: { value: '#0C0A09' },
          },

          brand: {
            50: { value: '#EEF2FF' },
            100: { value: '#E0E7FF' },
            200: { value: '#C7D2FE' },
            300: { value: '#A5B4FC' },
            400: { value: '#818CF8' },
            500: { value: '#6366F1' },
            600: { value: '#4F46E5' },
            700: { value: '#4338CA' },
            800: { value: '#3730A3' },
            900: { value: '#312E81' },
          },

          red: {
            50: { value: '#FEF2F2' },
            400: { value: '#F87171' },
            500: { value: '#EF4444' },
            600: { value: '#DC2626' },
            900: { value: '#7F1D1D' },
          },

          // ── Clothing swatches ────────────────────────────────────────────
          // Domain data, NOT theme chrome. These are the 16 colours a garment
          // can be tagged with (PRD §5.3). They must render identically in
          // light and dark — a beige jacket is beige under either scheme — so
          // they intentionally live outside `semanticTokens` and must never be
          // given a `_dark` variant.
          //
          // `multi` stands for multi-colour/patterned garments. It has no single
          // truthful colour; the swatch dot renders it as a gradient and this
          // value is only the flat fallback.
          swatch: {
            black: { value: '#1A1A1A' },
            white: { value: '#FFFFFF' },
            gray: { value: '#9CA3AF' },
            beige: { value: '#E3D5BD' },
            brown: { value: '#8B5E3C' },
            navy: { value: '#1E3A5F' },
            blue: { value: '#2563EB' },
            sky: { value: '#7DD3FC' },
            green: { value: '#16A34A' },
            khaki: { value: '#7C7A52' },
            yellow: { value: '#FACC15' },
            orange: { value: '#F97316' },
            red: { value: '#DC2626' },
            pink: { value: '#F9A8D4' },
            purple: { value: '#7C3AED' },
            multi: { value: '#A3A3A3' },
          },
        },
      },

      // Every colour a component names should come from here, so dark mode is
      // defined once instead of being re-derived at each call site.
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.950}' },
            },
            subtle: {
              value: { base: '{colors.neutral.50}', _dark: '{colors.neutral.900}' },
            },
            // Cards, bottom sheets — anything sitting above the page plane.
            elevated: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.800}' },
            },
          },

          fg: {
            DEFAULT: {
              value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.50}' },
            },
            muted: {
              value: { base: '{colors.neutral.500}', _dark: '{colors.neutral.400}' },
            },
            subtle: {
              value: { base: '{colors.neutral.400}', _dark: '{colors.neutral.500}' },
            },
          },

          border: {
            DEFAULT: {
              value: { base: '{colors.neutral.200}', _dark: '{colors.neutral.800}' },
            },
            subtle: {
              value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.900}' },
            },
          },

          accent: {
            DEFAULT: {
              value: { base: '{colors.brand.600}', _dark: '{colors.brand.400}' },
            },
            // Text/icon colour that sits on top of an accent fill.
            fg: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.950}' },
            },
            subtle: {
              value: { base: '{colors.brand.50}', _dark: '{colors.brand.900}' },
            },
          },

          danger: {
            DEFAULT: {
              value: { base: '{colors.red.600}', _dark: '{colors.red.400}' },
            },
            fg: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.950}' },
            },
          },
        },
      },
    },
  },

  globalCss: {
    html: {
      // Lets native controls (scrollbars, form widgets, the URL bar) follow the
      // OS scheme too, so the chrome around our tokens doesn't fight them.
      colorScheme: 'light dark',
    },
    'html, body, #root': {
      minHeight: '100dvh',
    },
    body: {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
      WebkitFontSmoothing: 'antialiased',
      // The wardrobe grid is the only thing that should scroll; rubber-banding
      // the page behind it reads as broken on iOS.
      overscrollBehaviorY: 'none',
    },
  },
})
