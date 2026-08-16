import { describe, expect, it } from 'vitest'

import { buttonStyle } from './Button.css'

/**
 * 깨져도 그 화면을 열기 전까지는 보이지 않는 두 규칙을 붙들어 둔다.
 *
 * jsdom에는 레이아웃이 없어 기하는 관찰할 수 없고, 실제로 틀어진 것은 병합에서 어떤
 * 선언이 살아남았는가였다. 그래서 Panda의 원자 클래스 이름을 검사한다.
 */

/**
 * 클래스 이름을 통째 토큰의 집합으로.
 *
 * 부분 문자열 비교는 레시피가 자식 글리프 규칙을 갖는 순간 틀린다 —
 * `[&>svg]:flex-sh_0`이 `flex-sh_0`을 포함한다.
 */
function classes(recipe: string): Set<string> {
  return new Set(recipe.split(/\s+/).filter(Boolean))
}

describe('buttonStyle', () => {
  // base가 `flex-shrink: 0`이고 `full`이 `width: 100%`라, flex 행 안에서 둘이 만나면
  // 줄 전체를 요구하면서 한 뼘도 못 돌려주는 아이템이 되어 행이 넘친다.
  it('full 버튼은 줄어들 수 있어야 행을 넘치지 않고 채운다', () => {
    const applied = classes(buttonStyle({ full: true }))

    expect(applied).toContain('flex-sh_1')
    expect(applied).not.toContain('flex-sh_0')
    // 이것이 없으면 라벨의 min-content 너비가 바닥이라, 줄어들 수는 있어도 갈 곳이 없다.
    expect(applied).toContain('min-w_0')
  })

  it('평범한 버튼은 그대로 뻣뻣하다', () => {
    expect(classes(buttonStyle())).toContain('flex-sh_0')
  })

  /**
   * 되돌릴 수 없는 삭제의 확인 버튼은 빨개야 한다.
   *
   * `cx`는 클래스 이름을 이을 뿐 병합하지 않아, `.bg_danger`와 `.bg_accent`가 같은
   * 특이도로 붙으면 승자는 Panda가 나중에 쓴 쪽이 된다. 강조색이 *없음*을 확인하는
   * 쪽이 핵심이다 — `bg_danger`만 보는 검사는 깨진 판본도 통과시킨다.
   */
  it('destructive는 danger로 칠하고 강조색 채움을 남기지 않는다', () => {
    const applied = classes(buttonStyle({ variant: 'destructive' }))

    expect(applied).toContain('bg_danger')
    expect(applied).not.toContain('bg_accent')
  })
})
