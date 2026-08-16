import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * `target`이 뷰포트 상단에서 일정 거리 아래의 선을 지나 올라갔는지.
 *
 * 두 화면이 조금 다른 것을 묻는다. 하위 화면 헤더는 "큰 제목이 바 뒤로 갔는가"이고,
 * 선은 바 자체의 높이다 — 그 안에 상단 안전영역 인셋이 들어 있어 가정하지 않고 잰다.
 * 옷장은 "컨트롤 바가 붙었는가"이고, 선은 그 바가 멈추는 자리다.
 *
 * 스크롤 리스너가 아니라 IntersectionObserver인 것은, "이 요소가 아직 그 선 아래인가"가
 * 옵저버가 답하는 질문 그대로이고 메인 스레드 밖에서 답하기 때문이다. 같은 검사를
 * `onscroll` + `getBoundingClientRect`로 쓰면 사진을 디코드하는 중인 화면에서 스크롤
 * 매 프레임마다 레이아웃을 읽게 된다.
 */
export function useScrolledPast(
  target: RefObject<HTMLElement | null>,
  /** 높이가 곧 선이 되는 요소. 없으면 선은 뷰포트 상단이다. */
  below?: RefObject<HTMLElement | null>,
): boolean {
  // `null`은 "측정을 기다리는 중"이고, `below`를 받았을 때만 그렇다.
  const [distance, setDistance] = useState<number | null>(below ? null : 0)
  const [past, setPast] = useState(false)

  useEffect(() => {
    const node = below?.current
    if (!node) return
    // entry의 contentRect가 아니라 `offsetHeight` — 바의 패딩이 높이의 대부분이라
    // 콘텐츠 박스로 재면 기준선이 바 안쪽에 놓인다.
    const measure = () => setDistance(node.offsetHeight)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [below])

  useEffect(() => {
    const node = target.current
    if (!node || distance === null) return
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), {
      rootMargin: `-${distance}px 0px 0px 0px`,
      threshold: 0,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [target, distance])

  return past
}
