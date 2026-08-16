import { css, cva } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { appBarBox } from './AppBar.css'

export const screen = vstack({ gap: '0', alignItems: 'stretch', flex: '1' })

export const srOnly = css({ srOnly: true })

// 세로 여백은 옷장 화면의 바와 같은 `appBarBox`. `cx`가 아니라 병합이라, 여기서 쓴 값이
// 순서 싸움 없이 이긴다 — AppBar.css.ts 참고.
export const bar = css(
  appBarBox,
  hstack.raw({
    position: 'sticky',
    top: '0',
    zIndex: 'header',
    justify: 'space-between',
    gap: '2',
    px: '2',
    // 처음부터 불투명하다. 콘텐츠 위에 고정되는 바라, 투명하면 사진이 밑으로 흘러 지나간다.
    bg: 'bg',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    // 선은 접힌 제목과 함께 나타난다 — 스크롤 전 화면이 툴바를 덧댄 페이지가 아니라
    // 하나의 면으로 읽히도록.
    borderColor: 'transparent',
    transitionProperty: 'border-color',
    transitionDuration: 'normal',
    '&[data-collapsed]': { borderColor: 'border.subtle' },
  }),
)

export const barTitle = css({
  flex: '1',
  minWidth: 0,
  textStyle: 'subheading',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  opacity: 0,
  translate: 'auto',
  translateY: '4px',
  transitionProperty: 'opacity, translate',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '[data-collapsed] &': { opacity: 1, translateY: '0' },
  _motionReduce: { transitionDuration: '1ms' },
})

/** 액션이 없을 때도 뒤로 버튼과 같은 너비를 잡아, 바 제목이 늘 광학 중앙에 오게 한다. */
export const barActionSlot = css({
  minWidth: 'tap',
  display: 'flex',
  justifyContent: 'flex-end',
})

/**
 * `css()`에 삼항이 아니라 레시피인 이유: Panda는 소스를 읽을 뿐이라
 * `pb: flush ? '0' : '…'`을 꿰뚫어보지 못하고, 두 값 모두 내보내지 않는다.
 *
 * flex 컬럼인 것은 자식이 남은 높이를 가져갈 수 있게 하기 위해서다 — 옷 폼의 액션 바가
 * `margin-top: auto`로 바닥에 붙는다.
 */
export const main = cva({
  base: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    px: '5',
    pt: '5',
  },
  variants: {
    flushBottom: {
      true: { pb: '0' },
      false: { pb: 'calc({spacing.12} + var(--safe-b))' },
    },
  },
  defaultVariants: { flushBottom: false },
})

export const titleBlock = vstack({ gap: '1.5', alignItems: 'stretch', mb: '6' })

export const eyebrow = css({ textStyle: 'eyebrow', color: 'accent.text' })

export const title = css({ textStyle: 'title', wordBreak: 'keep-all' })

export const subtitle = css({ textStyle: 'body', color: 'fg.muted' })
