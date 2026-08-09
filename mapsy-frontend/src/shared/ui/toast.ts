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
  // Cleared past the FAB on the wardrobe screen, which sits at 24px above the
  // safe-area inset and would otherwise be covered by every toast. zag composes
  // this with `env(safe-area-inset-bottom)` itself.
  offsets: { top: '1rem', bottom: '5.5rem', left: '1rem', right: '1rem' },
})
