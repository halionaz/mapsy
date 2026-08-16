import { css } from 'styled-system/css'

/** 아래 격자에서 버튼을 띄운다. */
export const floating = css({ boxShadow: 'raised' })

/**
 * 접혀 사라지는 라벨.
 *
 * 텍스트를 언마운트하지 않고 `max-width`를 쓰므로, 버튼이 튀지 않고 몇 프레임에 걸쳐
 * 좁아진다. 음수 마진이 버튼 자신의 `gap`까지 걷어간다 — 없으면 접힌 라벨이 gap이
 * 잡아둔 자리를 그대로 붙들고 있다.
 *
 * 상한은 이 라벨이 가질 수 있는 가장 긴 문자열보다 크기만 하면 된다. 너비가 아니라
 * 트랜지션이 달릴 경계다.
 */
export const collapsible = css({
  display: 'inline-block',
  overflow: 'hidden',
  maxWidth: '12rem',
  whiteSpace: 'nowrap',
  transitionProperty: 'max-width, opacity, margin-left',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-collapsed]': {
    maxWidth: '0',
    opacity: 0,
    ml: '-2',
  },
  _motionReduce: { transitionDuration: '1ms' },
})
