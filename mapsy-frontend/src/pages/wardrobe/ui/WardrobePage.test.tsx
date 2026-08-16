/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PendingUpload, WardrobeItem } from '@/entities/item'
import { closeWearDraft, openWearDraft } from '@/features/wear-log'
import { toaster } from '@/shared/ui/toast'
import { todayLocal } from '@/shared/lib/calendarDay'
import { WardrobePage } from './WardrobePage'

/** 이 테스트가 되어보는 사용자. 옷 픽스처의 `userId`와 맞춘다. */
const OWNER = 'u1'

/**
 * 어느 화면이 옷 등록으로 가는 길을 내주는지.
 *
 * FAB가 숨는 화면은 정확히 하나 — 빈 옷장 — 이고, 그 화면이 자기 첫 옷 등록하기를
 * 들고 있어 같은 경로의 알약 둘은 앱이 두 번 묻는 것이기 때문이다. "그 화면"의 조건이
 * 반대 방향으로 두 번 틀렸으므로 여기서 붙든다.
 *
 * 미묘한 절반은 `entries`가 `data ?? []`라, 아직 로딩 중인 옷장과 불러오지 못한 옷장이
 * 둘 다 비어 보인다는 것이다. 거기서 FAB를 숨기면 에러 화면에 /items/new로 가는 길이
 * 아예 없어지는데, 등록은 큐잉되므로 네트워크가 없어도 동작하는 유일한 기능이다.
 */

const {
  useWardrobeMock,
  usePendingUploadsMock,
  useWearsMock,
  submitWearsMock,
  useCurrentUserIdMock,
} = vi.hoisted(() => ({
  useWardrobeMock: vi.fn(),
  usePendingUploadsMock: vi.fn(),
  useWearsMock: vi.fn(),
  submitWearsMock: vi.fn(),
  useCurrentUserIdMock: vi.fn(),
}))

/** `useWardrobe`가 돌려주는 모양 중, 이 화면이 읽는 것만. */
function query(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

/**
 * `useWardrobe`와 함께 `usePendingUploads`도 목으로 바꾼다.
 *
 * 진짜는 비어서 시작하는 모듈 수준 스토어라, 모든 테스트가 진행 중인 업로드 0개를 보고
 * 그것을 그리는 분기에 한 번도 들어가지 않았다 — 그 분기를 통째로 지워도 전부 통과했다.
 */
vi.mock('@/entities/item', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/item')>()),
  useWardrobe: useWardrobeMock,
  usePendingUploads: usePendingUploadsMock,
}))

/**
 * 착용 기록의 훅 둘만, 엔티티의 나머지는 그대로.
 *
 * `attachWears`와 `itemIdsWornOn`은 진짜로 둔다 — 아래 행을 카드와 선택이 실제로
 * 보여주는 것으로 바꾸는 것이 그것들이고, 목으로 바꾸면 이 테스트는 병합이 아니라
 * 픽스처를 검사하게 된다.
 */
vi.mock('@/entities/wear', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/wear')>()),
  useWears: useWearsMock,
  useSetWears: () => ({ mutate: submitWearsMock, isPending: false }),
}))

/**
 * 로그인한 사용자. 초안이 이제 누구의 것인지를 싣기 때문이다.
 *
 * 단위 실행에는 Supabase가 없어 진짜 훅이 `null`로 답하고, 화면은 그것을 "기록할 수
 * 없음"으로 읽어 아래 모든 화면에서 이 기능을 걷어간다.
 */
vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  useCurrentUserId: useCurrentUserIdMock,
}))

const uploading: PendingUpload = {
  tempId: 't1',
  draft: { title: '올라가는 중', categoryId: 'shoes.boots' },
  photos: [],
  userId: 'u1',
  state: 'uploading',
}

/**
 * `rerender`는 인자 없이 같은 화면을 다시 그린다.
 *
 * 이미 상태가 들어 있는 화면 아래에서 옷장을 움직이는 방법이다 — 목이 새 행을
 * 돌려주고, 이것이 그것을 필터가 비어 있는 두 번째 컴포넌트가 아니라 기존 컴포넌트에
 * 올린다. 매번 새 엘리먼트인 것은, React가 참조가 같은 엘리먼트의 서브트리를 건너뛸 수
 * 있기 때문이다.
 */
function renderWardrobe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WardrobePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const result = render(tree())
  return { ...result, rerender: () => result.rerender(tree()) }
}

const registerFab = () => screen.queryByLabelText('옷 등록')

