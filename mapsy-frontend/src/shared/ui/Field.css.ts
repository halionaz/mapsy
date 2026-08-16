import { css, cva, cx } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

/**
 * 텍스트 입력·검색창·textarea.
 *
 * 외곽선 상자가 아니라 파인 우물이다 — 어두운 페이지에서 외곽선은 안 보이거나 밝은
 * 사각형이 되지만, 살짝 밝은 채움은 선을 긋지 않고도 "여기 쓸 수 있다"로 읽힌다.
 *
 * base의 `fontSize`는 16px 아래로 내려가지 않는다. iOS Safari는 그보다 작은 입력에
 * 포커스가 가면 페이지 전체를 확대하고 되돌리지 않는다.
 */
export const inputStyle = cva({
  base: {
    width: 'full',
    bg: 'bg.subtle',
    color: 'fg',
    rounded: 'field',
    px: '4',
    fontSize: '16px',
    fontFamily: 'body',
    lineHeight: '1.4',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    transitionProperty: 'background-color, border-color',
    transitionDuration: 'fast',
    _placeholder: { color: 'fg.subtle' },
    _focusVisible: {
      outline: 'none',
      borderColor: 'accent.ring',
      bg: 'bg',
    },
    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
    // Safari가 date·search 입력에 자기 그림자와 둥근 모서리를 그린다.
    appearance: 'none',
    '&::-webkit-search-decoration, &::-webkit-search-cancel-button': {
      WebkitAppearance: 'none',
    },
    '&::-webkit-date-and-time-value': { textAlign: 'left' },
  },
  variants: {
    size: {
      md: { minHeight: 'tap', py: '2.5' },
      lg: { minHeight: '12', py: '3' },
    },
    invalid: {
      true: {
        borderColor: 'danger',
        _focusVisible: { borderColor: 'danger' },
      },
    },
    /** 필드 앞머리에 앉는 아이콘 자리를 비운다. */
    withLeadingIcon: {
      true: { pl: '11' },
    },
  },
  defaultVariants: { size: 'md', invalid: false, withLeadingIcon: false },
})

export const block = vstack({ gap: '2.5', alignItems: 'stretch' })

export const caption = css({ textStyle: 'caption', color: 'fg.muted' })

export const captionLabel = css({ color: 'fg' })

export const requiredMark = css({ color: 'accent.text', ml: '1' })

export const hint = css({ ml: '2', color: 'fg.subtle' })

export const error = css({ textStyle: 'caption', color: 'danger' })

/** 텍스트 입력과 같되, 여러 줄이라 세로로 늘릴 수 있다. */
export const textareaStyle = cx(inputStyle(), css({ resize: 'vertical' }))
