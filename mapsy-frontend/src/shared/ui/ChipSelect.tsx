import { chipLegend, chipRow, chipStyle, fieldset } from './Chip.css'
import type { ChipOption } from './ChipGroup'

/**
 * 반드시 답이 하나 있어야 하는 선택 — 정렬 순서, 옷의 카테고리.
 *
 * `ChipGroup`과 나뉜 이유는 콜백의 모양이다. 그쪽은 배열로 말하고 배열은 비어 있을 수
 * 있어서, 호출부마다 `next[0]`의 undefined를 각자 처리해야 했다. 여기서는 빈 답을
 * 만들 수 없다 — `onChange`가 값을 돌려주고, 이미 선택된 칩을 눌러도 아무 일이 없다.
 *
 * 라디오 시맨틱이 아니라 `aria-pressed`인 것은 홈 화면의 카테고리 레일과 맞추기 위해서다.
 * 제대로 된 radiogroup은 roving tabindex와 방향키까지 따라오고, 그건 이 파일이 아니라
 * 앱의 모든 칩을 바꾸는 일이다.
 */
interface ChipSelectProps<T extends string> {
  label: string
  options: readonly ChipOption<T>[]
  /** 아무것도 고르기 전에만 `null`이고, 다시 null로 돌아가지 않는다. */
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
    <fieldset className={fieldset}>
      <legend className={chipLegend}>{label}</legend>
      <div className={chipRow}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            // 가드가 있어야 "다시 눌러도 아무 일 없음"이 참이 된다 — 호출부는 값을
            // 저장만 하지 않는다. 옷 폼은 카테고리가 바뀌면 사이즈·핏을 비운다.
            onClick={() => option.value !== value && onChange(option.value)}
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