beforeEach(() => {
  useWardrobeMock.mockReset()
  usePendingUploadsMock.mockReset()
  usePendingUploadsMock.mockReturnValue([])
  useWearsMock.mockReset()
  // 기본값은 "답했고, 기록된 것은 없음". 기록이 답하기 전인 `undefined`는 아래 몇
  // 테스트가 일부러 요청하는 경우다.
  useWearsMock.mockReturnValue({ data: [] })
  submitWearsMock.mockReset()
  useCurrentUserIdMock.mockReset()
  useCurrentUserIdMock.mockReturnValue(OWNER)
  // 렌더보다 오래 사는 모듈 수준 스토어라, 테스트 사이에 되돌리지 않으면 열어둔
  // 선택이 다음 테스트로 샌다.
  closeWearDraft()
})
afterEach(cleanup)

describe('WardrobePage — 등록으로 가는 길', () => {
  it('옷장이 아직 오는 중에도 등록 버튼을 남긴다', () => {
    useWardrobeMock.mockReturnValue(query({ isLoading: true, isFetching: true }))
    renderWardrobe()

    expect(registerFab()).not.toBeNull()
  })

  it('옷장을 불러오지 못했을 때도 등록 버튼을 남긴다', () => {
    useWardrobeMock.mockReturnValue(query({ error: new Error('offline') }))
    renderWardrobe()

    // 아니면 막다른 화면이 된다 — 격자도, 빈 화면의 행동도, 구석의 버튼도 없다.
    expect(registerFab()).not.toBeNull()
  })

  /**
   * 재시도는 있기만 한 것이 아니라 연결돼 있어야 한다.
   *
   * 버튼이 존재한다고만 검사하는 것은, 파괴적 버튼에 `bg_danger`가 있는지만 보고 강조색
   * 채움이 사라졌는지 안 보는 것과 같은 실수다 — 아무 일도 안 하는 버튼도 통과한다.
   */
  it('재시도를 누르면 실제로 다시 불러온다', () => {
    const refetch = vi.fn()
    useWardrobeMock.mockReturnValue(query({ error: new Error('offline'), refetch }))
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('이미 불러오는 중이면 두 번째를 쌓지 않는다', () => {
    const refetch = vi.fn()
    useWardrobeMock.mockReturnValue(
      query({ error: new Error('offline'), isFetching: true, refetch }),
    )
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))

    expect(refetch).not.toHaveBeenCalled()
  })

  /**
   * 실패한 갱신이 이미 여기 있는 옷장을 버리면 안 된다.
   *
   * react-query는 배경 갱신이 실패해도 `data`를 유지한다 — `error`는 그것 대신이 아니라
   * 함께 세워진다. 화면이 `data`를 보기 전에 `error`로 분기하면, 모든 행이 메모리에
   * 있어도 격자가 "옷장을 불러오지 못했어요"로 바뀐다.
   *
   * 특이한 경로가 아니라 평범한 경로다. `refetchOnWindowFocus`가 일부러 켜져 있으니
   * 옷장을 보다 앱을 내렸다가 신호 없는 곳에서 돌아오는 것만으로 화면을 잃는다.
   */
  it('갱신이 실패해도 이미 가진 옷장을 계속 보여준다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()], error: new Error('offline') }))
    renderWardrobe()

    expect(screen.getByText('마산 플리스')).toBeDefined()
    expect(screen.queryByText('옷장을 불러오지 못했어요')).toBeNull()
  })

  it('갱신이 실패하면 옷장을 뺏지 않고 그렇게 말한다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()], error: new Error('offline') }))
    renderWardrobe()

    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeDefined()
    expect(registerFab()).not.toBeNull()
  })

  /**
   * 빈 옷장은 없는 답이 아니라 하나의 답이다.
   *
   * `data: []`는 가져오기가 성공했고 옷이 없다는 뜻이다. 나중의 갱신 실패가 그것을
   * 되돌리지 않으므로, 화면은 여전히 불러오기 실패가 아니라 온보딩 문구를 빚지고 있다.
   */
  it('갱신이 실패해도 빈 옷장은 빈 채로 둔다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [], error: new Error('offline') }))
    renderWardrobe()

    expect(screen.getByText('아직 등록한 옷이 없어요')).toBeDefined()
    expect(screen.queryByText('옷장을 불러오지 못했어요')).toBeNull()
  })

  it('목록이 최신이 아닐 수 있다는 말을 한 번만 한다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()], error: new Error('offline') }))
    const { container } = renderWardrobe()

    const announcing = [...container.querySelectorAll('[role="status"], [role="alert"]')].filter(
      (node) => node.textContent?.includes('불러오지 못했'),
    )

    expect(announcing).toHaveLength(1)
  })

  it('빈 옷장에는 자기 행동만 하나 준다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [] }))
    renderWardrobe()

    expect(screen.getByRole('link', { name: /첫 옷 등록하기/ })).toBeDefined()
    expect(registerFab()).toBeNull()
  })

  it('옷장에 무언가 생기면 등록 버튼을 보여준다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    expect(registerFab()).not.toBeNull()
  })
})

