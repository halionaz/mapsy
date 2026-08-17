import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { PHOTO_CORS } from '@/shared/api/photoCache'
import { clamp } from '@/shared/lib/clamp'
import * as styles from './PhotoViewer.css'
import { indexAfterChange } from '../lib/followSlots'
import type { PhotoSlot } from '../lib/photoSlots'
import {
  DOUBLE_TAP_SCALE,
  IDENTITY,
  clampToBounds,
  distance,
  focusOf,
  isZoomed,
  midpoint,
  pageAfterSwipe,
  pinchScale,
  resistEdge,
  transformAround,
  transformToCenter,
  type Point,
  type Transform,
} from '../lib/photoTransform'

/**
 * 전체 화면 사진 뷰어 — 스와이프로 넘기고, 핀치나 더블탭으로 확대하고, 끌어서 옮긴다.
 *
 * 모든 제스처를 직접 다루는 것은 의도한 거래다. 브라우저의 핀치는 비주얼 뷰포트를 확대해
 * 크롬까지 함께 커지고, 가로 스크롤러 안의 두 손가락 제스처는 스크롤로 가져가진다.
 * `touch-action: none`으로 표면을 소유하면 페이징·확대·이동을 어느 쪽인지 아는 코드
 * 하나가 정한다. 대가는 스냅을 직접 쓰는 것과, 튕김에 관성이 없다는 것이다.
 *
 * 기하는 검사할 수 있는 자리인 `photoTransform.ts`에 있다. 네이티브 `<dialog>`라
 * Esc·포커스 트랩·뒤 페이지 비활성화는 플랫폼의 몫이다.
 */

interface PhotoViewerProps {
  /**
   * 옷이 가진 모든 사진을 순서대로. 각각이 아직 도착했는지를 싣는다.
   *
   * URL 목록이 아니라 슬롯이다. 맨 `string[]`은 왜 짧은지 말하지 못한다 — 서명 중인
   * 사진과 실패한 사진이 똑같이 없음으로 오고, 뷰어는 볼 수 없는 차이를 그리게 된다.
   * 그 구분이 `photoSlots`의 존재 이유이고, 이 경계에서 납작하게 만들면 만든 지 한
   * 호출 만에 버리는 셈이다.
   */
  slots: PhotoSlot[]
  /** 어느 사진으로 열지. 슬롯에 없으면 첫 장. */
  startId: string | null
  /** 옷 이름 — 접근 가능한 이름과 각 사진의 alt에 쓴다. */
  title: string
  /**
   * 지금 화면에 있는 사진. 뷰어 뒤의 스트립이 이것을 따라가므로, 닫았을 때 열었던 사진이
   * 아니라 보고 있던 사진이 남는다.
   */
  onPageChange?: (slot: PhotoSlot) => void
  /**
   * 여기서 사진이 로드되지 않았다. 선택이 아니라 필수다 — 첫 장을 뺀 모든 사진에게는
   * 여기가 어디에서든 첫 시도이므로(뒤의 타일은 lazy다), 뷰어가 그 발견을 혼자 알고
   * 있으면 타일이 오지 않을 사진을 계속 내준다.
   */
  onLoadError: (id: string) => void
  onClose: () => void
}

const DOUBLE_TAP_MS = 300
/** 이보다 덜 움직인 누름은 끌기가 아니라 탭이다. */
const TAP_SLOP_PX = 12
/** 이보다 멀리 떨어진 두 탭은 더블탭이 아니라 탭 둘이다. */
const DOUBLE_TAP_SLOP_PX = 40
const SNAP_TRANSITION = 'transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)'

/**
 * 페이지 위에 무엇을 말할지. 사진이 스스로 말하면 `null`.
 *
 * "서명됐다"와 "도착했다"는 다른 일이라, `ready` 슬롯도 픽셀이 오기 전까지는 기다림이다 —
 * 그래서 슬롯만이 아니라 URL을 묻는다.
 */
function pageMessage(slot: PhotoSlot, decoded: ReadonlySet<string>): string | null {
  if (slot.state === 'failed') return '사진을 불러오지 못했어요'
  if (slot.state === 'ready') return decoded.has(slot.url) ? null : '사진을 불러오는 중…'
  return '사진을 불러오는 중…'
}

