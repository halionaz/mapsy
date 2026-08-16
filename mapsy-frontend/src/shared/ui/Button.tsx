import { LoaderCircle } from 'lucide-react'
import { cx } from 'styled-system/css'
import type { RecipeVariantProps } from 'styled-system/types'

import { buttonStyle, iconButtonStyle, spinner } from './Button.css'

// `NonNullable` — Panda는 레시피 인자를 optional로 타이핑하고, interface는
// undefined일 수 있는 타입을 확장하지 못한다.
type ButtonVariants = NonNullable<RecipeVariantProps<typeof buttonStyle>>
type IconButtonVariants = NonNullable<RecipeVariantProps<typeof iconButtonStyle>>

// `ComponentProps<'button'>` — React 19에서 `ref`는 평범한 prop이고 이 타입으로만
// props에 들어온다. Ark UI의 `asChild` 트리거가 ref를 넘기므로 흘리면 다이얼로그가
// 포커스를 놓는다.
interface ButtonProps extends Omit<React.ComponentProps<'button'>, 'className'>, ButtonVariants {
  /** 라벨 앞 글리프. children이 아니라 prop인 이유는 `loading`이 이 자리를 뺏기 때문. */
  icon?: React.ReactNode
  /**
   * `icon`을 스피너로 바꾸고 버튼을 잠근다. 라벨은 그대로 두므로 "저장 중…"은 호출부가 넘긴다.
   *
   * `disabled`와 따로인 것은 스크린리더에게 뜻이 다르기 때문 — `aria-busy`는 눌린 것이
   * 처리 중이라고, `disabled`는 아무 일도 없다고 말한다.
   */
  loading?: boolean
  className?: string
}

/** HTML 기본값이 `submit`이라 폼 안의 보조 버튼이 전부 제출 버튼이 된다. 여기서 한 번 뒤집는다. */
export function Button({
  variant,
  size,
  shape,
  full,
  icon,
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonStyle({ variant, size, shape, full }), className)}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps
  extends Omit<React.ComponentProps<'button'>, 'className'>, IconButtonVariants {
  /** 필수 — 내용이 글리프뿐이라 이것이 버튼의 이름이다. */
  label: string
  className?: string
}

export function IconButton({
  label,
  size,
  shape,
  filled,
  onPhoto,
  active,
  children,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(iconButtonStyle({ size, shape, filled, onPhoto, active }), className)}
      {...props}
    >
      {children}
    </button>
  )
}

/** `size`는 버튼 밖에서 쓸 때만 — 안에서는 `buttonStyle`이 글리프 크기를 정한다. */
export function Spinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} aria-hidden="true" className={spinner} />
}
