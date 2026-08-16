import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { CATEGORY_GROUPS, groupIdOf, type SubcategoryId } from '@/shared/config/categories'
import { CLOTHING_COLORS, MAX_COLORS_PER_ITEM, type ColorId } from '@/shared/config/colors'
import { fitPresetsFor, hasFitField } from '@/shared/config/fits'
import { MAX_SEASONS_PER_ITEM, SEASONS, type SeasonId } from '@/shared/config/seasons'
import { sizePresetsFor } from '@/shared/config/sizes'
import { releasePreview } from '@/shared/lib/image'
import { Button } from '@/shared/ui/Button'
import { ChipGroup } from '@/shared/ui/ChipGroup'
import { ChipSelect } from '@/shared/ui/ChipSelect'
import { Field, FieldError } from '@/shared/ui/Field'
import { inputStyle, textareaStyle } from '@/shared/ui/Field.css'
import { samePhotoList, type ItemDraft, type PhotoEntry } from '@/entities/item'
import * as styles from './ItemForm.css'
import { LIMITS, MAX_PHOTOS } from '../model/limits'
import { PhotoPicker } from './PhotoPicker'

/**
 * 등록과 편집을 겸하는 폼 — PRD §6.2.
 *
 * 필수는 사진·이름·카테고리뿐이다. 나머지는 접힌 구획 뒤에 있다. 제품이 건 것 전체가
 * "기록이 싸게 유지된다"이기 때문이다 — 브랜드·사이즈·가격을 먼저 묻는 폼은 다섯 벌쯤에서
 * 안 쓰이게 된다.
 */

export interface ItemFormValues extends ItemDraft {
  /** 커버가 먼저 — 순서가 답이지, 답의 세부가 아니다. */
  photos: PhotoEntry[]
  /**
   * 폼이 열릴 때의 목록과 비교해 사람이 사진을 바꿨는지.
   *
   * 여기서 알리는 것은 여기만 알기 때문이다. 사진 쓰기는 목록에 없는 것을 지우므로,
   * 호출부는 "손대지 않음"과 "같아 보임"을 가를 수 있어야 한다 — `samePhotoList` 참고.
   */
  photosChanged: boolean
}

interface ItemFormProps {
  initial?: Partial<ItemFormValues>
  /** 이미 저장된 `initial.photos`의 서명된 썸네일. */
  storedUrls?: ReadonlyMap<string, string | null>
  submitLabel: string
  pending?: boolean
  error?: string | null
  onSubmit: (values: ItemFormValues) => void
  onCancel: () => void
}

