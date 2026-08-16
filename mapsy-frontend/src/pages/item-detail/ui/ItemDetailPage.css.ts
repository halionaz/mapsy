import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { skeletonSurface } from '@/shared/ui/Skeleton.css'

export const body = vstack({ gap: '7', alignItems: 'stretch' })

export const actions = hstack({ gap: '2' })

export const photoSection = vstack({ gap: '3', alignItems: 'stretch' })

/**
 * 전폭, 한 화면에 사진 한 장.
 *
 * 패딩도 간격도 없어 타일이 정확히 컬럼 폭이고 스와이프 한 번이 정확히 사진 한 장을
 * 옮긴다. 이전 판본은 본문 패딩만큼 스트립을 들여 이웃이 살짝 보이게 했다 — 더 있다는
 * 것은 광고했지만 어떤 사진도 온전히 보이지 않았고, 옷 자신의 사진이 화면을 채우지 못하는
 * 유일한 것이 되었다. 스트립 아래의 점이 폭을 쓰지 않고 같은 말을 한다.
 */
export const strip = css({
  display: 'flex',
  gap: '0',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
})

export const tile = css({
  flex: '0 0 100%',
  // `center`가 아니라 `start`. 타일이 스트립과 정확히 같은 폭이면 둘이 같지만, 컬럼에
  // 언젠가 패딩이 생기면 `start`는 계속 맞고 가운데 정렬은 스냅마다 패딩 절반씩 어긋난다.
  scrollSnapAlign: 'start',
  cursor: 'zoom-in',
  _disabled: { cursor: 'default' },
  // 링을 타일 안쪽에 그린다. 스트립이 x로 스크롤되면 overflow-y도 auto로 계산되어,
  // 바깥으로 오프셋된 링은 네 변 모두 잘린다.
  layerStyle: 'focusableInset',
})

export const dots = hstack({ gap: '1.5', justify: 'center', height: '1.5' })

export const dot = css({
  width: '1.5',
  height: '1.5',
  rounded: 'full',
  bg: 'border.strong',
  transitionProperty: 'background-color, width',
  transitionDuration: 'fast',
  // 현재 페이지는 더 큰 원이 아니라 알약이다 — 6px에서는 지름 변화가 읽히지 않는다.
  '&[data-current]': { width: '4', bg: 'accent' },
})

export const disposedNotice = hstack({
  gap: '2',
  px: '4',
  py: '3',
  rounded: 'field',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
})

export const fields = vstack({ gap: '0', alignItems: 'stretch' })

/**
 * 필드 하나를, 아래 실선을 두른 행으로.
 *
 * 목록이 갖던 간격이 아니라 실선이다. 여백에 떠 있는 라벨/값 열한 쌍은, 값이 두 줄로
 * 넘어가는 순간 어느 값이 어느 라벨의 것인지 말해주는 것이 없는 글의 벽이 된다.
 * 행마다의 실선이 표를 그리지 않고 표로 만든다.
 */
export const row = css({
  display: 'flex',
  gap: '4',
  alignItems: 'flex-start',
  py: '3',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderColor: 'border.subtle',
  '&:last-of-type': { borderBottomWidth: '0' },
})

export const rowLabel = css({
  width: '68px',
  flexShrink: 0,
  textStyle: 'caption',
  color: 'fg.muted',
  pt: '0.5',
})

export const rowValue = css({ m: '0', flex: '1', textStyle: 'body', whiteSpace: 'pre-wrap' })

export const emptyValue = css({ color: 'fg.subtle' })

export const srOnly = css({ srOnly: true })

export const colorList = hstack({ gap: '3', flexWrap: 'wrap' })

export const colorItem = hstack({ gap: '1.5' })

/** 텍스트 한 줄만큼의 자리표시자를, 그 텍스트의 베이스라인 위에. */
export const valueBar = cx(
  skeletonSurface,
  css({ display: 'inline-block', height: '2.5', rounded: 'sm', verticalAlign: 'middle' }),
)

/**
 * 버튼처럼 생겼지만 버튼이 아닌 상자.
 *
 * 진짜 버튼의 높이를 빌려 예약할 자리를 정확히 맞추고, 눌릴 수 있다고 약속하는 것은
 * 전부 돌려준다 — 커서도 hover도 없고, 위 블록의 `aria-hidden`이 보조기술에서 떼어놓는다.
 */
const inertButton = cx(skeletonSurface, css({ minHeight: 'tap', rounded: 'full' }))

export const inertButtonWide = cx(inertButton, css({ flex: '1' }))

export const inertButtonNarrow = cx(inertButton, css({ width: '24' }))
