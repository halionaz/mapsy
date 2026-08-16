import { css, cva } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

/**
 * 칩 — 프리셋에서 고르는 모든 컨트롤(카테고리·색상·사이즈·핏·계절·정렬)이 이것 하나를 쓴다.
 *
 * 두 상태 모두 채워진 형태다. 사진 위에 얹히는 화면이라 외곽선 칩 여러 개는 얇은 사각형의
 * 행이 되고, 선택은 테두리 굵기가 아니라 채움색의 변화로 읽혀야 한다.
 */
export const chipStyle = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    flexShrink: 0,
    rounded: 'full',
    px: '3.5',
    // 탭 타겟 바닥보다 낮은 건 의도다 — 칩은 여러 개가 한 줄로 깔리고 잘못 눌러도
    // 한 번 더 누르면 된다. 44px 밴드는 칩을 감싼 레일의 패딩이 만든다.
    minHeight: '9',
    textStyle: 'label',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    transitionProperty: 'background-color, border-color, color, transform',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    // `_enabled`가 아닌 이유는 Button.css.ts를 볼 것. 칩은 아직 전부 버튼이지만,
    // 버튼에서만 동작하는 가드가 그 전제가 바뀔 때 조용히 깨지는 쪽이다.
    '&:active:not(:disabled)': { transform: 'scale(0.96)' },
    _motionReduce: { '&:active:not(:disabled)': { transform: 'none' } },
    _disabled: { opacity: 0.3, cursor: 'not-allowed' },
  },
  variants: {
    active: {
      true: {
        bg: 'accent',
        color: 'accent.fg',
        borderColor: 'accent',
        '&:hover:not(:disabled)': { bg: 'accent.hover', borderColor: 'accent.hover' },
      },
      false: {
        bg: 'bg.subtle',
        color: 'fg.muted',
        borderColor: 'transparent',
        '&:hover:not(:disabled)': { bg: 'bg.elevatedHover', color: 'fg' },
      },
    },
  },
  defaultVariants: { active: false },
})

/** 칩 레일 위의 캡션. ChipGroup·ChipSelect·필터 시트가 같은 것을 그려야 한다. */
export const chipLegend = css({ textStyle: 'caption', color: 'fg.muted', mb: '2.5' })

/** 칩을 감싸는 `<fieldset>`의 기본 장식 제거. */
export const fieldset = css({ border: 'none', p: '0', m: '0' })

export const chipRow = hstack({ gap: '2', flexWrap: 'wrap' })

/** 레전드 뒤에 붙는 "· 최대 N개". */
export const chipMaxHint = css({ color: 'fg.subtle' })
