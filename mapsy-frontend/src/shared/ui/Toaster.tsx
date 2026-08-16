import { Toast, Toaster as ArkToaster } from '@ark-ui/react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'

import { toaster } from './toast'
import * as styles from './Toaster.css'

/** `toaster`가 만든 토스트가 그려지는 곳. 프로바이더에서 한 번만 마운트한다. */
export function Toaster() {
  return (
    <ArkToaster toaster={toaster}>
      {(toast) => (
        <Toast.Root className={styles.root}>
          <ToneIcon type={toast.type} />
          <div>
            <Toast.Title className={styles.title}>{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description className={styles.description}>
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
  if (type === 'error') return <CircleAlert size={size} className={styles.errorIcon} />
  if (type === 'success') return <CircleCheck size={size} className={styles.successIcon} />
  return <Info size={size} className={styles.infoIcon} />
}
