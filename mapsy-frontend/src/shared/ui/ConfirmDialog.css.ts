import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

export const backdrop = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  bg: 'overlay.backdrop',
  backdropFilter: 'blur(3px)',
  '&[data-state=open]': { animation: 'fadeIn' },
  '&[data-state=closed]': { animation: 'fadeOut' },
})

export const positioner = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  display: 'grid',
  placeItems: 'center',
  p: '6',
})

export const content = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  width: 'full',
  maxWidth: '80',
  p: '6',
  bg: 'bg.elevated',
  color: 'fg',
  rounded: 'sheet',
  boxShadow: 'raised',
  '&[data-state=open]': { animation: 'dialogIn' },
  '&[data-state=closed]': { animation: 'dialogOut' },
  _motionReduce: {
    '&[data-state=open]': { animation: 'fadeIn' },
    '&[data-state=closed]': { animation: 'fadeOut' },
  },
})

export const text = vstack({ gap: '2', alignItems: 'stretch' })

export const title = css({ textStyle: 'heading' })

export const description = css({ textStyle: 'body', color: 'fg.muted' })

export const actions = css({ display: 'flex', gap: '2' })