export function ItemForm({
  initial,
  storedUrls,
  submitLabel,
  pending = false,
  error,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [photos, setPhotos] = useState<PhotoEntry[]>(initial?.photos ?? [])
  // 폼이 열릴 때의 사진 목록. 위 상태가 그것으로 채워진 바로 그 순간에 얼린다.
  const openedWith = useRef(initial?.photos ?? [])
  const [title, setTitle] = useState(initial?.title ?? '')
  const [categoryId, setCategoryId] = useState<SubcategoryId | null>(initial?.categoryId ?? null)
  const [colors, setColors] = useState<ColorId[]>(initial?.colors ?? [])
  const [seasons, setSeasons] = useState<SeasonId[]>(initial?.seasons ?? [])
  const [size, setSize] = useState(initial?.size ?? '')
  const [fit, setFit] = useState(initial?.fit ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? '')
  const [purchasePlace, setPurchasePlace] = useState(initial?.purchasePlace ?? '')
  const [tagText, setTagText] = useState((initial?.tags ?? []).join(', '))
  const [memo, setMemo] = useState(initial?.memo ?? '')
  // 새 옷은 접은 채로. 이미 선택 값이 있는 옷을 편집할 때는 펼친다 — 아니면 편집
  // 화면이 편집해야 할 것의 대부분을 감춘다.
  const [showOptional, setShowOptional] = useState(() => hasOptionalValues(initial))
  const [touched, setTouched] = useState(false)
  const uid = useId()

  // 성공한 제출에 넘긴 사진은 받은 쪽의 것이고(등록은 업로드 스토어, 편집은 저장이
  // 끝난 화면) 그쪽이 미리보기를 반납한다. 언마운트 시점에 아직 여기 있는 것은 버려진
  // 것이라(취소하거나 떠났거나) 그냥 두면 탭이 사는 내내 샌다.
  const photosRef = useRef(photos)
  photosRef.current = photos
  const submitted = useRef(false)
  // 거절된 제출은 사진을 돌려준다. 폼은 아직 서 있고 이 blob이 재시도가 다시 올릴
  // 바이트이므로 걸쇠를 풀어야 한다 — 아니면 실패한 저장 뒤의 취소가, 사진을 넘겼다고
  // 믿는 폼을 언마운트한다.
  if (error) submitted.current = false
  useEffect(
    () => () => {
      if (submitted.current) return
      for (const entry of photosRef.current) {
        if (entry.kind === 'picked') releasePreview(entry.photo)
      }
    },
    [],
  )

  const groupId = categoryId ? groupIdOf(categoryId) : undefined
  // 사이즈·핏 어휘가 카테고리마다 다르므로(PRD §5.4, §5.5) 선택지가 지금 고른 카테고리를 따른다.
  const sizeOptions = useMemo(
    () => sizePresetsFor(groupId).map((value) => ({ value, label: value })),
    [groupId],
  )
  const fitOptions = useMemo(
    () => fitPresetsFor(groupId).map((value) => ({ value, label: value })),
    [groupId],
  )

  const missingPhoto = photos.length === 0
  const missingTitle = title.trim().length === 0
  const missingCategory = categoryId === null
  // "abc"는 ""로 벗겨지고 Number("")는 0이라, 오타가 공짜 옷으로 저장된다.
  // mapRow는 0을 null로 만들지 않고 그대로 둔다.
  const parsedPrice = useMemo(() => {
    const digits = price.replace(/[^\d]/g, '')
    return digits === '' ? null : Number(digits)
  }, [price])

  const parsedTags = useMemo(
    () =>
      tagText
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
    [tagText],
  )
  const tagProblem =
    parsedTags.length > LIMITS.tagCount
      ? `태그는 최대 ${LIMITS.tagCount}개까지예요.`
      : parsedTags.some((t) => t.length > LIMITS.tagLength)
        ? `태그 하나는 ${LIMITS.tagLength}자를 넘을 수 없어요.`
        : null

  const priceProblem =
    parsedPrice != null && parsedPrice > LIMITS.price ? '가격이 너무 커요.' : null

  /**
   * 제출을 막는 것 전부를, 사용자가 볼 수 있는지로 나눠 담는다.
   *
   * `invalid`가 이 두 목록에서만 파생되므로 제출을 막는 방법은 둘 중 하나에 더하는
   * 것뿐이다. 자유롭게 붙인 `|| somethingProblem` 항이 마지막 회귀의 원인이었다 —
   * 접힌 구획 안에 추가된 검사가 버튼을 아무 메시지 없이 먹통으로 만들었다.
   *
   * 보이는 쪽이 문장이 아니라 플래그인 것은 의도다. 각 필드가 자기 자리에서 `<FieldError>`를
   * 그리므로, 여기에도 문구를 두면 사용자에게 보이는 문자열의 사본이 둘이 된다.
   * 숨은 쪽이 문구를 싣는 것은 그것을 보여주는 곳이 달리 없기 때문이다.
   */
  const visibleProblems = [missingPhoto, missingTitle, missingCategory].filter(Boolean)

  /** `{showOptional && …}` 안에 있어, 구획이 접혀 있으면 보이지 않는다. */
  const hiddenProblems = [tagProblem, priceProblem].filter(
    (problem): problem is string => problem !== null,
  )

  const invalid = visibleProblems.length + hiddenProblems.length > 0

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (invalid || pending || !categoryId) {
      // 필드 메시지에 닿을 수 있도록 구획을 연다. 그 메시지가 이 거절을 설명한다 —
      // `setTouched`와 이것이 한 배치에 들어가므로 아래 요약은 막힌 제출에 그려지지 않는다.
      if (hiddenProblems.length > 0) setShowOptional(true)
      return
    }

    onSubmit({
      photos,
      photosChanged: !samePhotoList(openedWith.current, photos),
      title,
      categoryId,
      colors,
      seasons,
      size: size || null,
      fit: fit || null,
      brand: brand || null,
      price: parsedPrice != null && Number.isFinite(parsedPrice) ? parsedPrice : null,
      purchasedAt: purchasedAt || null,
      purchasePlace: purchasePlace || null,
      tags: parsedTags,
      memo: memo || null,
    })

    // onSubmit 앞이 아니라 뒤에서 건다. 걸쇠의 뜻이 "blob을 넘겼다"이고, 일찍 빠져나간
    // 호출부는 받아간 적이 없다.
    //
    // onSubmit이 이 컴포넌트를 동기적으로 언마운트하지 않는다는 전제 위에 있다. React
    // 이벤트 핸들러 안의 이동은 배치되므로 언마운트가 handleSubmit 반환 뒤에 흐르지만,
    // flushSync 기반 이동은 걸쇠가 false인 채로 정리를 돌려 지금 카드가 그리고 있는
    // 미리보기 URL을 반납한다.
    submitted.current = true
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Field
        label="사진"
        required
        hint={`최대 ${MAX_PHOTOS}장 · 첫 번째가 대표 · 길게 눌러 순서 변경`}
      >
        <PhotoPicker photos={photos} onChange={setPhotos} storedUrls={storedUrls} />
        {touched && missingPhoto && <FieldError>사진을 한 장 이상 추가해주세요.</FieldError>}
      </Field>

      <Field
        label="이름"
        htmlFor={`${uid}-title`}
        required
        hint="나중에 알아볼 수 있는 별명이면 충분해요"
      >
        <input
          id={`${uid}-title`}
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 마산 플리스"
          className={inputStyle({ invalid: touched && missingTitle })}
        />
        {touched && missingTitle && <FieldError>이름을 입력해주세요.</FieldError>}
      </Field>

      <Field label="카테고리" required>
        <div className={styles.categoryList}>
          {CATEGORY_GROUPS.map((group) => (
            <ChipSelect
              key={group.id}
              label={group.label}
              options={group.subcategories.map((sub) => ({ value: sub.id, label: sub.label }))}
              value={categoryId}
              onChange={(next) => {
                setCategoryId(next)
                // 사이즈와 핏은 이전 카테고리의 어휘다. 남기면 니트에 "270"이 조용히 저장된다.
                setSize('')
                setFit('')
              }}
            />
          ))}
        </div>
        {touched && missingCategory && <FieldError>카테고리를 골라주세요.</FieldError>}
      </Field>

      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        className={styles.disclosure}
        data-open={showOptional || undefined}
        aria-expanded={showOptional}
      >
        <span>{showOptional ? '선택 항목 접기' : '선택 항목 더 쓰기'}</span>
        <ChevronDown size={16} aria-hidden="true" className={styles.disclosureChevron} />
      </button>

      {showOptional && (
        <div className={styles.stack}>
          <ChipGroup
            label="색상"
            options={CLOTHING_COLORS.map((c) => ({ value: c.id, label: c.label }))}
            selected={colors}
            onChange={setColors}
            multiple
            max={MAX_COLORS_PER_ITEM}
          />

          <ChipGroup
            label="계절"
            options={SEASONS.map((s) => ({ value: s.id, label: s.label }))}
            selected={seasons}
            onChange={setSeasons}
            multiple
            max={MAX_SEASONS_PER_ITEM}
          />

          {sizeOptions.length > 0 && (
            <Field label="사이즈">
              <div className={styles.sizeField}>
                <ChipGroup
                  label="프리셋"
                  options={sizeOptions}
                  selected={size ? [size] : []}
                  onChange={(next) => setSize(next[0] ?? '')}
                />
                <input
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  maxLength={LIMITS.size}
                  aria-label="사이즈 직접 입력"
                  placeholder="직접 입력"
                  className={inputStyle()}
                />
              </div>
            </Field>
          )}

          {hasFitField(groupId) && (
            <ChipGroup
              label="핏"
              options={fitOptions}
              selected={fit ? [fit] : []}
              onChange={(next) => setFit(next[0] ?? '')}
            />
          )}

          <Field label="브랜드" htmlFor={`${uid}-brand`}>
            <input
              id={`${uid}-brand`}
              value={brand}
              maxLength={LIMITS.brand}
              onChange={(e) => setBrand(e.target.value)}
              className={inputStyle()}
            />
          </Field>

          <Field label="가격" htmlFor={`${uid}-price`} hint="원 단위">
            <input
              id={`${uid}-price`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
              placeholder="220000"
              className={inputStyle({ invalid: priceProblem != null })}
            />
            {priceProblem && <FieldError>{priceProblem}</FieldError>}
          </Field>

          <Field label="구매일" htmlFor={`${uid}-purchased-at`}>
            <input
              id={`${uid}-purchased-at`}
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className={inputStyle()}
            />
          </Field>

          <Field label="구매처" htmlFor={`${uid}-purchase-place`}>
            <input
              id={`${uid}-purchase-place`}
              value={purchasePlace}
              maxLength={LIMITS.purchasePlace}
              onChange={(e) => setPurchasePlace(e.target.value)}
              className={inputStyle()}
            />
          </Field>

          <Field label="태그" htmlFor={`${uid}-tags`} hint="쉼표로 구분">
            <input
              id={`${uid}-tags`}
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="출근용, 러닝"
              className={inputStyle({ invalid: tagProblem != null })}
            />
            {tagProblem && <FieldError>{tagProblem}</FieldError>}
          </Field>

          <Field label="메모" htmlFor={`${uid}-memo`}>
            <textarea
              id={`${uid}-memo`}
              value={memo}
              maxLength={LIMITS.memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className={textareaStyle}
            />
          </Field>
        </div>
      )}

      {/* 막힌 제출을 설명하는 것이 아니다 — 그쪽은 같은 배치에서 구획을 열므로 이 경로로
          그려지지 않는다. 이것은 그 다음을 덮는다. 사용자가 구획을 다시 접으면, 이유를
          말하지 않고 거절하는 버튼만 남는다. `!showOptional` 가드가 필드 메시지를 두 번째
          라이브 리전으로 복제하는 것을 막는다. */}
      {touched && !showOptional && hiddenProblems.length > 0 && (
        <div role="alert" className={styles.problemList}>
          {hiddenProblems.map((problem) => (
            <p key={problem} className={styles.problem}>
              {problem}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      )}

      <div className={styles.actionBar}>
        <Button type="submit" size="lg" full loading={pending}>
          {pending ? '저장 중…' : submitLabel}
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  )
}

/** 이미 있는 옷의 선택 구획에 뭐라도 들어 있는지. */
function hasOptionalValues(initial: Partial<ItemFormValues> | undefined): boolean {
  if (!initial) return false
  return Boolean(
    initial.brand ||
    initial.size ||
    initial.fit ||
    initial.price != null ||
    initial.purchasedAt ||
    initial.purchasePlace ||
    initial.memo ||
    initial.colors?.length ||
    initial.seasons?.length ||
    initial.tags?.length,
  )
}
