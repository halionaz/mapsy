import { useId, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { photoEntryKey, type PhotoEntry } from '@/entities/item'
import { processPhoto, releasePreview } from '@/shared/lib/image'
import { IconButton, Spinner } from '@/shared/ui/Button'
import { SquarePhoto, type PhotoFallback } from '@/shared/ui/SquarePhoto'
import * as styles from './PhotoPicker.css'
import { moveItem } from '../lib/photoGrid'
import { MAX_PHOTOS } from '../model/limits'
import { useDragReorder } from '../model/useDragReorder'

interface PhotoPickerProps {
  photos: PhotoEntry[]
  onChange: (photos: PhotoEntry[]) => void
  /**
   * 옷이 이미 가진 사진의 서명된 URL, 이미지 id로 찾는다. 서명 중이면 없고, 서명하지
   * 못했으면 `null`.
   *
   * 등록에는 이것이 없고 넘기지도 않는다. 편집은 여기서 서명하지 않고 화면에서 받는다 —
   * 그 화면이 손에 든 것은 썸네일이 아니라 상세 화면용으로 이미 서명한 *원본*이다.
   * 그 거래가 싼 이유는 `ItemEditPage`에 있다.
   */
  storedUrls?: ReadonlyMap<string, string | null>
}

/**
 * 옷 폼의 사진 선택·순서·삭제.
 *
 * 가로 스크롤 띠가 아니라 줄바꿈 격자이고, 재정렬은 길게 눌러 끌기다. 둘 다 같은 데서
 * 나온다 — 최대 다섯 장이면 한 화면에 다 들어가고, 옆으로 스크롤되는 띠는 끌기가
 * 작동해야 하는 바로 그 자리에 경쟁하는 제스처를 하나 더 놓는다.
 * 상호작용은 `useDragReorder`, 산술은 `photoGrid`가 든다.
 *
 * 타일은 사진이 이미 스토리지에 있든 방금 고른 것이든 그냥 타일이다. 목록은 순서 있는
 * 하나이고, 어느 쪽이 어느 쪽인지는 저장할 때만 구분이 된다.
 */
export function PhotoPicker({ photos, onChange, storedUrls }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX_PHOTOS - photos.length

  /**
   * *지금*의 목록. 늦게 답하는 두 경로를 위한 것.
   *
   * `handleFiles`는 디코드와 인코드 뒤에 돌아오고, 아래 놓기는 타이머로 확정된다. 둘 다
   * 자신을 시작한 렌더의 목록을 붙들면, 그 사이에 지운 사진이 되살아난다 — 미리보기 URL은
   * 이미 반납된 뒤라 아무것도 가리키지 않는 타일이 된다.
   */
  const photosRef = useRef(photos)
  photosRef.current = photos

  const drag = useDragReorder({
    count: photos.length,
    onMove: (from, to) => onChange(moveItem(photosRef.current, from, to)),
  })

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const accepted = [...fileList].slice(0, remaining)
      const overflow = fileList.length - accepted.length

      // all이 아니라 allSettled. 디코드 안 되는 파일 하나가 함께 고른 사진 전부를
      // 버리고, 성공한 쪽이 이미 잡아둔 미리보기 URL은 아무도 반납하지 않았다.
      const results = await Promise.allSettled(accepted.map(processPhoto))
      const picked = results.flatMap((result): PhotoEntry[] =>
        result.status === 'fulfilled' ? [{ kind: 'picked', photo: result.value }] : [],
      )
      const failed = results.length - picked.length

      if (picked.length > 0) onChange([...photosRef.current, ...picked])

      const notes: string[] = []
      if (overflow > 0) notes.push(`사진은 최대 ${MAX_PHOTOS}장이라 ${overflow}장은 제외했어요.`)
      if (failed > 0) notes.push(`${failed}장은 불러오지 못했어요.`)
      setError(notes.length > 0 ? notes.join(' ') : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 불러오지 못했어요.')
    } finally {
      setBusy(false)
      // 비워야 같은 파일을 지운 뒤 다시 고를 수 있다. 아니면 input이 변경 없음으로
      // 보고하고 아무 일도 일어나지 않는다.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    // 아직 내려앉는 중인 재정렬은 곧 항목을 잃을 목록의 위치를 들고 있고, 그 확정이
    // 지운 사진을 되돌려 놓는다. 삭제가 이긴다 — 재정렬은 다시 하면 되지만, 미리보기가
    // 이미 반납된 채 되살아난 사진은 설명할 수 없다.
    drag.abandon()

    const entry = photos[index]
    // object URL을 가진 것은 고른 사진뿐이다. 저장본은 여기서 목록에서 빠지고 폼이
    // 저장될 때 실제로 지워진다.
    if (entry.kind === 'picked') releasePreview(entry.photo)
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div className={styles.block}>
      <div
        ref={drag.gridRef}
        className={styles.grid}
        data-rearranging={drag.rearranging || undefined}
      >
        {photos.map((entry, index) => {
          const thumb = thumbOf(entry, storedUrls)
          const held = drag.heldIndex === index
          const offset = drag.offsetOf(index)
          const missing = thumb.src === null && thumb.fallback === 'failed'

          return (
            <div
              key={photoEntryKey(entry)}
              className={styles.tile}
              data-held={held || undefined}
              // 손가락 아래 타일은 손가락을 그대로 따라가므로 그동안 트랜지션을 끈다.
              // 인라인 스타일이 아니라 속성으로 말하는 이유는 `tile`에 있다.
              data-following={(held && drag.following) || undefined}
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0)${held ? ' scale(1.06)' : ''}`,
                zIndex: held ? 1 : undefined,
              }}
            >
              <button
                type="button"
                className={styles.grip}
                aria-label={`사진 ${index + 1}${missing ? ', 불러오지 못함' : ''}`}
                aria-describedby={`${uid}-help`}
                {...drag.tileProps(index)}
              >
                {/* 이름은 버튼이 지므로 사진 자체는 장식이다. */}
                <SquarePhoto src={thumb.src} alt="" fallback={thumb.fallback} />
              </button>

              {/* 삭제 컨트롤이 사진 아래가 아니라 위에 앉는다 — 대상이 곧 자기가
                  작용하는 것이어야 하는 유일한 행동이다. 타일 버튼의 자식이 아니라
                  형제인 것은, 버튼 안의 버튼이 유효하지도 닿지도 않기 때문이다. */}
              <IconButton
                label={`사진 ${index + 1} 삭제`}
                size="sm"
                onPhoto
                onClick={() => removeAt(index)}
                className={styles.removeButton}
              >
                <X size={13} />
              </IconButton>

              {/* 목록이 아직 말하는 자리가 아니라 타일이 그려진 자리를 따른다. 사진을
                  맨 앞으로 끄는 것이 커버를 바꾸는 방법이라, 놓기를 기다리는 배지는
                  제스처 내내 밀려나는 타일 위에 남는다. */}
              {drag.slotOf(index) === 0 && <span className={styles.coverTag}>대표</span>}
            </div>
          )
        })}

        {remaining > 0 && (
          <label htmlFor={`${uid}-file`} className={styles.addTile}>
            {busy ? (
              <Spinner size={18} />
            ) : (
              <>
                <ImagePlus size={20} aria-hidden="true" />
                <span>
                  {photos.length}/{MAX_PHOTOS}
                </span>
              </>
            )}
          </label>
        )}
      </div>

      {/* 모든 타일이 이 한 문장을 가리키므로 스크린리더가 타일마다 되풀이한다 —
          동작을 수행하는 자리에서 설명하는 값이다. 그래서 짧은 한 절로 묶는다. */}
      <p id={`${uid}-help`} className={styles.srOnly}>
        스페이스로 집고, 방향키로 옮기고, 스페이스로 놓아요.
      </p>
      <p role="status" aria-live="polite" className={styles.srOnly}>
        {drag.announcement}
      </p>

      <input
        id={`${uid}-file`}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={busy || remaining <= 0}
        onChange={(e) => void handleFiles(e.target.files)}
        className={styles.srOnly}
      />

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * 항목 하나를 타일이 무엇으로 그리는지.
 *
 * 고른 사진은 자기 자신이 미리보기이고 늘 거기 있다. 저장본은 아직 오는 중일 수도,
 * 끝내 안 올 수도 있는 서명 URL이다 — `SquarePhoto`가 이미 긋는 구분이라, 두 번째
 * 어휘를 만들지 않고 그쪽 말로 옮긴다.
 */
function thumbOf(
  entry: PhotoEntry,
  storedUrls: ReadonlyMap<string, string | null> | undefined,
): { src: string | null; fallback: PhotoFallback } {
  if (entry.kind === 'picked') return { src: entry.photo.previewUrl, fallback: 'pending' }

  const url = storedUrls?.get(entry.image.id)
  if (url === undefined) return { src: null, fallback: 'pending' }
  return { src: url, fallback: 'failed' }
}
