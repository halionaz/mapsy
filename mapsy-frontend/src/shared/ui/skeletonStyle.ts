import { css } from 'styled-system/css'

/**
 * The tint a placeholder is painted in while the thing it stands for loads.
 *
 * One rule rather than a component, because the shapes differ — a square photo
 * frame, a bar the width of a title — while the material they are cut from
 * should not. Cards and the detail screen both build skeletons out of this, so
 * a loading wardrobe reads as one surface instead of a collage of greys.
 */
export const skeletonSurface = css({
  bg: 'border',
  animation: 'skeletonPulse 1.6s ease-in-out infinite',
  // A placeholder that pulses forever is exactly the kind of motion this
  // setting asks to be spared; the flat tint still reads as "pending".
  _motionReduce: { animation: 'none', opacity: 0.28 },
})
