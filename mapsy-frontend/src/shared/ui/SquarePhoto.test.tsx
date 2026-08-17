/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SquarePhoto } from './SquarePhoto'

/**
 * 여기서 붙드는 것은 렌더링이 아니라 **요청 모드**다.
 *
 * `crossOrigin`이 빠져도 화면은 멀쩡하다. 사진은 그대로 보이고 타입 검사도 린트도
 * 통과하며, 조용해지는 것은 서비스워커 캐시뿐이다 — opaque 응답은 `statuses: [200]`에
 * 걸려 저장되지 않으므로 캐시가 아무것도 담지 않은 채 계속 네트워크를 탄다. 통과와
 * 미실행이 구분되지 않는 상태라, 사람이 기억하는 대신 여기서 잡는다.
 *
 * 반대 방향은 더 나쁘다. `statuses`에 0을 되돌려 놓으면 만료된 서명의 오류가 사진으로
 * 캐시되고 재서명해도 풀리지 않는다. 두 설정이 한 짝이라는 것이 이 파일의 요지다.
 */
// vitest는 `globals`를 켜지 않아 testing-library가 스스로 정리하지 못한다 — 남은 DOM이
// 다음 테스트의 조회에 섞인다.
afterEach(cleanup)

describe('SquarePhoto', () => {
  it('사진을 CORS로 요청한다', () => {
    render(<SquarePhoto src="https://signed/a" alt="옷" />)

    expect(screen.getByAltText('옷')).toHaveProperty('crossOrigin', 'anonymous')
  })

  it('자리표시자도 같은 모드로 요청한다', () => {
    // 자리표시자는 원본과 같은 버킷에서 오고 같은 워커 라우트를 지난다. 하나만
    // 빠뜨리면 썸네일만 캐시를 비껴가고, 그것이 가장 자주 읽히는 사진이다.
    const { container } = render(
      <SquarePhoto src="https://signed/a" placeholder="https://signed/a-thumb" alt="옷" />,
    )

    const images = [...container.querySelectorAll('img')]
    expect(images).toHaveLength(2)
    expect(images.every((image) => image.crossOrigin === 'anonymous')).toBe(true)
  })
})
