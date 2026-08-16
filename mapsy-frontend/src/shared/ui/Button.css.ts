import { css, cva } from 'styled-system/css'

/**
 * 버튼과, 버튼처럼 그려지는 링크.
 *
 * 컴포넌트가 아니라 레시피로도 내보내는 이유는 react-router `<Link>`가 여러 화면에서
 * 버튼 노릇을 하기 때문이다. 그래서 상호작용 상태를 `_enabled`가 아니라 `:not(:disabled)`로
 * 막는다 — `_enabled`는 `:enabled`로 컴파일되고 `<a>`는 `:enabled`에도 `:disabled`에도
 * 걸리지 않아, 링크의 hover·press가 조용히 사라진다.
 */
export const buttonStyle = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    flexShrink: 0,
    textStyle: 'label',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    transitionProperty: 'background-color, border-color, color, transform, opacity',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    // 버튼 안의 모든 글리프를 버튼이 재운다 — 호출부가 크기를 넘기지 않아도
    // 아이콘과 스피너가 같은 크기로 맞는다.
    '& > svg': {
      width: 'var(--button-icon)',
      height: 'var(--button-icon)',
      flexShrink: 0,
    },
    _disabled: {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    // 터치 화면에서는 탭 후 hover가 남으므로 hover 가능한 포인터에서만.
    '@media (hover: hover)': {
      '&:hover:not(:disabled)': { transform: 'scale(1.03)' },
    },
    '&:active:not(:disabled)': { transform: 'scale(0.97)' },
    _motionReduce: {
      '@media (hover: hover)': {
        '&:hover:not(:disabled)': { transform: 'none' },
      },
      '&:active:not(:disabled)': { transform: 'none' },
    },
  },

  variants: {
    variant: {
      solid: {
        bg: 'accent',
        color: 'accent.fg',
        '&:hover:not(:disabled)': { bg: 'accent.hover' },
      },
      /** 강조색을 쓰지 않고 대비를 최대로 — 강조색이 두 번째 CTA가 될 자리에. */
      inverted: {
        bg: 'fg',
        color: 'fg.inverted',
        '&:hover:not(:disabled)': { opacity: 0.88 },
      },
      outline: {
        bg: 'transparent',
        color: 'fg',
        borderColor: 'border.strong',
        '&:hover:not(:disabled)': { bg: 'bg.subtle', borderColor: 'fg.subtle' },
      },
      /** 사진 위에 뜨는 컨트롤용 — `outline`의 투명 배경으로는 라벨이 읽히지 않는다. */
      surface: {
        bg: 'bg.elevated',
        color: 'fg',
        borderColor: 'border.strong',
        '&:hover:not(:disabled)': { bg: 'bg.elevatedHover', borderColor: 'fg.subtle' },
      },
      ghost: {
        bg: 'transparent',
        color: 'fg.muted',
        '&:hover:not(:disabled)': { bg: 'bg.subtle', color: 'fg' },
      },
      /** 여러 선택지 중 하나로 놓인 삭제 — 텍스트 버튼 형태. */
      danger: {
        bg: 'transparent',
        color: 'danger',
        '&:hover:not(:disabled)': { bg: 'danger.subtle' },
      },
      /**
       * 그 행동만을 위한 화면의 확인 버튼 — 채워진 파괴적 버튼.
       *
       * `solid` 위에 빨간 배경을 `cx`로 얹지 않는다. `cx`는 클래스 이름을 잇기만 해서
       * 같은 속성을 쓰는 두 클래스는 특이도가 같고, 승자는 Panda가 나중에 쓴 쪽이다.
       */
      destructive: {
        bg: 'danger',
        color: 'danger.fg',
        '&:hover:not(:disabled)': { opacity: 0.88 },
      },
    },

    /** `--button-icon`도 사이즈의 일부다 — 기본값이 레시피 한 곳에서만 정해지도록. */
    size: {
      sm: { minHeight: '9', px: '3.5', '--button-icon': '14px' },
      md: { minHeight: 'tap', px: '5', '--button-icon': '16px' },
      lg: { minHeight: '12', px: '6', textStyle: 'subheading', '--button-icon': '18px' },
    },

    /** 단독 액션은 `pill`, 전폭 행이 쌓이는 곳은 `block`. */
    shape: {
      pill: { rounded: 'full' },
      block: { rounded: 'field' },
    },

    /**
     * 줄의 나머지를 채운다.
     *
     * flex 행 안에서 `width: 100%`는 상한이 아니라 basis라, base의 `flexShrink: 0`과
     * 만나면 줄이 넘친다. `minWidth: 0`은 라벨이 `nowrap`이라 자동 최소 크기가
     * 라벨 전체 너비가 되는 것을 푼다.
     */
    full: {
      true: { width: 'full', flexShrink: 1, minWidth: 0 },
    },
  },

  defaultVariants: {
    variant: 'solid',
    size: 'md',
    shape: 'pill',
    full: false,
  },
})

/**
 * 글리프 하나만 담는 정사각 타겟.
 *
 * `buttonStyle`의 사이즈는 패딩으로 만들어져 정사각이 될 수 없고, 라벨용 `px`를
 * 도로 지워야 한다. 별개 레시피가 그것을 취소하는 variant보다 짧다.
 */
export const iconButtonStyle = cva({
  base: {
    display: 'inline-grid',
    placeItems: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    color: 'fg.muted',
    transitionProperty: 'background-color, color, transform',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    // 옷장 헤더의 설정 버튼이 <Link>다 — `_enabled`는 링크에 걸리지 않는다.
    '&:hover:not(:disabled)': { color: 'fg', bg: 'bg.subtle' },
    '&:active:not(:disabled)': { transform: 'scale(0.92)' },
    _disabled: { opacity: 0.35, cursor: 'not-allowed' },
    _motionReduce: { '&:active:not(:disabled)': { transform: 'none' } },
  },
  variants: {
    size: {
      sm: { width: '8', height: '8' },
      md: { width: 'tap', height: 'tap' },
    },
    /** 필드 행에 끼는 버튼은 `square`, 홀로 떠 있는 버튼은 `circle`. */
    shape: {
      circle: { rounded: 'full' },
      square: { rounded: 'field' },
    },
    /** hover 때만이 아니라 평소에도 표면을 준다. */
    filled: {
      true: { bg: 'bg.subtle' },
    },
    /** 사진 위 — 페이지 색으로는 대비가 나오지 않는 자리. */
    onPhoto: {
      true: {
        color: 'overlay.fg',
        bg: 'overlay.scrim',
        backdropFilter: 'blur(6px)',
        '&:hover:not(:disabled)': { color: 'overlay.fg', bg: 'overlay' },
      },
    },
    active: {
      true: { color: 'accent.text' },
    },
  },
  defaultVariants: {
    size: 'md',
    shape: 'circle',
    filled: false,
    onPhoto: false,
    active: false,
  },
})

export const spinner = css({
  animation: 'spin',
  _motionReduce: { animation: 'none', opacity: 0.6 },
})
