import { useCallback, useRef, useState } from 'react'

import { PHOTO_CORS } from '@/shared/api/photoCache'
import * as styles from './SquarePhoto.css'

/**
 * 크기가 변하지 않는 1:1 사진 상자.
 *
 * 이미지에서 크기를 받지 않고 선언으로 정사각인 것은, URL이 비동기로 서명된 뒤 디코드까지
 * 되어야 해서 마운트와 페인트 사이에 "사진이 있다는 건 알지만 그릴 게 없는" 구간이 있기
 * 때문이다. 그 구간 동안 상자가 접히면 아래 것들이 사진이 도착할 때마다 밀린다.
 *
 * `fit`은 재사용 전에 읽어야 하는 부분이다. 정사각인 것은 *썸네일*뿐이라(`processPhoto`가
 * 업로드 때 가운데를 잘라낸다) 썸네일의 `cover`는 아무 일도 하지 않는다. 원본은 찍힌
 * 비율 그대로라, 원본에 `cover`를 걸면 긴 옷의 위아래가 진짜로 잘린다. 상세 화면은 그걸
 * 감수한다 — 탭하면 전체 뷰어가 열려 사진 전체를 맞춰 보여주기 때문이다.
 */

/** `src`가 없다는 것이 무슨 뜻인지. 셋 다 여기서는 `null`이라 호출부가 말해줘야 한다. */
export type PhotoFallback =
  /** 사진이 오는 중 — 스켈레톤을 유지한다. */
  | 'pending'
  /** 기다릴 사진이 없다. */
  | 'empty'
  /** 있었는데 도착하지 못했다. */
  | 'failed'

interface SquarePhotoProps {
  /** URL을 서명하는 중이거나, 사진이 없을 때 `null`. */
  src: string | null
  alt: string
  /** 여기서 `src == null`이 무슨 뜻인지. */
  fallback?: PhotoFallback
  /**
   * `src`가 도착할 때까지 그 자리에 깔 저해상도 사진. 없으면 스켈레톤만 보인다.
   *
   * 스켈레톤을 대신하지 않고 **덮는다** — 자리표시자 자신도 로드되지 않을 수 있고, 그때
   * 아래에 아무것도 없으면 상자가 빈 채로 남는다.
   */
  placeholder?: string | null
  /** `cover`는 정사각을 채우며 자르고, `contain`은 사진 전체를 맞춘다. */
  fit?: 'cover' | 'contain'
  /** `flush`는 모서리와 실선을 없앤다 — 페이지 가장자리로 쓰이는 사진용. */
  shape?: 'card' | 'flush'
  /** 이미 화면에 있는 사진(첫 타일 등)은 `eager`. */
  loading?: 'eager' | 'lazy'
  /**
   * 사진이 있었는데 로드되지 않았다.
   *
   * 그리기만 하지 않고 알리는 이유는, 사진이 멀쩡하다고 믿는 호출부가 계속 그것을
   * 내주기 때문이다 — 불러오지 못함이라 적힌 타일이 같은 깨진 URL로 전체 뷰어를 여는
   * 것이 이 컴포넌트가 잡던 실패보다 나쁘다.
   */
  onLoadError?: () => void
  /** 사진 위에 그리는 오버레이 — 즐겨찾기 별, 업로드 스크림. */
  children?: React.ReactNode
}

// 여기서 소유해서, 로드에 실패한 사진과 URL이 오지 않은 사진이 같은 사용자에게 서로 다른
// 말을 하지 않도록 한다.
const FALLBACK_LABELS: Record<Exclude<PhotoFallback, 'pending'>, string> = {
  empty: '사진 없음',
  failed: '불러오지 못함',
}

/** 어떤 URL이 어떻게 끝났는지. URL로 키를 잡아 재서명된 사진은 처음부터 다시 시작한다. */
interface LoadState {
  src: string
  outcome: 'loaded' | 'failed'
}

