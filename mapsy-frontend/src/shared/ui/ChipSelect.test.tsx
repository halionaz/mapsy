/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChipSelect } from './ChipSelect'

/**
 * 이미 고른 칩을 다시 눌러도 콜백이 울리면 안 된다.
 *
 * 호출부가 값을 저장만 하지 않기 때문이다 — 옷 폼의 카테고리 핸들러는 사이즈와 핏을
 * 비운다. 바뀌지 않은 값에 콜백이 울리면 채워둔 두 필드가 비워지고 저장 때 null이 쓰인다.
 *
 * 첫 번째 테스트는 대조군이다. 없으면 아무 때도 콜백하지 않는 컴포넌트가 두 번째를
 * 통과한다.
 */
const OPTIONS = [
  { value: 'a', label: '반팔티' },
  { value: 'b', label: '셔츠' },
] as const

afterEach(cleanup)

describe('ChipSelect', () => {
  it('다른 선택은 알린다', () => {
    const onChange = vi.fn()
    render(<ChipSelect label="카테고리" options={OPTIONS} value="a" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '셔츠' }))

    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('이미 고른 칩을 다시 누르면 아무 말도 하지 않는다', () => {
    const onChange = vi.fn()
    render(<ChipSelect label="카테고리" options={OPTIONS} value="a" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '반팔티' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
