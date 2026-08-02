import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import {
  CATEGORY_GROUPS,
  groupIdOf,
  type SubcategoryId,
} from '@/shared/constants/categories'
import { CLOTHING_COLORS, MAX_COLORS_PER_ITEM, type ColorId } from '@/shared/constants/colors'
import { fitPresetsFor, hasFitField } from '@/shared/constants/fits'
import { SEASONS, type SeasonId } from '@/shared/constants/seasons'
import { sizePresetsFor } from '@/shared/constants/sizes'
import { releasePreview, type ProcessedPhoto } from '@/shared/lib/image'
import { ChipGroup } from '@/shared/ui/ChipGroup'
import type { ItemDraft } from '@/types/item'
import { MAX_PHOTOS, PhotoPicker } from './PhotoPicker'

/**
 * Mirrors the CHECK constraints in supabase/migrations.
 *
 * Not belt-and-braces: with photos uploading before the row is inserted, a
 * violation is only discovered after every object has been transferred. The
 * user waits through the whole upload, sees "업로드 실패", and retrying fails at
 * exactly the same point. Catching it in the form costs nothing and turns a
 * dead end into a corrected character count.
 */
const LIMITS = {
  title: 100,
  brand: 100,
  size: 40,
  purchasePlace: 100,
  memo: 2000,
  tagLength: 40,
  tagCount: 20,
  /**
   * Mirrors `items_price_max`. The previous value here was 10,000,000,000 with a
   * comment claiming it sat inside int4 — it does not; int4 stops at
   * 2,147,483,647, so everything between the two passed the form and died at
   * INSERT after the photos had uploaded. It drifted because it was the one
   * limit with no named constraint behind it and therefore nothing asserting it.
   */
  price: 1_000_000_000,
} as const

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
    <form onSubmit={handleSubmit} className={vstack({ gap: '6', alignItems: 'stretch' })}>
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
          className={inputStyle}
        />
        {touched && missingTitle && <FieldError>이름을 입력해주세요.</FieldError>}
      </Field>

      <Field label="카테고리" required>
        <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
          {CATEGORY_GROUPS.map((group) => (
            <ChipGroup
              key={group.id}
              label={group.label}
              options={group.subcategories.map((sub) => ({ value: sub.id, label: sub.label }))}
              selected={categoryId ? [categoryId] : []}
              onChange={(next) => {
                setCategoryId((next[0] as SubcategoryId | undefined) ?? null)
                // Size and fit belong to the old category's vocabulary; keeping
                // them would silently store "270" on a knit.
                setSize('')
                setFit('')
              }}
              clearable={false}
            />
          ))}
        </div>
        {touched && missingCategory && <FieldError>카테고리를 골라주세요.</FieldError>}
      </Field>

      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        className={css({
          alignSelf: 'flex-start',
          fontSize: 'sm',
          color: 'accent',
          cursor: 'pointer',
          textDecoration: 'underline',
          _focusVisible: {
            outline: '2px solid',
            outlineColor: 'accent',
            outlineOffset: '2px',
          },
        })}
        aria-expanded={showOptional}
      >
        {showOptional ? '선택 항목 접기' : '선택 항목 더 쓰기'}
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
                  className={inputStyle}
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
              className={inputStyle}
            />
          </Field>

          <Field label="가격" htmlFor={`${uid}-price`} hint="원 단위">
            <input
              id={`${uid}-price`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
              placeholder="220000"
              className={inputStyle}
            />
            {priceProblem && <FieldError>{priceProblem}</FieldError>}
          </Field>

          <Field label="구매일" htmlFor={`${uid}-purchased-at`}>
            <input
              id={`${uid}-purchased-at`}
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className={inputStyle}
            />
          </Field>

          <Field label="구매처" htmlFor={`${uid}-purchase-place`}>
            <input
              id={`${uid}-purchase-place`}
              value={purchasePlace}
              maxLength={LIMITS.purchasePlace}
              onChange={(e) => setPurchasePlace(e.target.value)}
              className={inputStyle}
            />
          </Field>

          <Field label="태그" htmlFor={`${uid}-tags`} hint="쉼표로 구분">
            <input
              id={`${uid}-tags`}
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="출근용, 러닝"
              className={inputStyle}
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
              className={css({ ...inputBase, resize: 'vertical' })}
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
            <p key={problem} className={css({ fontSize: 'sm', color: 'danger' })}>
              {problem}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'danger' })}>
          {error}
        </p>
      )}

      <div className={hstack({ gap: '2' })}>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? '저장 중…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          취소
        </button>
      </div>
    </form>
  )
}

const inputBase = {
  width: 'full',
  bg: 'bg.subtle',
  color: 'fg',
  rounded: 'lg',
  px: '3.5',
  py: '2.5',
  fontSize: 'sm',
  _placeholder: { color: 'fg.subtle' },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'accent',
    outlineOffset: '2px',
  },
} as const

const inputStyle = css(inputBase)

const primaryButton = css({
  flex: '1',
  bg: 'accent',
  color: 'accent.fg',
  rounded: 'lg',
  py: '3',
  fontSize: 'sm',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { opacity: 0.92 },
  _disabled: { opacity: 0.4, cursor: 'not-allowed' },
  _focusVisible: { outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' },
})

const secondaryButton = css({
  px: '5',
  rounded: 'lg',
  py: '3',
  fontSize: 'sm',
  color: 'fg.muted',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  cursor: 'pointer',
  _hover: { color: 'fg' },
  _focusVisible: { outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' },
})

/**
 * A labelled block.
 *
 * Renders a real `<label>` only when it wraps exactly one form control
 * (`htmlFor`). Wrapping everything in one was invalid HTML the moment the child
 * was a `<fieldset>` of chips or a picker with its own `<label>` — and it had
 * teeth: tapping the word "카테고리" activated the first labelable descendant,
 * so it silently selected 반팔티. Tapping "사진" opened the file picker.
 */
function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  const caption = (
    <>
      {label}
      {required && <span className={css({ color: 'danger', ml: '1' })}>*</span>}
      {hint && <span className={css({ ml: '2', color: 'fg.subtle' })}>{hint}</span>}
    </>
  )
  const captionStyle = css({ fontSize: 'xs', color: 'fg.muted' })

  return (
    <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={captionStyle}>
          {caption}
        </label>
      ) : (
        <span className={captionStyle}>{caption}</span>
      )}
      {children}
    </div>
  )
}

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

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className={css({ fontSize: 'xs', color: 'danger' })}>
      {children}
    </span>
  )
}
