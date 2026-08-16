import { css } from 'styled-system/css'

export const backdrop = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  bg: 'overlay.backdrop',
  // 뒤가 사진 격자라, 평평한 틴트만으로는 여전히 누를 수 있는 콘텐츠로 읽힌다.
  backdropFilter: 'blur(3px)',
  '&[data-state=open]': { animation: 'fadeIn' },
  '&[data-state=closed]': { animation: 'fadeOut' },
})

export const positioner = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
})

export const content = css({
  display: 'flex',
  flexDirection: 'column',
  width: 'full',
  // 앱 컬럼과 같은 폭 — 넓은 창에서 시트가 데스크톱 전체가 아니라 폰 안에서 올라온다.
  maxWidth: 'app',
  /**
   * 시트에서 나가는 두 길(손잡이, 그 위의 백드롭)이 모두 위쪽 가장자리에 있다. 시트가
   * 높이 올라올수록 둘 다 엄지가 가장 늦게 닿는 곳으로 간다. 대가는 안쪽이 치르고,
   * 필터 시트의 목록은 이보다 길어서 스크롤한다.
   */
  maxHeight: '60dvh',
  bg: 'bg.elevated',
  color: 'fg',
  roundedTop: 'sheet',
  boxShadow: 'sheet',
  // 시트가 화면 아래 끝까지 닿으므로 마지막 컨트롤을 홈 인디케이터에서 띄우는 건 시트의 몫.
  pb: 'var(--safe-b)',
  overflow: 'hidden',
  // 스냅백. 손가락이 닿아 있는 동안은 Ark가 인라인으로 0으로 만든다.
  transitionProperty: 'transform',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-state=open]': { animation: 'sheetIn' },
  '&[data-state=closed]': { animation: 'sheetOut' },
  _motionReduce: {
    transitionDuration: '1ms',
    '&[data-state=open]': { animation: 'fadeIn' },
    '&[data-state=closed]': { animation: 'fadeOut' },
  },
})

/** 보이는 손잡이는 36×4지만, 시트를 끌 수 있는 유일한 자리라 상자는 44px로 잡는다. */
export const grabber = css({
  display: 'grid',
  placeItems: 'center',
  minHeight: 'tap',
  cursor: 'grab',
  '&[data-dragging]': { cursor: 'grabbing' },
})

export const grabberBar = css({
  width: '9',
  height: '1',
  rounded: 'full',
  bg: 'border.strong',
  transitionProperty: 'background-color',
  transitionDuration: 'fast',
  '[data-dragging] &': { bg: 'fg.subtle' },
})

export const header = css({
  px: '5',
  pb: '3',
})

export const title = css({ textStyle: 'heading' })

export const srOnly = css({ srOnly: true })

export const body = css({
  flex: '1',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  px: '5',
  pb: '5',
})

export const footer = css({
  display: 'flex',
  gap: '2',
  px: '5',
  pt: '3',
  pb: '4',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'border.subtle',
  bg: 'bg.elevated',
})