type Gesture =
  /** 한 손가락, 사진은 원래 크기 — 트랙을 옆으로 끈다. */
  | { kind: 'swipe'; startX: number; dx: number }
  /** 한 손가락, 사진은 확대됨 — 사진을 틀 안에서 끈다. */
  | { kind: 'pan'; startX: number; startY: number; lastX: number; lastY: number }
  /** 두 손가락 — 그 사이의 점을 중심으로 배율을 바꾼다. */
  | { kind: 'pinch'; startDistance: number; startScale: number; focus: Point }

export function PhotoViewer({
  slots,
  startId,
  title,
  onPageChange,
  onLoadError,
  onClose,
}: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const imageRefs = useRef<(HTMLImageElement | null)[]>([])

  // 한 번 계산해 초기 상태와 아래 앉히기 effect가 함께 쓴다. 아니면 같은 식이 두 번
  // 적히고 한 번만 고쳐진다.
  const startIndex = Math.max(
    0,
    slots.findIndex((slot) => slot.id === startId),
  )

  // 0에 두고 아래 effect가 고치게 하지 않고 처음부터 앉힌다. 현재 페이지 주변의 창이
  // 어떤 사진을 받을지 정하므로, 잠깐 틀린 인덱스는 틀린 사진을 받아오는 일이다.
  const [index, setIndex] = useState(startIndex)

  /**
   * 실제로 도착한 사진을 URL로.
   *
   * `ready`는 URL이 서명됐다는 뜻이지 픽셀이 와서 디코드됐다는 뜻이 아니다. 그 사이의
   * `<img>`는 고유 크기가 없어서 페이지는 뷰어의 검은 배경에 카운터만 얹힌 상태가 된다.
   *
   * 사진 id가 아니라 URL로 잡는 것은, 재서명이 같은 사진에 다시 받아야 하는 새 URL을
   * 주기 때문이다 — id로 잡으면 새 URL을 이미 도착한 것으로 보고하고, 이 상태가 막으려던
   * 빈 페이지를 돌려준다.
   */
  const [decoded, setDecoded] = useState<ReadonlySet<string>>(() => new Set())

  function markDecoded(url: string) {
    setDecoded((seen) => (seen.has(url) ? seen : new Set(seen).add(url)))
  }

  // 제스처 상태는 state가 아니라 ref에 산다. 핀치는 손가락마다 프레임마다 pointermove를
  // 내고, React가 달리 신경 쓰지 않는 transform을 옮기려고 그때마다 트리를 다시 그리면
  // 뷰어가 끊긴다. `index`만 예외다 — 카운터가 그것으로 그려진다.
  const indexRef = useRef(index)

  // ref로 읽어서 `goTo`가 이것을 의존성으로 적지 않게 한다. 호출부가 인라인 클로저를
  // 넘기므로 매 렌더 새 identity가 오고, goTo와 거기 묶인 키 핸들러가 매번 다시
  // 만들어진다 — memo처럼 생겼을 뿐인 memo다.
  const pageChangeRef = useRef(onPageChange)
  useEffect(() => {
    pageChangeRef.current = onPageChange
  })
  const transform = useRef<Transform>(IDENTITY)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })

  const applyTrack = useCallback((page: number, dx: number, animate: boolean) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = animate ? SNAP_TRANSITION : 'none'
    // 퍼센트는 트랙 자신의 너비를 기준으로 풀리고 그 너비가 사진 한 장이라, -100%가
    // 정확히 한 페이지다.
    track.style.transform = `translate3d(calc(${-page * 100}% + ${dx}px), 0, 0)`
  }, [])

  const applyPhoto = useCallback((animate: boolean) => {
    const image = imageRefs.current[indexRef.current]
    if (!image) return
    const { scale, x, y } = transform.current
    image.style.transition = animate ? SNAP_TRANSITION : 'none'
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
  }, [])

  const resetZoom = useCallback(
    (animate: boolean) => {
      transform.current = IDENTITY
      applyPhoto(animate)
    },
    [applyPhoto],
  )

  /**
   * 화면에 있는 사진을 id로.
   *
   * `index`는 위치이고, 위치는 그 아래 컬렉션이 바뀌는 순간 같은 뜻이기를 그만둔다.
   * 이것이 그것을 살아남는다 — 아래의 컬렉션 추적 effect 참고.
   */
  const shownIdRef = useRef<string | null>(null)

  const goTo = useCallback(
    (next: number, animate = true) => {
      // `pageAfterSwipe`가 필요로 하는 것과 같은 이유의 `Math.max` — 사진이 없으면
      // 마지막 인덱스가 -1이고, 0과 -1 사이로 가두면 -1이 나온다.
      const target = clamp(next, 0, Math.max(0, slots.length - 1))
      const shown = slots[target]
      // 인덱스가 움직이기 전에 되돌린다 — 원래 크기로 돌아가는 것이 떠나는 사진이어야
      // 한다. 지난번 배율이 남은 페이지에 도착하는 것은 버그로 읽힌다.
      //
      // 위치가 아니라 id로 비교한다. 앞의 사진이 지워져 *자리만 옮긴* 사진은 여전히
      // 보고 있던 사진이고, 그것을 원래 크기로 되돌리는 것은 다른 데서 일어난 일에
      // 뷰어가 반응하는 일이다.
      if (shown?.id !== shownIdRef.current) resetZoom(false)
      shownIdRef.current = shown?.id ?? null
      indexRef.current = target
      setIndex(target)
      if (shown) pageChangeRef.current?.(shown)
      applyTrack(target, 0, animate)
    },
    [slots, applyTrack, resetZoom],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()

    // `<dialog>`는 페이지를 비활성으로 만들지만 스크롤을 막지는 않는다. iOS에서는
    // 뷰어 뒤의 옷장이 여전히 고무줄처럼 늘어난다.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // `index`가 이미 부르고 있는 페이지 아래로 트랙을 옮긴다 — 초기 상태는 맞는 페이지지만
  // 그것을 보여주는 transform은 DOM 쓰기이고, DOM 쓰기는 여기서 한다.
  //
  // 손으로 하지 않고 `goTo`를 거치므로 뒤 스트립도 뷰어가 어디 앉았는지 듣는다.
  //
  // 여기서 `slots`가 비었다는 것은 사진이 아예 없는 옷이라는 뜻이지 사진을 모른다는
  // 뜻이 아니다.
  const seated = useRef(false)
  useEffect(() => {
    if (seated.current || slots.length === 0) return
    seated.current = true
    goTo(startIndex, false)
  }, [slots.length, startIndex, goTo])

  /**
   * 뷰어 아래에서 컬렉션이 바뀌면 따라간다. 달리 그것을 하는 것이 없다 — 인덱스는
   * 앉히기·방향키·스와이프 끝에서만 움직이고 `startId`는 앉힐 때 한 번 읽힌다.
   *
   * 규칙과 그것이 막는 두 실패는 `../lib/followSlots`에 있다.
   */
  useEffect(() => {
    const target = indexAfterChange(slots, shownIdRef.current, indexRef.current)
    if (target !== null) goTo(target, false)
    // `goTo`가 돌았으리라 믿지 않고 뒤에서 다시 읽는다. 화면은 바뀌었는데 `null`이
    // 반환되는 가지가 하나 있다 — 지워진 사진의 자리를 같은 인덱스가 이어받는 경우
    // (`[A,B]`에서 A가 사라지면 인덱스 0이 B다). 거기서 id를 지워진 사진에 두면 화면에
    // 무엇이 있는지에 대한 유일한 출처가 조용히 틀린다.
    shownIdRef.current = slots[indexRef.current]?.id ?? null
  }, [slots, goTo])

  // 재서명은 현재 페이지에 새 URL을, 그리고 transform이 없는 새 `<img>`를 건넨다 —
  // `transform.current`는 사라진 쪽을 여전히 서술하는 채로. 그대로 두면 뷰어는 확대돼
  // 있다고 믿는데 화면의 사진은 아니어서, 한 손가락 끌기가 이동으로 가고 스와이프가 멈춘다.
  const currentUrl = slots[index]?.url ?? null
  useEffect(() => {
    resetZoom(false)
  }, [currentUrl, resetZoom])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') goTo(indexRef.current + 1)
      else if (event.key === 'ArrowLeft') goTo(indexRef.current - 1)
      else return
      event.preventDefault()
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [goTo])

  /** 틀의 측정값을 경계 검사에 넣는다. */
  function settle(next: Transform): Transform {
    const image = imageRefs.current[indexRef.current]
    const stage = stageRef.current
    if (!image || !stage) return next
    // offsetWidth는 배치된 크기라 transform의 영향을 받지 않는다 — 핀치가 얼마나
    // 진행됐든 맞는 값이다.
    return clampToBounds(
      next,
      { width: image.offsetWidth, height: image.offsetHeight },
      { width: stage.clientWidth, height: stage.clientHeight },
    )
  }

  /** 스테이지 중앙 기준의 포인터 위치. 사진의 transform-origin이 거기 있다. */
  function toStageCenter(point: Point): Point {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: point.x - (rect.left + rect.width / 2), y: point.y - (rect.top + rect.height / 2) }
  }

  /** 살아 있는 두 포인터. 핀치가 더 이상 핀치가 아니면 undefined. */
  function fingerPair(): [Point, Point] | undefined {
    const [a, b] = [...pointers.current.values()]
    return a && b ? [a, b] : undefined
  }

  function beginPinch() {
    const pair = fingerPair()
    if (!pair) return
    // 두 손가락이 같은 프레임에 닿는 일은 드물어서, 첫 손가락이 보통 트랙을 몇 픽셀
    // 스와이프로 끌어놓은 뒤다. 여기서부터는 아무도 트랙을 다시 건드리지 않으므로
    // (제스처가 이제 사진의 것이다) 이것이 없으면 다음 스와이프까지 페이지가 어긋난 채 앉아 있다.
    applyTrack(indexRef.current, 0, true)

    const mid = toStageCenter(midpoint(...pair))
    gesture.current = {
      kind: 'pinch',
      startDistance: distance(...pair),
      startScale: transform.current.scale,
      focus: focusOf(mid, transform.current),
    }
  }

  function handlePointerDown(event: React.PointerEvent) {
    stageRef.current?.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size >= 2) {
      beginPinch()
    } else {
      gesture.current = isZoomed(transform.current)
        ? {
            kind: 'pan',
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
          }
        : { kind: 'swipe', startX: event.clientX, dx: 0 }
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const current = gesture.current
    if (!current) return

    if (current.kind === 'pinch') {
      const pair = fingerPair()
      if (!pair) return
      const mid = toStageCenter(midpoint(...pair))
      const scale = pinchScale(current.startDistance, distance(...pair), current.startScale)
      transform.current = settle(transformAround(current.focus, mid, scale))
      applyPhoto(false)
      return
    }

    if (current.kind === 'pan') {
      transform.current = settle({
        ...transform.current,
        x: transform.current.x + (event.clientX - current.lastX),
        y: transform.current.y + (event.clientY - current.lastY),
      })
      current.lastX = event.clientX
      current.lastY = event.clientY
      applyPhoto(false)
      return
    }

    current.dx = resistEdge(event.clientX - current.startX, indexRef.current, slots.length)
    applyTrack(indexRef.current, current.dx, false)
  }

  function handleTap(event: React.PointerEvent) {
    const previous = lastTap.current
    const isDouble =
      event.timeStamp - previous.time < DOUBLE_TAP_MS &&
      distance({ x: event.clientX, y: event.clientY }, previous) < DOUBLE_TAP_SLOP_PX

    if (!isDouble) {
      lastTap.current = { time: event.timeStamp, x: event.clientX, y: event.clientY }
      return
    }
    // 세 번째 탭이 또 다른 더블탭으로 읽히지 않고 처음부터 시작하도록 비운다.
    lastTap.current = { time: 0, x: 0, y: 0 }

    if (isZoomed(transform.current)) {
      resetZoom(true)
      return
    }
    const tapped = toStageCenter({ x: event.clientX, y: event.clientY })
    transform.current = settle(transformToCenter(tapped, DOUBLE_TAP_SCALE))
    applyPhoto(true)
  }

  function handlePointerUp(event: React.PointerEvent) {
    const finished = gesture.current
    pointers.current.delete(event.pointerId)
    if (stageRef.current?.hasPointerCapture(event.pointerId)) {
      stageRef.current.releasePointerCapture(event.pointerId)
    }

    if (finished?.kind === 'pinch') {
      const remaining = [...pointers.current.values()][0]
      // 핀치 도중 손가락 하나를 떼면 제스처가 끝나지 않고 이동으로 이어진다. 화면에
      // 남은 손이 기대하는 것이 그것이다.
      gesture.current = remaining
        ? {
            kind: 'pan',
            startX: remaining.x,
            startY: remaining.y,
            lastX: remaining.x,
            lastY: remaining.y,
          }
        : null
      if (!remaining && !isZoomed(transform.current)) resetZoom(true)
      return
    }

    if (pointers.current.size > 0) return
    gesture.current = null

    if (finished?.kind === 'pan') {
      if (!isZoomed(transform.current)) {
        resetZoom(true)
        return
      }
      // 확대된 상태에서 움직이지 않은 누름은 탭이고, 두 번째 탭이 빠져나오는 길이다 —
      // 이것이 없으면 더블탭은 확대만 한다.
      const travelled = distance(
        { x: event.clientX, y: event.clientY },
        { x: finished.startX, y: finished.startY },
      )
      if (travelled <= TAP_SLOP_PX) handleTap(event)
      return
    }

    if (finished?.kind !== 'swipe') return

    const width = stageRef.current?.clientWidth ?? 1
    const landing = pageAfterSwipe(indexRef.current, finished.dx, width, slots.length)
    if (landing !== indexRef.current) {
      goTo(landing)
      return
    }
    applyTrack(indexRef.current, 0, true)
    if (Math.abs(finished.dx) <= TAP_SLOP_PX) handleTap(event)
  }

  function handlePointerCancel(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size > 0) return
    gesture.current = null
    applyTrack(indexRef.current, 0, true)
    if (!isZoomed(transform.current)) resetZoom(true)
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={`${title} 사진`}
      className={styles.dialog}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div ref={trackRef} className={styles.track}>
          {slots.map((slot, position) => {
            const message = pageMessage(slot, decoded)
            return (
              <div key={slot.id} className={styles.page}>
                {/* 보이는 페이지와 양옆 하나씩만 받아온다. 트랙이 transform으로 움직이므로
                    브라우저가 보기에는 모든 슬라이드가 뷰포트 안이고 `loading="lazy"`는
                    전부를 받아온다 — 뷰어가 열리는 순간 상세 화면의 lazy 타일을 무효로
                    만드는 셈이다. 양옆 하나면 스와이프가 이미 있는 사진에 앉는다. */}
                {Math.abs(position - index) <= 1 && (
                  <>
                    {slot.state === 'ready' && (
                      <img
                        ref={(node) => {
                          imageRefs.current[position] = node
                          // 캐시에 있는 사진은 React가 onLoad를 붙이기 전에 끝날 수
                          // 있다 — `SquarePhoto`가 ref 검사를 두는 것과 같은 경합이고,
                          // 없으면 이미 끝난 기다림을 알리는 문구가 페이지를 덮은 채 남는다.
                          if (node?.complete && node.naturalWidth > 0) markDecoded(slot.url)
                        }}
                        src={slot.url}
                        alt={`${title} 사진 ${position + 1}`}
                        // 서비스워커 사진 캐시가 이것에 기댄다 — 없으면 응답이 opaque라
                        // 만료된 서명의 오류가 사진과 구분되지 않는다. 근거는 상수 옆에.
                        crossOrigin={PHOTO_CORS}
                        // 없으면 마우스 끌기가 네이티브 이미지 드래그를 시작해
                        // 스와이프가 첫 pointermove에서 죽는다.
                        draggable={false}
                        onLoad={() => markDecoded(slot.url)}
                        onError={() => onLoadError(slot.id)}
                        className={styles.photo}
                      />
                    )}

                    {/* 아직 아무것도 없는 페이지가 어떤 없음인지 말한다. 스켈레톤이
                        아니라 말인 것은, 옅게 맥동하는 블록이 페이지 위 사진처럼 보이는데
                        여기는 불 꺼진 방이기 때문이다. */}
                    {message != null && <p className={styles.notice}>{message}</p>}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* 트랙 밖에 둔다. 트랙은 자기 position이 없는 flex 행이라, 안에 넣으면 이
            absolute 중앙 정렬 문구가 닫기 버튼 아래 왼쪽 위 구석에 앉는다. */}
        {slots.length === 0 && <p className={styles.notice}>사진이 없어요</p>}
      </div>

      <div className={styles.topBar}>
        <button
          type="button"
          aria-label="사진 닫기"
          onClick={() => dialogRef.current?.close()}
          className={styles.closeButton}
        >
          <X size={22} />
        </button>

        {slots.length > 1 && (
          <span aria-live="polite" className={styles.counter}>
            {index + 1} / {slots.length}
          </span>
        )}
      </div>
    </dialog>
  )
}
