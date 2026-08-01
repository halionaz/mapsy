import { useParams } from 'react-router'
import { ScreenStub } from '../../shared/ui/ScreenStub'

export function ItemEditPage() {
  const { id } = useParams()

  return (
    <ScreenStub
      title="옷 편집"
      note={`등록 화면과 같은 폼을 기존 값으로 채워 보여줄 화면입니다. (id: ${id ?? '?'})`}
    />
  )
}
