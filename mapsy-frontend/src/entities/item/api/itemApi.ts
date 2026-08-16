import { removeObjects, settledError, signPaths } from '@/shared/api/storage'
import { getSupabase, STORAGE_BUCKET } from '@/shared/api/supabase'
import { warnIfTruncated } from '@/shared/api/warnIfTruncated'
import { newId } from '@/shared/lib/id'
import type { ProcessedPhoto } from '@/shared/lib/image'
import type { PhotoEntry } from '../model/photoEntries'
import type {
  Item,
  ItemDraft,
  ItemImage,
  ItemStatus,
  ItemWithImages,
  WardrobeItem,
} from '../model/types'
import {
  toImagePayload,
  toItem,
  toItemImage,
  toItemInsert,
  toItemUpdate,
  type UploadedImage,
} from './mapRow'

/**
 * 옷장의 Supabase 접근.
 *
 * 읽기와 갱신에는 소유자 조건이 없다. 정책이 이미 모든 행을 auth.uid()로 좁히고,
 * 클라이언트에서 그것을 되풀이하면 보안이 DB가 아니라 여기 있는 것처럼 보인다.
 *
 * **삭제만 예외다** — `deleteItem`과 `createItem` 안의 롤백은 `.eq('user_id', …)`를
 * 더한다. RLS를 의심해서가 아니라, 그 둘만이 실수를 되돌릴 수 없는 쿼리이기 때문이다.
 * 나머지와 일관되게 "정리"하지 말 것.
 */

const ITEM_COLUMNS = '*'
const IMAGE_COLUMNS = '*'

/**
 * 전량 로드의 상한. 옆의 `count: 'exact'`가 무엇을 위한 것인지는 `warnIfTruncated`에 있다.
 *
 * PRD §8.4이 서버 사이드 필터링으로 넘어갈 지점을 옷 1,000벌쯤으로 잡으므로 그 조금
 * 위에 둔다 — 여기 닿았다는 것은 고장이 아니라 방식을 넘어섰다는 뜻이다.
 */
const ITEM_FETCH_LIMIT = 2000
const IMAGE_FETCH_LIMIT = ITEM_FETCH_LIMIT * 5

