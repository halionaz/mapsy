import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { ItemImage } from '@/entities/item'
import { signPaths, SIGNED_URL_TTL_SECONDS, storageKeys } from '@/shared/api/storage'
import { isSupabaseConfigured } from '@/shared/api/supabase'
import { photoSlots, type PhotoSlot } from '../lib/photoSlots'

/**
 * 옷의 사진을 커버 순서로, 서명된 URL과 짝지어 돌려준다.
 *
 * 옷장 쿼리가 서명하는 것은 커버 썸네일 하나뿐이다. 나머지는 여기서 서명하므로 격자가
 * 아무도 열지 않는 URL의 값을 치르지 않는다.
 *
 * **원본과 썸네일을 함께 서명한다.** 왕복이 아니라 경로 수가 두 배가 되는 것이고, 비용은
 * 왕복 쪽에 있다. 그 대가로 상세 화면이 1280px을 기다리는 동안 400px을 깔 수 있고, 격자를
 * 지나온 커버는 그것을 이미 캐시에 들고 있어 첫 프레임부터 사진이 있다.
 *
 * 두 일이 한 훅에 있는 것은 그것이 하나의 불변식이기 때문이다. URL은 사진과 **위치로**
 * 짝지어지므로, 순서를 한 곳에서 URL을 다른 곳에서 만들면 타일이 이웃의 사진을 보여준다.
 * 호출부는 어긋날 수 없는 슬롯을 받는다.
 */

const NOTHING_UNLOADABLE: ReadonlySet<string> = new Set()

/**
 * 서명 URL을 읽을 가치가 있는 시간. 그것이 존재하는 시간과는 다르다.
 *
 * **빼는 여유가 뷰어가 건네받는 URL 잔여 수명의 하한이다.** 타이머로 재서명하는 것이
 * 없고 갱신에는 계기와 낡은 엔트리가 둘 다 필요하므로, 엔트리는 낡기 직전에 정당하게
 * 제공될 수 있다. 그때 `<img>`가 든 것이 정확히 이 여유다.
 *
 * 그 하한은 `staleTime`에서만 나온다 — `gcTime`은 마지막 관찰자가 떠난 때부터 재므로
 * 올리지 못한다. 같은 값을 쓰는 것은 두 질문의 답이 여기서 우연히 같기 때문이다.
 */
const SIGNED_URL_USEFUL_MS = (SIGNED_URL_TTL_SECONDS - 60 * 60) * 1000

export interface ItemPhotos {
  /** 커버가 먼저. 스트립·점·뷰어가 모두 이 순서를 읽는다. */
  photos: ItemImage[]
  slots: PhotoSlot[]
  /** URL은 서명됐는데 브라우저가 로드하지 못한 사진. */
  markUnloadable: (photoId: string) => void
}

export function useItemPhotos(images: readonly ItemImage[] | undefined): ItemPhotos {
  const photos = useMemo(
    () => [...(images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [images],
  )
  const paths = useMemo(() => photos.flatMap((photo) => [photo.path, photo.thumbPath]), [photos])

  const query = useQuery({
    // 매 렌더 새 배열이어도 된다. react-query는 키를 값으로 해싱하므로 같은 경로가 같은
    // 엔트리를 가리킨다. effect 기반 판본이 경로를 문자열로 잇던 춤도 이것으로 사라진다 —
    // `useEffect`는 identity로 비교해서, 캐시를 기울 때마다(별을 켜는 것만으로도) 새
    // 배열이 생겨 모든 URL을 재서명하고 모든 `<img>`를 다시 마운트했다.
    queryKey: storageKeys.signedUrls(paths),
    queryFn: async () => {
      const signed = await signPaths(paths)
      // 경로 목록이 아니라 사진 목록을 따라 접는다 — 위에서 사진마다 두 경로를 폈으므로,
      // 그대로 돌려주면 슬롯이 이웃의 썸네일을 원본으로 읽는다. 서명하지 못한 경로는
      // `null`이고, 그것이 타일에게 "오는 중"과 "안 왔다"를 구분하게 한다.
      return photos.map((photo) => ({
        url: signed.get(photo.path) ?? null,
        thumbUrl: signed.get(photo.thumbPath) ?? null,
      }))
    },
    enabled: isSupabaseConfigured && paths.length > 0,
    // 옷장 목록의 30분이 아니라 URL이 실제로 사는 시간에 맞춘다. 이 URL이 `<img src>`가
    // 지어지는 재료이고 재서명은 그것을 전부 바꾼다 — 브라우저는 토큰까지 포함한 전체
    // URL로 캐시하므로, 갱신 한 번이 1280px 원본 다섯 장을 폰 연결로 다시 받는다.
    staleTime: SIGNED_URL_USEFUL_MS,
    // 목록 쿼리의 한 시간을 물려받지 않고 읽을 가치가 있는 만큼 붙든다. gcTime은
    // 관찰자가 없어진 뒤에야 시작하므로, 이것이 같은 옷을 *두 번째* 열었을 때 만나는
    // 것이다 — 아직 유효한 URL을, 서명 왕복 없이 그리고 어떤 `<img src>`도 바꾸지 않고
    // 재사용한다. 남는 것은 연 옷마다 문자열 다섯 개다.
    //
    // 이것은 보장이 아니라 비용이다. 위 하한에 닿는 경로를 넓힐 뿐 하한 자체를 낮추지 않는다.
    gcTime: SIGNED_URL_USEFUL_MS,
  })

  /**
   * 끝났는데 보여줄 것이 없다.
   *
   * 이것이 없으면 타일이 영영 스켈레톤 위에 앉아, 새로고침으로 다시 해볼 수 있는 실패가
   * 아니라 느린 네트워크로 읽힌다. (`retry`가 기본이라 시도를 다 쓴 뒤에만 닿는다.)
   */
  const allFailed = useMemo(() => photos.map(() => ({ url: null, thumbUrl: null })), [photos])
  const signed = query.data ?? (query.isError ? allFailed : null)

  const [unloadable, setUnloadable] = useState<ReadonlySet<string>>(NOTHING_UNLOADABLE)
  const [signedFor, setSignedFor] = useState(query.data)

  // 로드되지 않은 것은 이제 없는 URL에서 그랬으므로, 새 서명은 — 다른 옷이든, 앱이
  // 앞으로 나올 때의 갱신이든 — 다시 시도할 자격이 있다. effect가 아니라 렌더 중에
  // 맞추므로 낡은 집합이 한 번 그려지는 일이 없다.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (signedFor !== query.data) {
    setSignedFor(query.data)
    setUnloadable(NOTHING_UNLOADABLE)
  }

  // 일을 아끼려고만 memo하는 것이 아니다. `PhotoViewer`가 이것을 prop으로 받아 페이징
  // 콜백을 짓는다. 매 렌더 새 배열은 매 렌더 새 콜백이고, 거기 묶인 키 핸들러가 매번
  // 떼였다 붙는다. 뷰어에서 스와이프하면 뒤 스트립이 스크롤되어 화면이 다시 그려지므로
  // "매 렌더"는 스와이프의 매 프레임이다.
  const slots = useMemo(() => photoSlots(photos, signed, unloadable), [photos, signed, unloadable])

  return {
    photos,
    slots,
    // 이미 들어 있는 id면 같은 집합을 돌려준다. 매번 새 집합은 매번 새 상태값이고,
    // 이것은 리렌더에도 울릴 수 있는 `<img>` 에러 핸들러에서 불린다.
    markUnloadable: (photoId) =>
      setUnloadable((failed) => (failed.has(photoId) ? failed : new Set(failed).add(photoId))),
  }
}
