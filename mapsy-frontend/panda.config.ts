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
  //
  // The palette is designed dark-first and inverted for light, not the other way
  // round: this is a screen full of photographs of clothes, and a near-black page
  // is what lets the garment be the only lit thing on it.
  conditions: {
    extend: {
      dark: '@media (prefers-color-scheme: dark)',
    },
  },

  theme: {
    extend: {
      keyframes: {
        // Skeletons breathe while a photo is being fetched or decoded. Opacity
        // only — animating a colour or a gradient position on a grid full of
        // placeholders costs paint work on exactly the frames where the phone is
        // already busy decoding images. Every use pairs this with `_motionReduce`.
        skeletonPulse: {
          '0%, 100%': { opacity: 0.35 },
          '50%': { opacity: 0.14 },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        // Bottom sheet. Translated in percent of its own height so the distance
        // is right whether the sheet holds four chips or the whole filter set.
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        /**
         * The sheet leaving, from wherever it currently is.
         *
         * `--drawer-translate-y` is written to the content by Ark's drawer on
         * every frame of a swipe, so starting the keyframe from it means a sheet
         * flicked halfway down carries on from halfway down. A fixed
         * `from: translateY(0)` would snap it back up to the top and then play
         * the exit — a jump on exactly the gesture this animation exists for.
         *
         * The fallback covers the other ways out (backdrop, Esc, 결과 보기),
         * where nothing has been dragged and the sheet starts at rest.
         */
        drawerOut: {
          from: { transform: 'translate3d(0, var(--drawer-translate-y, 0px), 0)' },
          to: { transform: 'translate3d(0, 100%, 0)' },
        },
        // Centred dialogs grow from slightly under full size rather than sliding:
        // a confirm box has no edge to come from.
        popIn: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        popOut: {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.96)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
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
          // Every tappable target clears this. 44px is the smallest thing iOS
          // Human Interface Guidelines will call a control, and the icon buttons
          // in the headers are exactly the ones that drift under it.
          tap: { value: '44px' },
        },

        radii: {
          // Photos and cards. Spotify-ish: enough curve to read as a surface,
          // not so much that a 1:1 photograph looks like a sticker.
          card: { value: '10px' },
          field: { value: '12px' },
          // Bottom sheets, which are only rounded along their top edge.
          sheet: { value: '20px' },
        },

        durations: {
          // Short enough to feel immediate on a chip tap, long enough to read
          // as a transition rather than a flicker.
          fast: { value: '120ms' },
          normal: { value: '200ms' },
          slow: { value: '280ms' },
        },

        easings: {
          // Fast out of the gate and a long settle. This is what makes a sheet
          // read as a physical object rather than a linear slide, and it is the
          // single curve everything in the app decelerates on.
          out: { value: 'cubic-bezier(0.16, 1, 0.3, 1)' },
          inOut: { value: 'cubic-bezier(0.65, 0, 0.35, 1)' },
        },

        animations: {
          fadeIn: { value: 'fadeIn {durations.normal} {easings.out}' },
          fadeOut: { value: 'fadeOut {durations.fast} {easings.out}' },
          sheetIn: { value: 'slideUp {durations.slow} {easings.out}' },
          sheetOut: { value: 'drawerOut {durations.normal} {easings.inOut}' },
          dialogIn: { value: 'popIn {durations.normal} {easings.out}' },
          dialogOut: { value: 'popOut {durations.fast} {easings.inOut}' },
          spin: { value: 'spin 0.8s linear infinite' },
        },

        zIndex: {
          header: { value: 10 },
          fab: { value: 20 },
          overlay: { value: 40 },
        },

        colors: {
          // Neutral ramp — the only greys the UI chrome is allowed to draw from.
          // Warm rather than blue-grey: it sits under photographs of fabric, and
          // a cold grey makes every beige and camel garment look washed out.
          neutral: {
            0: { value: '#FFFFFF' },
            50: { value: '#FAFAF9' },
            100: { value: '#F4F4F2' },
            200: { value: '#E7E5E2' },
            300: { value: '#D4D1CD' },
            400: { value: '#A8A39D' },
            500: { value: '#7A756F' },
            600: { value: '#57534E' },
            700: { value: '#3C3936' },
            800: { value: '#292725' },
            850: { value: '#201F1D' },
            900: { value: '#191817' },
            950: { value: '#0C0B0A' },
          },

          // Brand orange. 500 is the point colour and is the same hex in both
          // schemes — a brand that shifts with the OS setting is not a brand.
          //
          // Deliberately redder than `swatch.orange` (#F97316), which is domain
          // data: an orange garment's dot sits on cards painted in this colour,
          // and two oranges a few degrees apart read as a rendering bug.
          brand: {
            50: { value: '#FFF3ED' },
            100: { value: '#FFE2D2' },
            200: { value: '#FFC4A6' },
            300: { value: '#FFA274' },
            400: { value: '#FF8348' },
            500: { value: '#FF6B2C' },
            600: { value: '#EE5417' },
            700: { value: '#C63D0F' },
            800: { value: '#9C300C' },
            900: { value: '#7A2708' },
            // Orange at 14% over the dark page. A flat hex rather than an alpha
            // so it composites identically wherever it is used, including on top
            // of a photograph.
            tintDark: { value: '#2E190F' },
          },

          red: {
            50: { value: '#FEF2F2' },
            400: { value: '#F87171' },
            500: { value: '#EF4444' },
            600: { value: '#DC2626' },
            900: { value: '#7F1D1D' },
            tintDark: { value: '#2A1414' },
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
          // Chrome that sits on top of a photograph: the full-screen viewer, the
          // scrim over a thumbnail that is still uploading, the gradient under a
          // hero image. Like the swatches above these are deliberately outside
          // `semanticTokens` — a photo viewer is dark under either colour scheme,
          // because the point is to get everything that is not the photograph
          // out of the way.
          overlay: {
            DEFAULT: { value: 'rgba(8, 7, 7, 0.96)' },
            scrim: { value: 'rgba(8, 7, 7, 0.45)' },
            // Behind a modal. Heavier than the thumbnail scrim because it has to
            // push a whole screen back, not tint one tile.
            backdrop: { value: 'rgba(6, 5, 5, 0.72)' },
            fg: { value: '#FAFAF9' },
          },
        },
      },

      // Every colour a component names should come from here, so dark mode is
      // defined once instead of being re-derived at each call site.
      semanticTokens: {
        colors: {
          bg: {
            // The page. Near-black rather than pure black: pure black clips
            // against OLED and leaves an elevated surface nothing to be lighter
            // than without looking grey.
            DEFAULT: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.950}' },
            },
            // Inset surfaces — search fields, text inputs, the well a control
            // sits *in* rather than *on*.
            subtle: {
              value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.900}' },
            },
            // Cards, bottom sheets, dialogs — anything sitting above the page
            // plane. One contrast step away from `bg` in both schemes, in
            // opposite directions, so "elevated" always means "further from the
            // page" rather than "lighter".
            elevated: {
              value: { base: '{colors.neutral.50}', _dark: '{colors.neutral.900}' },
            },
            // What an elevated surface becomes under the pointer. Spotify's
            // whole card grid is built on this one move.
            elevatedHover: {
              value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.800}' },
            },
          },

          fg: {
            // Pure white on dark, on purpose: it is the one thing on the screen
            // that should look printed rather than dimmed.
            DEFAULT: {
              value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.0}' },
            },
            muted: {
              value: { base: '{colors.neutral.600}', _dark: '{colors.neutral.400}' },
            },
            subtle: {
              value: { base: '{colors.neutral.400}', _dark: '{colors.neutral.500}' },
            },
            // Text drawn on top of an inverted fill (the secondary button).
            inverted: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.950}' },
            },
          },

          border: {
            DEFAULT: {
              value: { base: '{colors.neutral.200}', _dark: '{colors.neutral.800}' },
            },
            subtle: {
              value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.850}' },
            },
            // A border that is meant to be seen — an unselected chip's outline.
            strong: {
              value: { base: '{colors.neutral.300}', _dark: '{colors.neutral.700}' },
            },
          },

          accent: {
            // The fill. Identical in both schemes.
            DEFAULT: { value: '{colors.brand.500}' },
            hover: {
              value: { base: '{colors.brand.600}', _dark: '{colors.brand.400}' },
            },
            // Text/icon colour that sits on top of an accent fill.
            //
            // Near-black in *both* schemes rather than following the theme.
            // White on #FF6B2C is 2.8:1 and fails at any size; near-black is
            // 7.4:1. This is also why Spotify sets black text on its green.
            fg: { value: '{colors.neutral.950}' },
            // Accent as *text* on the page background, where the fill colour is
            // too light to pass on white. Darkened for light (5.2:1) and
            // brightened for dark (8.1:1).
            text: {
              value: { base: '{colors.brand.700}', _dark: '{colors.brand.400}' },
            },
            // A tinted surface. One user today — the preview-mode banner.
            subtle: {
              value: { base: '{colors.brand.50}', _dark: '{colors.brand.tintDark}' },
            },
            // The focus ring, and the only colour allowed to draw one.
            ring: { value: '{colors.brand.500}' },
          },

          danger: {
            DEFAULT: {
              value: { base: '{colors.red.600}', _dark: '{colors.red.400}' },
            },
            fg: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.950}' },
            },
            subtle: {
              value: { base: '{colors.red.50}', _dark: '{colors.red.tintDark}' },
            },
          },
        },

        shadows: {
          raised: {
            value: {
              base: '0 8px 24px rgba(12, 11, 10, 0.12)',
              _dark: '0 8px 28px rgba(0, 0, 0, 0.6)',
            },
          },
          // The FAB, which has to stay legible over an arbitrary photograph.
          fab: {
            value: {
              base: '0 6px 20px rgba(238, 84, 23, 0.32)',
              _dark: '0 6px 24px rgba(0, 0, 0, 0.7)',
            },
          },
          sheet: {
            value: {
              base: '0 -8px 40px rgba(12, 11, 10, 0.16)',
              _dark: '0 -8px 40px rgba(0, 0, 0, 0.7)',
            },
          },
        },
      },

      /**
       * The type scale.
       *
       * mapsy ships no webfont — the stack is whatever the OS calls its system
       * sans, which on the target devices (iOS Safari 16+, Android Chrome) is
       * already a good Korean face. So the typographic identity has to come from
       * the scale rather than the letterforms: heavy weights, tight tracking on
       * anything large, and a hard stop at five sizes. Negative tracking on the
       * display sizes is most of what separates this from a default stylesheet.
       */
      textStyles: {
        display: {
          value: {
            fontSize: '2rem',
            lineHeight: '1.15',
            fontWeight: '800',
            letterSpacing: '-0.035em',
          },
        },
        title: {
          value: {
            fontSize: '1.5rem',
            lineHeight: '1.2',
            fontWeight: '800',
            letterSpacing: '-0.025em',
          },
        },
        heading: {
          value: {
            fontSize: '1.125rem',
            lineHeight: '1.3',
            fontWeight: '700',
            letterSpacing: '-0.015em',
          },
        },
        subheading: {
          value: {
            fontSize: '0.9375rem',
            lineHeight: '1.35',
            fontWeight: '700',
            letterSpacing: '-0.01em',
          },
        },
        body: {
          value: { fontSize: '0.9375rem', lineHeight: '1.55', fontWeight: '400' },
        },
        bodyStrong: {
          value: { fontSize: '0.9375rem', lineHeight: '1.5', fontWeight: '600' },
        },
        // Controls: chips, buttons, tabs.
        label: {
          value: { fontSize: '0.8125rem', lineHeight: '1.3', fontWeight: '600' },
        },
        caption: {
          value: { fontSize: '0.75rem', lineHeight: '1.4', fontWeight: '500' },
        },
        // Field captions and eyebrows. The tracking is what stops 12px bold
        // Korean from setting as a solid block.
        eyebrow: {
          value: {
            fontSize: '0.6875rem',
            lineHeight: '1.35',
            fontWeight: '700',
            letterSpacing: '0.04em',
          },
        },
      },

      /**
       * The focus ring, defined once.
       *
       * It was previously written out at seventeen call sites, which is
       * seventeen chances for one of them to be 1px or the wrong colour. A layer
       * style is the right shape for it: it carries its own `_focusVisible`
       * condition, so applying it is `layerStyle: 'focusable'` and nothing else.
       */
      layerStyles: {
        focusable: {
          value: {
            _focusVisible: {
              outline: '2px solid',
              outlineColor: 'accent.ring',
              outlineOffset: '2px',
            },
          },
        },
        // Same ring drawn inside the element, for anything clipped by a
        // scrolling ancestor — a tile in the photo strip, a chip in the rail.
        focusableInset: {
          value: {
            _focusVisible: {
              outline: '2px solid',
              outlineColor: 'accent.ring',
              outlineOffset: '-3px',
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
      // The app is a phone-width column; on a wide window the page behind it is
      // the same near-black, so the column does not sit in a white frame.
      bg: 'bg',
    },
    'html, body, #root': {
      minHeight: '100dvh',
    },
    body: {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
      textStyle: 'body',
      WebkitFontSmoothing: 'antialiased',
      // A tap on a chip or a card should look like the state change it causes,
      // not like a grey rectangle flashing behind it.
      WebkitTapHighlightColor: 'transparent',
    },
    // Ark UI's dialogs lock scroll by setting this attribute; without a rule for
    // it the page behind a sheet still moves under a drag on iOS.
    'body[data-scroll-locked]': {
      overflow: 'hidden',
    },
  },
})
