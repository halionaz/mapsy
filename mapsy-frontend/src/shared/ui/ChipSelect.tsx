import { css } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

import { chipStyle } from './chipStyle'
import type { ChipOption } from './ChipGroup'

/**
 * A choice among chips that has to end up with exactly one answer — the sort
 * order, an item's category.
 *
 * Separate from `ChipGroup` because the shape of the callback is the whole
 * point. `ChipGroup` speaks in arrays, and an array can be empty; every required
 * single choice therefore had to reach into it with `next[0]` and guess what to
 * do about `undefined`. In the sort control that guess was a `?? 'recent'`, and
 * removing it as unreachable was a mistake that took a while to see: the only
 * thing making it unreachable was `clearable={false}` at the call site, and
 * `clearable` defaults to `true`. The safe state was the one someone had
 * remembered to write down.
 *
 * What that would have cost is worth spelling out, because none of it is loud.
 * `next[0]` on an empty array is `undefined`, and with `noUncheckedIndexedAccess`
 * off the compiler still calls it a `SortId`. `applyFilters`' comparator has no
 * `default` branch, so it returns `undefined`; `Array.prototype.sort` treats that
 * as "leave them alone" and reports nothing. The sort silently stops working and
 * its label goes blank.
 *
 * Here the empty answer cannot be constructed: `onChange` hands back a value,
 * not a list, and a tap on the already-selected chip is a no-op rather than a
 * clear.
 */
interface ChipSelectProps<T extends string> {
  label: string
  options: readonly ChipOption<T>[]
  /** `null` only before anything has been picked; it never returns to null. */
  value: T | null
  onChange: (value: T) => void
}

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChipSelectProps<T>) {
  return (
    <fieldset className={css({ border: 'none', p: '0', m: '0' })}>
      <legend className={css({ textStyle: 'caption', color: 'fg.muted', mb: '2.5' })}>
        {label}
      </legend>
      <div className={hstack({ gap: '2', flexWrap: 'wrap' })}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={chipStyle({ active: value === option.value })}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
