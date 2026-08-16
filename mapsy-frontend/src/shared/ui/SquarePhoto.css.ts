import { css, cva, cx } from 'styled-system/css'

import { skeletonSurface } from './Skeleton.css'

// div가 아니라 span인 것은 상세 화면이 이걸 `<button>`으로 감싸기 때문 — 버튼의
// 콘텐츠 모델은 phrasing content다.
export const frame = cva({
  base: {
    display: 'block',
    position: 'relative',
    aspectRatio: '1',
    width: 'full',
    overflow: 'hidden',
    bg: 'bg.subtle',
  },
  variants: {
    shape: {
      /** 페이지 위의 타일 — 옷장 격자, 사진 피커. */
      card: {
        rounded: 'card',
        // 흰 배경에 찍은 옷은 자기 윤곽이 없어서, 이게 없으면 밝은 페이지에 번진다.
        boxShadow: 'inset 0 0 0 1px {colors.border.subtle}',
      },
      /**
       * 화면 위쪽을 통째로 차지하는 사진. 모서리도 실선도 없다 — 둘 다 "페이지 위의
       * 물체"라는 말인데, 전폭 사진의 요점은 그것이 페이지라는 것이다.
       *
       * `'none'`이 아니라 `'0'` — `radii.none` 토큰이 없고 Panda는 모르는 값을 그대로
       * 흘려보내므로 `border-radius: none`이 나가고 브라우저가 버린다.
       */
      flush: { rounded: '0' },
    },
  },
  defaultVariants: { shape: 'card' },
})

export const skeleton = cx(skeletonSurface, css({ position: 'absolute', inset: '0' }))

export const notice = css({
  position: 'absolute',
  inset: '0',
  display: 'grid',
  placeItems: 'center',
  px: '2',
  textAlign: 'center',
  color: 'fg.subtle',
  textStyle: 'caption',
})

export const photo = cva({
  base: {
    position: 'absolute',
    inset: '0',
    width: 'full',
    height: 'full',
    transitionProperty: 'opacity',
    transitionDuration: 'fast',
  },
  variants: {
    // 스켈레톤을 갈아치우는 대신 그 위로 페이드인해서 둘 사이 배경이 번쩍이지 않게 한다.
    loaded: {
      true: { opacity: 1 },
      false: { opacity: 0 },
    },
    fit: {
      cover: { objectFit: 'cover' },
      contain: { objectFit: 'contain' },
    },
  },
})
