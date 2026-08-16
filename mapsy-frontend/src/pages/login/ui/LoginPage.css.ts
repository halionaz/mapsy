import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

export const screen = css({
  position: 'relative',
  // 스태킹 컨텍스트. 아래 glow가 `z-index: -1`로 페이지 배경 뒤가 아니라 이 화면의 내용
  // 뒤에 앉게 한다 — 감싸는 컨텍스트가 없으면 음수 인덱스는 배경 뒤로 가서 보이지 않는다.
  isolation: 'isolate',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8',
  mx: 'auto',
  width: 'full',
  maxWidth: 'app',
  minHeight: '100dvh',
  px: '8',
  // 노치와 홈 인디케이터를 비킨다. index.html이 viewport-fit=cover다.
  pt: 'calc({spacing.16} + var(--safe-t))',
  pb: 'calc({spacing.8} + var(--safe-b))',
  textAlign: 'center',
  overflow: 'hidden',
})

/**
 * 앱의 유일한 장식 — 워드마크 뒤에 깔리는 브랜드 주황의 번짐. 화면이 잘라낸다.
 *
 * `filter: blur()`가 아니라 방사형 그라데이션이다. 이만한 크기의 요소에 blur를 걸면
 * 폰에서 전체 화면 오프스크린 버퍼가 되고, 여기는 첫 화면의 첫 페인트다.
 */
export const glow = css({
  position: 'absolute',
  // 모든 자손보다 뒤. 형제마다 `position: relative`를 기대하는 쪽은 장식이 워드마크 위에
  // 그려지게 두고, 모두가 기억하는 동안만 동작했다.
  zIndex: -1,
  top: '-20%',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  width: '150%',
  aspectRatio: '1',
  pointerEvents: 'none',
  background: 'radial-gradient(circle at 50% 50%, {colors.brand.500} 0%, transparent 62%)',
  opacity: { base: 0.1, _dark: 0.16 },
})

export const center = vstack({ gap: '10', justify: 'center', flex: '1', width: 'full' })

export const wordmarkBlock = vstack({ gap: '3' })

export const actions = vstack({ gap: '4', width: 'full', maxWidth: 'field' })

/**
 * 워드마크가 브랜드라, 강조색이 크게 쓰이는 유일한 자리다.
 *
 * 평평한 채움이 아니라 램프를 지나는 그라데이션으로 칠한다 — 48px에서 주황 하나는 누가
 * 타이핑한 색처럼 보이고, 400에서 600으로의 이동이 글자에 광원을 준다.
 *
 * 손으로 쓴 `background-clip: text`가 아니라 Panda의 `textGradient` 유틸리티인 것은,
 * 접두사 없는 속성이 Safari 16.4에야 들어왔고 이 앱은 iOS Safari 16을 노리기 때문이다.
 * 손으로 쓰면 거기서 앱 이름이 투명 잉크로 칠해진다.
 */
export const wordmark = css({
  textStyle: 'display',
  fontSize: '3rem',
  textGradient: 'to-br',
  gradientFrom: 'brand.400',
  gradientTo: 'brand.600',
})

export const tagline = css({ textStyle: 'body', color: 'fg.muted' })

export const note = css({
  textStyle: 'caption',
  color: 'fg.muted',
  lineHeight: 'relaxed',
})

export const code = css({
  color: 'fg',
  fontFamily: 'mono',
  bg: 'bg.subtle',
  px: '1',
  rounded: 'sm',
})

export const error = css({ textStyle: 'caption', color: 'danger' })

export const footnote = css({ textStyle: 'caption', color: 'fg.subtle' })
