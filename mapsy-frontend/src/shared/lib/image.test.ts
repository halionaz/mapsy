import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EncodedPhoto } from './photoEncoder'

/**
 * 인코딩이 **어느 스레드에서 일어나는지**만 검사한다. 나온 사진이 맞는지는
 * `photoEncoder.test.ts`가 보고, 진짜 캔버스는 jsdom에 없다.
 *
 * 이 분기를 붙드는 이유는 폴백이 조용히 죽을 수 있기 때문이다. 워커가 답하지 못할 때
 * 메인 스레드가 이어받지 않으면 사진 등록이 통째로 멈추는데, 워커가 도는 브라우저에서
 * 개발하면 그 경로를 한 번도 지나지 않는다.
 */
vi.mock('./photoEncoder', () => ({ encodePhoto: vi.fn() }))

const ENCODED: EncodedPhoto = {
  full: new Blob(['full']),
  thumb: new Blob(['thumb']),
  width: 1280,
  height: 960,
  ext: 'webp',
}

const FILE = new File(['raw'], 'garment.jpg', { type: 'image/jpeg' })

/** 워커가 만들어지기는 하는데 파일을 해내지 못하는 경우 — `ok: false`로 답한다. */
class GivingUpWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null

  postMessage(request: { id: number }) {
    // 진짜 워커처럼 다음 틱에 답한다. 같은 틱은 호출부가 아직 대기 목록에 들어가기 전이다.
    queueMicrotask(() => this.onmessage?.({ data: { id: request.id, ok: false } } as MessageEvent))
  }
}

/**
 * 통째로 죽는 워커 — 답 대신 `onerror`가 운다. 스크립트를 못 읽었거나 스레드가 사라진 경우다.
 *
 * `terminated`를 세는 것은 그 경로가 워커를 놓아주기만 하고 끝내지 않으면, 아무도 말을
 * 걸지 않는 스레드가 페이지 수명 내내 남기 때문이다.
 */
class DyingWorker {
  static terminated = 0
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    /**
     * 스크립트를 못 읽은 워커를 흉내낸다 — 그래서 요청과 무관하게 한 번만 운다.
     *
     * `onerror`가 그 경우에만 우는 것은 아니다. 워커 안의 잡히지 않은 예외마다 울고,
     * 그것은 요청당 일어날 수 있다. 지금 워커는 `self.onmessage` 전체가 try/catch라
     * 그 경로가 없어서 이 모양이 실물과 맞는다 — 그 try가 사라지면 여기도 같이 봐야 한다.
     *
     * 다음 틱인 것은 `onerror`가 아직 대입되기 전이기 때문이다. 생성자는 그 대입보다
     * 먼저 끝난다.
     */
    queueMicrotask(() => this.onerror?.())
  }

  postMessage() {}

  terminate() {
    DyingWorker.terminated += 1
  }
}

/** 잘 도는 워커. 인코딩은 여기서 끝나고 메인 스레드는 불려서는 안 된다. */
class WorkingWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null

  postMessage(request: { id: number }) {
    queueMicrotask(() =>
      this.onmessage?.({ data: { id: request.id, ok: true, photo: ENCODED } } as MessageEvent),
    )
  }
}

async function importProcessPhoto() {
  // `image.ts`가 워커 핸들을 모듈 수준에 기억하므로, 초기화하지 않으면 두 번째 테스트가
  // 첫 번째의 워커를 물려받는다.
  vi.resetModules()
  // 인코더를 먼저 — `image.ts`가 그것을 정적으로 import하므로, 둘을 동시에 부르면
  // 어느 쪽이 먼저 모듈 캐시에 앉는지가 경합이 된다.
  const { encodePhoto } = await import('./photoEncoder')
  const { processPhoto } = await import('./image')
  return { processPhoto, encodePhoto: vi.mocked(encodePhoto) }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  // `resetModules`는 모듈 캐시만 비우고 mock은 그대로 둔다 — 이게 없으면 호출 수가
  // 테스트를 넘어 쌓인다.
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  // 워커가 만들어질 조건 — 둘 다 jsdom에 없어서 스텁하지 않으면 항상 폴백만 돈다.
  vi.stubGlobal('OffscreenCanvas', class {})
})

describe('processPhoto', () => {
  it('워커를 쓸 수 없으면 메인 스레드에서 인코딩한다', async () => {
    vi.stubGlobal('Worker', undefined)
    const { processPhoto, encodePhoto } = await importProcessPhoto()
    encodePhoto.mockResolvedValue(ENCODED)

    const photo = await processPhoto(FILE)

    expect(encodePhoto).toHaveBeenCalledTimes(1)
    expect(photo.previewUrl).toBe('blob:preview')
  })

  it('워커가 해내지 못한 파일을 메인 스레드가 다시 해본다', async () => {
    vi.stubGlobal('Worker', GivingUpWorker)
    const { processPhoto, encodePhoto } = await importProcessPhoto()
    encodePhoto.mockResolvedValue(ENCODED)

    const photo = await processPhoto(FILE)

    expect(encodePhoto).toHaveBeenCalledTimes(1)
    expect(photo.full).toBe(ENCODED.full)
  })

  it('워커가 통째로 죽어도 기다리던 사진이 메인 스레드로 넘어간다', async () => {
    DyingWorker.terminated = 0
    vi.stubGlobal('Worker', DyingWorker)
    const { processPhoto, encodePhoto } = await importProcessPhoto()
    encodePhoto.mockResolvedValue(ENCODED)

    // 두 장을 동시에 — `onerror`는 요청 하나가 아니라 대기 목록 전체를 상대한다.
    const [first, second] = await Promise.all([processPhoto(FILE), processPhoto(FILE)])

    expect(first.full).toBe(ENCODED.full)
    expect(second.full).toBe(ENCODED.full)
    expect(DyingWorker.terminated).toBe(1)
  })

  it('워커가 해냈으면 메인 스레드를 부르지 않는다', async () => {
    vi.stubGlobal('Worker', WorkingWorker)
    const { processPhoto, encodePhoto } = await importProcessPhoto()

    const photo = await processPhoto(FILE)

    expect(encodePhoto).not.toHaveBeenCalled()
    expect(photo.thumb).toBe(ENCODED.thumb)
  })
})
