import { useMemo, useRef, useState } from 'react'
import {
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Settings,
  Shirt,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Link } from 'react-router'
import { cx } from 'styled-system/css'

import { useDiscardUpload, usePendingUploads, useRetryUpload, useWardrobe } from '@/entities/item'
import { attachWears, itemIdsWornOn, useSetWears, useWears } from '@/entities/wear'
import { useCurrentUserId } from '@/features/auth'
import {
  applyFilters,
  appliedFilters,
  clearFilters,
  deriveFilterOptions,
  EMPTY_FILTERS,
  removeApplied,
  SORT_OPTIONS,
  WardrobeFilterSheet,
  type WardrobeFilters,
} from '@/features/wardrobe-filter'
import {
  closeWearDraft,
  openWearDraft,
  toggleWearDraftItem,
  useWearDraft,
  WearFab,
  WearSelectionBar,
} from '@/features/wear-log'
import { CATEGORY_GROUPS, groupIdOf, type CategoryGroupId } from '@/shared/config/categories'
import { assertNever } from '@/shared/lib/assertNever'
import { errorMessage, hasErrorCode } from '@/shared/lib/errorMessage'
import { useScrolledPast } from '@/shared/lib/useScrolledPast'
import { useToday } from '@/shared/lib/useToday'
import { Button } from '@/shared/ui/Button'
import { buttonStyle, iconButtonStyle } from '@/shared/ui/Button.css'
import { chipStyle } from '@/shared/ui/Chip.css'
import { EmptyState } from '@/shared/ui/EmptyState'
import { inputStyle } from '@/shared/ui/Field.css'
import { toaster } from '@/shared/ui/toast'
import * as styles from './WardrobePage.css'
import { groupSections } from '../lib/sections'
import { GridSkeleton, WardrobeGrid } from './WardrobeGrid'

/** 이 화면이 될 수 있는 다섯 가지. */
type View = 'loading' | 'failed' | 'empty' | 'noMatches' | 'grid'

/**
 * 낡음 배너가 어느 화면의 것인지.
 *
 * `view === …` 비교의 나열이 아니라 `Record`다. 비교는 새 view가 "여기 일부러 놓여야
 * 한다"고 산문으로 말할 뿐이고, 산문은 아무도 막지 않는다 — 여섯 번째 view는 그냥
 * 조용히 배너를 못 받는다. 유니온을 키로 잡으면 하나가 늘 때 답할 때까지 컴파일러가 멈춘다.
 */
const SHOWS_STALE_NOTICE: Record<View, boolean> = {
  loading: false,
  // 화면 자체가 이미 실패다. 그 위의 배너는 같은 말을 두 번 하는 것이다.
  failed: false,
  empty: true,
  noMatches: true,
  grid: true,
}

/**
 * 내 옷장 — 홈 화면 (PRD §6.1).
 *
 * 모든 축이 메모리의 컬렉션 위에서 돌므로 검색·칩·필터 시트·정렬이 왕복 없이 끝난다.
 *
 * 그 전부가 컨트롤마다의 상태 변수가 아니라 `WardrobeFilters` 값 하나다. 시트·카테고리
 * 레일·검색창이 그러지 않으면 하나의 `applyFilters` 호출에 먹이를 주는 세 출처가 되고,
 * 그 전부를 한 번에 서술하고 그중 하나를 뺄 수 있어야 하는 요약 행은 객체 하나에 대해서만
 * 쓸 수 있다.
 */
