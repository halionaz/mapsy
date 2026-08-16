import { CLOTHING_COLORS, type ColorId } from '@/shared/config/colors'
import { SEASONS, type SeasonId } from '@/shared/config/seasons'
import { Button } from '@/shared/ui/Button'
import { chipLegend, chipStyle } from '@/shared/ui/Chip.css'
import { ChipGroup } from '@/shared/ui/ChipGroup'
import { ChipSelect } from '@/shared/ui/ChipSelect'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { Sheet } from '@/shared/ui/Sheet'
import * as styles from './WardrobeFilterSheet.css'
import { activeFilterCount, clearFilters } from '../lib/filterSummary'
import type { FilterOptions } from '../lib/filterOptions'
import { SORT_OPTIONS, type WardrobeFilters } from '../model/filters'

/**
 * 필터 바텀시트 — 격자 위 카테고리 레일이 표현하지 못하는 축들 (PRD §6.1).
 *
 * 적용 버튼이 아니라 고르는 즉시 반영된다. 필터링이 메모리에서 즉시 일어나므로(PRD §8.4)
 * 시트 뒤의 격자가 이미 미리보기다 — 결과를 보기 전에 확정하게 만드는 것은 존재하지도
 * 않는 왕복을 더하는 일이다.
 *
 * 푸터도 거기서 정해진다. 주 버튼은 결과 보기이고 닫기만 한다. 눌릴 때쯤이면 결과는
 * 이미 아래에 있다.
 */
interface WardrobeFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: WardrobeFilters
  onChange: (filters: WardrobeFilters) => void
  /** 이 옷장에 실제로 있는 브랜드·사이즈·핏·태그 값. */
  options: FilterOptions
  /** 지금 필터에 걸리는 옷의 수. 푸터 버튼이 쓴다. */
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
      <div className={styles.body}>
        {/* 정렬은 끌 수 있는 축이 아니다 — 비우면 마지막 비교 함수가 우연히 만든 순서로
            격자가 남고, `applyFilters`의 비교 함수에는 "정렬 없음" 가지가 없다.
            `ChipSelect`가 그것을 피하는 게 아니라 표현 불가능하게 만든다. */}
        <ChipSelect
          label="정렬"
          options={SORT_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
          value={filters.sort}
          onChange={(sort) => onChange({ ...filters, sort })}
        />

        <div>
          <p className={chipLegend}>즐겨찾기</p>
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
