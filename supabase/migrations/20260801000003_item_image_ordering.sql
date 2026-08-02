-- Photo ordering and deletion (PRD §6.2, §7)
--
-- `(item_id, sort_order)` is unique and deferrable, so a reorder can hold two
-- rows at the same position mid-transaction. The client cannot use that: every
-- PostgREST request is its own transaction, so two UPDATE calls commit
-- separately and the first one trips the constraint on its own commit. And the
-- usual escape — parking a row at a sentinel like 99 — is blocked by the
-- `sort_order between 0 and 4` CHECK, which cannot be deferred at all.
--
-- Hence these functions. Each runs inside a single transaction, which is the
-- only place the deferred constraint actually buys anything.
--
-- Both are SECURITY INVOKER, so row level security still applies: they can only
-- ever touch rows the caller already owns. Making them SECURITY DEFINER would
-- hand any authenticated user the ability to reorder anyone's photos.

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
  v_owned  integer;
  v_given  integer := coalesce(array_length(p_image_ids, 1), 0);
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

  -- One statement, so the transient duplicate positions only have to survive
  -- until commit — which is exactly what the deferred constraint allows.
  update public.item_images i
  set sort_order = ordered.position - 1
  from unnest(p_image_ids) with ordinality as ordered(id, position)
  where i.id = ordered.id
    and i.item_id = p_item_id;

  -- Guards against ids that belong to another item: those rows never matched,
  -- so fewer rows changed than were asked for.
  if not found then
    raise exception 'reorder_item_images: 대상 이미지를 찾지 못함'
      using errcode = 'no_data_found';
  end if;
end;
$$;

comment on function public.reorder_item_images(uuid, uuid[]) is
  'Rewrites sort_order to match the given id order. Send every image id for the item, cover first.';

/**
 * Deletes one photo and closes the gap it leaves.
 *
 * Without the renumber, deleting the cover leaves the item with photos but no
 * sort_order 0 — and the grid looks up its cover by that exact value, so the
 * card would go blank while the photos are still there.
 */
create or replace function public.delete_item_image(p_image_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_id uuid;
begin
  delete from public.item_images
  where id = p_image_id
  returning item_id into v_item_id;

  if v_item_id is null then
    raise exception 'delete_item_image: 이미지를 찾지 못함'
      using errcode = 'no_data_found';
  end if;

  update public.item_images i
  set sort_order = renumbered.position - 1
  from (
    select id, row_number() over (order by sort_order) as position
    from public.item_images
    where item_id = v_item_id
  ) as renumbered
  where i.id = renumbered.id
    and i.sort_order <> renumbered.position - 1;
end;
$$;

comment on function public.delete_item_image(uuid) is
  'Deletes one photo and renumbers the rest to a contiguous 0..n-1 range.';

-- PostgREST only exposes functions the caller may execute.
grant execute on function public.reorder_item_images(uuid, uuid[]) to authenticated;
grant execute on function public.delete_item_image(uuid) to authenticated;
