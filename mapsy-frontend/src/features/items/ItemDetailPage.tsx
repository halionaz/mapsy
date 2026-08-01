import { useParams } from 'react-router'
import { ScreenStub } from '../../shared/ui/ScreenStub'

export function ItemDetailPage() {
  const { id } = useParams()

  return (
    <ScreenStub
      title="옷 상세"
      note={`이미지 캐러셀과 입력된 정보만 표시하는 화면입니다. (id: ${id ?? '?'})`}
    />
  )
}
