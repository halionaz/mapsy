import { css, cx } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import { skeletonSurface } from '@/shared/ui/Skeleton.css'

export const stack = vstack({ gap: '2', alignItems: 'stretch' })

/**
 * `display: block`인 것은 이것이 `<span>`이기 때문이고, span인 것은
 * `SelectableItemCard`가 카드 전체를 `<button>`으로 감싸기 때문이다 — 버튼의 콘텐츠
 * 모델은 phrasing content라 `<p>`는 잘못된 마크업이다.
 */
export const title = css({
  display: 'block',
  textStyle: 'caption',
  color: 'fg',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

/**
 * 제목 아래 한 줄 — 옷 카드에서는 색 점, 등록 중인 카드에서는 업로드 상태.
 * 높이를 고정해 비어 있을 때도 같은 자리를 차지한다. 그것이 색 없는 옷을 색 있는 옷과
 * 같은 크기로 유지한다.
 */
export const metaRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1',
  // 물려받은 line-height의 캡션 한 줄. 색 점이 있든 "저장 중"이든 비어 있든 같은 높이.
  height: '4.5',
  // 카드 폭은 페이지의 1/3에서 여백 둘을 뺀 것이라 가장 좁은 화면에서 100px이 안 된다.
  // 줄이 자라게 두는 대신 잘라 격자의 행 높이를 맞춘다.
  overflow: 'hidden',
})

/** 색 점. 자리가 모자랄 때 양보하는 쪽이다. */
export const swatches = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1',
  overflow: 'hidden',
  flexShrink: 1,
  minWidth: 0,
})

/**
 * 마지막으로 입은 때, 메타 행의 끝에.
 *
 * `flexShrink: 0`이라 점이 먼저 잘린다. 반쯤 잘린 점의 행은 "색이 더 있음"으로 읽히지만
 * 잘린 날짜는 버그로 읽힌다.
 */
export const wornAgo = css({
  ml: 'auto',
  pl: '1',
  flexShrink: 0,
  textStyle: 'caption',
  color: 'fg.subtle',
  whiteSpace: 'nowrap',
})

export const tile = cx(
  stack,
  css({
    rounded: 'card',
    transitionProperty: 'transform',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    // hover 가능한 포인터에서만. 터치 화면에서는 탭 뒤에 `:hover`가 남아 눌린 타일이
    // 행 위에 떠 있게 된다.
    '@media (hover: hover)': {
      _hover: { transform: 'translateY(-3px)' },
    },
    _motionReduce: {
      '@media (hover: hover)': { _hover: { transform: 'none' } },
    },
  }),
)

/**
 * 버튼에게 자신이 카드임을 알려준다.
 *
 * Panda의 preflight가 채움·테두리·글꼴을 이미 벗기므로, 여기 남는 것은 `tile`이
 * 전제하는데 `<button>`이 주지 않는 것뿐이다.
 */
export const selectableTile = cx(
  tile,
  css({
    width: 'full',
    textAlign: 'left',
    cursor: 'pointer',
  }),
)

/**
 * 선택된 사진을 두르는 강조색 테두리.
 *
 * 테두리가 아니라 inset 그림자인 것은 `SquarePhoto`가 자식을 잘라내기 때문이다 — inset은
 * 둥근 모서리에 정확히 앉지만 border는 그 바깥에 걸린다. 사진 *위에* 그려지는 것도
 * 요점이다 — 타일 바깥의 링은 격자의 홈에 묻힌다.
 */
export const selectedRing = css({
  position: 'absolute',
  inset: '0',
  rounded: 'card',
  boxShadow: 'inset 0 0 0 3px {colors.accent}',
  pointerEvents: 'none',
})

/**
 * 체크는 왼쪽 위 — 즐겨찾기 별의 반대 모서리라, 즐겨찾기한 옷을 골라도 배지가 겹치지 않는다.
 *
 * 선택되지 않았을 때도 빈 채로 있다. 체크된 뒤에야 나타나는 체크박스는 첫 탭을 광고하지
 * 못한다 — 카드가 선택 가능해졌다고 말해주는 것이 격자에 하나도 없게 된다.
 */
export const checkBadge = css({
  position: 'absolute',
  top: '1.5',
  left: '1.5',
  display: 'grid',
  placeItems: 'center',
  width: '5',
  height: '5',
  rounded: 'full',
  bg: 'overlay.scrim',
  backdropFilter: 'blur(4px)',
  boxShadow: 'inset 0 0 0 1.5px {colors.overlay.fg}',
  color: 'overlay.fg',
  '&[data-selected]': {
    bg: 'accent',
    boxShadow: 'none',
    color: 'accent.fg',
  },
})

/**
 * 임의의 사진 위에 놓이는 별.
 *
 * text-shadow를 두른 맨 글리프가 아니라 틴트된 원반이다. 그림자는 밝은 별과 밝은 사진을
 * 흐림으로만 갈라놓아, 흰옷 위에서는 회색 얼룩이 된다. 스크림 원반은 무엇 위에서든 같은
 * 대비를 낸다.
 */
export const favoriteBadge = css({
  position: 'absolute',
  top: '1.5',
  right: '1.5',
  display: 'grid',
  placeItems: 'center',
  width: '5',
  height: '5',
  rounded: 'full',
  bg: 'overlay.scrim',
  backdropFilter: 'blur(4px)',
  color: 'accent',
})

/** 사진 낮추기가 아니라 스크림 — 어두운 옷 위에서도 흰옷 위에서도 같게 읽힌다. */
export const uploadingScrim = css({
  position: 'absolute',
  inset: '0',
  display: 'grid',
  placeItems: 'center',
  bg: 'overlay.scrim',
  color: 'overlay.fg',
})

export const failedText = css({ textStyle: 'caption', color: 'danger' })

export const uploadingText = css({ textStyle: 'caption', color: 'fg.muted' })

export const errorDetail = css({
  fontSize: '2xs',
  color: 'fg.muted',
  lineHeight: 'tight',
  wordBreak: 'break-word',
})

export const repair = vstack({ gap: '1.5', alignItems: 'stretch' })

/** 나란히가 아니라 쌓는다. 격자 한 칸에 라벨 붙은 버튼 둘이 가로로 들어가지 않는다. */
export const repairActions = vstack({ gap: '1', alignItems: 'stretch' })

/** 진짜 제목이 도착해도 아무것도 움직이지 않도록, 줄 높이의 상자 안에 텍스트 높이의 막대. */
export const skeletonTitleRow = css({ height: '4.5', display: 'flex', alignItems: 'center' })

export const skeletonTitleBar = cx(
  skeletonSurface,
  css({ height: '2.5', width: '4/5', rounded: 'sm' }),
)
