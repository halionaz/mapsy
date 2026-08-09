import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import {
  CATEGORY_GROUPS,
  groupIdOf,
  type SubcategoryId,
} from '@/shared/config/categories'
import { CLOTHING_COLORS, MAX_COLORS_PER_ITEM, type ColorId } from '@/shared/config/colors'
import { fitPresetsFor, hasFitField } from '@/shared/config/fits'
import { MAX_SEASONS_PER_ITEM, SEASONS, type SeasonId } from '@/shared/config/seasons'
import { sizePresetsFor } from '@/shared/config/sizes'
import { releasePreview, type ProcessedPhoto } from '@/shared/lib/image'
import { Button } from '@/shared/ui/Button'
import { ChipGroup } from '@/shared/ui/ChipGroup'
import { ChipSelect } from '@/shared/ui/ChipSelect'
import { Field, FieldError } from '@/shared/ui/Field'
import { inputStyle } from '@/shared/ui/fieldStyle'
import type { ItemDraft } from '@/entities/item'
import { LIMITS, MAX_PHOTOS } from '../model/limits'
import { PhotoPicker } from './PhotoPicker'

/**
 * The registration and edit form — one component for both (PRD §6.2).
 *
 * Only the photo, title and category are required. Everything else sits behind a
 * collapsed section, because the whole product bet is that capture stays cheap:
 * a form that asks for brand, size and price up front is one people stop using
 * after five garments.
 */

export interface ItemFormValues extends ItemDraft {
  photos: ProcessedPhoto[]
}

interface ItemFormProps {
  initial?: Partial<ItemFormValues>
  /** Edit reuses existing photos, so the picker is hidden and not required. */
  showPhotos?: boolean
  submitLabel: string
  pending?: boolean
  error?: string | null
  onSubmit: (values: ItemFormValues) => void
  onCancel: () => void
}

