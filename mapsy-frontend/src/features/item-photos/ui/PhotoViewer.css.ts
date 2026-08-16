import { css } from 'styled-system/css'

import { appBarBox } from '@/shared/ui/AppBar.css'

export const dialog = css({
  position: 'fixed',
  inset: '0',
  width: '100dvw',
  maxWidth: '100dvw',
  height: '100dvh',
  maxHeight: '100dvh',
  m: '0',
  p: '0',
  border: 'none',
  overflow: 'hidden',
  bg: 'overlay',
  color: 'overlay.fg',
  '&::backdrop': { background: '{colors.overlay}' },
})

/** 모든 제스처가 우리 것이다. 기본 동작을 브라우저에 남기면 핀치가 도중에 스크롤이 된다. */
export const stage = css({
  position: 'absolute',
  inset: '0',
  overflow: 'hidden',
  touchAction: 'none',
  userSelect: 'none',
})

export const track = css({
  display: 'flex',
  width: 'full',
  height: 'full',
  willChange: 'transform',
})

export const page = css({
  position: 'relative',
  flex: '0 0 100%',
  height: 'full',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
})

export const photo = css({
  display: 'block',
  maxWidth: 'full',
  maxHeight: 'full',
  objectFit: 'contain',
  transformOrigin: 'center',
  willChange: 'transform',
})

/**
 * 사진이 없는 페이지가 하는 말.
 *
 * 사진 옆에 배치되지 않고 페이지 위에 얹힌다 — 안에 무엇이 있든 페이지 전체를 덮고,
 * 아래로 사진이 나타나는 순간 움직이는 것이 없도록.
 */
export const notice = css({
  position: 'absolute',
  inset: '0',
  display: 'grid',
  placeItems: 'center',
  px: '6',
  textAlign: 'center',
  fontSize: 'sm',
  color: 'overlay.fg',
  opacity: 0.7,
})

/** 세로 여백은 `appBarBox` — 닫기 버튼이 여기로 들어온 화면의 뒤로 버튼과 같은 높이에 앉는다. */
export const topBar = css(appBarBox, {
  position: 'absolute',
  insetInline: '0',
  top: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  px: '2',
  // 사진 위에 놓이므로 위쪽이 어둡기를 바라지 않고 자기 어둠을 들고 다닌다.
  bgGradient: 'to-b',
  gradientFrom: '{colors.overlay.scrim}',
  gradientTo: 'transparent',
  // 바가 사진 위를 가로지른다. 클릭 가능한 채로 두면 그 띠에서 시작한 스와이프와 핀치를
  // 전부 삼키므로, 안의 버튼만 포인터를 받는다.
  pointerEvents: 'none',
})

export const closeButton = css({
  display: 'grid',
  placeItems: 'center',
  width: 'tap',
  height: 'tap',
  ml: '1',
  color: 'overlay.fg',
  rounded: 'full',
  cursor: 'pointer',
  pointerEvents: 'auto',
  // 페이지의 포커스 링은 임의의 사진 위에서 읽혀야 하는 주황이다. 여기서는 위 스크림이
  // 대비를 보장하는 오버레이 전경색으로 그린다.
  _focusVisible: { outline: '2px solid', outlineColor: 'overlay.fg', outlineOffset: '0' },
})

/**
 * 페이지 카운터. 사진 위에 맨몸으로 두지 않고 알약에 담는다 — 위 그라데이션이 긴 사진에서는
 * 카운터의 베이스라인 전에 사라져, 텍스트가 뒤에 뭐가 있든 그것에 기대게 된다.
 */
export const counter = css({
  px: '3',
  py: '1.5',
  mr: '2',
  rounded: 'full',
  bg: 'overlay.scrim',
  backdropFilter: 'blur(6px)',
  color: 'overlay.fg',
  textStyle: 'caption',
  fontVariantNumeric: 'tabular-nums',
})