export async function fetchWardrobe(): Promise<WardrobeItem[]> {
  const supabase = getSupabase()

  const [itemsResult, imagesResult] = await Promise.all([
    supabase
      .from('items')
      .select(ITEM_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(ITEM_FETCH_LIMIT),
    supabase
      .from('item_images')
      .select(IMAGE_COLUMNS, { count: 'exact' })
      .order('sort_order')
      .limit(IMAGE_FETCH_LIMIT),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (imagesResult.error) throw imagesResult.error

  warnIfTruncated(itemsResult.data?.length ?? 0, itemsResult.count, '아이템')
  warnIfTruncated(imagesResult.data?.length ?? 0, imagesResult.count, '사진')

  const imagesByItem = new Map<string, ReturnType<typeof toItemImage>[]>()
  for (const row of imagesResult.data ?? []) {
    const image = toItemImage(row)
    const list = imagesByItem.get(image.itemId)
    if (list) list.push(image)
    else imagesByItem.set(image.itemId, [image])
  }

  const items = (itemsResult.data ?? []).map((row) => ({
    ...toItem(row),
    images: imagesByItem.get(row.id) ?? [],
  }))

  // 커버 전부를 한 번에 서명한다 — 비용은 경로 수가 아니라 왕복이다.
  const coverPaths = items
    .map((item) => coverOf(item.images)?.thumbPath)
    .filter((path): path is string => Boolean(path))

  const signed = await signPaths(coverPaths)

  return items.map((item) => {
    const cover = coverOf(item.images)
    return { ...item, coverUrl: cover ? (signed.get(cover.thumbPath) ?? null) : null }
  })
}

/**
 * 커버는 `sort_order`가 가장 작은 것이지, 글자 그대로 0이 아니다.
 *
 * `set_item_images`가 위치로 번호를 매기니 보통은 같지만, "0번 아니면 없음"으로 읽으면
 * 어떤 틈이든 사진은 있는데 썸네일이 빈 카드가 된다.
 */
function coverOf<T extends { sortOrder: number }>(images: T[]): T | undefined {
  return images.reduce<T | undefined>(
    (lowest, image) => (!lowest || image.sortOrder < lowest.sortOrder ? image : lowest),
    undefined,
  )
}

function contentTypeOf(ext: ProcessedPhoto['ext']): string {
  return ext === 'webp' ? 'image/webp' : 'image/jpeg'
}

/**
 * 옷을 만들고 사진을 올린다.
 *
 * 사진이 행보다 **먼저** 올라간다. 옷 id를 클라이언트에서 만들어 DB가 아무것도 보기 전에
 * 스토리지 경로를 지을 수 있게 한다. 반대 순서(insert → upload → 실패 시 delete)는
 * 롤백까지 실패하면 사진 없는 유령 행을 남기고, 그건 흔한 짝이다 — 업로드와 롤백이
 * 실패하는 이유가 둘 다 사라진 네트워크다.
 *
 * 창은 줄었지만 0은 아니다. 옷 행만 들어간 경우의 delete에 같은 문제가 있어, 그 실패는
 * 삼키지 않고 알린다.
 */
export async function createItem(
  draft: ItemDraft,
  photos: ProcessedPhoto[],
  userId: string,
): Promise<WardrobeItem> {
  const supabase = getSupabase()
  const itemId = newId()

  const { uploaded, paths } = await uploadPhotos(itemId, userId, photos)

  try {
    const { data, error } = await supabase
      .from('items')
      .insert({ ...toItemInsert(draft, userId), id: itemId })
      .select(ITEM_COLUMNS)
      .single()
    if (error) throw error

    const item = toItem(data)

    try {
      const { data: imageRows, error: imageError } = await supabase
        .from('item_images')
        .insert(
          uploaded.map((image, index) => ({
            ...image,
            item_id: itemId,
            user_id: userId,
            sort_order: index,
          })),
        )
        .select(IMAGE_COLUMNS)
      if (imageError) throw imageError

      const images = (imageRows ?? []).map(toItemImage)
      const cover = coverOf(images)
      const signed = await signPaths(cover ? [cover.thumbPath] : [])

      return {
        ...item,
        images,
        coverUrl: cover ? (signed.get(cover.thumbPath) ?? null) : null,
      }
    } catch (imageError) {
      // 행은 있는데 사진이 없다. 이 순서가 막으려던 상태이므로 도로 뺀다.
      const { error: rollbackError } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId)
      if (rollbackError) {
        console.warn(
          '사진 없는 아이템 행을 되돌리지 못함. 그리드에 빈 카드로 보일 수 있음:',
          rollbackError.message,
        )
      }
      throw imageError
    }
  } catch (insertError) {
    await removeObjects(paths)
    throw insertError
  }
}

/**
 * 사진을 전부 올리고, 그것을 서술할 값을 돌려준다.
 *
 * DB에는 아무것도 쓰지 않는다 — 여기서 실패하면 흔적이 아예 남지 않도록. 올라간 객체는
 * 그때그때 기록하고, 중간에 실패하면 이미 쓴 것을 지운다.
 */
async function uploadPhotos(
  itemId: string,
  userId: string,
  photos: readonly ProcessedPhoto[],
): Promise<{ uploaded: UploadedImage[]; paths: string[] }> {
  const storage = getSupabase().storage.from(STORAGE_BUCKET)
  const uploaded: UploadedImage[] = []
  const paths: string[] = []

  try {
    for (const photo of photos) {
      const imageId = newId()
      const base = `${userId}/${itemId}/${imageId}`
      const path = `${base}.${photo.ext}`
      const thumbPath = `${base}_thumb.${photo.ext}`
      const contentType = contentTypeOf(photo.ext)

      // 성공 보고 뒤가 아니라 업로드를 시도하기 전에 적는다. 실패한 요청도 객체를
      // 남겼을 수 있고 — 끊긴 연결은 이쪽이 포기한 것이지 서버가 되돌린 것이 아니다 —
      // 적히지 않은 경로는 아래 정리가 그냥 지나친다.
      paths.push(path, thumbPath)

      // all이 아니라 allSettled. 실패한 업로드는 보통 reject가 아니라 `{ error }`로
      // resolve하지만(`settledError`) rejection 경로도 실재하고, `Promise.all`은 형제를
      // 기다리지 않고 먼저 거절해 뒤늦게 올라간 객체를 놓친다.
      const [full, thumb] = await Promise.allSettled([
        storage.upload(path, photo.full, { contentType }),
        storage.upload(thumbPath, photo.thumb, { contentType }),
      ])
      const fullError = settledError(full)
      const thumbError = settledError(thumb)
      if (fullError !== null) throw fullError
      if (thumbError !== null) throw thumbError

      uploaded.push({
        id: imageId,
        path,
        thumb_path: thumbPath,
        width: photo.width,
        height: photo.height,
      })
    }

    return { uploaded, paths }
  } catch (uploadError) {
    await removeObjects(paths)
    throw uploadError
  }
}

/**
 * 옷의 사진 목록을 `entries`에 맞춰 다시 쓴다 — 폼에서 고른 것을 올리고, 폼이 놓은
 * 저장본을 지우고, 남은 것을 주어진 순서로 놓는다.
 *
 * 셋이 DB 호출 하나에 들어가는 것은 나눌 수 없기 때문이다. PostgREST 요청은 각각이
 * 트랜잭션이고 `sort_order` CHECK는 즉시라, 사진 다섯 장짜리 옷에는 무언가 지워지기
 * 전까지 넣을 자리가 없다. 요청을 쪼개면 삭제가 혼자 커밋되고, 이어진 저장이 실패하면
 * 추가는 없이 사진만 사라진다.
 * `supabase/migrations/20260816000001_set_item_images.sql`에 근거가 있다.
 *
 * 트랜잭션에 넣을 수 없는 스토리지는 그 둘레에 배치한다 — 업로드가 먼저(참조 없는 객체는
 * 낭비지만 없는 객체는 깨진 이미지다), 고아가 된 객체는 커밋된 뒤에만 지운다.
 */
export async function setItemPhotos(
  item: ItemWithImages,
  entries: readonly PhotoEntry[],
): Promise<{ images: ItemImage[]; coverUrl: string | null }> {
  const picked = entries.flatMap((entry) => (entry.kind === 'picked' ? [entry.photo] : []))
  const { uploaded, paths } = await uploadPhotos(item.id, item.userId, picked)

  const { data, error, status } = await getSupabase().rpc('set_item_images', {
    p_item_id: item.id,
    p_images: toImagePayload(entries, uploaded),
  })

  if (error) {
    // *DB가* 거부했을 때만. 거절된 문장은 함수를 통째로 되돌리므로 이 객체를 가리키는
    // 것이 없고 순수한 낭비다.
    //
    // 나머지는 전부 "모른다"이고, 모르는 것은 두어야 한다. 쓰기는 커밋됐는데 답이 오는
    // 길에 사라졌을 수 있고, 그때 객체를 지우면 행이 깨진 이미지를 그린다. 고아는
    // 복구할 수 있지만 사라진 파일은 아니다.
    //
    // `status !== 0`이 아니라 4xx 구간인 이유가 그것이다. 5xx는 커밋됐을 수도 있는
    // 요청에 PostgREST 앞의 게이트웨이가 답한 것이라, "답했다"를 "되돌렸다"로 읽으면 안 된다.
    if (status >= 400 && status < 500) await removeObjects(paths)
    throw error
  }

  const images = (data ?? []).map(toItemImage)

  // 무엇을 지울지는 폼이 아니라 돌아온 것에서 정한다 — 폼은 남길 것을, 서버는 남은 것을
  // 말한다. 이 화면이 뜬 뒤 다른 기기가 더한 사진은 이 재작성이 지우지만 그 경로는 애초에
  // 우리가 부를 수 있는 이름이 아니었다. 고아가 남고, 그것이 이 거래의 복구 가능한 쪽이다.
  const kept = new Set(images.map((image) => image.id))
  const dropped = item.images.filter((image) => !kept.has(image.id))
  await removeObjects(dropped.flatMap((image) => [image.path, image.thumbPath]))

  // 서명은 따로 실패할 수 있고 던진다 — 그때는 이미 재작성이 커밋된 뒤라, 화면은
  // 성공한 저장에 실패를 알린다. 그래도 그대로 둔다. 재시도가 수렴하고(다음 시도가 전체
  // 목록을 다시 말한다), 대안은 서명되지 않은 커버 URL로 격자를 기워 사진이 있는 옷을
  // 빈 카드로 만드는 것이다.
  const cover = coverOf(images)
  const signed = await signPaths(cover ? [cover.thumbPath] : [])

  return { images, coverUrl: cover ? (signed.get(cover.thumbPath) ?? null) : null }
}

export async function updateItem(id: string, draft: ItemDraft): Promise<Item> {
  const { data, error } = await getSupabase()
    .from('items')
    .update(toItemUpdate(draft))
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .single()

  if (error) throw error
  return toItem(data)
}

export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('items')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
  if (error) throw error
}

export async function setStatus(id: string, status: ItemStatus): Promise<void> {
  const { error } = await getSupabase().from('items').update({ status }).eq('id', id)
  if (error) throw error
}

/**
 * 옷과 그 사진 행, 스토리지 객체를 지운다.
 *
 * 경로를 먼저 읽고, 행을 지우고, 객체를 지운다.
 *
 * 스토리지를 먼저 비우는 쪽이 깔끔해 보이지만 더 나쁜 방향으로 실패한다. 객체를 지운 뒤
 * 행 삭제가 실패하면 사진은 영영 사라지고 옷은 깨진 이미지를 그린다. 이 순서가 남길 수
 * 있는 것은 고아 객체뿐이고, 그것은 버킷을 나열해 행과 맞춰보면 복구된다.
 */
export async function deleteItem(id: string, userId: string): Promise<void> {
  const supabase = getSupabase()

  const { data, error: listError } = await supabase
    .from('item_images')
    .select('path, thumb_path')
    .eq('item_id', id)
  if (listError) throw listError

  const paths = (data ?? []).flatMap((row) => [row.path, row.thumb_path])

  const { data: deleted, error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
  if (error) throw error

  // PostgREST는 "아무것도 안 맞음"을 에러로 부르지 않는다. 행을 돌려받지 않으면 하나도
  // 못 지운 삭제가 성공으로 보고되고, 호출부는 그대로 움직인다 — 카드가 캐시에서
  // 빠지고 화면이 떠나고, 다음 갱신에 옷이 설명 없이 되살아난다.
  if (!deleted?.length) throw new Error('삭제할 옷을 찾지 못했어요.')

  // 치명적이지 않다 — 요청받은 행은 사라졌다. 남은 객체는 용량을 먹을 뿐이고, 여기서
  // 실패하면 사용자에게 삭제가 안 됐다고 말하게 된다.
  await removeObjects(paths)
}
