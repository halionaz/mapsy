import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

export const block = vstack({ gap: '2', alignItems: 'stretch' })

export const srOnly = css({ srOnly: true })

export const error = css({ textStyle: 'caption', color: 'danger' })

export const grid = css({
  display: 'grid',
  // 상수가 아니라 리터럴이다. Panda는 소스를 읽어 스타일을 뽑고, 변수를 거쳐야 하는 값은
  // 아무것도 내보내지 않을 수 있다. `useDragReorder`는 실제 트랙 크기를 computed style에서
  // 되읽으므로 사본을 따로 들지 않는다.
  gridTemplateColumns: 'repeat(auto-fill, 84px)',
  gap: '3',
  justifyContent: 'start',
})

export const tile = css({
  width: '84px',
  position: 'relative',
  rounded: 'card',
  // 들어올림의 그림자는 놓은 뒤 아래 transform 규칙이 물러난 자리에서 스스로 풀린다.
  // 들어올릴 때는 풀리지 않는다 — 집는 것은 일어나는 중이 아니라 일어난 일이어야 한다.
  transitionProperty: 'box-shadow',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  /**
   * 재정렬 중에만, 그리고 위 규칙에 더해지는 것이 아니라 대체한다.
   *
   * 재정렬 밖에서는 transform이 즉시 사라져야 한다. 목록이 방금 다시 쓰였고 모든 타일이
   * 이미 transform이 데려가던 자리에 앉아 있으므로, transform을 애니메이션으로 걷으면
   * 이미 도착한 자리에서 되돌아오는 것처럼 보인다.
   */
  '[data-rearranging] &': {
    transitionProperty: 'transform',
    transitionDuration: 'normal',
    transitionTimingFunction: 'out',
    _motionReduce: { transitionDuration: '1ms' },
    /**
     * 손가락 아래 타일. 프레임마다 직접 놓이는 중이라 트랜지션이 얹히면 지연으로 읽힌다.
     *
     * 인라인 스타일이 아니라 규칙인 것이 이 속성의 존재 이유다. 놓기 동작이 이 요소의
     * computed `transition-duration`을 읽어 기다릴 시간을 재므로, 컴포넌트가 쓰고 또
     * 읽는 값은 자기 질문에 자기가 답하게 된다. `transition` 단축 속성으로 인라인에
     * 쓰면 duration이 0으로 읽혀 모든 놓기 애니메이션이 첫 프레임에 잘린다. 여기서는
     * property만 가져가고 duration은 바깥 규칙에 남긴다.
     *
     * 하나의 셀렉터로 펼치지 않고 중첩한 것은 순서가 아니라 특이도로 이겨야 하기
     * 때문이고, Panda는 `&`로 시작하거나 끝나는 셀렉터만 타이핑한다.
     */
    '&[data-following]': { transitionProperty: 'none' },
  },
  _motionReduce: { transitionDuration: '1ms' },
  '&[data-held]': { shadow: 'raised' },
})

export const grip = css({
  display: 'block',
  width: 'full',
  rounded: 'card',
  cursor: 'grab',
  // 스크롤과 재정렬을 가르는 것은 길게 누르기이므로 패닝은 살려두고, 220ms 누르기 위에
  // 얹히는 브라우저의 300ms 더블탭 대기만 걷어낸다.
  touchAction: 'manipulation',
  layerStyle: 'focusable',
  '&[aria-pressed=true]': { cursor: 'grabbing' },
})

export const removeButton = css({
  position: 'absolute',
  top: '1',
  right: '1',
})

export const coverTag = css({
  position: 'absolute',
  bottom: '1',
  left: '1',
  px: '1.5',
  py: '0.5',
  rounded: 'full',
  bg: 'accent',
  color: 'accent.fg',
  fontSize: '2xs',
  fontWeight: 'bold',
  lineHeight: 'tight',
  // 배지는 아래 사진의 것이지 그것을 끄는 손가락의 것이 아니다.
  pointerEvents: 'none',
})

export const addTile = css({
  // `tile`과 같은 리터럴. 이유도 같다.
  width: '84px',
  height: '84px',
  display: 'grid',
  placeItems: 'center',
  gap: '1',
  gridAutoFlow: 'row',
  rounded: 'card',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border.strong',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
  cursor: 'pointer',
  transitionProperty: 'border-color, color, background-color',
  transitionDuration: 'fast',
  _hover: { borderColor: 'accent', color: 'accent.text' },
})
