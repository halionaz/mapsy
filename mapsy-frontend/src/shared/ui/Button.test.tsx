/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './Button'

/**
 * `loading`은 아이콘 옆에 끼어드는 게 아니라 아이콘을 대신한다.
 *
 * children 앞에 스피너를 덧붙이던 시절에는 아이콘을 가지는 호출부마다 자기 글리프를
 * 직접 숨겨야 했다. 그 기억을 prop이 대신 가져갔으므로, 교체를 여기서 붙들어 둔다.
 */
afterEach(cleanup)

describe('Button', () => {
  it('로딩이 아니면 아이콘을 보여준다', () => {
    render(
      <Button icon={<svg data-testid="icon" />} loading={false}>
        처분
      </Button>,
    )

    expect(screen.queryByTestId('icon')).not.toBeNull()
  })

  it('로딩이면 아이콘을 더하지 않고 스피너로 바꾼다', () => {
    render(
      <Button icon={<svg data-testid="icon" />} loading>
        처분
      </Button>,
    )

    expect(screen.queryByTestId('icon')).toBeNull()
  })

  it('로딩이면 스스로 잠근다 — 호출부가 두 번 말하지 않도록', () => {
    render(<Button loading>저장</Button>)

    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
  })
})
