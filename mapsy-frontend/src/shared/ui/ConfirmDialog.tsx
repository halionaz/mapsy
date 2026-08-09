import { useRef } from 'react'
import { Dialog, Portal } from '@ark-ui/react'
import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import { Button } from './Button'

/**
 * The replacement for `window.confirm`.
 *
 * `confirm()` was doing the job on the delete action, and it works — but it is
 * the one surface in the app the product has no say over: the browser's own
 * chrome, in the browser's own type, in whatever language the browser decided,
 * with a button that says "OK" next to an irreversible delete. It also blocks
 * the main thread, so nothing behind it can keep painting.
 *
 * `role="alertdialog"` rather than `dialog`, and focus lands on the cancel
 * button rather than the destructive one: a dialog that opens with 삭제 already
 * focused turns a reflexive Enter into a deleted garment.
 */
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Paints the confirm button as destructive. */
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      role="alertdialog"
      initialFocusEl={() => cancelRef.current}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className={backdrop} />
        <Dialog.Positioner className={positioner}>
          <Dialog.Content className={content}>
            <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
              <Dialog.Title className={css({ textStyle: 'heading' })}>{title}</Dialog.Title>
              {description && (
                <Dialog.Description
                  className={css({ textStyle: 'body', color: 'fg.muted' })}
                >
                  {description}
                </Dialog.Description>
              )}
            </div>

            <div className={css({ display: 'flex', gap: '2' })}>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" full disabled={pending} ref={cancelRef}>
                  {cancelLabel}
                </Button>
              </Dialog.CloseTrigger>
              <Button
                full
                loading={pending}
                onClick={onConfirm}
                className={destructive ? destructiveFill : undefined}
              >
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

/**
 * The destructive confirm button.
 *
 * A `danger` *fill* rather than another variant on `buttonStyle`: the recipe's
 * `danger` is a text button, used where deletion is one option among several on
 * a page. Here the whole dialog exists to ask about this one action, so it is
 * the filled button — and that is a property of this dialog, not a sixth button
 * variant the rest of the app can reach for.
 */
const destructiveFill = css({
  bg: 'danger',
  color: 'danger.fg',
  '&:hover:not(:disabled)': { bg: 'danger', opacity: 0.88 },
})

const backdrop = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  bg: 'overlay.backdrop',
  backdropFilter: 'blur(3px)',
  '&[data-state=open]': { animation: 'fadeIn' },
  '&[data-state=closed]': { animation: 'fadeOut' },
})

const positioner = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  display: 'grid',
  placeItems: 'center',
  p: '6',
})

const content = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  width: 'full',
  maxWidth: '80',
  p: '6',
  bg: 'bg.elevated',
  color: 'fg',
  rounded: 'sheet',
  boxShadow: 'raised',
  '&[data-state=open]': { animation: 'dialogIn' },
  '&[data-state=closed]': { animation: 'dialogOut' },
  _motionReduce: {
    '&[data-state=open]': { animation: 'fadeIn' },
    '&[data-state=closed]': { animation: 'fadeOut' },
  },
})