/**
 * 카테고리 레일은 옷장이 가진 것을 내주고, 격자는 그것으로 나뉜다.
 *
 * 한 규칙의 두 절반이다 — 아무것도 없는 카테고리는 갈 수 있는 곳이 아니다 — 그래서
 * 아무것도 못 맞추는 칩과 카드 없는 제목은 같은 결함의 양면이다.
 */
describe('WardrobePage — 카테고리', () => {
  const chip = (label: string) => screen.queryByRole('button', { name: label })

  it('이 옷장에 아무것도 없는 카테고리는 칩을 내주지 않는다', () => {
    useWardrobeMock.mockReturnValue(
      query({ data: [item(), item({ id: 'i2', categoryId: 'shoes.boots' })] }),
    )
    renderWardrobe()

    expect(chip('상의')).not.toBeNull()
    expect(chip('신발')).not.toBeNull()
    // 이 옷장에는 원피스/셋업도 가방도 액세서리도 없다. 여덟 그룹을 조건 없이 그리면
    // 레일 대부분이 화면을 비우는 것밖에 못 하는 칩이 된다.
    expect(chip('원피스/셋업')).toBeNull()
    expect(chip('가방')).toBeNull()
  })

  /**
   * 켜진 칩은 아직 거르고 있는 동안 떠날 수 없어야 한다.
   *
   * 신발이 선택된 채 마지막 신발을 처분하면 `filters.groupIds`는 그것을 든 채로 그룹만
   * 옷장에서 사라진다. 그 칩이 지금 보고 있는 카테고리를 말하는 유일한 것이라(요약 행에
   * 대분류 알약은 없다) 없으면 화면이 이유 없이 빈다.
   *
   * 끌 방법이 없어서가 아니다 — 그 상태는 `noMatches`이고 그쪽의 필터 모두 해제가
   * `groupIds`를 비운다.
   */
  it('마지막 옷이 옷장을 떠나도 선택된 칩은 남긴다', () => {
    const shoes = item({ id: 'i2', categoryId: 'shoes.boots' })
    useWardrobeMock.mockReturnValue(query({ data: [item(), shoes] }))
    const { rerender } = renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: '신발' }))
    useWardrobeMock.mockReturnValue(query({ data: [item(), { ...shoes, status: 'disposed' }] }))
    rerender()

    expect(chip('신발')).not.toBeNull()
  })

  it('전부 한 카테고리면 레일을 아예 그리지 않는다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    renderWardrobe()

    // 여기서 전체와 상의는 같은 옷을 고르므로, 행이 서로 다를 수 없는 컨트롤 둘이 된다.
    expect(chip('전체')).toBeNull()
    expect(chip('상의')).toBeNull()
    expect(screen.getByText('흰 티')).toBeDefined()
  })

  it('격자를 카테고리별 구획으로, 표 순서대로 나눈다', () => {
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'shoes.boots' }),
          item({ id: 'i2', categoryId: 'top.knit' }),
        ],
      }),
    )
    renderWardrobe()

    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      '상의1',
      '신발1',
    ])
  })

  /**
   * 칩이 켜져 있으면 구획이 정확히 하나이고, 그 구획에 그것을 만든 칩의 이름을 제목으로
   * 다는 것은 같은 말을 두 번 하는 것이다.
   */
  it('카테고리를 고르면 제목을 없앤다', () => {
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'shoes.boots' }),
          item({ id: 'i2', categoryId: 'top.knit' }),
        ],
      }),
    )
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: '상의' }))

    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
    expect(screen.getByText('마산 플리스')).toBeDefined()
  })

  /**
   * 정렬 컨트롤은 모든 제목 위에 앉고, 제목이 있는 순간 자기가 부르는 순서를 더는
   * 약속할 수 없다.
   *
   * 구획이 카테고리 표 순서로 돌므로 최근 등록순은 한 구획 안에서만 성립한다 — 오늘
   * 등록한 가방이 1월의 옷 셋 아래에 그려진다. 묶음과 전역 순서를 동시에 참으로 만들 수
   * 없으니, 라벨이 묶음을 빼지 않고 함께 싣는다.
   */
  it('정렬을 부를 때는 묶여 있다는 것도 함께 말한다', () => {
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'top.knit' }),
          item({ id: 'i2', categoryId: 'bag.tote', title: '방금 산 가방' }),
        ],
      }),
    )
    renderWardrobe()

    expect(screen.getByRole('button', { name: /갈래별 · 최근 등록순/ })).toBeDefined()
  })

  it('묶을 것이 없으면 정렬만 부른다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    expect(screen.getByRole('button', { name: '최근 등록순' })).toBeDefined()
  })
})

