import { css } from 'styled-system/css'

export const root = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '2.5',
  width: 'fit-content',
  maxWidth: 'min(22rem, calc(100vw - 2rem))',
  px: '4',
  py: '3',
  bg: 'bg.elevated',
  color: 'fg',
  rounded: 'field',
  boxShadow: 'raised',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  // 위치·스택·안전영역 인셋은 전부 Ark 머신이 계산해 커스텀 프로퍼티로 내려준다.
  // 여기서 `bottom`이나 `transform`을 쓰는 것은 토스트가 몇 개인지 아는 쪽을 덮는 일이다.
  translate: 'var(--x) var(--y)',
  opacity: 'var(--opacity)',
  zIndex: 'var(--z-index)',
  willChange: 'translate, opacity',
  transitionProperty: 'translate, opacity',
  transitionDuration: 'slow',
  transitionTimingFunction: 'out',
  _motionReduce: { transitionDuration: '1ms' },
  layerStyle: 'focusable',
})

export const title = css({ textStyle: 'label' })

export const description = css({ textStyle: 'caption', color: 'fg.muted', mt: '0.5' })

export const errorIcon = css({ color: 'danger', flexShrink: 0 })
export const successIcon = css({ color: 'accent.text', flexShrink: 0 })
export const infoIcon = css({ color: 'fg.muted', flexShrink: 0 })
