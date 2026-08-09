import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

/**
 * A labelled block: caption, optional hint, the control, and whatever the
 * control has to say about itself.
 *
 * Renders a real `<label>` only when it wraps exactly one form control
 * (`htmlFor`). Wrapping everything in one was invalid HTML the moment the child
 * was a `<fieldset>` of chips or a picker with its own `<label>` — and it had
 * teeth: tapping the word "카테고리" activated the first labelable descendant,
 * so it silently selected 반팔티. Tapping "사진" opened the file picker.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  const caption = (
    <>
      <span className={css({ color: 'fg' })}>{label}</span>
      {required && (
        <span className={css({ color: 'accent.text', ml: '1' })} aria-hidden="true">
          *
        </span>
      )}
      {hint && <span className={css({ ml: '2', color: 'fg.subtle' })}>{hint}</span>}
    </>
  )

  return (
    <div className={vstack({ gap: '2.5', alignItems: 'stretch' })}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={fieldCaption}>
          {caption}
        </label>
      ) : (
        <span className={fieldCaption}>{caption}</span>
      )}
      {children}
    </div>
  )
}

// Local, not exported: a module that exports both a component and a plain value
// loses React Fast Refresh for the whole file.
const fieldCaption = css({ textStyle: 'caption', color: 'fg.muted' })

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className={css({ textStyle: 'caption', color: 'danger' })}>
      {children}
    </span>
  )
}
