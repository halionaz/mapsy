import { encodePhoto, type EncodedPhoto } from './photoEncoder'
import type { EncodeRequest, EncodeResponse } from './photoEncoder.worker'

/**
 * 고른 사진을 업로드될 것으로 바꾸는, 화면이 쓰는 유일한 입구 — PRD §7.
 *
 * 인코딩 자체는 `photoEncoder`에 있고 여기서는 그것을 **어디서 돌릴지**만 정한다.
 * 워커가 먼저, 안 되면 메인 스레드. 두 경로가 같은 인코더를 지나므로 결과 바이트는 같고,
 * 갈리는 것은 그동안 화면이 반응하느냐뿐이다.
 */

export type { EncodedPhoto }

export interface ProcessedPhoto extends EncodedPhoto {
  /** 즉시 미리보기용 object URL. `releasePreview`로 반납한다. */
  previewUrl: string
}

/**
 * `undefined`는 아직 안 만들어봤다는 뜻, `null`은 쓸 수 없다는 뜻이다.
 *
 * 둘을 가르는 이유는 실패를 기억하기 위해서다 — `null`이면 다시 만들지 않고 곧장 메인
 * 스레드로 간다. 매번 다시 시도하면 워커가 뜨지 못하는 브라우저에서 사진마다 실패한
 * 워커를 하나씩 새로 만든다.
 */
let worker: Worker | null | undefined

/** 아직 답을 기다리는 요청. 워커가 죽으면 전부 폴백으로 흘려보낸다. */
const pending = new Map<number, (photo: EncodedPhoto | null) => void>()
let nextRequestId = 0

function getWorker(): Worker | null {
  if (worker !== undefined) return worker

  // `OffscreenCanvas`가 조건인 것은 워커 안에 다른 캔버스가 없기 때문이다.
  // `photoEncoder`의 `createCanvas`가 이 약속 위에 서 있다.
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    worker = null
    return worker
  }

  try {
    const created = new Worker(new URL('./photoEncoder.worker.ts', import.meta.url), {
      type: 'module',
    })

    created.onmessage = ({ data }: MessageEvent<EncodeResponse>) => {
      const settle = pending.get(data.id)
      if (!settle) return
      pending.delete(data.id)
      settle(data.ok ? data.photo : null)
    }

    /**
     * 워커가 통째로 죽었다. 기다리던 것을 전부 폴백으로 넘기고 다시 만들지 않는다 —
     * 여기까지 왔다는 것은 이 브라우저에서 워커가 뜨지 못한다는 뜻이고, 사진마다
     * 같은 실패를 되풀이할 이유가 없다.
     */
    created.onerror = () => {
      worker = null
      // 핸들러가 이 워커를 참조하므로 놓아주기만 해서는 GC되지 않는다. 스레드가 페이지
      // 수명 내내 남는 것이, 이미 아무도 말을 걸지 않는 워커에게 치를 값은 아니다.
      created.terminate()
      for (const settle of pending.values()) settle(null)
      pending.clear()
    }

    worker = created
  } catch {
    worker = null
  }

  return worker
}

/** 워커에서 인코딩한다. 워커를 쓸 수 없거나 워커가 해내지 못하면 `null`. */
function encodeInWorker(file: File): Promise<EncodedPhoto | null> {
  const active = getWorker()
  if (!active) return Promise.resolve(null)

  const id = nextRequestId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    active.postMessage({ id, file } satisfies EncodeRequest)
  })
}

/**
 * 고른 파일을 업로드될 두 blob으로 바꾼다.
 *
 * 워커가 실패한 파일을 메인 스레드에서 한 번 더 해보는 것은 낭비가 아니다. 워커에는
 * `<img>` 디코드 대체 경로가 없어서, `createImageBitmap`이 다루지 못하는 포맷이
 * 정확히 여기서 갈린다. 실패의 최종 이유도 그 두 번째 시도가 만든다.
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const encoded = (await encodeInWorker(file)) ?? (await encodePhoto(file))
  return { ...encoded, previewUrl: URL.createObjectURL(encoded.thumb) }
}

export function releasePreview(photo: ProcessedPhoto): void {
  URL.revokeObjectURL(photo.previewUrl)
}
