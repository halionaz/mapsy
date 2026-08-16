import { css } from 'styled-system/css'

export const floating = css({ boxShadow: 'raised' })

/**
 * 날짜를, 그것이 무엇인지 그대로 그린다.
 *
 * 옆 두 버튼과 같은 높이·같은 반경이라 행이 한 줄에 앉고, "눌러 보세요"라고 말하는
 * 것들은 일부러 하나도 없다 — 테두리도 hover도 포인터도 없고 `fg`가 아니라 `fg.muted`다.
 * 뒤에 피커가 생기기 전까지 이것은 행의 캡션이다.
 */
export const dateLabel = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  minHeight: 'tap',
  px: '4',
  rounded: 'full',
  bg: 'bg.elevated',
  color: 'fg.muted',
  textStyle: 'label',
  whiteSpace: 'nowrap',
  boxShadow: 'raised',
})

/**
 * 홈 인디케이터 위에 고정하되 창이 아니라 앱 컬럼에 맞춘다 — 셸이 컬럼을 가운데 두므로,
 * 전폭 행은 태블릿에서 취소 버튼을 페이지 여백 어딘가로 보낸다.
 */
export const bar = css({
  position: 'fixed',
  bottom: 'calc({spacing.6} + var(--safe-b))',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  zIndex: 'fab',
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  width: 'calc(100vw - {spacing.10})',
  maxWidth: 'calc({sizes.app} - {spacing.10})',
})