export function WardrobePage() {
  const { data, isLoading, isFetching, error, refetch } = useWardrobe()
  const { data: wearData } = useWears()
  const submitWears = useSetWears()
  const pending = usePendingUploads()
  const retry = useRetryUpload()
  const discard = useDiscardUpload()

  const userId = useCurrentUserId()
  const today = useToday()
  // 두 가드가 모두 스토어에 있다 — 누구의 초안인지, 그 날이 아직 앱이 쓰는 날인지.
  const draft = useWearDraft(userId, today)

  const [filters, setFilters] = useState<WardrobeFilters>(EMPTY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  /**
   * 실패한 제출이 시작한 옷장 갱신을, 화면이 보여줄 수 있는 형태로.
   *
   * 뮤테이션의 `isPending`은 쓸 수 없다 — `onError`에 들어올 때 이미 false이고 그 콜백을
   * 기다리는 것도 없다(`queries.premise.test.tsx`). `isFetching`도 아니다. 창 포커스가
   * 시작한 갱신에도 참이라 사용자가 하지 않은 일로 컨트롤을 잠근다.
   *
   * 자신을 만든 선택보다 오래 살아서, 갱신 도중 다시 연 선택의 제출도 잠긴다. 옷장이 정말
   * 교체되는 중이므로 잠금은 옳고, 거짓말하는 스피너를 떼는 방법이 전부 더 나쁘다.
   */
  const [recovering, setRecovering] = useState(false)
  const stickSentinel = useRef<HTMLDivElement>(null)
  const statusStrip = useRef<HTMLDivElement>(null)
  const stuck = useScrolledPast(stickSentinel, statusStrip)

  /**
   * 이 탭이 아직 아는 옷. 아래 모든 것이 이것을 거른다.
   *
   * 옷장보다 오래 사는 id를 든 스토어가 둘인데(착용 기록, 초안) `dropItemWears`는 첫
   * 번째에만 닿는다. 걸러지지 않으면 카드 없는 옷이 선택에 남아 제출이
   * `item_wears_item_fk`에서 죽고, 함수가 통째로 롤백되어 그날을 기록할 수 없다.
   *
   * 이 탭이 아는 것까지가 전부다 — 다른 기기의 삭제는 `submitSelection`의 `23503` 가지가 맡는다.
   * 처분한 옷도 포함한다. 가리킬 것이 없는 것은 *지워진* 옷뿐이다.
   */
  const knownIds = useMemo(() => new Set((data ?? []).map((item) => item.id)), [data])

  /**
   * 착용 기록과, 그것이 답했는지.
   *
   * "행이 있다"가 아니라 `data !== undefined`다. 한 번도 기록한 적 없는 사람은 `[]`를
   * 받고 그것도 답이다. 그 구분이 무엇을 위한 것인지는 아래 `canRecord`에 있다.
   */
  const wears = useMemo(
    () => (wearData ?? []).filter((entry) => knownIds.has(entry.itemId)),
    [wearData, knownIds],
  )
  const wearsAnswered = wearData !== undefined

  /**
   * 옷마다 착용 이력이 붙은 옷장.
   *
   * 어느 쿼리도 아닌 여기서 합치므로, 착용 토글이 옷 캐시를 건드리지 않는다.
   */
  const entries = useMemo(() => attachWears(data ?? [], wears), [data, wears])
  const visible = useMemo(() => applyFilters(entries, filters), [entries, filters])
  /**
   * 검색과 칩 이전의 옷장.
   *
   * 레일과 필터 시트 둘 다 이 컬렉션이 실제로 가진 값만 내주고, 둘 다 `visible`이 아니라
   * *여기서* 읽어야 한다. 걸러진 결과에서 파생한 선택지는 타이핑 한 글자마다 스스로를
   * 다시 쓰고, 사용자가 잡고 있던 컨트롤이 손가락 밑에서 사라진다.
   *
   * `status`로 거르는 것은 격자가 늘 한 상태만 그리기 때문이다. 처분한 옷에만 있는
   * 브랜드는 아무것도 못 맞추는 칩으로 제안되고, 아무것도 못 맞추는 필터는 사용자의
   * 실수처럼 읽힌다.
   */
  const inWardrobe = useMemo(
    () => entries.filter((entry) => entry.status === filters.status),
    [entries, filters.status],
  )
  const options = useMemo(() => deriveFilterOptions(inWardrobe), [inWardrobe])
  const applied = appliedFilters(filters)
  // 같은 목록이지, 같은 축을 두 번 걷는 것이 아니다.
  const filterCount = applied.length
  const ownedCount = entries.filter((entry) => entry.status === 'owned').length
  const activeGroup = filters.groupIds[0] ?? null
  const hasWardrobe = entries.length > 0 || pending.length > 0

  /**
   * 이 옷장이 쓸 데가 있는 카테고리 칩.
   *
   * 모든 축이 그래야 해서가 아니다 — 시트의 색상과 계절은 일부러 프리셋 전체를 나열한다
   * (`filterOptions.ts`). 이 축이 사는 자리 때문이다. 없는 색상 칩은 열어야 보이는 시트
   * 뒤에 있지만, 없는 카테고리 칩은 홈 화면에 매번 깔린다.
   *
   * 선택된 그룹은 비어도 남는다. 켜진 칩이 지금 보고 있는 카테고리를 말하는 유일한
   * 것이라(요약 행은 일부러 대분류를 싣지 않는다) 사라지면 화면이 이유 없이 빈다.
   */
  const railGroups = useMemo(() => {
    // 원소 타입을 추론에 맡기지 않고 이름 붙이는 것이 인자의 존재 이유다. `new Set(…)`은
    // 넘겨받은 것에서 타입을 가져가므로 `undefined` 원소를 말없이 흡수한다.
    // `ResolvableSubcategoryId` 참고.
    const present = new Set<CategoryGroupId>(inWardrobe.map((entry) => groupIdOf(entry.categoryId)))
    return CATEGORY_GROUPS.filter((group) => present.has(group.id) || group.id === activeGroup)
  }, [inWardrobe, activeGroup])

  /**
   * 카테고리로 나뉜 격자.
   *
   * 구획이 하나뿐일 때도 늘 그려지는 것의 출처다. 대안은 이것 옆에 `visible`을 먹는
   * 두 번째 격자를 두는 것인데, 같은 카드에 출처가 둘이 되고 `visible`이 비었지만 옷장은
   * 비지 않은 유일한 화면(첫 등록이 아직 올라가는 중)에서 빈 `<ul>`을 그린다.
   */
  const sections = useMemo(() => groupSections(visible), [visible])

  /**
   * 구획이 하나보다 많은지 — 제목을 그릴지, 정렬 컨트롤이 묶음을 이름에 넣을지가 여기 달렸다.
   *
   * 일부러 "전체가 선택됐는가"가 아니다. 제목 하나는 화면 위 전부를 이름 부르는 것이고
   * 그건 위의 타이틀이 이미 한다. 그리고 컨트롤을 가진 모든 필터 축이 구획 하나만 남길
   * 수 있다 — 규칙을 축마다 두면 아홉 개가 되지만, 개수는 하나다.
   */
  const sectioned = sections.length > 1

  // "행이 있다"가 아니라 `data !== undefined`. 빈 옷장도 답이다 — `data: []`는 가져오기가
  // 성공했고 이 사람이 아직 아무것도 안 가졌다는 뜻이고, 나중의 갱신 실패가 그 답을
  // 도로 가져가지 않는다.
  const answered = data !== undefined

  /**
   * 이 화면이 다섯 중 무엇인지, 한 번에 정한다.
   *
   * 조건을 분기마다 다시 적으면 "그릴 행이 없다"를 "옷장이 비었다"로 읽는 실수가 난다 —
   * `entries`는 `data ?? []`라 로딩 중에도 비어 있고, `error`는 react-query가 `data`
   * *대신*이 아니라 *함께* 세운다.
   *
   * 그래서 `failed`는 차가운 경우뿐이다. 행을 든 채의 실패가 어느 view인지는 필터가
   * 정하고, 배너는 위 `SHOWS_STALE_NOTICE`가 답한다 — `grid`만이 아니라 `noMatches`도
   * 싣는 이유다.
   */
  const view: View = isLoading
    ? 'loading'
    : error != null && !answered
      ? 'failed'
      : !hasWardrobe
        ? 'empty'
        : visible.length === 0 && pending.length === 0
          ? 'noMatches'
          : 'grid'

  /**
   * 아직 동작하는 화면 위에 얹어 말할 만한 실패.
   *
   * `hasWardrobe`로 다시 검사하지 않고 `view`에서 읽으므로, 실제로 그려지는 분기와
   * 어긋날 수 없다.
   */
  const stale = error != null && SHOWS_STALE_NOTICE[view]

  /**
   * 이 화면이 기록을 할 수 있는지.
   *
   * "옷장을 불러오지 못했어요"와 빈 옷장에서는 안 된다 — 앞은 고를 컬렉션이 없고 뒤는
   * 안에 아무것도 없다. `noMatches`는 유지한다. 모드 안에서도 필터에 닿을 수 있으므로,
   * 지금 아무것도 못 맞추는 검색어는 막다른 길이 아니라 타이핑으로 빠져나올 상태다.
   *
   * `wearsAnswered`가 스피너에 대한 예의가 아니라 이 조건의 핵심이다. 제출은 하루를
   * 통째로 다시 쓰므로, 도착하지 않은 컬렉션에서 심은 선택은 진짜 기록 위에 쓰이려는
   * 빈 집합이다.
   */
  const canRecord = wearsAnswered && userId !== null && (view === 'grid' || view === 'noMatches')

  /**
   * 선택이 실제로 진행 중인지. 초안이 있는지와는 다른 질문이다.
   *
   * 초안은 새로고침을 살아남으므로 콜드 스타트에서는 두 쿼리보다 먼저 여기 있다 —
   * 착용 기록이 보통 먼저 도착한다. 옷 가져오기는 커버 URL도 전부 서명하기 때문이다.
   * 게이트가 없으면 제출 바가 로딩 스켈레톤 위에, 그리고 "옷장을 불러오지 못했어요" 위에
   * 그려진다 — 고를 옷이 없는 화면의 옷 고르기 모드다.
   *
   * `wearsAnswered`가 아니라 `canRecord`인 것은, 모드가 틀린 모든 화면이 `View`와 발을
   * 맞춰야 하는 목록이 아니라 조건 하나로 빠지도록 하기 위해서다.
   */
  const selecting = canRecord ? draft : null

  /**
   * 그날이 담고 있는 것 — 처분한 옷까지 포함해 그날에 기록된 모든 착용.
   *
   * 격자는 `owned`만 그리므로 둘은 어긋날 수 있다. 오늘 입은 옷을 처분하면 카드 한 장
   * 위에 버튼이 "오늘 2벌"이라고 쓴다. 개수가 맞다 — 기록을 서술하니까 — 그리고 화면에
   * 있는 것으로 좁히면 더 나쁘다. 숨은 옷은 어차피 제출되는 집합에 남으면서 보이지도
   * 세어지지도 않게 된다.
   */
  const recordedIds = useMemo(() => itemIdsWornOn(wears, today), [wears, today])

  /**
   * 실제로 골라진 것 — 초안에서, 더 이상 옷이 아닌 것을 뺀 것.
   *
   * 초안은 한 번 쓰이고 나면 옷장에 무슨 일이 일어나든 살아남는다. 제출 시점이 아니라
   * 여기서 거르는 것이 그것을 읽는 세 곳(격자의 체크, 버튼의 개수, 보내는 값)이 어긋나지
   * 않게 한다.
   */
  const selectedIds = useMemo(
    () => (selecting ? new Set(selecting.itemIds.filter((id) => knownIds.has(id))) : null),
    [selecting, knownIds],
  )

  function setGroup(groupId: CategoryGroupId | null) {
    setFilters((current) => ({ ...current, groupIds: groupId ? [groupId] : [] }))
  }

  /**
   * 오늘을, 이미 담고 있는 것으로 채워 연다.
   *
   * 날짜 인자가 없는 것은 넘길 다른 날이 없기 때문이다 — 지금 날짜는 라벨이고
   * `wearDraft.isUsable`이 다른 날을 거부한다. 날짜 피커와 함께 돌아온다.
   */
  function startSelecting() {
    // `string | null`을 좁히는 것 이상은 아니다. 닿지 않게 하는 것은 `canRecord`이고,
    // 혹시 닿는다면 착용 버튼이 아무 일도 하지 않는다.
    if (!userId) return
    openWearDraft(userId, today, itemIdsWornOn(wears, today))
  }

  function submitSelection() {
    if (!selecting || !selectedIds) return
    const { wornOn } = selecting
    // `selecting.itemIds`가 아니라 `selectedIds` — 초안이 그새 지워진 옷을 들고 있을 수
    // 있고, 그것을 보내면 DB가 그날 전체를 거부한다.
    const itemIds = [...selectedIds]

    submitWears.mutate(
      { wornOn, itemIds },
      {
        // 성공할 때만 모드가 닫힌다. 실패는 사용자가 고른 것을 손에 든 채로 남겨야 한다 —
        // 다른 어디에도 그것이 없고, 격자를 두 번 걸으라는 것은 놓친 요청에 대한 최악의 답이다.
        onSuccess: () => {
          closeWearDraft()
          toaster.create({
            title:
              itemIds.length > 0
                ? `오늘 입은 옷 ${itemIds.length}벌을 기록했어요.`
                : '오늘 기록을 지웠어요.',
            type: 'success',
          })
        },
        /**
         * `23503` — 선택에 든 옷이 DB에서 사라졌다. 이 탭이 보지 못한 삭제(다른 기기,
         * 다른 창)에서만 닿는다.
         *
         * 갱신이 없으면 `staleTime` 동안 컬렉션이 틀린 채로 남아 버튼이 매번 똑같이
         * 실패한다 — 이 뮤테이션은 아무것도 무효화하지 않는다. `knownIds`가 `data`에서
         * 파생되므로 await해야 선택이 실제로 줄고, 실패한 갱신도 말할 수 있다.
         */
        onError: async (e) => {
          if (!hasErrorCode(e, '23503')) {
            toaster.create({
              title: '기록하지 못했어요',
              description: errorMessage(e, '잠시 후 다시 시도해주세요.'),
              type: 'error',
            })
            return
          }

          setRecovering(true)
          try {
            // `refetch`는 거부하지 않고 실패를 실어 resolve하지만, 그것이 react-query
            // 옵션 하나로 뒤집힐 수 있고 `onError` 안의 처리되지 않은 rejection은
            // 보이지 않는다.
            const result = await refetch().catch(() => null)

            toaster.create({
              title: '기록하지 못했어요',
              description:
                result != null && !result.isError
                  ? '옷장에 없는 옷이 섞여 있었어요. 그 옷을 빼고 목록을 새로 불러왔어요.'
                  : '옷장을 새로 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.',
              type: 'error',
            })
          } finally {
            setRecovering(false)
          }
        },
      },
    )
  }

  const sortLabel = SORT_OPTIONS.find((option) => option.id === filters.sort)?.label ?? ''

  /**
   * 화면이 실제로 무엇으로 정렬돼 있는지. 제목이 생기는 순간 그것은 정렬만이 아니게 된다.
   *
   * 구획은 카테고리 표의 순서로 돌아가므로 정렬은 한 구획 안에서만 살아남는다. 모든
   * 구획 위에 앉아 "최근 등록순"이라고 쓰는 버튼은 화면이 갖지 않은 순서를 약속하는
   * 컨트롤이다. 묶음이 사용자가 요청한 것이고 둘을 동시에 참으로 만드는 순서는 없으므로,
   * 라벨이 둘 다 말한다 — 갈래별 · 최근 등록순.
   */
  const orderLabel = sectioned ? `갈래별 · ${sortLabel}` : sortLabel

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        {/* `hstack`은 기본이 세로 가운데 정렬이고 여기서는 그 기본이 맞다 — 제목의 라인
            박스는 29px이고 설정 버튼은 44px 탭 타겟이라, 위로 맞추면 톱니가 제목의
            광학적 중심보다 아래로 내려앉는다. */}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            내 옷장
            <span className={styles.titleCount}>{ownedCount}</span>
          </h1>
          <Link to="/settings" aria-label="설정" className={styles.settingsLink}>
            <Settings size={20} />
          </Link>
        </div>
      </div>

      {/*
        바가 인셋 아래에 고정된 뒤 덮이지 않고 남는 띠. sticky가 아니라 fixed라 높이가
        흐름에 들어가지 않는다 — 붙는 순간 인셋만큼 자라는 바는 격자 전체를 한 프레임에
        47px 밀어낸다.

        이 요소가 아래 트리거의 자이기도 하다. 그 높이가 곧 `--safe-t`라, 센티널이 넘어야
        하는 선과 바가 밀려나는 거리가 같은 요소에서 읽은 같은 숫자가 되어 어긋날 수 없다.
      */}
      <div
        ref={statusStrip}
        className={styles.statusStripScrim}
        data-stuck={stuck || undefined}
        aria-hidden="true"
      />

      {/* 높이 0이고 아래 바의 트리거 전부다. 바의 위 가장자리가 쉬는 자리에 정확히
          앉으므로, 이것이 뷰포트 상단을 넘는 순간이 바가 붙는 순간이다. 바 자체를 재면
          트리거가 바의 높이에 묶이는데, 바는 필터가 걸릴 때마다 한 줄씩 자란다. */}
      <div ref={stickSentinel} />

      {/* 격자가 스크롤되는 동안 고정된다. 화면에 무엇이 있는지를 바꾸는 컨트롤이고,
          그것들에 닿으려고 위로 되돌아가야 하는 것이 긴 옷장을 피곤하게 만든다. 위의
          타이틀은 컨트롤이 아니므로 떠나도 된다. */}
      <div className={styles.controls} data-stuck={stuck || undefined}>
        {/* 옷을 고르는 동안 여기에 더해지는 것은 없다. 날짜와 나가는 길 둘 다 화면 아래
            `WearSelectionBar`에 있다 — 스크롤하는 엄지 옆이다. */}
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <Search size={16} aria-hidden="true" className={styles.searchIcon} />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => setFilters((current) => ({ ...current, query: e.target.value }))}
              aria-label="옷 검색"
              placeholder="이름, 브랜드, 메모, 태그"
              className={inputStyle({ withLeadingIcon: true })}
            />
          </div>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={filterCount > 0 ? `필터 ${filterCount}개 적용됨` : '필터'}
            className={cx(
              iconButtonStyle({ shape: 'square', filled: true, active: filterCount > 0 }),
              styles.filterButton,
            )}
          >
            <SlidersHorizontal size={19} />
            {filterCount > 0 && (
              <span className={styles.badge} aria-hidden="true">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* 하나도 없을 때가 아니라 하나일 때도 숨긴다. 전부 상의인 옷장에서 전체와 상의는
            같은 옷을 고르므로, 행이 서로 다를 수 없는 칩 둘이 된다. 두 번째 카테고리가
            등록되는 순간 다시 나타난다. */}
        {railGroups.length > 1 && (
          <div className={styles.rail}>
            <button
              type="button"
              aria-pressed={activeGroup === null}
              className={chipStyle({ active: activeGroup === null })}
              onClick={() => setGroup(null)}
            >
              전체
            </button>
            {railGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={activeGroup === group.id}
                className={chipStyle({ active: activeGroup === group.id })}
                onClick={() => setGroup(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>
        )}

        {/* 시트가 소유한 축만. 카테고리는 위 레일에서 이미 켜진 칩이고, 여기에 지울 수 있는
            알약을 하나 더 주면 선택 하나에 컨트롤이 둘이 된다. */}
        {applied.length > 0 && (
          <div className={styles.rail}>
            {applied.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-label={`${entry.label} 필터 해제`}
                className={chipStyle({ active: true })}
                onClick={() => setFilters((current) => removeApplied(current, entry))}
              >
                {entry.label}
                <X size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      <main className={styles.main}>
        {/* 분기 밖에, 늘 마운트된 채로.
            라이브 리전은 내용이 *바뀔 때* 읽히므로, 문장을 담은 채 나타나는 리전은 읽는
            리더와 안 읽는 리더가 갈리고, 데이터가 도착할 때 언마운트되는 리전은 기다림이
            끝났다고 말하지 못한다. 여기 두면 기다림에서 결과로 바뀌므로 한 요소가 두
            알림을 다 한다. */}
        <p role="status" className={styles.srOnly}>
          {/* 모드에 들어가고 나가는 것이 격자 위의 탭이 무엇을 하는지를 바꾸는데, 그것을
              소리 내어 말하는 것이 달리 없다. 모드가 켜져 있는 동안 값이 일정하므로
              들어갈 때와 나올 때 한 번씩만 알린다. */}
          {selecting ? '오늘 입은 옷을 고르는 중이에요. ' : ''}
          {view === 'loading'
            ? '옷장을 불러오는 중이에요.'
            : view === 'failed'
              ? '옷장을 불러오지 못했어요.'
              : view === 'empty' || view === 'noMatches' || view === 'grid'
                ? `옷 ${visible.length}벌${stale ? '. 최신 목록은 불러오지 못했어요.' : ''}`
                : assertNever(view)}
        </p>

        {/* 옷장 대신이 아니라 옷장 위에. 화면의 행은 진짜이고 몇 분 지났을 뿐이다.
            `role="alert"`는 없다 — 위 리전이 늘 마운트돼 있고 그 문장이 이미 이 사실로
            바뀌었다. 여기 alert를 두면 같은 사실을 알리는 두 번째 라이브 리전이 되고,
            재시도 버튼의 라벨까지 문장의 일부로 읽는다. */}
        {stale && (
          <div className={styles.staleNotice}>
            <TriangleAlert size={15} aria-hidden="true" className={styles.staleIcon} />
            <span className={styles.staleText}>최신 목록을 불러오지 못했어요</span>
            {/* `ghost`가 아니라 `outline` — ghost의 hover 채움이 이 배너가 칠해진
                `bg.subtle`이라, hover가 글자색만 바꾼다. */}
            <Button
              size="sm"
              variant="outline"
              icon={<RotateCcw />}
              loading={isFetching}
              onClick={() => void refetch()}
            >
              다시 시도
            </Button>
          </div>
        )}

        {view === 'loading' ? (
          <div className={styles.stack}>
            {/* 자리표시자는 장식이다 — 빈 리스트 항목 여섯 개는 스크린리더가 걸어야 할
                것이 아니다. */}
            <div className={styles.listMeta} aria-hidden="true">
              <span className={styles.listMetaSkeletonBar} />
            </div>
            <GridSkeleton />
          </div>
        ) : view === 'failed' ? (
          <EmptyState
            tone="danger"
            icon={<TriangleAlert size={24} />}
            title="옷장을 불러오지 못했어요"
            description={errorMessage(error)}
            action={
              // `isLoading`이 아니라 `isFetching` — 한 번 에러가 난 쿼리는 재시도 내내
              // status가 'error'라 `isLoading`이 계속 false다. `retry: 2`와 함께면 그
              // 몇 초가 조용하고, 사용자는 그동안 한 번씩 더 누른다.
              <Button
                variant="outline"
                icon={<RotateCcw />}
                loading={isFetching}
                onClick={() => void refetch()}
              >
                다시 시도
              </Button>
            }
          />
        ) : view === 'empty' ? (
          <EmptyState
            icon={<Shirt size={24} />}
            title="아직 등록한 옷이 없어요"
            description="사진 찍고 이름만 붙이면 등록 끝. 나머지는 나중에 채워도 괜찮아요."
            action={
              <Link to="/items/new" className={buttonStyle()}>
                <Plus />첫 옷 등록하기
              </Link>
            }
          />
        ) : view === 'noMatches' ? (
          <EmptyState
            icon={<SearchX size={24} />}
            title="조건에 맞는 옷이 없어요"
            description="검색어를 줄이거나 필터를 풀어보세요."
            action={
              <Button
                variant="outline"
                // 시트의 초기화와 같은 `clearFilters`에, 이 버튼만 볼 수 있는 둘(검색창과
                // 카테고리 레일)을 더한다. `EMPTY_FILTERS`는 정렬까지 되돌려, 가격
                // 높은순을 보며 누른 사람을 말없이 최근 등록순으로 데려갔다.
                onClick={() =>
                  setFilters((current) => ({
                    ...clearFilters(current),
                    query: '',
                    groupIds: [],
                  }))
                }
              >
                필터 모두 해제
              </Button>
            }
          />
        ) : view === 'grid' ? (
          <div className={styles.stack}>
            <div className={styles.listMeta}>
              <span className={styles.listCount}>{visible.length}벌</span>
              {/* `<select>`가 아니라 시트를 연다. 네이티브 드롭다운은 이 화면에서 앱이
                  스타일을 입힐 수 없는 유일한 컨트롤이고, 정렬을 바꿀 수 있는 두 번째
                  자리이기도 했다. */}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={buttonStyle({ variant: 'ghost', size: 'sm' })}
              >
                {orderLabel}
                <SlidersHorizontal size={13} aria-hidden="true" />
              </button>
            </div>

            <WardrobeGrid
              sections={sections}
              pending={pending}
              onRetry={retry}
              onDiscard={discard}
              sectioned={sectioned}
              today={today}
              selectedIds={selectedIds}
              onToggleItem={toggleWearDraftItem}
            />
          </div>
        ) : (
          // 닿지 않는다. `View`의 모든 멤버가 위에서 이름 불렸다는 것이 요점이고,
          // 여섯 번째가 생기면 격자로 흘러 조용히 그려지는 대신 여기서 컴파일이 멈춘다.
          assertNever(view)
        )}
      </main>

      {/* 행이 아니라 따로 고정된 버튼 둘이다. 그것이 옷 등록을 화면 정중앙에 놓는다 —
          행이었다면 *쌍*이 가운데 오고 등록 버튼은 한쪽으로 밀린다.

          착용 버튼은 창이 아니라 앱 컬럼의 오른쪽 가장자리에 붙들려, 태블릿에서 페이지
          여백으로 떠내려가지 않는다. */}
      {selecting === null ? (
        <>
          {/* 빈 옷장 화면에서는 감춘다. 그 화면이 이미 한가운데서 첫 옷 등록하기를 내주고
              있고, 같은 경로를 가리키는 똑같은 알약 둘은 앱이 두 번 묻는 것이다. */}
          {view !== 'empty' && (
            <Link to="/items/new" aria-label="옷 등록" className={styles.fab}>
              <Plus />옷 등록
            </Link>
          )}

          {canRecord && (
            <div className={styles.wearFabSlot}>
              <WearFab
                recordedCount={recordedIds.size}
                // 컨트롤 바가 붙는 것과 같은 신호. 두 번째 스크롤 리스너를 두면 페이지
                // 위쪽이 어디서 끝났는지에 대해 둘이 어긋날 수 있다.
                collapsed={stuck}
                onOpen={startSelecting}
              />
            </div>
          )}
        </>
      ) : (
        <WearSelectionBar
          wornOn={selecting.wornOn}
          selectedCount={selectedIds?.size ?? 0}
          recordedCount={recordedIds.size}
          submitting={submitWears.isPending || recovering}
          onSubmit={submitSelection}
          onCancel={closeWearDraft}
        />
      )}

      <WardrobeFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        onChange={setFilters}
        options={options}
        resultCount={visible.length}
      />
    </div>
  )
}
