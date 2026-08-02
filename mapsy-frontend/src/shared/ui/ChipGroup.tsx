import { css } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

import { chipStyle } from './chipStyle'

/**
 * Selectable chips — the single control the whole app uses for choosing from a
 * preset (category, colour, size, fit, season, sort).
 *
 * Native `<select>` is the obvious alternative, but a wardrobe form asks six of
 * these in a row and stacked dropdowns turn registration into a chore. Chips
 * show the options and their state at once, which is what makes the optional
 * section skimmable enough to actually fill in.
 */

export interface ChipOption<T extends string> {
  value: T
  label: string
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
  /** Lets a single-select be cleared by tapping the active chip again. */
  clearable?: boolean
}

export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  multiple = false,
  max,
  clearable = true,
}: ChipGroupProps<T>) {
  const atLimit = multiple && max != null && selected.length >= max

  function toggle(value: T) {
    if (selected.includes(value)) {
      if (!multiple && !clearable) return
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
      <legend className={css({ fontSize: 'xs', color: 'fg.muted', mb: '2' })}>
        {label}
        {max != null && ` (최대 ${max}개)`}
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
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
