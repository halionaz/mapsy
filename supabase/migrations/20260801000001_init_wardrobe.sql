-- mapsy 내 옷장 — initial schema (PRD §4)
--
-- Two tables: `items` holds a garment, `item_images` holds its photos. Both are
-- private per user via RLS keyed on auth.uid(). The app is single-user today,
-- but nothing here assumes that.

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------

create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,

  -- Required at creation. Everything below is optional so the capture flow can
  -- stay "photo + name" and nothing else (PRD §1).
  title          text not null,
  category_id    text not null,

  brand          text,
  size           text,
  fit            text,
  colors         text[] not null default '{}',
  seasons        text[] not null default '{}',
  price          integer,
  purchased_at   date,
  purchase_place text,
  memo           text,
  tags           text[] not null default '{}',

  status         text not null default 'owned',
  is_favorite    boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint items_title_not_blank
    check (length(btrim(title)) > 0),

  -- Sold or discarded garments are hidden, never deleted, so purchase history
  -- survives. The wardrobe only ever queries 'owned'.
  constraint items_status_valid
    check (status in ('owned', 'disposed')),

  constraint items_price_non_negative
    check (price is null or price >= 0),

  -- Only the group prefix is validated, not the full subcategory list. Adding a
  -- subcategory is a product change that should not require a migration, but a
  -- category_id whose group does not exist is garbage that would silently drop
  -- out of every filter.
  constraint items_category_group_valid
    check (
      split_part(category_id, '.', 1) in (
        'top', 'bottom', 'outer', 'onepiece',
        'shoes', 'bag', 'accessory', 'etc'
      )
      and length(split_part(category_id, '.', 2)) > 0
    ),

  -- The palette is fixed at 16 (PRD §5.3) precisely so the colour filter keeps
  -- working; free text would fragment "베이지 / 아이보리 / 크림" into three
  -- unrelated values. Adding a colour therefore IS a schema change, and this
  -- constraint is the thing that makes that explicit rather than accidental.
  -- Mirrors COLOR_IDS in mapsy-frontend/src/shared/constants/colors.ts.
  constraint items_colors_valid
    check (colors <@ array[
      'black', 'white', 'gray', 'beige', 'brown', 'navy', 'blue', 'sky',
      'green', 'khaki', 'yellow', 'orange', 'red', 'pink', 'purple', 'multi'
    ]::text[]),

  constraint items_colors_limit
    check (cardinality(colors) <= 3),

  -- Mirrors SEASON_IDS in mapsy-frontend/src/shared/constants/seasons.ts.
  constraint items_seasons_valid
    check (seasons <@ array['spring', 'summer', 'fall', 'winter']::text[]),

  -- Lets item_images carry a composite foreign key, which is what stops a photo
  -- from ever being attached to another user's item — a guarantee that holds
  -- even if an RLS policy is later loosened by mistake.
  constraint items_id_user_key unique (id, user_id)
);

comment on column public.items.category_id is
  'Subcategory id such as top.tshirt_short. Stable storage key — never rename.';
comment on column public.items.colors is
  'Up to 3 palette ids; the first is the primary colour shown on the card.';
comment on column public.items.price is
  'KRW, whole won.';

-- ---------------------------------------------------------------------------
-- item_images
-- ---------------------------------------------------------------------------

create table if not exists public.item_images (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null,
  user_id     uuid not null,

  -- Storage object paths, both under {user_id}/{item_id}/ in the wardrobe bucket.
  path        text not null,
  thumb_path  text not null,

  -- 0 is the cover shown in the grid — reordering is how the cover changes.
  -- Capping at 4 is what enforces "at most 5 photos per item" (PRD §7); the
  -- range and the uniqueness below are together the whole rule.
  sort_order  smallint not null default 0,

  width       integer,
  height      integer,
  created_at  timestamptz not null default now(),

  constraint item_images_sort_order_range
    check (sort_order between 0 and 4),

  constraint item_images_path_not_blank
    check (length(btrim(path)) > 0 and length(btrim(thumb_path)) > 0),

  constraint item_images_dimensions_positive
    check (
      (width is null or width > 0)
      and (height is null or height > 0)
    ),

  -- Composite rather than a plain item_id reference: user_id must match the
  -- parent item's, so cross-user attachment is impossible at the storage layer.
  constraint item_images_item_fk
    foreign key (item_id, user_id)
    references public.items (id, user_id)
    on delete cascade,

  -- Deferred so a reorder can swap two rows' sort_order inside one transaction
  -- without tripping over itself midway; the check still runs at commit.
  constraint item_images_item_sort_key
    unique (item_id, sort_order) deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- Indexes (PRD §4.2)
-- ---------------------------------------------------------------------------

-- The wardrobe loads one user's items newest-first, then filters client-side.
create index if not exists items_user_created_idx
  on public.items (user_id, created_at desc);

create index if not exists items_user_category_idx
  on public.items (user_id, category_id);

-- GIN over the array columns, so server-side filtering stays available for when
-- the collection outgrows client-side filtering (PRD §8.4). Tag and brand
-- autocomplete does not need them — the client already holds the whole
-- collection and derives those lists in memory.
create index if not exists items_colors_gin  on public.items using gin (colors);
create index if not exists items_seasons_gin on public.items using gin (seasons);
create index if not exists items_tags_gin    on public.items using gin (tags);

create index if not exists item_images_item_sort_idx
  on public.item_images (item_id, sort_order);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
-- Empty search_path: this function is reached through a trigger owned by a
-- privileged role, so leaving the caller's search_path in place would let an
-- unqualified name be resolved somewhere unintended.
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security (PRD §4.3)
-- ---------------------------------------------------------------------------

alter table public.items       enable row level security;
alter table public.item_images enable row level security;

-- Policies have no CREATE ... IF NOT EXISTS, so they are dropped first. Every
-- other statement in this file is re-runnable; leaving these as the one part
-- that isn't would mean a migration that fails halfway can't simply be retried.
drop policy if exists "items are private to their owner" on public.items;
drop policy if exists "item images are private to their owner" on public.item_images;

-- auth.uid() is wrapped in a scalar subquery so Postgres evaluates it once per
-- statement instead of once per row.
create policy "items are private to their owner"
  on public.items
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "item images are private to their owner"
  on public.item_images
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
