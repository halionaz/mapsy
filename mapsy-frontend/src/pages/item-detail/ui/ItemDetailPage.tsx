import { useMemo, useRef, useState } from 'react'
import {
  ArchiveRestore,
  CalendarCheck,
  PackageOpen,
  Pencil,
  SearchX,
  Star,
  Trash2,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import {
  useSetFavorite,
  useSetStatus,
  useWardrobe,
  type ItemImage,
  type WardrobeItem,
} from '@/entities/item'
import { attachWears, useToggleWear, useWears, type Worn } from '@/entities/wear'
import { useCurrentUserId } from '@/features/auth'
import { useDeleteItem } from '@/features/item-delete'
import { PhotoViewer, useItemPhotos, type PhotoSlot } from '@/features/item-photos'
import { categoryLabel } from '@/shared/config/categories'
import { colorLabel } from '@/shared/config/colors'
import { seasonLabel } from '@/shared/config/seasons'
import { clamp } from '@/shared/lib/clamp'
import { errorMessage } from '@/shared/lib/errorMessage'
import { formatDate, formatDayAgo, formatPrice } from '@/shared/lib/format'
import { useToday } from '@/shared/lib/useToday'
import { Button, IconButton } from '@/shared/ui/Button'
import { buttonStyle } from '@/shared/ui/Button.css'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { SquarePhoto } from '@/shared/ui/SquarePhoto'
import { toaster } from '@/shared/ui/toast'
import * as styles from './ItemDetailPage.css'

/**
 * 옷 상세 (PRD §6.3).
 *
 * id로 가져오지 않고 옷장 캐시에서 읽는다 — 컬렉션이 이미 통째로 있으므로 옷 하나를 위한
 * 요청은 스피너만 늘린다.
 *
 * 화면 모양은 모든 옷에 대해 같다. 옷이 반드시 갖는 것은 이름·카테고리·사진뿐이라,
 * 채워지지 않은 필드를 감추면 같은 앱이 짧은 토막과 꽉 찬 시트라는 두 화면을 만들고,
 * 필드가 비어 있는 것인지 이 앱이 기록하지 않는 것인지 말해주는 것이 없다.
 */
export function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useCurrentUserId()
  const { data, isLoading } = useWardrobe()
  const { data: wearData } = useWears()
  const today = useToday()

  const setFavorite = useSetFavorite()
  const setStatus = useSetStatus()
  const remove = useDeleteItem()
  const toggleWear = useToggleWear()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const found = data?.find((entry) => entry.id === id)

  /**
   * 착용 이력이 붙은 옷.
   *
   * 옆에 단건 요약기를 따로 두지 않고 길이 1의 목록에 `attachWears`를 쓴다 — 격자의
   * 숫자와 이 화면의 숫자가 같아야 하고, 더하는 방법이 둘이면 언젠가 달라진다.
   */
  const wears = useMemo(() => wearData ?? [], [wearData])
  const item = useMemo(() => (found ? attachWears([found], wears)[0] : undefined), [found, wears])
  // `itemIdsWornOn(...).has(...)`가 아니라 `some` — 그쪽은 옷 하나에 대한 질문에 답하려고
  // 그날 입은 모든 옷의 Set을 짓는다.
  const wornToday = useMemo(
    () =>
      found != null && wears.some((entry) => entry.itemId === found.id && entry.wornOn === today),
    [found, wears, today],
  )
  // 정렬·서명·짝짓기가 한 곳에서 일어난다 — URL이 사진과 위치로 짝지어지므로, 그 순서를
  // 두 번 파생하면 타일이 이웃의 사진을 보여준다.
  const { photos, slots, markUnloadable } = useItemPhotos(item?.images)
  const [photoIndex, setPhotoIndex] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  /**
   * 뷰어가 어느 사진으로 열려 있는지를 컴포넌트 상태가 아니라 히스토리 항목에 둔다.
   *
   * 폰의 뒤로 가기 제스처가 닫지 못하는 전체 화면 오버레이는, 대신 그 아래 화면을 닫는
   * 오버레이다 — 사진을 내려놓으려다 옷 전체가 사라진다. 이동으로 열면 뒤로 가기가 닫고,
   * 값도 들지 않는다. react-router가 항목을 소유하므로 스크롤 복원과 싸우는 pushState가 없다.
   *
   * URL이 아니라 사진 id로. URL은 재서명되지만 id는 그 뒤에도 풀린다.
   */
  const openedPhotoId = (location.state as { photoId?: string } | null)?.photoId ?? null

  // 아래 모든 분기가 ScreenHeader를 그리므로, 그 안의 라이브 리전이 셋을 통틀어 한
  // 요소이고 각 상태를 도착하는 대로 알린다.
  if (isLoading) {
    return (
      <ScreenHeader
        title="옷 상세"
        status="옷 정보를 불러오는 중이에요."
        // 본문의 첫 요소가 아니라 `hero`로. 불러온 화면은 사진을 본문 패딩 밖에 두므로,
        // 안에 앉은 자리표시자는 틀린 자리의 자리표시자다 — 옷이 도착하는 순간 페이지가
        // 본문 패딩만큼 옆으로 튄다.
        hero={<SquarePhoto src={null} alt="" shape="flush" />}
      >
        <DetailSkeletonBody />
      </ScreenHeader>
    )
  }

  if (!item) {
    return (
      <ScreenHeader title="옷 상세" status="이 옷을 찾을 수 없어요.">
        <EmptyState
          icon={<SearchX size={24} />}
          title="이 옷을 찾을 수 없어요"
          description="삭제됐거나 주소가 잘못됐을 수 있어요."
          action={
            <Link to="/" className={buttonStyle({ variant: 'outline' })}>
              내 옷장으로
            </Link>
          }
        />
      </ScreenHeader>
    )
  }

  const photoCount = photos.length
  const disposed = item.status === 'disposed'

  /**
   * 어느 사진이 가운데인지를 스크롤 위치에서 되읽는다.
   *
   * 컨테이너 폭이라고 가정하지 않고 두 번째 타일이 실제로 시작하는 자리에서 재므로,
   * 타일 사이 간격이 어떻든 맞는다.
   */
  function handleStripScroll() {
    const strip = stripRef.current
    if (!strip) return
    const [first, second] = strip.children
    const step =
      first && second
        ? (second as HTMLElement).offsetLeft - (first as HTMLElement).offsetLeft
        : strip.clientWidth
    if (step <= 0) return
    setPhotoIndex(clamp(Math.round(strip.scrollLeft / step), 0, photoCount - 1))
  }

  /** 스트립을 한 사진으로 스크롤한다. 뷰어가 보여주는 것을 따라가도록. */
  function showInStrip(photoId: string) {
    const strip = stripRef.current
    const position = photos.findIndex((image) => image.id === photoId)
    const tile = strip?.children[position]
    const first = strip?.children[0]
    if (!strip || !(tile instanceof HTMLElement) || !(first instanceof HTMLElement)) return
    // 타일 하나의 `offsetLeft`가 아니라 두 타일 사이의 거리. 여기와 <body> 사이에
    // positioned된 것이 없어 타일의 offsetParent가 문서이고, offsetLeft가 페이지 레이아웃
    // 전체를 싣는다 — 넓은 창에서는 가운데 정렬된 컬럼의 여백이고 그것이 타일 대부분이라,
    // 스트립이 엉뚱한 사진으로 스냅한다. 형제끼리는 그것이 상쇄된다.
    strip.scrollTo({ left: tile.offsetLeft - first.offsetLeft })
  }

  async function handleDelete() {
    if (!userId || !item) return
    try {
      await remove.mutateAsync({ id: item.id, userId })
      setConfirmingDelete(false)
      navigate('/', { replace: true })
      toaster.create({ title: `'${item.title}'을(를) 삭제했어요.`, type: 'success' })
    } catch (e) {
      // 다이얼로그는 열린 채로 둔다. 메시지가 그 다이얼로그가 아직 묻고 있는 것의 실패를
      // 이름 부르고 있고, 닫으면 사용자는 여전히 그 자리에 있는 옷을 보며 눌림이 먹혔는지
      // 알 수 없게 된다.
      toaster.create({
        title: '삭제하지 못했어요',
        description: errorMessage(e, '잠시 후 다시 시도해주세요.'),
        type: 'error',
      })
    }
  }

  return (
    <ScreenHeader
      title={item.title}
      eyebrow={categoryLabel(item.categoryId)}
      subtitle={item.brand}
      // 제목 그대로가 아니라 문장으로. 제목은 이미 두 요소 건너의 헤딩이고, 같은 말을
      // 연달아 듣는 것은 도착이 아니라 더듬는 것으로 읽힌다.
      status={`${item.title} 정보를 불러왔어요.`}
      action={
        <IconButton
          label={item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          aria-pressed={item.isFavorite}
          active={item.isFavorite}
          onClick={() =>
            setFavorite.mutate(
              { id: item.id, isFavorite: !item.isFavorite },
              {
                onError: () =>
                  toaster.create({ title: '즐겨찾기를 바꾸지 못했어요.', type: 'error' }),
              },
            )
          }
        >
          <Star size={20} fill={item.isFavorite ? 'currentColor' : 'none'} />
        </IconButton>
      }
      hero={
        <PhotoStrip
          item={item}
          slots={slots}
          photos={photos}
          photoIndex={photoIndex}
          stripRef={stripRef}
          onScroll={handleStripScroll}
          onOpen={(photoId) => navigate(location.pathname, { state: { photoId } })}
          onLoadError={markUnloadable}
        />
      }
    >
      <div className={styles.body}>
        {disposed && (
          <p className={styles.disposedNotice}>
            <PackageOpen size={15} aria-hidden="true" />
            처분한 옷이에요. 옷장 목록에는 보이지 않아요.
          </p>
        )}

        {/* 편집·처분 위 자기 줄에, 그리고 셋 중 라우트가 아니라 토글인 유일한 것.
            이것이 옷 한 벌짜리 길이다 — 옷장의 오늘 입은 옷은 코디 전체를 고르는 것이고,
            점심에 걸친 자켓 하나를 더하러 여기 왔는데 격자를 열어 칸 하나를 체크해야
            한다면 그건 아니다.

            행동과 상태 사이를 오가는 라벨이 아니라 `aria-pressed`다. "오늘 입었어요"가
            제목이면서 버튼이면 채움색에 따라 같은 말이 두 뜻이 된다. */}
        <Button
          variant={wornToday ? 'solid' : 'surface'}
          shape="block"
          full
          aria-pressed={wornToday}
          icon={<CalendarCheck />}
          // 미리보기 모드에는 세션이 없고, 행은 user_id를 싣는다.
          disabled={!userId}
          loading={toggleWear.isPending}
          onClick={() => {
            if (!userId) return
            toggleWear.mutate(
              { itemId: item.id, userId, wornOn: today, worn: !wornToday },
              {
                onError: () =>
                  toaster.create({ title: '착용 기록을 바꾸지 못했어요.', type: 'error' }),
              },
            )
          }}
        >
          오늘 입었어요
        </Button>

        <div className={styles.actions}>
          {/* 위에 `flex: '1'`을 얹지 않는다. `full`이 이미 "줄의 나머지를 가져간다"는
              뜻이고, `flex-shrink`와 `width`를 정하는 레시피 위에 flex 단축을 쌓는 것은
              순서에 좌우되는 덮어쓰기다. */}
          <Link to={`/items/${item.id}/edit`} className={buttonStyle({ full: true })}>
            <Pencil />
            편집
          </Link>
          <Button
            variant="outline"
            onClick={() =>
              setStatus.mutate(
                { id: item.id, status: disposed ? 'owned' : 'disposed' },
                {
                  onSuccess: () =>
                    toaster.create({
                      title: disposed ? '다시 보유로 옮겼어요.' : '처분 처리했어요.',
                      type: 'success',
                    }),
                  onError: () =>
                    toaster.create({ title: '상태를 바꾸지 못했어요.', type: 'error' }),
                },
              )
            }
            icon={disposed ? <ArchiveRestore /> : <PackageOpen />}
            loading={setStatus.isPending}
          >
            {disposed ? '다시 보유로' : '처분'}
          </Button>
        </div>

        <dl className={styles.fields}>
          {DETAIL_FIELDS.map((field) => (
            <div key={field.label} className={styles.row}>
              <dt className={styles.rowLabel}>{field.label}</dt>
              <dd className={styles.rowValue}>
                {field.value(item, today) ?? (
                  <span className={styles.emptyValue}>
                    <span aria-hidden="true">—</span>
                    <span className={styles.srOnly}>미입력</span>
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <Button
          variant="danger"
          shape="block"
          full
          icon={<Trash2 />}
          onClick={() => setConfirmingDelete(true)}
          disabled={remove.isPending}
        >
          삭제
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="이 옷을 삭제할까요?"
        description={`'${item.title}'과(와) 사진이 모두 지워져요. 되돌릴 수 없어요.`}
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        onConfirm={() => void handleDelete()}
      />

      {/* 열려 있는 동안만 마운트되므로 매번 알려진 상태에서 시작한다. 앞으로 와서 열렸으니
          닫는 것은 뒤로 가기다.

          그릴 사진이 있는지가 아니라 히스토리 항목만으로 가른다. 잠깐 그릴 것이 없다고
          언마운트하면 네트워크 한 번 끊긴 것으로 뷰어가 닫혔다 다시 열리며 페이지와 배율을
          잃는다. 기다림과 실패는 뷰어가 직접 그린다. */}
      {openedPhotoId != null && (
        <PhotoViewer
          slots={slots}
          startId={openedPhotoId}
          title={item.title}
          onPageChange={(slot) => showInStrip(slot.id)}
          onLoadError={markUnloadable}
          // 가드 없이도 한 번 누름이 한 번 pop이다. close watcher가 있는 브라우저에서는
          // 뒤로 제스처가 히스토리를 건드리지 않고 `close`를 울리고, 없는 곳에서는 항목이
          // pop되어 이것을 그리는 state가 사라진다 — DOM에서 열린 `<dialog>`를 없애는 것은
          // `close`를 울리지 않는다. 두 경로 중 하나만 돈다.
          onClose={() => navigate(-1)}
        />
      )}
    </ScreenHeader>
  )
}

/**
 * 제목 위 전폭 사진 캐러셀.
 *
 * 본문 패딩 안이 아니라 가장자리까지 간다. 사용자가 보러 온 유일한 것이고, 양옆에 여백을
 * 두른 옷 사진은 이유 없이 작아진 사진이다.
 */
function PhotoStrip({
  item,
  slots,
  photos,
  photoIndex,
  stripRef,
  onScroll,
  onOpen,
  onLoadError,
}: {
  item: WardrobeItem
  slots: PhotoSlot[]
  photos: ItemImage[]
  photoIndex: number
  stripRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  onOpen: (photoId: string) => void
  onLoadError: (photoId: string) => void
}) {
  const photoCount = photos.length

  return (
    <section aria-label="사진" className={styles.photoSection}>
      {photoCount === 0 ? (
        <SquarePhoto src={null} alt="" fallback="empty" shape="flush" />
      ) : (
        <div ref={stripRef} onScroll={onScroll} className={styles.strip}>
          {/* URL이 아니라 사진 행이 개수를 정한다 — 캐시에서 즉시 알 수 있으므로 서명이
              돌아오기 전에 맞는 개수의 정사각이 화면에 있다. */}
          {slots.map((slot, index) => (
            <button
              key={slot.id}
              type="button"
              disabled={slot.state !== 'ready'}
              aria-label={`사진 ${index + 1} 크게 보기`}
              onClick={() => onOpen(slot.id)}
              className={styles.tile}
            >
              <SquarePhoto
                src={slot.url}
                alt={`${item.title} 사진 ${index + 1}`}
                // 슬롯 자신의 상태에서 `ready`를 뺀 것 — 사진이 있어 그릴 대체물이 없는 경우다.
                fallback={slot.state === 'ready' ? undefined : slot.state}
                // 맞추지 않고 채워 자른다. 저장된 원본은 찍힌 비율 그대로라 긴 옷의 끝이
                // 잘리는데, 그것이 이 거래다 — 세로 사진을 레터박스로 맞추면 화면이
                // 말하려는 하나의 것 양옆에 페이지 색 띠 둘이 생긴다. 사진 전체는 탭 한
                // 번 거리의 뷰어에 있다.
                fit="cover"
                shape="flush"
                // 화면에 있는 것은 첫 타일뿐이다. 나머지는 스와이프 한 번 뒤에 있고,
                // 하나를 보이자고 1280px 원본 다섯 장을 받는 것은 폰의 연결로 치르는 값이다.
                loading={index === 0 ? 'eager' : 'lazy'}
                // `slots`로 되먹여 이 버튼을 잠그고, 뷰어가 열 사진에서 뺀다.
                onLoadError={() => onLoadError(slot.id)}
              />
            </button>
          ))}
        </div>
      )}

      {/* 사진이 하나뿐이어도 자리를 잡아둬, 아래 블록이 모든 옷에서 같은 높이에서 시작한다. */}
      <div className={styles.dots}>
        {photoCount > 1 &&
          photos.map((image, index) => (
            <span
              key={image.id}
              className={styles.dot}
              // 그대로 읽지 않고 가둔다 — 화면 밑에서 사진이 지워지면 인덱스가 끝을 넘는다.
              data-current={index === clamp(photoIndex, 0, photoCount - 1) || undefined}
            />
          ))}
      </div>
    </section>
  )
}

/**
 * 옷을 알기 전의 화면.
 *
 * 진짜 화면과 같은 필드 목록에서, 같은 행과 같은 너비로 짓는다 — 도착하는 것이 화면을
 * 갈아치우는 대신 모양을 채운다. 라벨은 자리표시자가 아니다. 어떤 옷이든 카테고리·색상·
 * 브랜드이므로 진짜 단어가 갈 자리에 회색 막대를 그릴 이유가 없다.
 */
function DetailSkeletonBody() {
  return (
    <div className={styles.body} aria-hidden="true">
      {/* 사진 자리표시자는 헤더의 `hero`다 — 진짜 스트립이 차지하는 전폭 정사각에 앉도록. */}
      <div className={styles.actions}>
        <div className={styles.inertButtonWide} />
        <div className={styles.inertButtonNarrow} />
      </div>

      <dl className={styles.fields}>
        {DETAIL_FIELDS.map((field) => (
          <div key={field.label} className={styles.row}>
            <dt className={styles.rowLabel}>{field.label}</dt>
            {/* 막대가 진짜 값 칸 안에 앉으므로, 행 높이가 막대가 아니라 대신 서 있는
                텍스트 줄의 높이다. */}
            <dd className={styles.rowValue}>
              {/* 너비가 데이터이고 Panda는 소스에 적힌 것만 내보내므로 인라인 `style`. */}
              <span className={styles.valueBar} style={{ width: field.skeletonWidth }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * 필드 목록, 한 곳에.
 *
 * 라벨과 값이 함께 있는 것은 스켈레톤이 라벨을 그리고 불러온 화면이 둘 다 그리기
 * 때문이다. 목록이 둘이면 발을 맞춰야 하는 목록이 둘이고, 열한 행을 그리는 화면에
 * 스켈레톤이 여섯 행만 예약하는 어긋남은 데이터가 도착해 페이지가 자랄 때까지 보이지 않는다.
 *
 * 비어 있어도 모든 행을 그린다. 필드 목록은 어떤 옷에서나 같으므로, 없는 것도 있는 것만큼
 * 화면의 일부다 — 그리고 그 빈칸이 채우러 가는 가장 빠른 길이다.
 */
const DETAIL_FIELDS: {
  label: string
  /** `today`를 시계에서 읽지 않고 받으므로, 이 행과 여기로 보낸 카드가 오늘에 대해 어긋나지 않는다. */
  value: (item: Worn<WardrobeItem>, today: string) => React.ReactNode | null
  /**
   * 옷을 불러오는 동안 이 행의 자리표시자 막대 너비.
   *
   * 옆의 목록이 아니라 필드에 있다. 평행 배열은 이 목록과 정확히 같은 길이를 유지해야
   * 하는데 모자라도 조용하다 — 범위 밖 읽기는 `undefined`이고 그것은 합법적인 너비라
   * 아무것도 아닌 막대를 그린다. 여기서는 이것 없는 필드가 컴파일되지 않는다.
   *
   * 값이 들쭉날쭉한 것은 의도다. 같은 길이의 막대가 늘어선 열은 렌더에 실패한 표로
   * 읽히지만, 고르지 않은 쪽은 아직 도착하지 않은 텍스트로 읽힌다.
   */
  skeletonWidth: string
}[] = [
  { label: '카테고리', skeletonWidth: '55%', value: (item) => categoryLabel(item.categoryId) },
  {
    label: '착용',
    skeletonWidth: '42%',
    /**
     * 다른 필드가 비었을 때 쓰는 `—`로 흘려보내지 않고 "아직"을 소리 내어 말하는 유일한 행.
     *
     * 그 대시는 미입력으로 읽히는데, 아무도 기록하지 않은 옷은 누가 채우기를 잊은 필드가
     * 아니라 하나의 답이다. 격자 카드가 같은 상황에서 침묵하는 것은 반대 이유다 —
     * 거기서는, 아직 아무것도 기록되지 않은 옷장에서 이 문장이 모든 카드에 붙는다.
     */
    value: (item, today) => {
      if (item.lastWornOn === null) return '아직 기록이 없어요'
      // DB가 쓴 행에서는 닿지 않지만, 보간이 아니라 연결로 쓴다 — `${null}`은 진짜 개수
      // 옆에 "null"이라는 단어를 그린다.
      const ago = formatDayAgo(item.lastWornOn, today)
      return ago ? `${ago} · 총 ${item.wearCount}번` : `총 ${item.wearCount}번`
    },
  },
  {
    label: '색상',
    skeletonWidth: '40%',
    value: (item) =>
      item.colors.length ? (
        <span className={styles.colorList}>
          {item.colors.map((color) => (
            <span key={color} className={styles.colorItem}>
              <ColorSwatch color={color} size="md" />
              {colorLabel(color)}
            </span>
          ))}
        </span>
      ) : null,
  },
  { label: '브랜드', skeletonWidth: '30%', value: (item) => item.brand },
  { label: '사이즈', skeletonWidth: '48%', value: (item) => item.size },
  { label: '핏', skeletonWidth: '35%', value: (item) => item.fit },
  {
    label: '계절',
    skeletonWidth: '60%',
    value: (item) => (item.seasons.length ? item.seasons.map(seasonLabel).join(' · ') : null),
  },
  { label: '가격', skeletonWidth: '45%', value: (item) => formatPrice(item.price) },
  { label: '구매일', skeletonWidth: '38%', value: (item) => formatDate(item.purchasedAt) },
  { label: '구매처', skeletonWidth: '52%', value: (item) => item.purchasePlace },
  {
    label: '태그',
    skeletonWidth: '33%',
    value: (item) => (item.tags.length ? item.tags.map((tag) => `#${tag}`).join(' ') : null),
  },
  { label: '메모', skeletonWidth: '70%', value: (item) => item.memo },
]
