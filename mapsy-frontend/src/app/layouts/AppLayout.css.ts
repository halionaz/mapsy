import { css } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

export const shell = css({
  mx: 'auto',
  width: 'full',
  maxWidth: 'app',
  minHeight: '100dvh',
  // flex 컬럼이라 화면이 자기 main 영역에 `flex: 1`을 주면 그것이 실제로 뷰포트를 채운다.
  // 블록 컨테이너에는 나눠줄 여유 공간이 없어, 세로 정렬을 뷰포트 높이 추측으로 흉내내야 한다.
  display: 'flex',
  flexDirection: 'column',
  bg: 'bg',
  // 넓은 화면에서 폰 폭 컬럼을 암시하는 실선.
  borderInlineWidth: { base: '0', md: '1px' },
  borderInlineStyle: 'solid',
  borderColor: 'border.subtle',
})

export const previewBanner = hstack({
  justify: 'center',
  gap: '2',
  px: '4',
  py: '2.5',
  bg: 'accent.subtle',
  color: 'accent.text',
  textStyle: 'caption',
})

export const previewIcon = css({ flexShrink: 0 })

export const previewLink = css({
  fontWeight: 'bold',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  rounded: 'sm',
  layerStyle: 'focusable',
})
