import { chipLegend, chipMaxHint, chipRow, chipStyle, fieldset } from './Chip.css'

/**
 * 비워둘 수 있는 선택 — 아무것도 안 고른 다중 선택, 같은 칩을 다시 눌러 해제한 단일 선택.
 * 반드시 답이 있어야 하는 선택은 `ChipSelect`이고, 그쪽은 빈 상태를 표현할 수 없다.
 */

export interface ChipOption<T extends string> {
  value: T
  label: string
  /**
   * 라벨 앞에 그려지는 색 점이나 작은 글리프.
   *
   * `label`을 ReactNode로 넓히지 않고 분리한 이유는 label이 칩의 접근 가능한 이름이기도
   * 해서다 — 노드는 이름을 만들어낸다고 보장할 수 없다.
   */
  icon?: React.ReactNode
}

interface ChipGroupProps<T extends string> {
  label: string
  options: readonly ChipOption<T>[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  /** 단일 선택은 누적하지 않고 기존 선택을 대체한다. */
  multiple?: boolean
  /** 다중 선택의 상한. 넘으면 나머지 칩이 disabled가 된다. */
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
    <fieldset className={fieldset}>
      <legend className={chipLegend}>
        {label}
        {max != null && <span className={chipMaxHint}>{` · 최대 ${max}개`}</span>}
      </legend>
      <div className={chipRow}>
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
