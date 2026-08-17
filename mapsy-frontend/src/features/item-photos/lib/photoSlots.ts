/**
 * 옷의 사진과 서명된 URL을 짝짓는다.
 *
 * 세 줄짜리 규칙인데 양방향으로 한 번씩 틀렸다 — "아직 URL이 없음"을 "URL이 빈 채로
 * 돌아옴"으로 읽어 콜드 로드 내내 모든 타일이 실패를 주장했고, 이전 답의 URL을 새 사진
 * 집합에 위치로 맞춰 타일이 이웃의 사진을 보여줬다. 둘 다 호출부를 읽어서는 보이지
 * 않고 둘 다 DOM 없이 보일 수 있어서, 규칙이 테스트 옆인 여기 산다.
 *
 * 실패의 두 출처는 일부러 한 상태로 접는다. 서명하지 못한 사진과 서명은 됐지만 로드되지
 * 않은 사진은 다른 사건이지만 결과가 같다 — 보여줄 것도 열 것도 없다. 둘을 구분하는
 * 화면은 파이프라인의 어느 절반이 깨졌는지를 사용자가 신경 쓰라고 요구하는 것이다.
 */

type PhotoSlotState =
  /** 아직 답이 없다 — 실패가 아니라 스켈레톤. */
  | 'pending'
  /** URL이 있고 동작한다. 뷰어에서 열 수 있는 것은 이것뿐이다. */
  | 'ready'
  /** 서명이 실패했거나, 사진 자체가 로드되지 않았다. */
  | 'failed'

/** 사진 하나가 받아 든 두 URL. 둘은 한 번의 서명에서 함께 온다. */
export interface SignedPhoto {
  /** 상세 화면과 뷰어가 그리는 1280px 원본. */
  url: string | null
  /** 원본이 도착하기 전 그 자리에 깔리는 400px 썸네일. */
  thumbUrl: string | null
}

/**
 * 선택적 필드가 아니라 유니온이라, 타입 검사기에게도 "ready"와 "URL이 있음"이 같은
 * 사실이 된다 — URL이 있다는 것을 먼저 세우지 않고는 집을 수 없다.
 *
 * `thumbUrl`이 `ready`에만 실리는 것은 그것이 원본의 자리표시자이기 때문이다. 그릴 원본이
 * 없는 슬롯에 자리표시자만 남으면, 열 수 없는 사진이 열 수 있는 것처럼 보인다.
 */
export type PhotoSlot =
  | { id: string; state: 'ready'; url: string; thumbUrl: string | null }
  | { id: string; state: Exclude<PhotoSlotState, 'ready'>; url: null; thumbUrl: null }

export function photoSlots(
  photos: readonly { id: string }[],
  /** 서명이 끝나기 전에는 `null`. 끝나면 사진마다 하나씩 순서대로. */
  signed: readonly SignedPhoto[] | null,
  /** URL은 서명됐는데 사진이 로드되지 않은 id. */
  unloadable: ReadonlySet<string> = new Set(),
): PhotoSlot[] {
  // 길이가 다르면 그 URL은 다른 사진 집합을 서술하는 것이다 — 아직 날아오는 중이거나,
  // 이전 답이 상태에 남아 있거나. 어느 쪽이든 위치를 믿을 수 없다.
  const settled = signed != null && signed.length === photos.length

  return photos.map((photo, index) => {
    if (!settled) return { id: photo.id, url: null, thumbUrl: null, state: 'pending' }

    // 위에서 길이를 맞춰봤으므로 여기 없는 자리는 없다.
    const entry = signed[index]
    if (entry.url == null || unloadable.has(photo.id)) {
      return { id: photo.id, url: null, thumbUrl: null, state: 'failed' }
    }
    return { id: photo.id, url: entry.url, thumbUrl: entry.thumbUrl, state: 'ready' }
  })
}