export function ItemForm({
  initial,
  showPhotos = true,
  submitLabel,
  pending = false,
  error,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [photos, setPhotos] = useState<ProcessedPhoto[]>(initial?.photos ?? [])
  const [title, setTitle] = useState(initial?.title ?? '')
  const [categoryId, setCategoryId] = useState<SubcategoryId | null>(
    initial?.categoryId ?? null,
  )
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
  // Collapsed for a new item — the whole point is that capture stays cheap.
  // Opened when editing something that already has optional values, otherwise
  // the edit screen hides most of what it is supposed to be editing.
  const [showOptional, setShowOptional] = useState(() => hasOptionalValues(initial))
  const [touched, setTouched] = useState(false)
  const uid = useId()

  // Photos handed to a successful submit belong to the upload store, which
  // revokes them when it is done. Anything still here on unmount was abandoned
  // — cancelling, or navigating away — and would otherwise leak for the life of
  // the tab.
  const photosRef = useRef(photos)
  photosRef.current = photos
  const submitted = useRef(false)
  useEffect(
    () => () => {
      if (!submitted.current) photosRef.current.forEach(releasePreview)
    },
    [],
  )

  const groupId = categoryId ? groupIdOf(categoryId) : undefined
  // Size and fit vocabularies differ per category (PRD §5.4, §5.5), so the
  // options follow whatever category is currently chosen.
  const sizeOptions = useMemo(
    () => sizePresetsFor(groupId).map((value) => ({ value, label: value })),
    [groupId],
  )
  const fitOptions = useMemo(
    () => fitPresetsFor(groupId).map((value) => ({ value, label: value })),
    [groupId],
  )

  const missingPhoto = showPhotos && photos.length === 0
  const missingTitle = title.trim().length === 0
  const missingCategory = categoryId === null
  // "abc" strips to "" and Number("") is 0 — which would store a typo as a free
  // garment, and mapRow deliberately keeps 0 rather than nulling it.
  const parsedPrice = useMemo(() => {
    const digits = price.replace(/[^\d]/g, '')
    return digits === '' ? null : Number(digits)
  }, [price])

  const parsedTags = useMemo(
    () => tagText.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
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
   * Everything blocking submit, split by whether the user can see it.
   *
   * `invalid` is derived from these two lists and nothing else, so the only way
   * to block submission is to append to one of them. A free `|| somethingProblem`
   * term is what caused the last regression: a check added inside the collapsed
   * section made the button do nothing with no message anywhere.
   *
   * The visible list holds flags rather than sentences on purpose — each of
   * these fields renders its own `<FieldError>` in place, and carrying the text
   * here too would be a second copy of three user-facing strings with nothing
   * keeping the two in sync. The hidden list carries text because nothing else
   * shows it.
   */
  const visibleProblems = [missingPhoto, missingTitle, missingCategory].filter(Boolean)

  /** Inside `{showOptional && …}` — invisible while the section is collapsed. */
  const hiddenProblems = [tagProblem, priceProblem].filter(
    (problem): problem is string => problem !== null,
  )

  const invalid = visibleProblems.length + hiddenProblems.length > 0

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (invalid || pending || !categoryId) {
      // Open the section so the field-level message becomes reachable. That
      // message is what explains this refusal — `setTouched` and this land in
      // one batch, so the summary below never renders for a blocked submit.
      if (hiddenProblems.length > 0) setShowOptional(true)
      return
    }

    onSubmit({
      photos,
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

    // Set after onSubmit, not before: the latch means "handed the blobs over",
    // and a caller that bails out early has not taken them.
    //
    // This relies on onSubmit not unmounting this component synchronously.
    // Navigation inside a React event handler is batched, so the unmount
    // flushes after handleSubmit returns — but a flushSync-based navigation
    // would run the cleanup with the latch still false, revoking preview URLs
    // that the pending card is at that moment rendering. Keep navigation in
    // onSubmit ordinary.
    submitted.current = true
  }

  return (
    <form
      onSubmit={handleSubmit}
      // `flex: 1` so the action bar below can push itself to the bottom edge on
      // a form short enough not to scroll. Its parent is `ScreenHeader`'s
      // `<main>`, which is a flex column for this reason.
      className={vstack({ gap: '6', alignItems: 'stretch', flex: '1' })}
    >
      {showPhotos && (
        <Field label="사진" required hint={`최대 ${MAX_PHOTOS}장 · 첫 번째가 대표 사진`}>
          <PhotoPicker photos={photos} onChange={setPhotos} />
          {touched && missingPhoto && <FieldError>사진을 한 장 이상 추가해주세요.</FieldError>}
        </Field>
      )}

      <Field label="이름" htmlFor={`${uid}-title`} required hint="나중에 알아볼 수 있는 별명이면 충분해요">
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
        <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
          {CATEGORY_GROUPS.map((group) => (
            <ChipSelect
              key={group.id}
              label={group.label}
              options={group.subcategories.map((sub) => ({ value: sub.id, label: sub.label }))}
              value={categoryId}
              onChange={(next) => {
                setCategoryId(next)
                // Size and fit belong to the old category's vocabulary; keeping
                // them would silently store "270" on a knit.
                setSize('')
                setFit('')
              }}
            />
          ))}
        </div>
        {touched && missingCategory && <FieldError>카테고리를 골라주세요.</FieldError>}
      </Field>

      {/* A full-width row rather than a text link. The optional section holds
          nine of the eleven fields, so this is the form's main fork and was
          drawn as its smallest control. */}
      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        className={disclosure}
        data-open={showOptional || undefined}
        aria-expanded={showOptional}
      >
        <span>{showOptional ? '선택 항목 접기' : '선택 항목 더 쓰기'}</span>
        <ChevronDown size={16} aria-hidden="true" className={disclosureChevron} />
      </button>

      {showOptional && (
        <div className={vstack({ gap: '6', alignItems: 'stretch' })}>
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
              <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
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
              className={cx(inputStyle(), css({ resize: 'vertical' }))}
            />
          </Field>
        </div>
      )}

      {/* Not what explains a blocked submit — that opens the section in the same
          batch, so this never renders on that path. It covers what comes after:
          the user collapses the section again and would otherwise be left with a
          button that refuses for no stated reason. Gated on `!showOptional` so
          it never duplicates the field-level message into a second live region. */}
      {touched && !showOptional && hiddenProblems.length > 0 && (
        <div role="alert" className={vstack({ gap: '1', alignItems: 'stretch' })}>
          {hiddenProblems.map((problem) => (
            <p key={problem} className={css({ textStyle: 'caption', color: 'danger' })}>
              {problem}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className={formError}>
          {error}
        </p>
      )}

      <div className={actionBar}>
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

/**
 * 등록 / 저장, pinned to the bottom edge.
 *
 * The form is eleven fields with a category picker in the middle of it, so the
 * button that ends the job was several screens below the fold — and the one
 * moment it is most wanted is right after the last thing you typed, wherever
 * that was. Sticky keeps it in reach without taking it out of the form, so it is
 * still a real submit button in document order and still the last thing a
 * keyboard reaches.
 *
 * Two rules make it behave in both directions: `bottom: 0` holds it against the
 * viewport while the form is long enough to scroll, and `margin-top: auto`
 * drops it to the bottom of the screen when the form is short — otherwise a
 * collapsed edit form would leave the bar floating mid-screen with a rule under
 * it, which reads as a section divider rather than as the foot of the page.
 *
 * Requires `flushBottom` on the ScreenHeader around it. Without it the body
 * keeps its bottom padding, and the bar's resting place is that far above the
 * bottom edge — so at full scroll it visibly lifts off.
 */
const actionBar = css({
  position: 'sticky',
  bottom: '0',
  mt: 'auto',
  display: 'flex',
  gap: '2',
  // Pulled back out over `<main>`'s inset so the bar spans the column. Inset by
  // the same amount as the fields, it reads as a widget sitting on the page
  // rather than as the bottom of the screen.
  mx: '-5',
  px: '5',
  pt: '3',
  // The screen now reaches the bottom edge, so clearing the home indicator is
  // this bar's job rather than the body's.
  pb: 'calc({spacing.4} + var(--safe-b))',
  bg: 'bg',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'border.subtle',
})

const disclosure = cx(
  hstack({ justify: 'space-between' }),
  css({
    width: 'full',
    px: '4',
    minHeight: 'tap',
    rounded: 'field',
    bg: 'bg.subtle',
    color: 'accent.text',
    textStyle: 'label',
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: 'fast',
    _hover: { bg: 'bg.elevatedHover' },
    layerStyle: 'focusable',
  }),
)

const disclosureChevron = css({
  transitionProperty: 'rotate',
  transitionDuration: 'fast',
  transitionTimingFunction: 'out',
  '[data-open] &': { rotate: '180deg' },
  _motionReduce: { transitionDuration: '1ms' },
})

const formError = css({
  textStyle: 'caption',
  color: 'danger',
  bg: 'danger.subtle',
  px: '4',
  py: '3',
  rounded: 'field',
})

/** True when an existing item has anything in the optional section. */
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
