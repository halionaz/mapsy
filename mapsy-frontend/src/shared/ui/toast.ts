import { createToaster } from '@ark-ui/react'

/**
 * The app's one toast queue.
 *
 * A module-level store rather than a context: the things that need to say
 * something — a mutation's `onError`, an upload that finished — are callbacks,
 * not components, and threading a hook down to them would mean every mutation
 * hook taking a notifier argument. `<Toaster />` is mounted once in the
 * providers and subscribes to this.
 *
 * Toasts are for things the user does not have to act on. Anything that needs a
 * decision is a dialog, and anything that is the answer to a form submission
 * stays next to the form — a message that slides away while someone is reading a
 * field is a message that was not delivered.
 */
export const toaster = createToaster({
  placement: 'bottom',
  // Stacked, not overlapped. Overlap is the Sonner-style pile, which needs the
  // scale/height custom properties to be wired up and only pays for itself when
  // toasts arrive in bursts. Nothing here bursts.
  overlap: false,
  max: 3,
  gap: 10,
  duration: 3200,
  // Cleared past the FAB on the wardrobe screen, which is centred on the same
  // edge and whose top sits at `24px + safe-b + 44px`.
  //
  // The inset has to be added here rather than left to the machine: zag resolves
  // the offset as `max(env(safe-area-inset-bottom), offset)`, not as a sum. A
  // flat `5.5rem` therefore stayed at 88px while the FAB rose with the inset, so
  // on every notched phone — 34px of inset puts the FAB's top at 102px — a toast
  // covered the register button for its whole life. Desktop, where the inset is
  // 0, was the only place it looked right.
  offsets: {
    top: '1rem',
    bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
    left: '1rem',
    right: '1rem',
  },
})
