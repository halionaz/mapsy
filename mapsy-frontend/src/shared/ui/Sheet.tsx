import { Dialog, Portal } from '@ark-ui/react'
import { X } from 'lucide-react'
import { css } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

import { IconButton } from './Button'

/**
 * A panel that comes up from the bottom edge — the filter sheet, and whatever
 * else needs a screen's worth of controls without being a screen.
 *
 * Built on Ark UI's `Dialog` rather than its `Drawer`. The drawer is the richer
 * component (it swipes to dismiss), but it drives the content's transform from
 * inline styles, while Ark's presence machine only waits on a CSS **animation**
 * before unmounting — so a drawer styled with a transition disappears instantly
 * on close instead of sliding out. A dialog owns its transform outright, which
 * makes the two keyframes below the only thing deciding how it moves.
 *
 * What that buys, for free: focus is trapped and restored, the page behind is
 * inert and does not scroll, and Esc closes.
 */
interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** A row pinned below the scrolling body — 초기화 / 적용. */
  footer?: React.ReactNode
  children: React.ReactNode
}

export function Sheet({ open, onOpenChange, title, footer, children }: SheetProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      // Mounted only while it has been asked for, and torn down after the exit
      // animation — so a sheet always opens from a known state rather than from
      // wherever it was left, and its contents are not in the tab order when it
      // is closed.
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className={backdrop} />
        <Dialog.Positioner className={positioner}>
          {/* No `aria-label` here: rendering `Dialog.Title` is what makes Ark
              set `aria-labelledby`, and adding a label as well would replace the
              heading the user can actually see with a duplicate of it. */}
          <Dialog.Content className={content}>
            <div className={grabber} aria-hidden="true" />

            <header className={sheetHeader}>
              <Dialog.Title className={css({ textStyle: 'heading' })}>{title}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton label="닫기" size="sm">
                  <X size={18} />
                </IconButton>
              </Dialog.CloseTrigger>
            </header>

            <div className={body}>{children}</div>

            {footer && <footer className={sheetFooter}>{footer}</footer>}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

const backdrop = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  bg: 'overlay.backdrop',
  // The page behind is a grid of photographs; a flat tint alone still lets them
  // read as content you could tap.
  backdropFilter: 'blur(3px)',
  '&[data-state=open]': { animation: 'fadeIn' },
  '&[data-state=closed]': { animation: 'fadeOut' },
})

const positioner = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'overlay',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
})

const content = css({
  display: 'flex',
  flexDirection: 'column',
  width: 'full',
  // Matches the app column, so on a wide window the sheet comes up inside the
  // phone rather than across the whole desktop.
  maxWidth: 'app',
  maxHeight: '86dvh',
  bg: 'bg.elevated',
  color: 'fg',
  roundedTop: 'sheet',
  boxShadow: 'sheet',
  // The sheet reaches the bottom edge of the display, so its own padding is what
  // keeps the last row of controls off the home indicator.
  pb: 'var(--safe-b)',
  overflow: 'hidden',
  '&[data-state=open]': { animation: 'sheetIn' },
  '&[data-state=closed]': { animation: 'sheetOut' },
  _motionReduce: {
    '&[data-state=open]': { animation: 'fadeIn' },
    '&[data-state=closed]': { animation: 'fadeOut' },
  },
})

/**
 * The handle. Decoration — this sheet is not draggable — but it is the shape
 * that says "this came up from the edge and will go back down", and leaving it
 * out is most of why a bottom panel reads as a page that failed to load.
 */
const grabber = css({
  width: '9',
  height: '1',
  mx: 'auto',
  mt: '2.5',
  rounded: 'full',
  bg: 'border.strong',
})

const sheetHeader = hstack({
  justify: 'space-between',
  px: '5',
  pt: '3',
  pb: '3',
})

const body = css({
  flex: '1',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  px: '5',
  pb: '5',
})

const sheetFooter = css({
  display: 'flex',
  gap: '2',
  px: '5',
  pt: '3',
  pb: '4',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'border.subtle',
  bg: 'bg.elevated',
})
