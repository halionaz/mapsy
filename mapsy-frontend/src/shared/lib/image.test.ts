import { describe, expect, it } from 'vitest'
import { coverCropRect, fitWithin, FULL_MAX_EDGE } from './image'

describe('fitWithin', () => {
  it('가로 사진을 긴 변 기준으로 줄인다', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 })
  })

  it('세로 사진을 긴 변 기준으로 줄인다', () => {
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 })
  })

  it('이미 작은 사진은 키우지 않고 그대로 둔다', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })

  it('딱 한도에 걸린 것은 할 일 없음으로 본다', () => {
    expect(fitWithin(1280, 720, 1280)).toEqual({ width: 1280, height: 720 })
  })

  it('극단적인 비율에서도 짧은 변을 1px 이상으로 지킨다', () => {
    // 10000×3 파노라마는 높이가 0으로 반올림되어 캔버스가 던진다.
    const { height } = fitWithin(10000, 3, FULL_MAX_EDGE)
    expect(height).toBeGreaterThanOrEqual(1)
  })

  it('정사각을 다룬다', () => {
    expect(fitWithin(2000, 2000, 1280)).toEqual({ width: 1280, height: 1280 })
  })
})

describe('coverCropRect', () => {
  it('가로 사진은 좌우 가운데를 자른다', () => {
    expect(coverCropRect(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 })
  })

  it('세로 사진은 상하 가운데를 자른다', () => {
    expect(coverCropRect(3000, 4000)).toEqual({ sx: 0, sy: 500, size: 3000 })
  })

  it('정사각에는 아무 일도 하지 않는다', () => {
    expect(coverCropRect(1000, 1000)).toEqual({ sx: 0, sy: 0, size: 1000 })
  })

  it('원본 바깥을 읽지 않는다', () => {
    const { sx, sy, size } = coverCropRect(1001, 750)
    expect(sx + size).toBeLessThanOrEqual(1001)
    expect(sy + size).toBeLessThanOrEqual(750)
  })
})
