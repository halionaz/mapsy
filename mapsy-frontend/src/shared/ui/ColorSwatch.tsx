import type { CSSProperties } from 'react'
import { cva } from 'styled-system/css'
import { cssVarOf, colorLabel, type ColorId } from '../constants/colors'

/**
 * The colour dot shown on item cards and in the filter sheet.
 *
 * Reference implementation of the one dynamic-value technique Panda allows: the
 * colour comes from data, so it cannot be a token reference inside the style
 * object — Panda reads source at build time and would emit nothing for it.
 * Instead the static rule paints `var(--swatch)`, and at runtime the inline
 * `style` attribute points that variable at the token Panda already generated.
 *
 * `multi` covers multi-colour and patterned garments. It has no single truthful
 * colour, so it renders as a conic sweep rather than a flat fill.
 */

interface ColorSwatchProps {
  color: ColorId
  size?: 'sm' | 'md'
}

const swatch = cva({
  base: {
    display: 'inline-block',
    rounded: 'full',
    flexShrink: 0,
    background: 'var(--swatch)',
    // White and beige garments would vanish against a white card, so every dot
    // carries a hairline rather than only the pale ones.
    boxShadow: 'inset 0 0 0 1px {colors.border}',
  },
  variants: {
    size: {
      sm: { width: '10px', height: '10px' },
      md: { width: '16px', height: '16px' },
    },
    multi: {
      true: {
        background:
          'conic-gradient(#DC2626, #FACC15, #16A34A, #2563EB, #7C3AED, #DC2626)',
      },
    },
  },
  defaultVariants: {
    size: 'sm',
  },
})

export function ColorSwatch({ color, size = 'sm' }: ColorSwatchProps) {
  const label = colorLabel(color)

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={swatch({ size, multi: color === 'multi' })}
      style={{ '--swatch': `var(${cssVarOf(color)})` } as CSSProperties}
    />
  )
}
