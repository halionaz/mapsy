import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

/** `flex: 1`이라 아래 액션 바가 짧은 폼에서도 바닥까지 스스로를 밀어낼 수 있다. */
export const form = vstack({ gap: '6', alignItems: 'stretch', flex: '1' })

export const stack = vstack({ gap: '6', alignItems: 'stretch' })

export const categoryList = vstack({ gap: '4', alignItems: 'stretch' })

export const sizeField = vstack({ gap: '2', alignItems: 'stretch' })

export const problemList = vstack({ gap: '1', alignItems: 'stretch' })

export const problem = css({ textStyle: 'caption', color: 'danger' })

/**
 * 등록 / 저장. 화면 아래 가장자리에 고정된다.
 *
 * sticky라 폼 밖으로 꺼내지 않고도 손 닿는 곳에 있다 — 문서 순서상 여전히 진짜 제출
 * 버튼이고 키보드가 마지막에 닿는다.
 *
 * 두 규칙이 양방향을 만든다. `bottom: 0`은 폼이 길 때 뷰포트에 붙들고,
 * `margin-top: auto`는 폼이 짧을 때 아래로 떨군다 — 없으면 바가 화면 중간에서 밑줄을
 * 그어 페이지의 끝이 아니라 구획 구분선으로 읽힌다.
 *
 * 감싸는 ScreenHeader에 `flushBottom`이 필요하다. 아니면 본문의 아래 패딩만큼 바가
 * 위에서 쉬고, 끝까지 스크롤했을 때 눈에 띄게 뜬다.
 */
export const actionBar = css({
  position: 'sticky',
  bottom: '0',
  mt: 'auto',
  display: 'flex',
  gap: '2',
  // `<main>`의 인셋 위로 도로 당겨 컬럼을 가로지르게 한다. 필드와 같은 만큼 들여쓰면
  // 화면의 바닥이 아니라 페이지 위에 놓인 위젯으로 읽힌다.
  mx: '-5',
  px: '5',
  pt: '3',
  // 화면이 아래 끝까지 닿으므로 홈 인디케이터를 비키는 것은 본문이 아니라 이 바의 몫이다.
  pb: 'calc({spacing.4} + var(--safe-b))',
  bg: 'bg',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'border.subtle',
})

/** 선택 항목이 열한 필드 중 아홉을 담는 폼의 갈림길이라, 전폭 행으로 그린다. */
export const disclosure = cx(
  hstack({ justify: 'space-between' }),
  css({
    width: 'full',
    px: '4',
    minHeight: 'tap',
    rounded: 'field',
    bg: 'bg.subtle',
    color: 'accent.text',
    textStyle: 'label',
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: 'fast',
    _hover: { bg: 'bg.elevatedHover' },
    layerStyle: 'focusable',
  }),
)

export const disclosureChevron = css({
  transitionProperty: 'rotate',
  transitionDuration: 'fast',
  transitionTimingFunction: 'out',
  '[data-open] &': { rotate: '180deg' },
  _motionReduce: { transitionDuration: '1ms' },
})

export const formError = css({
  textStyle: 'caption',
  color: 'danger',
  bg: 'danger.subtle',
  px: '4',
  py: '3',
  rounded: 'field',
})
