import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { appBarBox } from '@/shared/ui/AppBar.css'
import { buttonStyle, iconButtonStyle } from '@/shared/ui/Button.css'
import { skeletonSurface } from '@/shared/ui/Skeleton.css'

export const page = vstack({ gap: '0', alignItems: 'stretch', flex: '1' })

/**
 * 홈 화면 상단의 바 — 옷장의 이름과 설정으로 가는 길.
 *
 * 세로 여백은 하위 화면의 바가 입는 것과 같은 `appBarBox`라, 옷에 들어갔다 나와도 바가
 * 제자리에 있다. 가로 인셋만 이 화면의 것이고, 아래의 모든 것이 그것에 맞춘다.
 */
export const titleBlock = css(appBarBox, { px: '5' })

export const titleRow = hstack({ justify: 'space-between' })

export const title = css({ textStyle: 'title' })

export const titleCount = css({ ml: '2', color: 'fg.subtle' })

/**
 * 설정 버튼을 화면의 광학적 여백까지 끌어낸다.
 *
 * 탭 타겟 안의 글리프는 양옆에 공기를 두르고 있어서, *상자*가 페이지 인셋에서 끝나면
 * 글리프는 그만큼 더 안쪽에서 끝난다 — 아래 필터 버튼은 채워져 있어 눈이 상자에 줄을
 * 맞추므로 눈에 띈다. 그 공기만큼 상자를 빼면 보이는 오른쪽 가장자리 둘이 한 줄에 서고
 * 탭 타겟은 온전히 남는다.
 */
export const settingsLink = cx(iconButtonStyle(), css({ mr: '-3' }))

/**
 * 고정되는 컨트롤 바.
 *
 * 처음부터 불투명하다. 사진 격자 위에 고정되므로 투명하면 사진이 밑으로 흘러 지나간다.
 * 쉬는 동안에는 아무것도 밑을 지나지 않고 뒤의 셸이 같은 색이라, 붙는 순간 바뀌는 것은
 * 실선뿐이다 — 더 일찍 그리면 아무것도 없는 것을 두르는 테두리가 된다.
 */
export const controls = css({
  position: 'sticky',
  // 뷰포트 가장자리가 아니라 인셋 *아래*에 고정한다 — 검색 필드가 시계 밑에 앉지 않도록.
  // 인셋 자체는 `titleBlock`이 한 번 센다. 여기서도 더하면 노치 있는 폰마다 제목과
  // 검색창 사이에 47px의 빈 띠가 생긴다. 바가 자라는 대신 기준점을 옮긴다.
  top: 'var(--safe-t)',
  zIndex: 'header',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  pt: '1',
  pb: '3',
  bg: 'bg',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderColor: 'transparent',
  transitionProperty: 'border-color',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-stuck]': { borderColor: 'border.subtle' },
  _motionReduce: { transitionDuration: '1ms' },
})

/**
 * 고정된 바 위의 안전영역 띠를 덮는다. 고정된 동안에만.
 *
 * 창이 아니라 앱 컬럼으로 제한한다 — 셸이 컬럼을 가운데 두므로, 전폭 띠는 태블릿에서
 * 컬럼 양옆의 페이지까지 칠한다.
 */
export const statusStripScrim = css({
  position: 'fixed',
  top: '0',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  width: 'full',
  maxWidth: 'app',
  height: 'var(--safe-t)',
  zIndex: 'header',
  bg: 'bg',
  opacity: 0,
  pointerEvents: 'none',
  transitionProperty: 'opacity',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-stuck]': { opacity: 1 },
  _motionReduce: { transitionDuration: '1ms' },
})

/**
 * 목록이 최신이 아닐 수 있다고 말하는 줄. 경고가 아니라 안내다.
 *
 * `danger`로 그리지 않는다 — 화면의 옷은 진짜고 몇 분 지났을 뿐인데, 그것을 되돌릴 수
 * 없는 행동과 같은 빨강으로 칠하면 세 단계의 심각도가 하나로 뭉개진다.
 */
export const staleNotice = hstack({
  gap: '2',
  mb: '4',
  px: '3',
  py: '2',
  rounded: 'field',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
})

export const staleIcon = css({ flexShrink: 0 })

export const staleText = css({ flex: '1' })

