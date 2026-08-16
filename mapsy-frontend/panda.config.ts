import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  jsxFramework: 'react',

  // mapsy는 OS 설정을 따르고 수동 토글을 일부러 두지 않으므로(PRD §9), `_dark`를
  // Panda 기본의 클래스 셀렉터에서 미디어 쿼리로 옮긴다. 아래 시맨틱 토큰이 전부 그것을
  // 물려받고, 어떤 컴포넌트도 자기 테마 분기를 갖지 않는다.
  //
  // 팔레트는 라이트를 뒤집은 것이 아니라 다크를 먼저 설계했다 — 옷 사진으로 가득한
  // 화면이고, 검정에 가까운 페이지라야 옷이 유일하게 빛나는 것이 된다.
  conditions: {
    extend: {
      dark: '@media (prefers-color-scheme: dark)',
    },
  },

  theme: {
    extend: {
      keyframes: {
        // 사진을 받거나 디코드하는 동안 스켈레톤이 숨쉰다. 불투명도만 — 자리표시자로
        // 가득한 격자에서 색이나 그라데이션 위치를 움직이면, 폰이 이미 이미지 디코딩으로
        // 바쁜 바로 그 프레임에 페인트 비용이 든다.
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
        // 바텀시트. 자기 높이의 퍼센트로 옮기므로, 시트가 칩 넷을 담든 필터 전체를
        // 담든 거리가 맞는다.
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        /**
         * 시트가 지금 있는 자리에서 떠나는 것.
         *
         * Ark의 drawer가 스와이프 매 프레임마다 `--drawer-translate-y`를 콘텐츠에
         * 쓰므로, 키프레임을 거기서 시작하면 절반쯤 내려간 시트가 절반에서 이어간다.
         * 고정된 `from: translateY(0)`은 시트를 맨 위로 되튕긴 뒤 퇴장을 재생한다 —
         * 이 애니메이션이 존재하는 이유인 바로 그 제스처에서 튀는 것이다.
         *
         * 대체값은 끌린 적 없이 쉬는 자리에서 시작하는 나머지 경로(백드롭, Esc,
         * 결과 보기)를 덮는다.
         */
        drawerOut: {
          from: { transform: 'translate3d(0, var(--drawer-translate-y, 0px), 0)' },
          to: { transform: 'translate3d(0, 100%, 0)' },
        },
        // 가운데 다이얼로그는 미끄러지지 않고 조금 작은 크기에서 자란다 — 확인 상자에는
        // 나올 가장자리가 없다.
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
          // 모든 화면이 배치되는 폰 폭 컬럼. 화면마다가 아니라 여기 있어야 앱이 두
          // 가지 폭을 갖지 않는다.
          app: { value: '480px' },
          // 넓은 화면에서 폼 컨트롤 하나가 가질 편한 최대 폭.
          field: { value: '320px' },
          swatchSm: { value: '10px' },
          swatchMd: { value: '16px' },
          // 44px는 iOS HIG가 컨트롤이라 부르는 가장 작은 것이고, 엄지가 스스로 찾아야
          // 하는 것의 크기다. 앱 전체가 넘는 선은 아니다 — 칩은 일부러 36px이고 44px
          // 밴드를 감싸는 레일에서 받는다. 이 토큰을 부르는 것들의 바닥값이다.
          tap: { value: '44px' },
        },

        radii: {
          // 사진과 카드. 면으로 읽힐 만큼은 굽지만, 1:1 사진이 스티커로 보일 만큼은 아니게.
          card: { value: '10px' },
          field: { value: '12px' },
          // 바텀시트. 위쪽 가장자리만 둥글다.
          sheet: { value: '20px' },
        },

        durations: {
          // 칩 탭에서 즉각으로 느껴질 만큼 짧고, 깜빡임이 아니라 전환으로 읽힐 만큼 길게.
          fast: { value: '120ms' },
          normal: { value: '200ms' },
          slow: { value: '280ms' },
        },

        easings: {
          // 빠르게 출발해 길게 가라앉는다. 시트가 선형 슬라이드가 아니라 물체로 읽히게
          // 하는 것이고, 앱의 모든 감속이 타는 하나의 곡선이다.
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
          // 중립 램프 — UI 크롬이 쓸 수 있는 유일한 회색. 푸른 회색이 아니라 따뜻한
          // 쪽이다. 옷감 사진 아래 깔리는데, 차가운 회색은 베이지와 카멜을 전부 바래 보이게 한다.
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

          // 브랜드 주황. 500이 포인트 색이고 두 스킴에서 같은 hex다 — OS 설정에 따라
          // 바뀌는 브랜드는 브랜드가 아니다.
          //
          // 도메인 데이터인 `swatch.orange`보다 일부러 붉다. 주황 옷의 점이 이 색으로
          // 칠한 카드 위에 앉는데, 몇 도 차이 나는 주황 둘은 렌더링 버그로 읽힌다.
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
            // 어두운 페이지 위 14%의 주황. 알파가 아니라 평평한 hex라, 사진 위를 포함해
            // 어디서 쓰이든 똑같이 합성된다.
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

          // ── 옷 색상 스와치 ───────────────────────────────────────────────
          // 테마 크롬이 아니라 도메인 데이터다. 옷에 붙일 수 있는 16색(PRD §5.3)이고,
          // 라이트와 다크에서 똑같이 그려져야 한다 — 베이지 자켓은 어느 스킴에서도
          // 베이지다. 그래서 일부러 `semanticTokens` 바깥에 있고, `_dark` variant를
          // 주면 안 된다.
          //
          // `multi`는 여러 색이거나 패턴인 옷이다. 참인 색 하나가 없어 점은 그라데이션으로
          // 그려지고, 이 값은 평평한 대체값일 뿐이다.
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

          // ── 사진 오버레이 ────────────────────────────────────────────────
          // 사진 위에 놓이는 크롬 — 전체 화면 뷰어, 업로드 중인 썸네일의 스크림, 히어로
          // 이미지 아래 그라데이션. 위 스와치와 마찬가지로 일부러 `semanticTokens`
          // 바깥이다. 사진 뷰어는 어느 스킴에서도 어둡다. 사진이 아닌 것을 전부 비키게
          // 하는 것이 요점이기 때문이다.
          overlay: {
            DEFAULT: { value: 'rgba(8, 7, 7, 0.96)' },
            scrim: { value: 'rgba(8, 7, 7, 0.45)' },
            // 모달 뒤. 타일 하나를 틴트하는 것이 아니라 화면 전체를 밀어내야 해서
            // 썸네일 스크림보다 무겁다.
            backdrop: { value: 'rgba(6, 5, 5, 0.72)' },
            fg: { value: '#FAFAF9' },
          },
        },
      },

      // 컴포넌트가 부르는 모든 색이 여기서 나와야 다크 모드가 호출부마다 다시
      // 파생되지 않고 한 번만 정의된다.
      semanticTokens: {
        colors: {
          bg: {
            // 페이지. 순수한 검정이 아니라 검정에 가까운 색이다. 순수한 검정은 OLED에서
            // 잘리고, 그 위에 뜬 면이 회색으로 보이지 않고 밝아질 여지를 남기지 않는다.
            DEFAULT: {
              value: { base: '{colors.neutral.0}', _dark: '{colors.neutral.950}' },
            },
            // 파여 들어간 면 — 검색 필드, 텍스트 입력, 컨트롤이 *위*가 아니라 *안*에
            // 앉는 우물.
            subtle: {
              value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.900}' },
            },
            // 카드·바텀시트·다이얼로그 — 페이지 평면 위에 뜬 것. 두 스킴에서 `bg`로부터
            // 대비 한 칸씩, 서로 반대 방향으로 떨어져 있어 "떠 있음"이 늘 "밝음"이 아니라
            // "페이지에서 멀어짐"을 뜻한다.
            elevated: {
              value: { base: '{colors.neutral.50}', _dark: '{colors.neutral.900}' },
            },
            // 떠 있는 면이 포인터 아래에서 되는 것.
            elevatedHover: {
              value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.800}' },
            },
          },

          fg: {
            // 다크에서 순수한 흰색인 것은 의도다 — 화면에서 흐려 보이지 않고 인쇄된
            // 것처럼 보여야 하는 유일한 것이다.
            DEFAULT: {
              value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.0}' },
            },
            muted: {
              value: { base: '{colors.neutral.600}', _dark: '{colors.neutral.400}' },
            },
            subtle: {
              value: { base: '{colors.neutral.400}', _dark: '{colors.neutral.500}' },
            },
            // 반전된 채움 위에 그려지는 글자(보조 버튼).
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
            // 보이라고 있는 테두리 — 선택되지 않은 칩의 외곽선.
            strong: {
              value: { base: '{colors.neutral.300}', _dark: '{colors.neutral.700}' },
            },
          },

          accent: {
            // 채움. 두 스킴에서 같다.
            DEFAULT: { value: '{colors.brand.500}' },
            hover: {
              value: { base: '{colors.brand.600}', _dark: '{colors.brand.400}' },
            },
            // 강조색 채움 위에 앉는 글자·아이콘 색.
            //
            // 테마를 따르지 않고 *두 스킴 모두* 검정에 가깝다. 강조색 위의 흰색은 어느
            // 크기에서도 대비를 통과하지 못한다.
            fg: { value: '{colors.neutral.950}' },
            // 페이지 배경 위의 *글자*로서의 강조색. 채움 색은 흰 배경에서 대비가
            // 모자라므로 라이트에서는 어둡게, 다크에서는 밝게 민다.
            text: {
              value: { base: '{colors.brand.700}', _dark: '{colors.brand.400}' },
            },
            // 틴트된 면. 지금 쓰는 곳은 미리보기 모드 배너뿐이다.
            subtle: {
              value: { base: '{colors.brand.50}', _dark: '{colors.brand.tintDark}' },
            },
            // 포커스 링. 링을 그릴 수 있는 유일한 색이다.
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
          // FAB. 임의의 사진 위에서도 읽혀야 한다.
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
       * 타입 스케일.
       *
       * mapsy는 웹폰트를 싣지 않는다 — 스택은 OS가 시스템 산세리프라 부르는 것이고,
       * 노리는 기기에서는 이미 좋은 한글 서체다. 그래서 타이포그래피의 정체성이
       * 글자꼴이 아니라 스케일에서 나와야 한다 — 두꺼운 굵기, 큰 것에는 좁은 자간,
       * 그리고 다섯 크기에서 끊기.
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
        // 컨트롤 — 칩, 버튼, 탭.
        label: {
          value: { fontSize: '0.8125rem', lineHeight: '1.3', fontWeight: '600' },
        },
        caption: {
          value: { fontSize: '0.75rem', lineHeight: '1.4', fontWeight: '500' },
        },
        // 필드 캡션과 눈썹 텍스트. 자간이 12px 볼드 한글이 덩어리로 뭉치는 것을 막는다.
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
       * 포커스 링, 한 번만 정의한다.
       *
       * 호출부마다 적어두면 그 수만큼 1px이나 다른 색이 될 기회가 생긴다. layerStyle이
       * 맞는 모양이다 — 자기 `_focusVisible` 조건을 싣고 다녀서, 적용은
       * `layerStyle: 'focusable'` 한 줄이면 끝난다.
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
        // 같은 링을 요소 안쪽에 그린다. 스크롤되는 조상에게 잘리는 것들용 —
        // 사진 스트립의 타일, 레일의 칩.
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
      // index.html이 viewport-fit=cover라 레이아웃이 노치와 홈 인디케이터 아래까지
      // 닿는다. 화면 가장자리에 붙은 것이 스스로 패딩을 되돌릴 때만 안전하다 — 아니면
      // FAB가 홈 인디케이터 밑에 앉는다. 인셋을 평범한 커스텀 프로퍼티로(0px 대체값과
      // 함께) 노출하면 어떤 규칙이든 calc()로 조합할 수 있다.
      '--safe-t': 'env(safe-area-inset-top, 0px)',
      '--safe-b': 'env(safe-area-inset-bottom, 0px)',
    },
    html: {
      // 네이티브 컨트롤(스크롤바, 폼 위젯, 주소창)도 OS 스킴을 따르게 해서, 토큰
      // 둘레의 크롬이 그것들과 싸우지 않게 한다.
      colorScheme: 'light dark',
      // 앱은 폰 폭 컬럼이다. 넓은 창에서 그 뒤 페이지도 같은 색이라 컬럼이 흰 액자
      // 안에 놓이지 않는다.
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
      // 칩이나 카드를 누르면 그것이 일으키는 상태 변화로 보여야지, 뒤에서 회색 사각형이
      // 번쩍이는 것으로 보이면 안 된다.
      WebkitTapHighlightColor: 'transparent',
    },
    // Ark UI의 다이얼로그가 이 속성으로 스크롤을 잠근다. 규칙이 없으면 iOS에서 시트 뒤
    // 페이지가 끌기에 여전히 움직인다.
    'body[data-scroll-locked]': {
      overflow: 'hidden',
    },
  },
})