/**
 * 아직 올라가는 중인 등록은 그려지고, 구획 밖에 그려진다.
 *
 * 이 전부가 덮이지 않았었다 — `usePendingUploads`가 모든 테스트에서 비어 있는 진짜
 * 모듈 스토어라, 이 카드를 그리는 분기를 지워도 전부 통과했다. 카테고리 제목 아래
 * 정리된 업로드는 사용자가 찾을 수 없는 업로드이고, 그 카드가 재시도 버튼으로 가는
 * 유일한 길이다.
 */
describe('WardrobePage — 진행 중인 업로드', () => {
  it('업로드를 옷장 위, 모든 구획 밖에 고정한다', () => {
    usePendingUploadsMock.mockReturnValue([uploading])
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'top.knit' }),
          item({ id: 'i2', categoryId: 'bag.tote' }),
        ],
      }),
    )
    const { container } = renderWardrobe()

    const card = screen.getByText('올라가는 중')
    expect(card.closest('section')).toBeNull()
    // 페이지 어딘가가 아니라 제목들보다 앞에.
    const first = container.querySelector('main ul, main h2')
    expect(first?.contains(card)).toBe(true)
  })

  it('업로드만 있을 때 빈 목록을 남기지 않는다', () => {
    usePendingUploadsMock.mockReturnValue([uploading])
    useWardrobeMock.mockReturnValue(query({ data: [] }))
    const { container } = renderWardrobe()

    // 여기서 `visible`은 비었지만 옷장은 비지 않았고, 그것을 먹는 두 번째 격자는
    // 자식 없는 `<ul>`을 그렸다 — 스크린리더가 걸어 들어갈 "목록, 항목 0개"가 하나 더.
    expect([...container.querySelectorAll('ul')].map((list) => list.children.length)).toEqual([1])
  })
})

/**
 * 오늘 입은 옷 — 버튼, 그것이 여는 모드, 그리고 제출하는 것.
 *
 * 무게를 지는 것은 첫 번째 검사다. 제출은 하루를 통째로 갈아치우므로, 착용 기록이
 * 답하기 전에 심은 선택은 실재하는 기록 위에 빈 집합을 보낸다 — 느린 연결에서 기능이
 * 자기 데이터를 지우는 것이다. 나머지는 동작이고, 그 하나는 가드다.
 */
