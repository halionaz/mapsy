/**
 * Public API of 착용 기록 — recording what was worn, from the wardrobe grid.
 *
 * A feature rather than part of `entities/wear`, because none of it is about
 * what a wear *is*: it is the selection in progress, the button that carries it
 * through its three states, and the row that says which day is being written.
 * The entity underneath knows nothing about any of that.
 */

export {
  closeWearDraft,
  openWearDraft,
  toggleWearDraftItem,
  useWearDraft,
  type WearDraft,
} from './model/wearDraft'

export { WearFab } from './ui/WearFab'
export { WearSelectionBar } from './ui/WearSelectionBar'
