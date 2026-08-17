import { encodePhoto, type EncodedPhoto } from './photoEncoder'

/**
 * 사진 인코딩을 메인 스레드 밖으로 내보내는 워커.
 *
 * 사진 다섯 장이면 디코드·리사이즈·인코드가 열 번이고, 그 전부가 동기 캔버스 작업이다.
 * 메인 스레드에서 돌면 등록 화면이 그동안 통째로 얼어 스피너조차 멈춘다 — 사용자에게는
 * 앱이 죽은 것과 구분되지 않는다.
 *
 * 요청을 큐에 쌓지 않고 오는 대로 처리한다. 워커 하나가 직렬로 도는 것이 이미 상한이고,
 * 그 뒤에서 기다리는 것은 어차피 사진 다섯 장뿐이다.
 */

export interface EncodeRequest {
  id: number
  file: File
}

export type EncodeResponse =
  | { id: number; ok: true; photo: EncodedPhoto }
  | { id: number; ok: false }

self.onmessage = async ({ data }: MessageEvent<EncodeRequest>) => {
  try {
    const photo = await encodePhoto(data.file)
    // Blob은 구조적 복제로 건너간다. 바이트가 복사되지 않으므로 transfer 목록이 필요 없다.
    self.postMessage({ id: data.id, ok: true, photo } satisfies EncodeResponse)
  } catch {
    /**
     * 이유를 싣지 않는다. 호출부는 이것을 실패로 읽지 않고 **메인 스레드에서 다시**
     * 해보며, 거기에는 워커에 없는 `<img>` 디코드 경로가 있다. 진짜 실패 메시지는 그
     * 두 번째 시도가 만든다 — 여기 것을 실어 보내면 사용자가 이미 지나간 시도의 이유를
     * 읽게 된다.
     */
    self.postMessage({ id: data.id, ok: false } satisfies EncodeResponse)
  }
}
