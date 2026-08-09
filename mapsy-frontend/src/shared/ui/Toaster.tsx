import { Toast, Toaster as ArkToaster } from '@ark-ui/react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { css } from 'styled-system/css'

import { toaster } from './toast'

/**
 * Where the toasts from `toaster` are drawn. Mounted once, in the providers.
 *
 * Position, stacking and the safe-area inset are all computed by the machine and
 * arrive as inline custom properties on the group and on each toast; the rules
 * below only consume them. That division is why this file sets `translate` and
 * `opacity` from variables it never defines — writing a `bottom` or a `transform`
 * here would be overriding the thing that knows how many toasts there are.
 */
export function Toaster() {
  return (
    <ArkToaster toaster={toaster}>
      {(toast) => (
        <Toast.Root className={root}>
          <ToneIcon type={toast.type} />
          <div>
            <Toast.Title className={css({ textStyle: 'label' })}>{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description
                className={css({ textStyle: 'caption', color: 'fg.muted', mt: '0.5' })}
              >
                {toast.description}
              </Toast.Description>
            )}
          </div>
        </Toast.Root>
      )}
    </ArkToaster>
  )
}

function ToneIcon({ type }: { type?: string }) {
  const size = 17
  if (type === 'error') {
    return <CircleAlert size={size} className={css({ color: 'danger', flexShrink: 0 })} />
  }
  if (type === 'success') {
    return <CircleCheck size={size} className={css({ color: 'accent.text', flexShrink: 0 })} />
  }
  return <Info size={size} className={css({ color: 'fg.muted', flexShrink: 0 })} />
}

const root = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '2.5',
  width: 'fit-content',
  maxWidth: 'min(22rem, calc(100vw - 2rem))',
  px: '4',
  py: '3',
  bg: 'bg.elevated',
  color: 'fg',
  rounded: 'field',
  boxShadow: 'raised',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  // Driven entirely by the machine's custom properties — see the note above.
  translate: 'var(--x) var(--y)',
  opacity: 'var(--opacity)',
  zIndex: 'var(--z-index)',
  willChange: 'translate, opacity',
  transitionProperty: 'translate, opacity',
  transitionDuration: 'slow',
  transitionTimingFunction: 'out',
  _motionReduce: { transitionDuration: '1ms' },
  layerStyle: 'focusable',
})
