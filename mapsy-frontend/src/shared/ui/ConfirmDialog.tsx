import { useRef } from 'react'
import { Dialog, Portal } from '@ark-ui/react'

import { Button } from './Button'
import * as styles from './ConfirmDialog.css'

/**
 * `window.confirm`의 대체.
 *
 * `confirm()`은 제품이 손댈 수 없는 유일한 표면이다 — 브라우저의 크롬, 브라우저가 정한
 * 언어, 되돌릴 수 없는 삭제 옆의 "OK". 메인 스레드도 막는다.
 *
 * `role="alertdialog"`이고 포커스는 파괴적 버튼이 아니라 취소에 놓는다. 삭제에 포커스가
 * 잡힌 채 열리면 반사적인 Enter가 옷을 지운다.
 */
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** 확인 버튼을 파괴적으로 칠한다. */
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
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Positioner className={styles.positioner}>
          <Dialog.Content className={styles.content}>
            <div className={styles.text}>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              {description && (
                <Dialog.Description className={styles.description}>
                  {description}
                </Dialog.Description>
              )}
            </div>

            <div className={styles.actions}>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" full disabled={pending} ref={cancelRef}>
                  {cancelLabel}
                </Button>
              </Dialog.CloseTrigger>
              <Button
                variant={destructive ? 'destructive' : 'solid'}
                full
                loading={pending}
                onClick={onConfirm}
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
