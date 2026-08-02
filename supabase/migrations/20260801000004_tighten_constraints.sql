-- Fixes found by review: the reorder guard did not actually guard, and several
-- array/text columns had no upper bound.

-- ---------------------------------------------------------------------------
-- reorder_item_images: check how many rows changed, not whether any did
-- ---------------------------------------------------------------------------
--
-- The previous version tested `if not found`, which is true as soon as a single
-- row updates. Sending a well-sized list that contains an id from another item —
-- or the same id twice — passed the count check, updated a subset, and returned
-- success while leaving the remaining photo at a stale position. Reproduced:
--
--   [X1, X2, Y1]  → succeeded, X3 left at sort_order 2
--   [X1, X1, X3]  → succeeded, order unchanged
--
-- ROW_COUNT is the number actually updated, so comparing it against the input
-- length catches both cases: a foreign id matches nothing, and a duplicate id
-- can only update one row.

create or replace function public.reorder_item_images(
  p_item_id   uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owned   integer;
  v_given   integer := coalesce(array_length(p_image_ids, 1), 0);
  v_updated integer;
begin
  select count(*) into v_owned
  from public.item_images
  where item_id = p_item_id;

  -- A partial list would leave holes or duplicates once the update lands, so
  -- the caller has to send the complete order rather than a delta.
  if v_owned <> v_given then
    raise exception
      'reorder_item_images: 이미지 % 개 중 % 개만 전달됨', v_owned, v_given
      using errcode = 'data_exception';
  end if;

  -- An item with no photos is a legitimate no-op, not an error.
  if v_given = 0 then
    return;
  end if;

  -- One statement, so the transient duplicate positions only have to survive
  -- until commit — which is exactly what the deferred constraint allows.
  update public.item_images i
  set sort_order = ordered.position - 1
  from unnest(p_image_ids) with ordinality as ordered(id, position)
  where i.id = ordered.id
    and i.item_id = p_item_id;

  get diagnostics v_updated = row_count;

  if v_updated <> v_given then
    raise exception
      'reorder_item_images: % 개를 요청했지만 % 개만 일치함 (다른 아이템의 id이거나 중복)',
      v_given, v_updated
      using errcode = 'data_exception';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Array hygiene
-- ---------------------------------------------------------------------------
--
-- `<@` constrains membership but says nothing about repeats, so
-- array['summer','summer','summer'] was accepted and rendered as three
-- identical chips. A CHECK cannot contain a subquery, but it may call an
-- immutable function that does.

create or replace function public.has_unique_elements(arr text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(arr) = (select count(distinct e) from unnest(arr) as e)
$$;

comment on function public.has_unique_elements(text[]) is
  'True when the array has no repeated elements. Immutable so CHECK can use it.';

-- ADD CONSTRAINT has no IF NOT EXISTS, so each is dropped first — the rest of
-- this repo's migrations are re-runnable and these should not be the exception.
alter table public.items
  drop constraint if exists items_seasons_limit,
  drop constraint if exists items_seasons_distinct,
  drop constraint if exists items_colors_distinct,
  drop constraint if exists items_tags_distinct,
  drop constraint if exists items_tags_limit;

alter table public.items
  -- There are only four seasons; anything longer is duplicates.
  add constraint items_seasons_limit check (cardinality(seasons) <= 4),
  add constraint items_seasons_distinct check (public.has_unique_elements(seasons)),
  add constraint items_colors_distinct check (public.has_unique_elements(colors)),
  add constraint items_tags_distinct check (public.has_unique_elements(tags)),
  add constraint items_tags_limit check (cardinality(tags) <= 20);

-- ---------------------------------------------------------------------------
-- Text bounds
-- ---------------------------------------------------------------------------
--
-- Every other column was tightly constrained while free text had no ceiling at
-- all — a 500,000-character title was accepted. These are generous enough that
-- no real garment hits them.

alter table public.items
  drop constraint if exists items_title_length,
  drop constraint if exists items_brand_length,
  drop constraint if exists items_size_length,
  drop constraint if exists items_fit_length,
  drop constraint if exists items_purchase_place_length,
  drop constraint if exists items_memo_length;

alter table public.items
  add constraint items_title_length check (length(title) <= 100),
  add constraint items_brand_length check (brand is null or length(brand) <= 100),
  add constraint items_size_length check (size is null or length(size) <= 40),
  add constraint items_fit_length check (fit is null or length(fit) <= 40),
  add constraint items_purchase_place_length
    check (purchase_place is null or length(purchase_place) <= 100),
  add constraint items_memo_length check (memo is null or length(memo) <= 2000);

-- ---------------------------------------------------------------------------
-- Redundant index
-- ---------------------------------------------------------------------------
--
-- `item_images_item_sort_key` (the UNIQUE constraint) already provides a btree
-- on exactly (item_id, sort_order), so this one only cost write throughput.

drop index if exists public.item_images_item_sort_idx;
