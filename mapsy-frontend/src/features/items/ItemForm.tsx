import { useMemo, useState } from 'react'
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
import type { ProcessedPhoto } from '@/shared/lib/image'
import { ChipGroup } from '@/shared/ui/ChipGroup'
import type { ItemDraft } from '@/types/item'
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
  const [showOptional, setShowOptional] = useState(false)
  const [touched, setTouched] = useState(false)

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
  const invalid = missingPhoto || missingTitle || missingCategory

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (invalid || pending || !categoryId) return

    const parsedPrice = price.trim() === '' ? null : Number(price.replace(/[^\d]/g, ''))

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
      tags: tagText.split(',').map((t) => t.trim()).filter(Boolean),
      memo: memo || null,
      isFavorite: initial?.isFavorite ?? false,
    })
  }

  return (
    <form onSubmit={handleSubmit} className={vstack({ gap: '6', alignItems: 'stretch' })}>
      {showPhotos && (
        <Field label="사진" required hint={`최대 ${5}장 · 첫 번째가 대표 사진`}>
          <PhotoPicker photos={photos} onChange={setPhotos} />
          {touched && missingPhoto && <FieldError>사진을 한 장 이상 추가해주세요.</FieldError>}
        </Field>
      )}

      <Field label="이름" required hint="나중에 알아볼 수 있는 별명이면 충분해요">
        <input
          value={title}
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

          <Field label="브랜드">
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputStyle} />
          </Field>

          <Field label="가격" hint="원 단위">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
              placeholder="220000"
              className={inputStyle}
            />
          </Field>

          <Field label="구매일">
            <input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className={inputStyle}
            />
          </Field>

          <Field label="구매처">
            <input
              value={purchasePlace}
              onChange={(e) => setPurchasePlace(e.target.value)}
              className={inputStyle}
            />
          </Field>

          <Field label="태그" hint="쉼표로 구분">
            <input
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="출근용, 러닝"
              className={inputStyle}
            />
          </Field>

          <Field label="메모">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className={css({ ...inputBase, resize: 'vertical' })}
            />
          </Field>
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

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className={vstack({ gap: '2', alignItems: 'stretch' })}>
      <span className={css({ fontSize: 'xs', color: 'fg.muted' })}>
        {label}
        {required && <span className={css({ color: 'danger', ml: '1' })}>*</span>}
        {hint && <span className={css({ ml: '2', color: 'fg.subtle' })}>{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className={css({ fontSize: 'xs', color: 'danger' })}>
      {children}
    </span>
  )
}
