import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

export const page = vstack({ gap: '8', alignItems: 'stretch' })

export const section = vstack({ gap: '3', alignItems: 'stretch' })

export const sectionTitle = css({ textStyle: 'subheading', color: 'fg' })

export const count = css({ ml: '2', color: 'fg.subtle' })

export const card = css({
  p: '4',
  rounded: 'field',
  bg: 'bg.elevated',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border.subtle',
})

export const account = hstack({ gap: '3' })

export const accountText = css({ minWidth: 0 })

export const email = css({ textStyle: 'bodyStrong', truncate: true })

export const emailNote = css({ textStyle: 'caption', color: 'fg.muted' })

export const avatar = css({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: '11',
  height: '11',
  rounded: 'full',
  bg: 'accent',
  color: 'accent.fg',
  textStyle: 'heading',
})

export const emptyNote = hstack({
  gap: '2',
  px: '4',
  py: '4',
  rounded: 'field',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
})

// 옷장 격자와 같은 세 열. `minmax(0, 1fr)`의 이유는 WardrobeGrid.css.ts에 있다.
export const grid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  '& > li': { minWidth: 0 },
  gap: '3',
  listStyle: 'none',
  p: '0',
  m: '0',
})