describe('WardrobePage — 착용 기록', () => {
  const today = todayLocal()

  /** `2026-08-15`에서 `8.15`를. 검사 대상인 포매터를 쓰지 않고 계산한다. */
  const monthDay = (day: string) => {
    const [, month, date] = day.split('-')
    return `${Number(month)}.${Number(date)}`
  }

  // 쉬는 상태의 라벨 둘 — 초대말과 "이미 기록됨". 같은 버튼이고, 하나만 아는 테스트는
  // 그날에 무언가 들어 있는 순간 조용히 아무것도 못 찾는다.
  const wearButton = () => screen.queryByRole('button', { name: /입은 옷 기록하기|기록 고치기/ })
  const cards = () => screen.queryAllByRole('button', { name: /마산 플리스|흰 티/ })
  // 날짜가 이제 컨트롤이 아니라 라벨이라 텍스트로 찾는다.
  const dateLabel = () => screen.queryByText(/^\d+\.\d+ \(오늘\)$/)

  it('착용 기록이 답하기 전에는 누를 것을 내주지 않는다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    useWearsMock.mockReturnValue({ data: undefined })
    renderWardrobe()

    expect(wearButton()).toBeNull()
    // 그리고 카드는 여전히 링크라, 탭이 채울 것 없는 선택이 아니라 옷으로 간다.
    expect(screen.getByRole('link', { name: /마산 플리스/ })).toBeDefined()
  })

  it('그날이 비어 있으면 기록하자고 청한다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    expect(wearButton()).not.toBeNull()
  })

  /**
   * 이것이 쓰는 날은 오늘뿐이다.
   *
   * 어제가 한동안 기본이었고 다시 그리로 갈 예정이지만, 그것은 두 값짜리 토글이 아니라
   * 날짜 피커가 필요한 일이다. 그때까지 날은 선택이 아니라 불변식이다.
   */
  it('오늘로 열리고, 오늘 입은 옷은 이미 체크돼 있다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    useWearsMock.mockReturnValue({
      data: [
        { itemId: 'i1', wornOn: today },
        { itemId: 'i2', wornOn: '2020-01-01' },
      ],
    })
    renderWardrobe()

    fireEvent.click(wearButton()!)

    expect(dateLabel()?.textContent).toBe(`${monthDay(today)} (오늘)`)
    expect(cards().map((card) => card.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
  })

  it('고르는 중인 날짜가 접근 가능한 이름에 들어간다', () => {
    // 날짜는 role도 탭 정지도 없는 `<p>`라 그룹의 이름만이 그것이 들릴 수 있는
    // 자리다. 인쇄하고 말하지 않으면, 자정 전부터 열려 있던 화면이 어느 날을 쓰려는지
    // 확인한다는 인쇄의 목적 자체가 사라진다.
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    expect(
      screen.getByRole('group', { name: `${monthDay(today)} (오늘) 입은 옷 고르기` }),
    ).toBeDefined()
  })

  it('날짜는 눌리지 않는다', () => {
    // 컨트롤처럼 생겼는데 아무 답도 안 하는 알약은 평범한 것보다 나쁘다. 피커가 생기기
    // 전까지 옮겨갈 곳이 없다.
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    expect(dateLabel()).not.toBeNull()
    expect(screen.queryByRole('button', { name: /오늘\)/ })).toBeNull()
    expect(dateLabel()?.closest('button')).toBeNull()
  })

  it('다시 청하는 대신 그날이 이미 담은 것을 말한다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    useWearsMock.mockReturnValue({
      data: [
        { itemId: 'i1', wornOn: today },
        { itemId: 'i2', wornOn: today },
      ],
    })
    renderWardrobe()

    // 사라지는 것이 아니다 — 나중에 자켓 하나를 그날 기록에 더하는 것이 평범한
    // 모양이라, 버튼은 남아 개수를 싣는다.
    expect(screen.getByRole('button', { name: /오늘 2벌 기록 고치기/ })).toBeDefined()
  })

  it('등록 버튼을 날짜·제출·취소로 갈아치운다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    // 옷 등록은 이 모드의 목적이 아니고, 알약 셋에 넷째까지는 폰 가로폭에 안 들어간다.
    expect(registerFab()).toBeNull()
    expect(dateLabel()).not.toBeNull()
    expect(screen.getByRole('button', { name: '고르기 취소' })).toBeDefined()
  })

  it('고른 옷을 오늘에 대해 제출한다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)
    fireEvent.click(screen.getByRole('button', { name: /흰 티/ }))
    fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))

    expect(submitWearsMock).toHaveBeenCalledTimes(1)
    expect(submitWearsMock.mock.calls[0][0]).toEqual({ wornOn: today, itemIds: ['i2'] })
  })

  /**
   * 아무것도 안 골랐으면 제출이 잠기므로 취소가 모드에서 나가는 유일한 길이다 —
   * 그래서 폭을 내주는 컨트롤이 결코 되지 않는다.
   */
  it('취소하면 모드를 떠나고 카드가 링크로 돌아온다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)
    fireEvent.click(screen.getByRole('button', { name: '고르기 취소' }))

    expect(screen.getByRole('link', { name: /마산 플리스/ })).toBeDefined()
    expect(registerFab()).not.toBeNull()
    expect(submitWearsMock).not.toHaveBeenCalled()
  })

  it('원래 비어 있던 날에 빈 집합을 제출하지 않는다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    // 무언가 있는 날을 비우는 것은 진짜 편집이라 눌리는 채로 둔다. 이쪽은 없는 것 위에
    // 없는 것을 쓴다.
    expect(screen.getByRole('button', { name: '옷을 골라주세요' }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('무언가 있는 날은 지우자고 내준다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    useWearsMock.mockReturnValue({ data: [{ itemId: 'i1', wornOn: today }] })
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: /오늘 1벌 기록 고치기/ }))
    fireEvent.click(screen.getByRole('button', { name: /마산 플리스/ }))
    fireEvent.click(screen.getByRole('button', { name: '기록 지우기' }))

    expect(submitWearsMock.mock.calls[0][0]).toEqual({ wornOn: today, itemIds: [] })
  })

  it('마지막으로 입은 때를 그리고, 한 번도 안 입었으면 아무것도 안 그린다', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    useWearsMock.mockReturnValue({ data: [{ itemId: 'i1', wornOn: today }] })
    renderWardrobe()

    // 그러지 않으면 기능이 나가고 몇 주 동안 모든 카드가 같은 "기록 없음"을 달고,
    // 그것은 정보가 아니라 캡션이다.
    expect(screen.getAllByText('오늘').length).toBeGreaterThan(0)
    expect(screen.queryByText('기록 없음')).toBeNull()
  })

  /**
   * 이 탭이 볼 수 없는 삭제.
   *
   * `dropItemWears`와 `knownIds`가 여기서 지워진 옷은 전부 덮지만, 둘 다 다른 기기에서
   * 지워진 것에는 닿지 못한다. 그것은 이 탭의 `data`에 남아 제출에 실려 가고, DB가
   * 거부하며, `set_item_wears`가 한 트랜잭션이라 그날 전체가 실패한다.
   *
   * 그것이 분기를 둘 값을 하는 이유는 달리 복구되는 것이 없어서다 — `staleTime`이
   * 30분이고 포커스 갱신이 그것을 존중하며 이 뮤테이션은 아무것도 무효화하지 않는다.
   */
  describe('다른 기기에서 지워진 옷', () => {
    const fkError = {
      message: 'violates foreign key constraint "item_wears_item_fk"',
      code: '23503',
    }

    // 나눈 것은 두 절반이 `act`를 공유할 수 없기 때문이다 — 모드에 들어가는 것이
    // 카드를 버튼으로 바꾸는데, 배치된 블록은 체크하러 갈 때 아직 링크를 보고 있다.
    function pickOne() {
      fireEvent.click(wearButton()!)
      fireEvent.click(screen.getByRole('button', { name: /마산 플리스/ }))
    }

    function submit() {
      fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))
    }

    function pickOneAndSubmit() {
      pickOne()
      submit()
    }

    it('옷장을 다시 불러오고, 고르던 것은 그대로 둔다', () => {
      const refetch = vi.fn().mockResolvedValue({ isError: false })
      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOneAndSubmit()

      expect(refetch).toHaveBeenCalledTimes(1)
      // 모드는 성공할 때만 닫힌다 — 실패는 고른 것을 그 자리에 남겨야 한다.
      expect(dateLabel()).not.toBeNull()
    })

    /**
     * 메시지가 갱신을 기다린다. 그것이 고침의 전부다.
     *
     * 첫 판본은 `void refetch()`를 쏘고 같은 틱에 "다시 불러왔으니 한 번 더 눌러주세요"를
     * 알렸다 — 끝난 것처럼 들리는 지시인데, 곧바로 따르면 `knownIds`가 `data`에서 오고
     * `data`는 아직 움직이지 않았으므로 똑같은 집합을 다시 보낸다.
     *
     * 두 번째 누름의 payload가 아니라 `toaster.create`로 검사한다. payload 판본은 깨진
     * 코드도 통과시킨다 — 테스트가 갱신에 동기 목을 주고 손으로 다시 그릴 수 있기
     * 때문이다. 실제로 바뀐 것은 문장이 *언제* 나오는가이므로 그것을 잰다.
     */
    it('옷장을 다시 불러오기 전에는 아무 말도 하지 않는다', async () => {
      let land!: (result: { isError: boolean }) => void
      const inFlight = new Promise<{ isError: boolean }>((resolve) => {
        land = resolve
      })
      const refetch = vi.fn(() => inFlight)
      const toast = vi.spyOn(toaster, 'create')

      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOne()
      await act(async () => {
        submit()
      })

      expect(refetch).toHaveBeenCalledTimes(1)
      expect(toast).not.toHaveBeenCalled()

      /**
       * 그리고 기다리는 동안 침묵하지 않는다.
       *
       * `onError`가 돌 때 뮤테이션은 이미 끝나 있다(`queries.premise.test.tsx` 참고).
       * 그래서 요청이 실패하는 순간 버튼이 스피너를 잃고 갱신이 도는 내내 살아 있는 채로
       * 앉아 있었고, 두 번째 누름이 똑같은 집합을 보내며 두 번째 갱신을 시작했다.
       *
       * 이 파일 전체에서 `isPending`은 `false`로 목이 되어 있으므로, 여기를 통과시키는
       * 것은 화면 자신의 복구 플래그뿐이다.
       */
      const button = screen.getByRole('button', { name: '1벌 기록' })
      expect(button.hasAttribute('disabled')).toBe(true)
      expect(button.getAttribute('aria-busy')).toBe('true')

      fireEvent.click(button)
      expect(submitWearsMock).toHaveBeenCalledTimes(1)
      expect(refetch).toHaveBeenCalledTimes(1)

      await act(async () => {
        land({ isError: false })
        await inFlight
      })

      expect(toast).toHaveBeenCalledTimes(1)
      // 그리고 잠금이 풀린다. 아니면 모드가 열려 있는 내내 갇힌다.
      expect(screen.getByRole('button', { name: '1벌 기록' }).hasAttribute('disabled')).toBe(false)
      toast.mockRestore()
    })

    /**
     * 잠금은 제출에만 걸리고 다른 것에는 걸리지 않는다.
     *
     * `recovering`은 화면 상태라 자신을 만든 선택보다 오래 살고, 갱신 도중에 다시 열면
     * 새 선택의 제출이 잠긴 채 보인다 — 플래그의 주석이 그대로 두자고 주장하는, 경계가
     * 있는 이상함이다. 절대 여기 합류하면 안 되는 것이 취소다. 그것을 잠그면 갱신이
     * 도착할 때까지 모드가 갇히고, 실패하는 쪽은 `retry: 2`와 그 백오프를 싣는다.
     */
    it('복구 중에도 취소는 눌리고, 모드가 갇히지 않는다', async () => {
      let land!: (result: { isError: boolean }) => void
      const inFlight = new Promise<{ isError: boolean }>((resolve) => {
        land = resolve
      })
      const refetch = vi.fn(() => inFlight)

      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOne()
      await act(async () => {
        submit()
      })

      const cancel = screen.getByRole('button', { name: '고르기 취소' })
      expect(cancel.hasAttribute('disabled')).toBe(false)
      fireEvent.click(cancel)
      expect(screen.queryByRole('group', { name: /입은 옷 고르기/ })).toBeNull()

      await act(async () => {
        land({ isError: false })
        await inFlight
      })
    })

    it('다시 불러오지 못하면 그렇게 말한다', async () => {
      // `void`가 이 답을 버려서, 오프라인 재시도가 똑같이 끝난 듯한 문장을 받고
      // 30분짜리 교착이 아무 말 없이 돌아왔다.
      const refetch = vi.fn().mockResolvedValue({ isError: true })
      const toast = vi.spyOn(toaster, 'create')

      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOne()
      await act(async () => {
        submit()
      })

      expect(toast.mock.calls[0][0].description).toContain('연결을 확인')
      toast.mockRestore()
    })

    /**
     * 복구 전체 경로.
     *
     * 이것이 지키는 것은 타이밍이 아니라 필터다 — 목 갱신이 동기로 끝나고 다시 그리기가
     * 손으로 이뤄지므로 `void` 판본도 통과한다. 덮는 것은 따로 있다. `selectedIds`가
     * 애초에 `knownIds`에서 파생된다는 것, 그래서 짧아진 옷장이 초안을 아무도 건드리지
     * 않고도 짧은 payload를 만든다는 것.
     */
    it('다시 불러온 뒤의 누름은 사라진 옷을 빼고 나간다', async () => {
      const refetch = vi.fn(() => {
        // 서버가 실제로 가진 것 — i2는 다른 기기에서 지워졌다.
        useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
        return Promise.resolve({ isError: false })
      })
      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(
        query({ data: [item(), item({ id: 'i2', title: '흰 티' })], refetch }),
      )
      const { rerender } = renderWardrobe()

      fireEvent.click(wearButton()!)
      fireEvent.click(screen.getByRole('button', { name: /마산 플리스/ }))
      fireEvent.click(screen.getByRole('button', { name: /흰 티/ }))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '2벌 기록' }))
      })
      expect(submitWearsMock.mock.calls[0][0].itemIds).toEqual(['i1', 'i2'])

      // 갱신이 도착했다. 화면이 짧아진 옷장으로 다시 그려진다.
      rerender()
      submitWearsMock.mockImplementation(() => undefined)
      fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))

      expect(submitWearsMock.mock.calls[1][0]).toEqual({ wornOn: today, itemIds: ['i1'] })
    })

    it('그 밖의 실패로는 옷장을 다시 부르지 않는다', () => {
      // 갱신은 모든 커버 URL을 재서명하고 모든 썸네일을 다시 받는다. 그래서 컬렉션이
      // 틀렸다고 말하는 그 하나의 실패를 위한 것이지, 새로 배울 것이 없는 끊긴 연결을
      // 위한 것이 아니다.
      const refetch = vi.fn().mockResolvedValue({ isError: false })
      submitWearsMock.mockImplementation((_vars, options) =>
        options?.onError?.(new Error('offline')),
      )
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOneAndSubmit()

      expect(refetch).not.toHaveBeenCalled()
    })
  })

  /**
   * 초안은 새로고침을 살아남으므로, 그것이 놓일 화면보다 먼저 여기 있을 수 있다.
   * 그것이 틀어지는 방식이 넷이고 넷 다 닿을 수 있었다.
   */
  describe('열려 있던 초안', () => {
    it('옷장이 아직 오는 중이면 고르는 모드를 열지 않는다', () => {
      // 착용 기록이 보통 먼저 도착한다 — 옷장 가져오기는 오는 길에 모든 커버 URL을
      // 서명한다 — 그래서 제출 바가 로딩 스켈레톤 위에 그려졌다. 고를 옷이 없는 화면의
      // 옷 고르기 모드다.
      openWearDraft(OWNER, today, ['i1'])
      useWardrobeMock.mockReturnValue(query({ isLoading: true, isFetching: true }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
      expect(screen.queryByRole('button', { name: /벌 기록|옷을 골라주세요/ })).toBeNull()
      // 등록 버튼은 그대로다 — 네트워크가 없어도 동작한다.
      expect(registerFab()).not.toBeNull()
    })

    it('옷장을 불러오지 못한 화면에서도 열지 않는다', () => {
      openWearDraft(OWNER, today, ['i1'])
      useWardrobeMock.mockReturnValue(query({ error: new Error('offline') }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
    })

    it('오늘이 아닌 날짜의 초안은 열지 않는다', () => {
      // `wearDraft`는 복원할 때만 날을 검사했었다. 다른 날의 초안을 UI가 더는 만들 수
      // 없지만 날짜 컨트롤이 사라지기 전에 쓰인 것은 여전히 있을 수 있고, 그것은 화면의
      // 무엇도 부르지 않는 날에 제출했을 것이다.
      openWearDraft(OWNER, '2020-01-01', ['i1'])
      useWardrobeMock.mockReturnValue(query({ data: [item()] }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
      fireEvent.click(wearButton()!)
      expect(dateLabel()?.textContent).toBe(`${monthDay(today)} (오늘)`)
    })

    /**
     * 앞 테스트가 만들지 못한 경우.
     *
     * 마운트 전에 낡은 초안을 심는 것은 복원 경로를 검사한다. 이쪽은 시계를 마운트
     * *뒤에* 움직이는데, 그것이 "자정을 넘겨 열려 있던 탭"의 실제 뜻이고 가드가 쓰인
     * 이유다. 통과하는 것은 `useToday`에 타이머가 있기 때문이다 — 이벤트 리스너만으로는
     * 16일에도 바가 8.15 (오늘)을 말하며 그날에 제출했다.
     */
    it('마운트 뒤에 자정을 넘기면 닫히고, 다시 열면 새 오늘이 된다', () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date(2026, 7, 15, 23, 59, 0))
        useWardrobeMock.mockReturnValue(query({ data: [item()] }))
        renderWardrobe()

        fireEvent.click(wearButton()!)
        expect(dateLabel()?.textContent).toBe('8.15 (오늘)')

        // visibilitychange도 focus도 없다 — 그냥 창을 보고 있었을 뿐이다.
        act(() => {
          vi.advanceTimersByTime(2 * 60 * 1000)
        })

        expect(dateLabel()).toBeNull()

        fireEvent.click(wearButton()!)
        expect(dateLabel()?.textContent).toBe('8.16 (오늘)')
      } finally {
        vi.useRealTimers()
      }
    })

    it('다른 사용자의 초안은 열지 않는다', () => {
      // localStorage는 로그아웃을 살아남는다. 소유자 검사가 없으면 다음 사람의 화면이
      // 남의 선택을 든 채 열리고, 체크된 카드는 하나도 보이지 않으며, 제출은 외래키에서
      // 실패한다.
      openWearDraft('another-user', today, ['i1'])
      useWardrobeMock.mockReturnValue(query({ data: [item()] }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
      expect(wearButton()).not.toBeNull()
    })
  })

  /**
   * 옷장보다 오래 살 수 있는 옷 id를 든 스토어가 둘이고, `dropItemWears`는 그중 하나에,
   * 그것도 이 탭에서만 닿는다. 다른 기기에서 지우는 것도, 선택을 열어둔 채
   * 설정 → 처분한 옷으로 걸어가는 것도 그것을 지나친다.
   *
   * 지킬 값을 하게 만든 것은 실패의 크기다 — id가 제출에 실려 가고,
   * `set_item_wears`가 `item_wears_item_fk`에 걸리며, 함수가 한 트랜잭션이라 그 옷만이
   * 아니라 그날 전체가 실패한다.
   */
  describe('사라진 옷', () => {
    it('열려 있는 초안에서 빠지고, 개수와 그리드와 제출이 같이 줄어든다', () => {
      useWardrobeMock.mockReturnValue(query({ data: [item({ id: 'i2', title: '흰 티' })] }))
      openWearDraft(OWNER, today, ['gone', 'i2'])
      renderWardrobe()

      // 카드 하나, 개수 하나, payload 하나 — 초안을 읽는 세 곳이 어긋날 수 없고,
      // 그래서 알릴 것이 없다.
      expect(screen.queryAllByRole('button', { name: /흰 티/ })).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))

      expect(submitWearsMock.mock.calls[0][0]).toEqual({ wornOn: today, itemIds: ['i2'] })
    })

    it('착용 기록만 남은 유령은 버튼 개수에 잡히지 않는다', () => {
      useWardrobeMock.mockReturnValue(query({ data: [item()] }))
      useWearsMock.mockReturnValue({ data: [{ itemId: 'gone', wornOn: today }] })
      renderWardrobe()

      // 오늘 1벌은 DB가 옷과 함께 캐스케이드로 지운 행을, 그것을 없앨 버튼이 하나도
      // 없는 화면에서 세는 것이다.
      expect(screen.queryByRole('button', { name: /기록 고치기/ })).toBeNull()
      expect(screen.getByRole('button', { name: /오늘 입은 옷 기록하기/ })).toBeDefined()
    })
  })
})

/** 이 화면이 실제로 읽는 몇 필드. */
function item(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: 'i1',
    userId: 'u1',
    title: '마산 플리스',
    categoryId: 'top.knit',
    brand: null,
    size: null,
    fit: null,
    colors: [],
    seasons: [],
    price: null,
    purchasedAt: null,
    purchasePlace: null,
    memo: null,
    tags: [],
    status: 'owned',
    isFavorite: false,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    images: [],
    coverUrl: null,
    ...overrides,
  }
}
