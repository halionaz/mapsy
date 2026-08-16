import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

export const sections = vstack({ gap: '7', alignItems: 'stretch' })

export const section = vstack({ gap: '3', alignItems: 'stretch' })

/** `subheading`이 아니라 `heading` — 사진 격자 둘 사이에 홀로 서서 스크롤을 견뎌야 한다. */
export const sectionHeading = css({ textStyle: 'heading' })

export const sectionCount = css({ ml: '2', color: 'fg.subtle' })

/**
 * 불러온 격자와 로딩 중인 격자가 공유한다 — 자리표시자가 카드가 앉을 줄에 놓여야
 * 데이터가 도착해도 화면이 다시 배치되지 않는다.
 */
export const grid = css({
  display: 'grid',
  // 맨 `1fr`이 아니라 `minmax(0, …)`.
  //
  // `1fr`은 `minmax(auto, 1fr)`의 축약이고, 그 `auto`는 아이템의 자동 최소 크기 —
  // 카드에서는 제목의 min-content 너비다. 제목이 `white-space: nowrap`이라 그 값은 자르지
  // 않은 문자열 전체다. `overflow: hidden`은 무엇이 *그려지는지*를 정할 뿐 텍스트가
  // 요구하는 크기를 바꾸지 않는다. 결과는 옷 이름 길이가 열 너비를 정하는 격자이고,
  // 사진이 열을 채우는 정사각이라 이름이 긴 옷은 카드도 커진다.
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  // 같은 자동 최소 크기가 트랙 안의 아이템에도 걸려, 방금 맞춘 트랙 밖으로 카드를 도로 민다.
  '& > li': { minWidth: 0 },
  gap: '3',
  listStyle: 'none',
  p: '0',
  m: '0',
})
