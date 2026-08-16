import { Drawer, Portal } from '@ark-ui/react'

import * as styles from './Sheet.css'

/**
 * 아래에서 올라오는 패널.
 *
 * Ark UI의 `Drawer`라 손잡이가 진짜다 — 임계점 아래로 끌면 닫히고, 못 미치면 되돌아간다.
 * 포커스 트랩·복원, 뒤 페이지 비활성화, Esc, 백드롭 탭은 전부 프리미티브가 준다.
 *
 * 모션을 두 가지 CSS가 나눠 맡고 둘은 바꿔 쓸 수 없다. `transform` **트랜지션**이
 * 스냅백을 그리고, `[data-state=closed]` **애니메이션**이 퇴장을 그린다. 퇴장이
 * 애니메이션이어야 하는 것은 Ark의 presence 머신이 `animationend`를 기다렸다 언마운트하고
 * 애니메이션이 없으면 "이미 사라졌다"로 취급하기 때문이다.
 */
interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** 스크롤되는 본문 아래 고정되는 행 — 초기화 / 결과 보기. */
  footer?: React.ReactNode
  children: React.ReactNode
}

export function Sheet({ open, onOpenChange, title, footer, children }: SheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      // 요청된 동안만 마운트하고 퇴장 애니메이션 후 버린다 — 시트는 늘 알려진 상태에서
      // 열리고, 닫혀 있을 때 내용이 탭 순서에 남지 않는다.
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Drawer.Backdrop className={styles.backdrop} />
        <Drawer.Positioner className={styles.positioner}>
          {/*
            `draggable={false}`로 끌기를 손잡이에만 둔다. 본문까지 끌게 하는 것은 폰에서
            물렸다 — Ark는 손가락 아래 요소가 그 방향으로 스크롤할 여지가 없으면 끌기를
            시작하는데, 그 판단은 대칭이라 목록 *바닥*에서 위로 밀어도 끌기가 시작된다.
            한 번 시작하면 다시 묻지 않아, 손가락을 되돌리면 스크롤된 목록 한가운데서
            시트가 닫히는 쪽으로 걸어간다.

            `aria-label`은 없다 — `Drawer.Title`을 그리는 것이 Ark가 `aria-labelledby`를
            거는 조건이고, 라벨을 덧붙이면 눈에 보이는 제목이 대체된다.
          */}
          <Drawer.Content className={styles.content} draggable={false}>
            <Drawer.Grabber className={styles.grabber}>
              <Drawer.GrabberIndicator className={styles.grabberBar} />
            </Drawer.Grabber>

            <header className={styles.header}>
              <Drawer.Title className={styles.title}>{title}</Drawer.Title>

              {/* 손잡이가 대신한 닫기 컨트롤을, 손잡이를 쓸 수 없는 사람 몫으로 남긴다.
                  끌기는 경로 기반 제스처이고 프리미티브가 주는 대안은 키보드가 필요한
                  Esc와, 모달이라 스크린리더에게 비활성인 백드롭 탭뿐이다. */}
              <Drawer.CloseTrigger className={styles.srOnly}>닫기</Drawer.CloseTrigger>
            </header>

            <div className={styles.body}>{children}</div>

            {footer && <footer className={styles.footer}>{footer}</footer>}
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
