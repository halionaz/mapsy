import { cva } from 'styled-system/css'

export const swatch = cva({
  base: {
    display: 'inline-block',
    rounded: 'full',
    flexShrink: 0,
    background: 'var(--swatch)',
    // 흰색·베이지 옷이 흰 카드 위에서 사라지므로, 옅은 점만이 아니라 모든 점이 실선을 문다.
    boxShadow: 'inset 0 0 0 1px {colors.border}',
  },
  variants: {
    size: {
      sm: { width: 'swatchSm', height: 'swatchSm' },
      md: { width: 'swatchMd', height: 'swatchMd' },
    },
    multi: {
      true: {
        background:
          'conic-gradient({colors.swatch.red}, {colors.swatch.yellow}, {colors.swatch.green}, {colors.swatch.blue}, {colors.swatch.purple}, {colors.swatch.red})',
      },
    },
  },
  defaultVariants: {
    size: 'sm',
    multi: false,
  },
})
