import type { CSSProperties } from 'react'
import { cva } from 'styled-system/css'
import { swatchVar, colorLabel, type ColorId } from '@/shared/config/colors'

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
 * colour, so it renders as a conic sweep — built from swatch token references
 * rather than literal hex, so it follows the palette when the palette changes.
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

export function ColorSwatch({ color, size }: ColorSwatchProps) {
  return (
    <span
      role="img"
      // aria-label alone: adding a matching `title` makes some screen readers
      // announce the same string twice.
      aria-label={colorLabel(color)}
      className={swatch({ size, multi: color === 'multi' })}
      style={{ '--swatch': swatchVar(color) } as CSSProperties}
    />
  )
}
