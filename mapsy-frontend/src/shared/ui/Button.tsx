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
   * A glyph before the label.
   *
   * A prop rather than the first child, so that `loading` has somewhere to put
   * the spinner. When the icon lived in `children` the spinner was *added* in
   * front of it and every call site had to remember to hide its own —
   * `{!pending && <GoogleMark />}` — which two of the three did. The third put
   * three glyphs on one line for the length of a mutation.
   */
  icon?: React.ReactNode
  /**
   * Swaps `icon` for a spinner and disables the button.
   *
   * The label is left alone; a caller that wants one ("저장 중…") passes it.
   * Callers do not need `disabled` as well — that is set here.
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

/**
 * `size` is for spinners outside a button — a loading screen, a photo tile.
 * Inside one, `buttonStyle` sizes every glyph it contains and this is ignored.
 */
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
