/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChipSelect } from './ChipSelect'

/**
 * Re-tapping the current choice must not call back.
 *
 * `ChipGroup`, which this replaced at the required-single-choice call sites,
 * returned early instead of firing — and callers were built on that. The item
 * form's category handler does not only store the value: it clears 사이즈 and
 * 핏, because those vocabularies belong to the old category. Firing on an
 * unchanged value therefore emptied two fields the user had filled in, and
 * saving wrote nulls.
 *
 * The first test is the control. Without it, a component that never called back
 * at all would pass the second one.
 */
const OPTIONS = [
  { value: 'a', label: '반팔티' },
  { value: 'b', label: '셔츠' },
] as const

afterEach(cleanup)

describe('ChipSelect', () => {
  it('reports a different choice', () => {
    const onChange = vi.fn()
    render(<ChipSelect label="카테고리" options={OPTIONS} value="a" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '셔츠' }))

    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('says nothing when the chip that is already chosen is tapped again', () => {
    const onChange = vi.fn()
    render(<ChipSelect label="카테고리" options={OPTIONS} value="a" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '반팔티' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
