import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import { CLOTHING_COLORS, type ColorId } from '@/shared/config/colors'
import { SEASONS, type SeasonId } from '@/shared/config/seasons'
import { Button } from '@/shared/ui/Button'
import { ChipGroup } from '@/shared/ui/ChipGroup'
import { chipStyle } from '@/shared/ui/chipStyle'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { Sheet } from '@/shared/ui/Sheet'
import { activeFilterCount, clearFilters } from '../lib/filterSummary'
import type { FilterOptions } from '../lib/filterOptions'
import { SORT_OPTIONS, type SortId, type WardrobeFilters } from '../model/filters'

/**
 * 필터 바텀시트 — the axes the category rail above the grid cannot express
 * (PRD §6.1).
 *
 * Changes apply as they are made rather than on a 적용 press. Filtering is
 * in-memory and instant (PRD §8.4), so the grid behind the sheet is already the
 * preview — making the user commit before seeing the result would be adding a
 * round trip that does not exist.
 *
 * Which also decides the footer: the primary button says 결과 보기 and only
 * closes, because by the time it is pressed the result is what is underneath.
 */
interface WardrobeFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: WardrobeFilters
  onChange: (filters: WardrobeFilters) => void
  /** Brand / size / fit / tag values present in this wardrobe. */
  options: FilterOptions
  /** How many garments the current filters match, for the footer button. */
  resultCount: number
}

export function WardrobeFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  options,
  resultCount,
}: WardrobeFilterSheetProps) {
  const count = activeFilterCount(filters)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="필터"
      footer={
        <>
          <Button
            variant="ghost"
            shape="block"
            onClick={() => onChange(clearFilters(filters))}
            disabled={count === 0}
          >
            초기화
          </Button>
          <Button shape="block" full onClick={() => onOpenChange(false)}>
            {resultCount}벌 보기
          </Button>
        </>
      }
    >
      <div className={vstack({ gap: '6', alignItems: 'stretch' })}>
        <ChipGroup
          label="정렬"
          options={SORT_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
          selected={[filters.sort]}
          // `next[0]`, unguarded: `clearable={false}` makes ChipGroup return
          // early rather than call back when the active chip is tapped again,
          // so every call that arrives carries exactly one value.
          onChange={(next) => onChange({ ...filters, sort: next[0] as SortId })}
          // Sorting is not an axis that can be off — clearing it would leave the
          // grid in whatever order the last comparator happened to produce.
          clearable={false}
        />

        <div>
          <p className={sectionLabel}>즐겨찾기</p>
          <button
            type="button"
            aria-pressed={filters.favoriteOnly}
            className={chipStyle({ active: filters.favoriteOnly })}
            onClick={() => onChange({ ...filters, favoriteOnly: !filters.favoriteOnly })}
          >
            즐겨찾기만 보기
          </button>
        </div>

        <ChipGroup
          label="색상"
          options={CLOTHING_COLORS.map((color) => ({
            value: color.id,
            label: color.label,
            icon: <ColorSwatch color={color.id} />,
          }))}
          selected={filters.colors}
          onChange={(next) => onChange({ ...filters, colors: next as ColorId[] })}
          multiple
        />

        <ChipGroup
          label="계절"
          options={SEASONS.map((season) => ({ value: season.id, label: season.label }))}
          selected={filters.seasons}
          onChange={(next) => onChange({ ...filters, seasons: next as SeasonId[] })}
          multiple
        />

        {options.brands.length > 0 && (
          <ChipGroup
            label="브랜드"
            options={options.brands.map((brand) => ({ value: brand, label: brand }))}
            selected={filters.brands}
            onChange={(brands) => onChange({ ...filters, brands })}
            multiple
          />
        )}

        {options.sizes.length > 0 && (
          <ChipGroup
            label="사이즈"
            options={options.sizes.map((size) => ({ value: size, label: size }))}
            selected={filters.sizes}
            onChange={(sizes) => onChange({ ...filters, sizes })}
            multiple
          />
        )}

        {options.fits.length > 0 && (
          <ChipGroup
            label="핏"
            options={options.fits.map((fit) => ({ value: fit, label: fit }))}
            selected={filters.fits}
            onChange={(fits) => onChange({ ...filters, fits })}
            multiple
          />
        )}

        {options.tags.length > 0 && (
          <ChipGroup
            label="태그"
            options={options.tags.map((tag) => ({ value: tag, label: `#${tag}` }))}
            selected={filters.tags}
            onChange={(tags) => onChange({ ...filters, tags })}
            multiple
          />
        )}
      </div>
    </Sheet>
  )
}

// Matches ChipGroup's <legend>, so the one section that is a lone toggle rather
// than a group lines up with the ones around it.
const sectionLabel = css({ textStyle: 'caption', color: 'fg.muted', mb: '2.5' })
