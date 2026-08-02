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
      // Skeletons breathe while a photo is being fetched or decoded. Opacity
      // only — animating a colour or a gradient position on a grid full of
      // placeholders costs paint work on exactly the frames where the phone is
      // already busy decoding images. Every use pairs this with `_motionReduce`.
      keyframes: {
        skeletonPulse: {
          '0%, 100%': { opacity: 0.35 },
          '50%': { opacity: 0.14 },
        },
      },

      tokens: {
        fonts: {
          body: {
            value:
              "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', Pretendard, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
          },
        },

        sizes: {
          // The phone-width column every screen is laid out in. Lives here
          // rather than in each screen so the app can't end up two widths wide.
          app: { value: '480px' },
          // Comfortable max for a single form control on a wide screen.
          field: { value: '320px' },
          swatchSm: { value: '10px' },
          swatchMd: { value: '16px' },
        },

        durations: {
          // Short enough to feel immediate on a chip tap, long enough to read
          // as a transition rather than a flicker.
          fast: { value: '120ms' },
        },

        zIndex: {
          header: { value: 10 },
          fab: { value: 20 },
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

          // ── Photo overlays ───────────────────────────────────────────────
          // Chrome that sits on top of a photograph: the full-screen viewer and
          // the scrim over a thumbnail that is still uploading. Like the
          // swatches above these are deliberately outside `semanticTokens` — a
          // photo viewer is dark under either colour scheme, because the point
          // is to get everything that is not the photograph out of the way.
          overlay: {
            DEFAULT: { value: 'rgba(12, 10, 9, 0.96)' },
            scrim: { value: 'rgba(12, 10, 9, 0.45)' },
            fg: { value: '#FAFAF9' },
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
    ':root': {
      // index.html sets viewport-fit=cover so the layout can reach under the
      // notch and home indicator. That is only safe if anything anchored to a
      // screen edge pads itself back out — otherwise the FAB sits beneath the
      // home indicator. Exposing the insets as plain custom properties (with a
      // 0px fallback, so non-notched devices and desktop are unaffected) lets
      // any rule compose them into a calc().
      '--safe-t': 'env(safe-area-inset-top, 0px)',
      '--safe-b': 'env(safe-area-inset-bottom, 0px)',
    },
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
    },
  },
})
