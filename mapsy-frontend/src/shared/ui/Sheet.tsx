import { Drawer, Portal } from '@ark-ui/react'
import { css } from 'styled-system/css'

/**
 * A panel that comes up from the bottom edge — the filter sheet, and whatever
 * else needs a screen's worth of controls without being a screen.
 *
 * Ark UI's `Drawer`, so the handle is real: dragging it down past a threshold
 * dismisses the sheet, and releasing short of it snaps back. That is what the
 * handle has meant on a phone for a decade, and drawing one that did nothing was
 * the reason this needed a close button at all.
 *
 * Focus is trapped and restored, the page behind is inert and does not scroll,
 * Esc closes, and a tap on the backdrop closes — all from the primitive.
 *
 * Two pieces of CSS carry the motion, and they are not interchangeable:
 *
 * - a `transform` **transition**, which is what animates the snap-back when a
 *   drag is released short of the threshold. Ark sets `transition-duration: 0s`
 *   inline while a finger is down, so the drag itself stays on the finger.
 * - a `[data-state=closed]` **animation**, which is what plays on the way out.
 *   It has to be an animation rather than a transition: Ark's presence machine
 *   waits for `animationend` before unmounting and treats "no animation" as
 *   "already gone", so a transition-only sheet vanishes instantly instead of
 *   sliding.
 */
interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** A row pinned below the scrolling body — 초기화 / 결과 보기. */
  footer?: React.ReactNode
  children: React.ReactNode
}

export function Sheet({ open, onOpenChange, title, footer, children }: SheetProps) {
  return (
    <Drawer.Root
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
        <Drawer.Backdrop className={backdrop} />
        <Drawer.Positioner className={positioner}>
          {/*
            `draggable={false}` confines dragging to the handle. The body of this
            sheet scrolls, and a drag that starts on a chip rail would otherwise
            be competing with it for the same gesture.

            No `aria-label`: rendering `Drawer.Title` is what makes Ark set
            `aria-labelledby`, and adding a label as well would replace the
            heading the user can see with a duplicate of it.
          */}
          <Drawer.Content className={content} draggable={false}>
            <Drawer.Grabber className={grabber}>
              <Drawer.GrabberIndicator className={grabberBar} />
            </Drawer.Grabber>

            <header className={sheetHeader}>
              <Drawer.Title className={css({ textStyle: 'heading' })}>{title}</Drawer.Title>

              {/*
                The close control the handle replaced, kept for anyone who cannot
                use it. Dragging is a path-based gesture; the alternatives that
                come with the primitive are Esc, which needs a keyboard, and a
                tap on the backdrop, which is inert to a screen reader precisely
                because this is a modal. That leaves touch-with-assistive-tech
                users nothing, so they get a button and nobody else sees one.
              */}
              <Drawer.CloseTrigger className={css({ srOnly: true })}>
                닫기
              </Drawer.CloseTrigger>
            </header>

            <div className={body}>{children}</div>

            {footer && <footer className={sheetFooter}>{footer}</footer>}
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
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
  // Snap-back. Ark zeroes this inline while a finger is down.
  transitionProperty: 'transform',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-state=open]': { animation: 'sheetIn' },
  '&[data-state=closed]': { animation: 'sheetOut' },
  _motionReduce: {
    transitionDuration: '1ms',
    '&[data-state=open]': { animation: 'fadeIn' },
    '&[data-state=closed]': { animation: 'fadeOut' },
  },
})

/**
 * The drag target, sized well past the bar it contains.
 *
 * The visible handle is 36×4; a 4px-tall grab area would be a gesture only a
 * stylus could start. The padding is the affordance.
 */
const grabber = css({
  display: 'grid',
  placeItems: 'center',
  py: '3',
  cursor: 'grab',
  '&[data-dragging]': { cursor: 'grabbing' },
})

const grabberBar = css({
  width: '9',
  height: '1',
  rounded: 'full',
  bg: 'border.strong',
  transitionProperty: 'background-color',
  transitionDuration: 'fast',
  '[data-dragging] &': { bg: 'fg.subtle' },
})

const sheetHeader = css({
  px: '5',
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
