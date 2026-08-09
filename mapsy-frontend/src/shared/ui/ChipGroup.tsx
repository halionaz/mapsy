import { css } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

import { chipLegend, chipStyle } from './chipStyle'

/**
 * Selectable chips — the single control the whole app uses for choosing from a
 * preset (category, colour, size, fit, season, sort).
 *
 * Native `<select>` is the obvious alternative, but a wardrobe form asks six of
 * these in a row and stacked dropdowns turn registration into a chore. Chips
 * show the options and their state at once, which is what makes the optional
 * section skimmable enough to actually fill in.
 *
 * Every choice here can end up empty — a multi-select with nothing ticked, a
 * single-select cleared by tapping its own chip again. A choice that must have
 * an answer is `ChipSelect`, which cannot express the empty one.
 */

export interface ChipOption<T extends string> {
  value: T
  label: string
  /**
   * Drawn before the label — a colour dot, a small glyph.
   *
   * Separate from `label` rather than widening it to `ReactNode`: the label is
   * also the accessible name of the chip, and a node cannot be relied on to
   * produce one.
   */
  icon?: React.ReactNode
}

interface ChipGroupProps<T extends string> {
  label: string
  options: readonly ChipOption<T>[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  /** Single-select clears the other choice instead of accumulating. */
  multiple?: boolean
  /** Caps a multi-select; further chips disable rather than silently no-op. */
  max?: number
}

export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  multiple = false,
  max,
}: ChipGroupProps<T>) {
  const atLimit = multiple && max != null && selected.length >= max

  function toggle(value: T) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
      return
    }
    if (multiple) {
      if (atLimit) return
      onChange([...selected, value])
    } else {
      onChange([value])
    }
  }

  return (
    <fieldset className={css({ border: 'none', p: '0', m: '0' })}>
      <legend className={chipLegend}>
        {label}
        {max != null && (
          <span className={css({ color: 'fg.subtle' })}>{` · 최대 ${max}개`}</span>
        )}
      </legend>
      <div
        className={hstack({
          gap: '2',
          flexWrap: 'wrap',
        })}
      >
        {options.map((option) => {
          const active = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={!active && atLimit}
              onClick={() => toggle(option.value)}
              className={chipStyle({ active })}
            >
              {option.icon}
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
