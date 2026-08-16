import { useEffect, useRef, useState } from 'react'

import { clamp } from '@/shared/lib/clamp'
import {
  readGridGeometry,
  readTransitionMs,
  slotAt,
  slotOffset,
  displaySlot,
  type GridGeometry,
} from '../lib/photoGrid'

/**
 * 길게 눌러 타일을 집고, 끌고, 놓는다.
 *
 * 즉시 끌기가 아닌 것은 피커가 스크롤되는 폼 안에 있어서다. 타일에서 시작한 터치가 둘 중
 * 어느 쪽도 될 수 있어야 하고, 손가락이 스스로 밝히게 두는 것이 유일한 길이다 — 가만히
 * 있으면 재정렬, 움직이면 스크롤. 마우스는 모호하지 않으므로 타이머 없이 몇 픽셀에서 시작한다.
 *
 * 페이지 스크롤이 들린 *뒤에야* 멈추는 것은 `touch-action`이 제스처 시작 때 읽혀 도중에
 * 켤 수 없기 때문이다. 그 순간부터 touchmove를 `preventDefault`하는 수밖에 없고, React의
 * 터치 리스너는 루트에서 passive라 못 하므로 아래에서 네이티브 리스너를 단다.
 */

/** 지나가는 손가락에는 안 걸릴 만큼 길고, 들어올림으로 느껴질 만큼 짧게. */
const HOLD_MS = 220
/** 누르는 동안 이만큼 움직였으면 스크롤하러 온 손가락이다. */
const HOLD_SLOP_PX = 8
/** 마우스 끌기를 시작시키는 움직임. */
const MOUSE_SLOP_PX = 4

interface Held {
  /** 확정된 목록에서 사진이 있는 자리. */
  from: number
  /** 지금 놓으면 도착할 자리. */
  to: number
  /** 포인터가 끄는 동안 자기 슬롯에서의 오프셋. 슬롯으로 애니메이션하는 동안은 `null`. */
  follow: { x: number; y: number } | null
  /** 키보드로 집은 것. 집기가 그것을 만든 포커스보다 오래 살 수 있는 유일한 경로다. */
  keyboard: boolean
}

/**
 * 포인터의 위치를 두 좌표계 모두로.
 *
 * 끌기는 같은 움직임에 서로 다른 두 질문을 하고 둘의 답이 다르다. 그래서 이름이 좌표계를 싣는다.
 *
 * **Page** — 타일의 오프셋과, 포인터 아래가 몇 번 슬롯인가. 격자를 페이지 좌표로 재는
 * 것은 마우스 끌기가 그 아래에서 페이지를 스크롤할 수 있기 때문이다. client 델타로
 * 배치한 타일은 페이지가 움직인 만큼 커서에서 멀어진다.
 *
 * **Client** — 길게 누르기의 slop. *유리 위에서 손가락이 움직였는가*를 묻는다. 패닝은
 * 손가락 아래에서 페이지를 1:1로 스크롤하므로 스크롤 중의 페이지 좌표 이동은 ~0이다.
 * 거기서 재면 스크롤과 가만히 있는 것을 구분할 수 없고, 가만히 있는 것이 타일을 들어올린다.
 */
function pointerPoint(event: React.PointerEvent<HTMLElement>) {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    pageX: event.clientX + window.scrollX,
    pageY: event.clientY + window.scrollY,
  }
}

type PointerPoint = ReturnType<typeof pointerPoint>

interface Gesture {
  pointerId: number
  index: number
  element: HTMLElement
  /** 눌린 자리, 두 좌표계 모두 — `pointerPoint` 참고. */
  start: PointerPoint
  holdTimer: number | null
  lifted: boolean
  /** 어디에 놓일지에 대한 권위 — pointerup은 리렌더보다 먼저 올 수 있다. */
  to: number
}

export interface DragReorder {
  gridRef: React.RefObject<HTMLDivElement | null>
  /** 재정렬 중 격자에 걸린다. 타일의 트랜지션이 여기 매달려 있다. */
  rearranging: boolean
  tileProps: (index: number) => {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
    onBlur: () => void
    'aria-pressed': boolean
  }
  /** `index`의 타일이 자기 슬롯에서 얼마나 떨어져 그려지는지. */
  offsetOf: (index: number) => { x: number; y: number }
  /** 집혀 있는 타일의, 확정된 목록에서의 인덱스. */
  heldIndex: number | null
  /** 손가락이나 마우스가 끄는 중 — 애니메이션이 붙으면 안 되는 구간. */
  following: boolean
  /** `index`의 타일이 그려지는 슬롯 — *보이는* 자리. */
  slotOf: (index: number) => number
  /**
   * 끌기 도중이든 내려앉는 도중이든 재정렬을 버린다.
   *
   * 그 아래 목록을 바꾸려는 호출부를 위한 것이다. 집고 있는 숫자는 곧 사라질 목록의
   * 위치이고, 대기 중인 확정은 방금 지운 사진을 되돌려 놓는다.
   */
  abandon: () => void
  /** 라이브 리전용 — 방금 일어난 일을 한 문장으로. */
  announcement: string
}

