import { LoaderCircle } from 'lucide-react'
import { css, cx } from 'styled-system/css'
import type { RecipeVariantProps } from 'styled-system/types'

import { buttonStyle, iconButtonStyle } from './buttonStyle'

// `NonNullable`, because Panda types a recipe's argument as optional and an
// interface cannot extend a type that might be undefined.
type ButtonVariants = NonNullable<RecipeVariantProps<typeof buttonStyle>>
type IconButtonVariants = NonNullable<RecipeVariantProps<typeof iconButtonStyle>>

// `ComponentProps<'button'>` rather than `ButtonHTMLAttributes`: under React 19
// `ref` is an ordinary prop on a function component, and it is only in the props
// type through this one. Ark UI's `asChild` triggers hand a ref to whatever they
// clone, so a button that silently drops it is a dialog that cannot place focus.
interface ButtonProps extends Omit<React.ComponentProps<'button'>, 'className'>, ButtonVariants {
  /**
   * Puts a spinner *before* the label and disables the button. It does not
   * replace the label — callers that want one ("저장 중…") pass it themselves.
   *
   * Separate from `disabled` because the two mean different things to a screen
   * reader: `aria-busy` says the press was received and is being worked on,
   * where `disabled` alone says nothing happened.
   */
  loading?: boolean
  className?: string
}

/**
 * Sets `type="button"` by default.
 *
 * The HTML default is `submit`, which inside `<form>` turns every unlabelled
 * helper — 취소, a disclosure toggle — into a second submit button. The item form
 * had exactly that shape, so the default is inverted here once instead of being
 * remembered at each call site.
 */
export function Button({
  variant,
  size,
  shape,
  full,
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
      {loading && <Spinner />}
      {children}
    </button>
  )
}

interface IconButtonProps
  extends Omit<React.ComponentProps<'button'>, 'className'>,
    IconButtonVariants {
  /** Required: the button's only content is a glyph, so this is its name. */
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

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <LoaderCircle
      size={size}
      aria-hidden="true"
      className={css({
        animation: 'spin',
        _motionReduce: { animation: 'none', opacity: 0.6 },
      })}
    />
  )
}
