import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

export const block = vstack({
  gap: '3',
  justify: 'center',
  flex: '1',
  py: '16',
  px: '6',
  textAlign: 'center',
})

const badgeBase = {
  display: 'grid',
  placeItems: 'center',
  width: '14',
  height: '14',
  rounded: 'full',
  mb: '1',
} as const

// 아이콘이 배경 위에 홀로 놓이면 깨진 이미지처럼 보인다. 틴트된 원 안에 앉힌다.
export const neutralBadge = css({ ...badgeBase, bg: 'bg.subtle', color: 'fg.subtle' })
export const dangerBadge = css({ ...badgeBase, bg: 'danger.subtle', color: 'danger' })

export const title = css({ textStyle: 'heading' })

export const description = css({
  textStyle: 'body',
  color: 'fg.muted',
  maxWidth: 'field',
  wordBreak: 'keep-all',
})

export const action = css({ mt: '2' })
