import { css } from 'styled-system/css'

/**
 * 로딩 자리표시자를 칠하는 색.
 *
 * 컴포넌트가 아니라 규칙 하나인 것은 모양이 제각각(정사각 사진틀, 제목 길이의 막대)인
 * 반면 재질은 같아야 하기 때문이다. 카드와 상세 화면이 이걸로 각자의 스켈레톤을 짓는다.
 */
export const skeletonSurface = css({
  bg: 'border',
  animation: 'skeletonPulse 1.6s ease-in-out infinite',
  // 끝없이 맥동하는 자리표시자는 이 설정이 덜어달라는 바로 그 움직임이다.
  _motionReduce: { animation: 'none', opacity: 0.28 },
})
