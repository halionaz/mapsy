/**
 * 뷰어 아래에서 컬렉션이 바뀔 때 어디에 앉아야 하는지.
 *
 * 뷰어는 페이지를 위치로 가리키고, 위치는 사진이 늘거나 줄면 같은 뜻이기를 그만둔다.
 *
 * - 열린 페이지 **뒤**의 사진이 지워지면 인덱스가 끝을 넘어 빈 화면이 된다.
 * - **앞**의 사진이 지워지면 더 나쁘다 — 아무것도 이상해 보이지 않는 채로 같은 위치가
 *   다음 사진을 가리킨다.
 *
 * id를 따라가면 둘 다 닫히고, 사진이 정말 사라졌을 때만 가둔다.
 */
export function indexAfterChange(
  slots: readonly { id: string }[],
  /** 화면의 사진을 id로. 뷰어가 앉기 전에는 `null`. */
  shownId: string | null,
  currentIndex: number,
): number | null {
  // 앉을 곳이 없다. 뷰어가 "사진이 없어요"를 그리고 인덱스는 무의미하다.
  if (slots.length === 0) return null

  const at = slots.findIndex((slot) => slot.id === shownId)
  // 아직 있으면(자리가 바뀌었더라도) 따라간다. 사라졌으면 위치를 지킨다 — 그 자리를
  // 이어받은 이웃이다 — 마지막이었으면 가둔다.
  const target = at >= 0 ? at : Math.min(currentIndex, slots.length - 1)

  // 현재 인덱스가 아니라 `null`을 돌려줘, 호출부가 이미 있는 자리로 이동하지 못하게
  // 한다. `goTo`는 트랙을 쓰고 뒤 화면에 알리는데, 이 effect는 컬렉션이 바뀔 때마다
  // 돈다 — 사진 자체는 그대로인 재서명까지 포함해서.
  return target === currentIndex ? null : target
}
