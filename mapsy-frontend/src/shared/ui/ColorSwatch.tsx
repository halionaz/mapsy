import type { CSSProperties } from 'react'

import { colorLabel, swatchVar, type ColorId } from '@/shared/config/colors'
import { swatch } from './ColorSwatch.css'

/**
 * 옷 카드와 필터 시트에 찍히는 색 점.
 *
 * Panda가 허용하는 유일한 동적 값 기법의 본보기다. 색이 데이터에서 오므로 스타일 객체
 * 안의 토큰 참조가 될 수 없다 — Panda는 빌드 타임에 소스를 읽고 그 자리에 아무것도
 * 내보내지 않는다. 대신 정적 규칙이 `var(--swatch)`를 칠하고, 런타임에 인라인 `style`이
 * 그 변수를 Panda가 이미 생성한 토큰으로 겨눈다.
 *
 * `multi`는 여러 색이거나 패턴인 옷이다. 참인 색 하나가 없어서 원뿔 그라데이션으로 그린다.
 */
interface ColorSwatchProps {
  color: ColorId
  size?: 'sm' | 'md'
}

export function ColorSwatch({ color, size }: ColorSwatchProps) {
  return (
    <span
      role="img"
      // aria-label만 — 같은 문자열의 `title`을 더하면 일부 스크린리더가 두 번 읽는다.
      aria-label={colorLabel(color)}
      className={swatch({ size, multi: color === 'multi' })}
      style={{ '--swatch': swatchVar(color) } as CSSProperties}
    />
  )
}
