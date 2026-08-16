/**
 * `public` 스키마의 제약 — 이름과, 무엇을 검사하는지.
 *
 * 마이그레이션이 만든 스키마에서 supabase/tests/run.sh가 생성한다.
 * 고치지 말 것 — `pnpm test:db`로 갱신한다.
 *
 * `errorMessage`가 여기 모든 이름을 덮어야 하고 errorMessage.test.ts가 그것을 검사한다.
 * 정의 쪽은 *값*을 싣는다 — 폼이 몇몇 상한을 미리 비추므로 사진 다섯 장을 올리기 전에
 * 위반이 잡히고, limits.test.ts가 그 거울이 여전히 맞는지 본다. 이름만으로는 값이
 * 어긋나는 것을 잡지 못한다.
 */
export const DB_CONSTRAINTS = [
  'item_images_dimensions_positive',
  'item_images_item_fk',
  'item_images_item_sort_key',
  'item_images_path_not_blank',
  'item_images_pkey',
  'item_images_sort_order_range',
  'item_wears_item_date_key',
  'item_wears_item_fk',
  'item_wears_pkey',
  'items_brand_length',
  'items_category_group_valid',
  'items_colors_distinct',
  'items_colors_limit',
  'items_colors_valid',
  'items_fit_length',
  'items_id_user_key',
  'items_memo_length',
  'items_pkey',
  'items_price_max',
  'items_price_non_negative',
  'items_purchase_place_length',
  'items_seasons_distinct',
  'items_seasons_limit',
  'items_seasons_valid',
  'items_size_length',
  'items_status_valid',
  'items_tags_distinct',
  'items_tags_element_length',
  'items_tags_limit',
  'items_title_length',
  'items_title_not_blank',
  'items_user_id_fkey',
] as const

export const DB_CONSTRAINT_DEFS =
{
    "items_pkey": "PRIMARY KEY (id)",
    "item_wears_pkey": "PRIMARY KEY (id)",
    "items_price_max": "CHECK (((price IS NULL) OR (price <= 1000000000)))",
    "item_images_pkey": "PRIMARY KEY (id)",
    "items_fit_length": "CHECK (((fit IS NULL) OR (length(fit) <= 40)))",
    "items_tags_limit": "CHECK ((cardinality(tags) <= 20))",
    "items_id_user_key": "UNIQUE (id, user_id)",
    "items_memo_length": "CHECK (((memo IS NULL) OR (length(memo) <= 2000)))",
    "items_size_length": "CHECK (((size IS NULL) OR (length(size) <= 40)))",
    "item_wears_item_fk": "FOREIGN KEY (item_id, user_id) REFERENCES items(id, user_id) ON DELETE CASCADE",
    "items_brand_length": "CHECK (((brand IS NULL) OR (length(brand) <= 100)))",
    "items_colors_limit": "CHECK ((cardinality(colors) <= 3))",
    "items_colors_valid": "CHECK ((colors <@ ARRAY['black'::text, 'white'::text, 'gray'::text, 'beige'::text, 'brown'::text, 'navy'::text, 'blue'::text, 'sky'::text, 'green'::text, 'khaki'::text, 'yellow'::text, 'orange'::text, 'red'::text, 'pink'::text, 'purple'::text, 'multi'::text]))",
    "items_status_valid": "CHECK ((status = ANY (ARRAY['owned'::text, 'disposed'::text])))",
    "items_title_length": "CHECK ((length(title) <= 100))",
    "items_user_id_fkey": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE",
    "item_images_item_fk": "FOREIGN KEY (item_id, user_id) REFERENCES items(id, user_id) ON DELETE CASCADE",
    "items_seasons_limit": "CHECK ((cardinality(seasons) <= 4))",
    "items_seasons_valid": "CHECK ((seasons <@ ARRAY['spring'::text, 'summer'::text, 'fall'::text, 'winter'::text]))",
    "items_tags_distinct": "CHECK (private.has_unique_elements(tags))",
    "items_colors_distinct": "CHECK (private.has_unique_elements(colors))",
    "items_title_not_blank": "CHECK ((length(btrim(title)) > 0))",
    "items_seasons_distinct": "CHECK (private.has_unique_elements(seasons))",
    "item_wears_item_date_key": "UNIQUE (item_id, worn_on)",
    "items_price_non_negative": "CHECK (((price IS NULL) OR (price >= 0)))",
    "item_images_item_sort_key": "UNIQUE (item_id, sort_order) DEFERRABLE INITIALLY DEFERRED",
    "items_tags_element_length": "CHECK ((private.max_element_length(tags) <= 40))",
    "item_images_path_not_blank": "CHECK (((length(btrim(path)) > 0) AND (length(btrim(thumb_path)) > 0)))",
    "items_category_group_valid": "CHECK (((split_part(category_id, '.'::text, 1) = ANY (ARRAY['top'::text, 'bottom'::text, 'outer'::text, 'onepiece'::text, 'shoes'::text, 'bag'::text, 'accessory'::text, 'etc'::text])) AND (length(split_part(category_id, '.'::text, 2)) > 0)))",
    "items_purchase_place_length": "CHECK (((purchase_place IS NULL) OR (length(purchase_place) <= 100)))",
    "item_images_sort_order_range": "CHECK (((sort_order >= 0) AND (sort_order <= 4)))",
    "item_images_dimensions_positive": "CHECK ((((width IS NULL) OR (width > 0)) AND ((height IS NULL) OR (height > 0))))"
}