export function useDragReorder({
  count,
  onMove,
}: {
  count: number
  onMove: (from: number, to: number) => void
}): DragReorder {
  const gridRef = useRef<HTMLDivElement>(null)
  const geometry = useRef<GridGeometry | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const settleTimer = useRef<number | null>(null)
  const unblockScroll = useRef<(() => void) | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(
    () => () => {
      if (gesture.current?.holdTimer != null) clearTimeout(gesture.current.holdTimer)
      if (settleTimer.current != null) clearTimeout(settleTimer.current)
      unblockScroll.current?.()
    },
    [],
  )

  /** 지원하는 폰에서 짧은 진동. iOS에는 조용히 없다. */
  function tick(pattern: number) {
    navigator.vibrate?.(pattern)
  }

  function measure() {
    const grid = gridRef.current
    geometry.current = grid ? readGridGeometry(grid) : null
  }

  /**
   * 방금 들린 타일 아래에서 페이지가 스크롤되는 것을 멈춘다.
   *
   * effect가 아니라 여기서 다는 것이 요점이다. effect는 자신을 부른 상태보다 한 프레임
   * 뒤에 돌고, 끌기의 첫 touchmove가 그 틈에 떨어질 수 있다. 막지 못한 touchmove 하나면
   * 충분하다 — 브라우저가 스크롤을 시작하고 그 뒤의 모든 touchmove가 `cancelable: false`로
   * 와서, 남은 제스처 내내 페이지와 타일이 함께 움직인다.
   */
  function blockScroll() {
    const grid = gridRef.current
    if (!grid) return
    const hold = (event: TouchEvent) => event.preventDefault()
    grid.addEventListener('touchmove', hold, { passive: false })
    unblockScroll.current = () => grid.removeEventListener('touchmove', hold)
  }

  function lift(current: Gesture) {
    current.lifted = true
    current.holdTimer = null
    measure()
    blockScroll()
    // 타일 밖으로 나간 손가락이 — 그게 요점이다 — 계속 이 타일에 보고하도록.
    current.element.setPointerCapture?.(current.pointerId)
    tick(8)
    setHeld({ from: current.index, to: current.index, follow: { x: 0, y: 0 }, keyboard: false })
    setAnnouncement(`${current.index + 1}번째 사진을 집었어요.`)
  }

  function forget() {
    const current = gesture.current
    if (current?.holdTimer != null) clearTimeout(current.holdTimer)
    gesture.current = null
    unblockScroll.current?.()
    unblockScroll.current = null
  }

  function commit(from: number, to: number) {
    setHeld(null)
    if (from !== to) onMove(from, to)
  }

  function abandon() {
    if (settleTimer.current != null) clearTimeout(settleTimer.current)
    settleTimer.current = null
    forget()
    setHeld(null)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>, index: number) {
    if (held || gesture.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const current: Gesture = {
      pointerId: event.pointerId,
      index,
      element: event.currentTarget,
      start: pointerPoint(event),
      holdTimer: null,
      lifted: false,
      to: index,
    }
    gesture.current = current

    // 마우스는 대신 움직임을 기다린다. 길게 누르기가 가릴 모호함이 없고, 커서가 뭔가를
    // 집기 전의 지연은 고장으로 느껴진다.
    if (event.pointerType !== 'mouse') {
      current.holdTimer = window.setTimeout(() => {
        if (gesture.current === current) lift(current)
      }, HOLD_MS)
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return

    const point = pointerPoint(event)

    if (!current.lifted) {
      // 유리 위에서: 손가락 자체가 움직였는가. 그 아래에서 스크롤된 페이지는 세지
      // 않는다.
      const travelled = Math.hypot(
        point.clientX - current.start.clientX,
        point.clientY - current.start.clientY,
      )
      if (event.pointerType === 'mouse') {
        if (travelled > MOUSE_SLOP_PX) lift(current)
      } else if (travelled > HOLD_SLOP_PX) {
        // 스크롤하러 온 손가락이다. 아직 아무것도 막지 않았으므로 브라우저가 이어간다.
        forget()
      }
      return
    }

    // 여기부터는 문서 좌표다 — 타일의 오프셋도, 포인터 아래 슬롯도 페이지 위 위치에
    // 대한 답이다.
    const follow = {
      x: point.pageX - current.start.pageX,
      y: point.pageY - current.start.pageY,
    }
    const grid = geometry.current
    const to = grid ? slotAt({ x: point.pageX, y: point.pageY }, grid, count) : current.index
    if (to !== current.to) tick(4)
    current.to = to
    setHeld({ from: current.index, to, follow, keyboard: false })
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    if (!current.lifted) {
      forget()
      return
    }

    const { index: from, to } = current
    const tile = current.element.parentElement
    forget()

    /**
     * 들어올릴 때가 아니라 여기서, 토큰이 아니라 타일에서 읽는다.
     *
     * 여기인 이유는 기다려야 할 트랜지션이 `[data-rearranging]`이 켜는 쪽이고 그 속성은
     * 무언가 집혀 있는 동안에만 있기 때문이다. 들어올리는 시점의 타일은 아직 base 규칙의
     * duration으로 답하는데, 오늘 우연히 같은 숫자일 뿐 그림자와 이동이 서로 다른 속도를
     * 원하는 날 갈라진다.
     *
     * 타일에서 읽는 이유는 `prefers-reduced-motion`이 스스로 답하게 하기 위해서다.
     */
    const settle = tile ? readTransitionMs(tile) : 0

    // 오프셋을 놓으면 타일이 자기 슬롯으로 애니메이션한다. 목록은 도착한 뒤에 다시
    // 쓰이므로 DOM 순서가 바뀌는 순간에 눈에 띄게 튀는 것이 없다.
    setHeld({ from, to, follow: null, keyboard: false })
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null
      commit(from, to)
      setAnnouncement(`${to + 1}번째에 놓았어요.`)
    }, settle)
  }

  /**
   * 무언가 포인터를 가져갔다 — 시스템이거나, 브라우저가 결국 자기 것이라고 정한 제스처.
   * 확정하지 않고 사진을 되돌려 놓는다. 끊긴 끌기는 지시가 아니다.
   */
  function handlePointerCancel(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    const lifted = current.lifted
    forget()
    if (!lifted) return
    setHeld(null)
    setAnnouncement('제자리에 놓았어요.')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>, index: number) {
    // 이미 포인터가 무언가를 들고 있거나, 키가 다른 타일의 것이다.
    if (held && (!held.keyboard || held.from !== index)) return

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (!held) {
        measure()
        setHeld({ from: index, to: index, follow: null, keyboard: true })
        setAnnouncement(`${index + 1}번째 사진을 집었어요. 방향키로 옮기고 다시 스페이스를 눌러요.`)
        return
      }
      commit(held.from, held.to)
      setAnnouncement(`${held.to + 1}번째에 놓았어요.`)
      return
    }

    if (!held) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setHeld(null)
      setAnnouncement('제자리에 놓았어요.')
      return
    }

    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (step === 0) return
    event.preventDefault()

    const to = clamp(held.to + step, 0, count - 1)
    if (to === held.to) return
    setHeld({ ...held, to })
    setAnnouncement(`${to + 1}번째로 옮겼어요.`)
  }

  /** `index`의 타일이 그려지는 자리 — 배지와 오프셋이 함께 읽는 하나의 규칙. */
  function slotOf(index: number): number {
    return held ? displaySlot(index, held.from, held.to) : index
  }

  return {
    gridRef,
    rearranging: held !== null,
    heldIndex: held?.from ?? null,
    following: held?.follow != null,
    slotOf,
    abandon,
    announcement,
    tileProps: (index) => ({
      onPointerDown: (event) => handlePointerDown(event, index),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onKeyDown: (event) => handleKeyDown(event, index),
      // 키보드로 집은 것은 포커스된 타일에 산다. 집은 채로 포커스를 잃으면 내려놓을
      // 방법 없이 격자가 열린 채 남는다.
      onBlur: () => {
        if (held?.keyboard && held.from === index) {
          setHeld(null)
          setAnnouncement('제자리에 놓았어요.')
        }
      },
      'aria-pressed': held?.from === index,
    }),
    offsetOf: (index) => {
      if (!held) return { x: 0, y: 0 }
      if (index === held.from && held.follow) return held.follow
      return slotOffset(index, slotOf(index), geometry.current)
    },
  }
}
