import { describe, expect, it } from 'vitest'
import { coverCropRect, fitWithin, FULL_MAX_EDGE } from './image'

describe('fitWithin', () => {
  it('scales a landscape photo by its long edge', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 })
  })

  it('scales a portrait photo by its long edge', () => {
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 })
  })

  it('leaves an already-small photo alone rather than upscaling it', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })

  it('treats exactly-at-the-limit as no work', () => {
    expect(fitWithin(1280, 720, 1280)).toEqual({ width: 1280, height: 720 })
  })

  it('keeps the short side at least 1px for extreme aspect ratios', () => {
    // A 10000×3 panorama would round its height to 0 and make the canvas throw.
    const { height } = fitWithin(10000, 3, FULL_MAX_EDGE)
    expect(height).toBeGreaterThanOrEqual(1)
  })

  it('handles squares', () => {
    expect(fitWithin(2000, 2000, 1280)).toEqual({ width: 1280, height: 1280 })
  })
})

describe('coverCropRect', () => {
  it('centres the crop horizontally on a landscape photo', () => {
    expect(coverCropRect(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 })
  })

  it('centres the crop vertically on a portrait photo', () => {
    expect(coverCropRect(3000, 4000)).toEqual({ sx: 0, sy: 500, size: 3000 })
  })

  it('is a no-op on a square', () => {
    expect(coverCropRect(1000, 1000)).toEqual({ sx: 0, sy: 0, size: 1000 })
  })

  it('never reads outside the source', () => {
    const { sx, sy, size } = coverCropRect(1001, 750)
    expect(sx + size).toBeLessThanOrEqual(1001)
    expect(sy + size).toBeLessThanOrEqual(750)
  })
})
