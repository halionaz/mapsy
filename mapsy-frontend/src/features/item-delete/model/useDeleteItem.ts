import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useDeleteItemRow } from '@/entities/item'
import { dropItemWears } from '@/entities/wear'

/**
 * 옷을 지우고, 그 옷을 가리키던 캐시를 전부 정리한다.
 *
 * 두 엔티티에 걸쳐 있어 어느 쪽에도 살 수 없다 — DB는 착용 기록을 캐스케이드하지만
 * `entities/item`은 그것을 알 이유가 없다. 화면에서 두 줄로 부르지 않고 훅으로 묶는 것은
 * 함께 고치지 않으면 깨지기 때문이다. 남은 착용 기록은 카드 없는 옷을 선택에 심고
 * 그날의 제출을 통째로 실패시킨다.
 *
 * 바깥 뮤테이션 하나로 감싸 `isPending`이 캐시 정리까지 덮는다.
 */
export function useDeleteItem() {
  const queryClient = useQueryClient()
  const deleteRow = useDeleteItemRow()

  return useMutation({
    mutationFn: async (vars: { id: string; userId: string }) => {
      await deleteRow.mutateAsync(vars)
      await dropItemWears(queryClient, vars.id)
    },
  })
}