export const searchRow = hstack({ gap: '2', px: '5' })

export const searchBox = css({ position: 'relative', flex: '1' })

export const searchIcon = css({
  position: 'absolute',
  left: '4',
  top: '50%',
  translate: 'auto',
  translateY: '-1/2',
  color: 'fg.subtle',
  pointerEvents: 'none',
})

// 레시피에 variant가 없는 것만 — 배지가 이 버튼을 기준으로 절대 배치되므로 컨테이닝
// 블록이 필요하다.
export const filterButton = css({ position: 'relative' })

export const badge = css({
  position: 'absolute',
  top: '1',
  right: '1',
  display: 'grid',
  placeItems: 'center',
  minWidth: '4',
  height: '4',
  px: '1',
  rounded: 'full',
  bg: 'accent',
  color: 'accent.fg',
  fontSize: '2xs',
  fontWeight: 'bold',
})

export const rail = css({
  display: 'flex',
  gap: '2',
  overflowX: 'auto',
  px: '5',
  // 칩은 탭 타겟 바닥보다 낮다. 이 패딩이 행 전체를 편한 타겟으로 만든다.
  py: '1',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
})

export const main = css({
  flex: '1',
  display: 'flex',
  flexDirection: 'column',
  px: '5',
  pt: '4',
  pb: 'calc({spacing.24} + var(--safe-b))',
})

export const srOnly = css({ srOnly: true })

export const stack = vstack({ gap: '4', alignItems: 'stretch' })

/**
 * 격자 위의 개수·정렬 줄.
 *
 * 높이를 고정해 로딩 상태가 정확히 이만큼을 예약할 수 있게 한다 — 스스로 높이를 재는
 * 행은 자리표시자가 맞출 수 없는 행이고, 데이터가 도착하는 순간 격자가 그 높이만큼
 * 떨어진다. 스켈레톤이 막으려던 바로 그 재배치다.
 */
export const listMeta = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '9',
})

export const listCount = css({ textStyle: 'caption', color: 'fg.muted' })

export const listMetaSkeletonBar = cx(
  skeletonSurface,
  css({ width: '10', height: '2.5', rounded: 'sm' }),
)

/**
 * 홈 인디케이터 위에 고정되는 등록 버튼.
 *
 * 구석이 아니라 가운데다. 한 손으로 쓰는 화면이고, 아래 가장자리의 한가운데가 양쪽 엄지가
 * 모두 닿는 자리다. `fixed`가 뷰포트를 기준으로 놓고, 앱 컬럼도 가운데라 둘이 맞는다.
 *
 * 글로우는 이 버튼만의 것이다. 옆의 착용 버튼은 강조색이 아니라 표면 위에 그려지고,
 * 중립 알약 밑의 강조색 그림자는 그 버튼에서 유일하게 주황인 것이 되어 렌더링 실수로 읽힌다.
 */
export const fab = cx(
  buttonStyle(),
  css({
    position: 'fixed',
    bottom: 'calc({spacing.6} + var(--safe-b))',
    left: '50%',
    translate: 'auto',
    translateX: '-1/2',
    zIndex: 'fab',
    boxShadow: 'fab',
  }),
)

/**
 * 착용 버튼이 앉는 자리 — 앱 컬럼의 오른쪽 끝, 등록 버튼과 같은 줄.
 *
 * 고정 오프셋이 아니라 전폭 슬롯인 것은 여기서 "오른쪽"이 창이 아니라 컬럼의 가장자리를
 * 뜻하기 때문이다. 셸이 컬럼을 가운데 두므로 더 넓은 화면에서는 버튼이 페이지 여백으로
 * 떠내려간다.
 *
 * 슬롯에는 `pointerEvents: none`, 자식에는 다시 auto. 슬롯이 카드 마지막 행 높이에서
 * 컬럼 전체를 가로지르므로, 탭을 먹는 보이지 않는 띠는 격자가 고장 난 것처럼 읽힌다.
 */
export const wearFabSlot = css({
  position: 'fixed',
  bottom: 'calc({spacing.6} + var(--safe-b))',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  zIndex: 'fab',
  display: 'flex',
  justifyContent: 'flex-end',
  width: 'calc(100vw - {spacing.10})',
  maxWidth: 'calc({sizes.app} - {spacing.10})',
  pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
})
