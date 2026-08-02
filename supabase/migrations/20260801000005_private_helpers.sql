-- Review follow-up: constraint helpers were reachable as REST endpoints, the two
-- rejection paths in reorder_item_images were indistinguishable, and tag
-- elements had no length ceiling.

-- ---------------------------------------------------------------------------
-- Helpers move out of the exposed schema
-- ---------------------------------------------------------------------------
--
-- `has_unique_elements` was created in `public`, where PostgREST introspects
-- everything, so a CHECK helper became POST /rest/v1/rpc/has_unique_elements.
-- Harmless in itself — it is pure and touches no data — but migration 003 made
-- "PostgREST only exposes functions the caller may execute" part of its
-- reasoning, and this did not follow that rule.
--
-- Revoking EXECUTE is not an option: constraint expressions are evaluated with
-- the inserting role's privileges, so revoking makes every INSERT fail with
-- "permission denied for function". Verified against Postgres 17. Moving the
-- helpers to an unexposed schema keeps the constraints working while taking the
-- endpoints away.

create schema if not exists private;

comment on schema private is
  'Internals PostgREST does not expose. Helpers called from CHECK constraints live here.';

grant usage on schema private to authenticated, service_role;

create or replace function private.has_unique_elements(arr text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(arr) = (select count(distinct e) from unnest(arr) as e)
$$;

/**
 * Longest element of the array, or 0 when empty.
 *
 * Tags were the one free-text column migration 004 left unbounded: it capped
 * their number and forbade duplicates but said nothing about each one. A
 * 500-character tag was accepted and rendered as an enormous chip, and past
 * roughly 2,700 bytes the GIN index rejects the row with an internal
 * "index row size exceeds maximum" that no part of the app can present.
 */
create or replace function private.max_element_length(arr text[])
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce((select max(length(e)) from unnest(arr) as e), 0)
$$;

alter table public.items
  drop constraint if exists items_seasons_distinct,
  drop constraint if exists items_colors_distinct,
  drop constraint if exists items_tags_distinct,
  drop constraint if exists items_tags_element_length;

drop function if exists public.has_unique_elements(text[]);

alter table public.items
  add constraint items_seasons_distinct check (private.has_unique_elements(seasons)),
  add constraint items_colors_distinct check (private.has_unique_elements(colors)),
  add constraint items_tags_distinct check (private.has_unique_elements(tags)),
  add constraint items_tags_element_length check (private.max_element_length(tags) <= 40);

-- ---------------------------------------------------------------------------
-- reorder_item_images: tell the two rejections apart
-- ---------------------------------------------------------------------------
--
-- Both a duplicated id and an id belonging to another item produce "fewer rows
-- updated than requested", and 004 reported them with one message. That made
-- the two indistinguishable to a caller — and to the tests, which could pass
-- with only one of the branches working.

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
  v_distinct integer;
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

  select count(distinct e) into v_distinct from unnest(p_image_ids) as e;
  if v_distinct <> v_given then
    raise exception 'reorder_item_images: 중복된 이미지 id가 있음'
      using errcode = 'data_exception';
  end if;

  -- One statement, so the transient duplicate positions only have to survive
  -- until commit — which is exactly what the deferred constraint allows.
  update public.item_images i
  set sort_order = ordered.position - 1
  from unnest(p_image_ids) with ordinality as ordered(id, position)
  where i.id = ordered.id
    and i.item_id = p_item_id;

  -- ROW_COUNT, not FOUND: FOUND is true as soon as one row updates, which let a
  -- list containing another item's id apply partially and report success.
  get diagnostics v_updated = row_count;

  if v_updated <> v_given then
    raise exception
      'reorder_item_images: % 개 중 % 개만 이 아이템의 이미지임', v_given, v_updated
      using errcode = 'data_exception';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants say what they mean
-- ---------------------------------------------------------------------------
--
-- Postgres grants EXECUTE to PUBLIC by default, and `grant ... to authenticated`
-- does not take that away — the ACLs read `=X/postgres` (PUBLIC) alongside the
-- explicit grant. RLS and `security invoker` mean an anonymous caller achieves
-- nothing, but the intent was "signed-in users only" and the state did not say
-- so.

revoke all on function public.reorder_item_images(uuid, uuid[]) from public;
revoke all on function public.delete_item_image(uuid) from public;

grant execute on function public.reorder_item_images(uuid, uuid[]) to authenticated;
grant execute on function public.delete_item_image(uuid) to authenticated;