export function SquarePhoto({
  src,
  alt,
  fallback = 'pending',
  placeholder,
  fit = 'cover',
  shape = 'card',
  loading = 'lazy',
  onLoadError,
  children,
}: SquarePhotoProps) {
  // boolean이 아닌 이유는 상세 화면이 URL을 재서명하기 때문 — boolean이면 교체를 넘어
  // true로 남아 디코드되지 않은 새 사진을 보여준다.
  const [state, setState] = useState<LoadState | null>(null)
  const outcome = src != null && state?.src === src ? state.outcome : null

  /**
   * 결과를 기록하되, 이미 기록된 것과 같으면 아무 일도 하지 않는다.
   *
   * 이 조기 반환은 정리가 아니라 필수다. `checkComplete`는 React가 ref를 다시 붙일
   * 때마다 — 클로저가 바뀐 렌더마다 — 다시 돌고, 매번 새 객체를 저장하면 매 렌더가
   * 새 상태값이 되어 스스로를 다시 렌더하는 컴포넌트가 된다.
   */
  const settle = useCallback((settledSrc: string, outcome: LoadState['outcome']) => {
    setState((previous) =>
      previous?.src === settledSrc && previous.outcome === outcome
        ? previous
        : { src: settledSrc, outcome },
    )
  }, [])

  /**
   * ref로 읽어서 `fail`과 `checkComplete`가 호출부 함수의 identity에 의존하지 않게 한다.
   *
   * 모든 호출부가 이걸 인라인으로 만들고, 중요한 쪽은 달리 할 수도 없다 — 상세 화면은
   * `map` 안에서 사진마다 타일을 그리므로 루프 안에 `useCallback`이 없다. 의존하면
   * `checkComplete`가 매 렌더 새로워지고, React는 identity가 바뀐 콜백 ref를 떼었다
   * 다시 붙인다.
   *
   * effect가 아니라 렌더 중에 대입한다. `checkComplete`는 콜백 ref라 붙는 즉시 —
   * 캐시된 깨진 이미지라면 같은 커밋 안에서 — `fail`을 부를 수 있는데, effect는 그보다
   * 늦게 돌아 ref가 이전 렌더의 클로저를 들고 있게 된다.
   */
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError

  const fail = useCallback(
    (failedSrc: string) => {
      settle(failedSrc, 'failed')
      onLoadErrorRef.current?.()
    },
    [settle],
  )

  // 브라우저 캐시에 있는 사진은 React가 onLoad를 붙이기 전에 끝날 수 있고, 그러면
  // 스켈레톤이 영영 남는다. ref는 요소가 생긴 뒤 도므로 `complete`를 물어볼 수 있다.
  const checkComplete = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node?.complete || src == null) return
      // `complete`는 깨진 이미지에도 true라 혼자서는 못 쓴다 — 캐시된 실패가 깨진
      // 이미지 아이콘을 불투명도 1로 페이드인시킨다.
      if (node.naturalWidth > 0) settle(src, 'loaded')
      else fail(src)
    },
    [src, settle, fail],
  )

  const failed = outcome === 'failed'
  const showing: PhotoFallback | null = failed ? 'failed' : src == null ? fallback : null
  const pending = showing === 'pending' || (src != null && outcome == null)

  return (
    <span className={styles.frame({ shape })}>
      {pending && <span className={styles.skeleton} />}

      {showing != null && showing !== 'pending' && (
        <span className={styles.notice}>{FALLBACK_LABELS[showing]}</span>
      )}

      {/* 원본보다 먼저 그려져야 원본이 그 위에 얹힌다 — 둘 다 절대 위치라 DOM 순서가
          쌓임 순서다. 이름은 아래 `<img>`가 지므로 이것은 장식이고, 원본이 다 그려진
          뒤에도 남지만 완전히 가려져 보이지 않는다. */}
      {placeholder != null && !failed && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          crossOrigin={PHOTO_CORS}
          // 원본과 같은 판정을 따른다. 자리표시자가 원본보다 먼저 오는 것이 요점이지
          // 원본이 미루기로 한 것까지 당겨오는 것이 아니다 — 그러면 스와이프하지 않는
          // 사람에게 썸네일 다섯 장이 순증이다.
          loading={loading}
          className={styles.photo({ loaded: true, fit })}
        />
      )}

      {src != null && !failed && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          crossOrigin={PHOTO_CORS}
          className={styles.photo({ loaded: outcome === 'loaded', fit })}
          onLoad={() => settle(src, 'loaded')}
          // 서명 URL은 만료되고 네트워크는 끊긴다. 이게 없으면 스켈레톤이 영원히
          // 맥동하고 실패가 느린 연결처럼 읽힌다.
          onError={() => fail(src)}
          ref={checkComplete}
        />
      )}

      {children}
    </span>
  )
}
