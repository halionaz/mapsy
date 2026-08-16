-- 편집 화면의 사진 반영 (PRD §6.2, MAPSY-10)
--
-- 편집 한 번에 삭제·추가·순서 변경이 섞여 들어온다. 003이 순서와 삭제를 각각 함수로
-- 만든 이유가 여기서도 그대로 걸리고, 한 겹 더 걸린다.
--
-- 1. PostgREST 요청은 하나가 하나의 트랜잭션이다. 나눠 부르면 중간 상태가 커밋된다.
-- 2. 나눠 부르면 순서까지 강제된다. `sort_order between 0 and 4`는 즉시 검사라
--    5장짜리 아이템에 먼저 넣고 나중에 지울 수가 없고 — 7행이 되는 순간 자리가 없다 —
--    반드시 지우고 나서 넣어야 한다. 그 사이에서 요청이 끊기면 사용자가 지운 사진만
--    사라지고 새 사진은 올라가지 않는다. 저장을 취소한 것도 완료한 것도 아닌 상태다.
--
-- 그래서 최종 목록을 통째로 받는다. `set_item_wears`가 하루치를 다시 쓰는 것과 같은
-- 모양이다 — 델타가 아니라 결과를 보낸다.
--
-- 003의 `reorder_item_images`와 `delete_item_image`는 이 함수로 표현되는 특수한 경우다.
-- 아래에서 지운다 — 이유는 그쪽 파일 끝에 적었다.

/**
 * 아이템의 사진 목록을 통째로 다시 쓴다.
 *
 * `p_images`는 최종 순서대로의 배열이고, 원소는 둘 중 하나다.
 *
 *   {"id": uuid}                                       유지 — 이 자리로 옮긴다
 *   {"id": uuid, "path": …, "thumb_path": …,           신규 — 이 자리에 넣는다
 *    "width": …, "height": …}
 *
 * `path` 키의 유무가 둘을 가른다. 목록에 없는 기존 사진은 삭제된다.
 *
 * 스토리지 객체는 건드리지 않는다 — 트랜잭션 밖이라 되돌릴 수 없기 때문이다. 지워진
 * 행의 객체를 치우는 것은 호출자 몫이고, 커밋된 뒤에 해야 한다.
 *
 * 최종 목록을 sort_order 순으로 돌려준다. 호출자가 캐시에 그대로 반영할 수 있어야
 * 하고, 그러려면 클라이언트가 만든 예상값이 아니라 서버가 쓴 행이어야 한다.
 */
create or replace function public.set_item_images(
  p_item_id uuid,
  p_images  jsonb
)
returns setof public.item_images
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id  uuid;
  v_given    integer;
  v_distinct integer;
  v_kept     integer;
  v_moved    integer;
begin
  if jsonb_typeof(p_images) <> 'array' then
    raise exception 'set_item_images: 사진 목록이 배열이 아님'
      using errcode = 'data_exception';
  end if;

  v_given := jsonb_array_length(p_images);

  -- 사진 없는 아이템은 그리드에서 정체를 알 수 없는 빈 카드가 된다. createItem은
  -- 이미지 삽입이 실패하면 아이템 행까지 되돌려서 그 상태를 막는데, 편집에는 그것을
  -- 막는 것이 폼의 필수 검사뿐이었다. 폼이 기억하는 규칙은 폼을 고치면 사라진다.
  if v_given = 0 then
    raise exception 'set_item_images: 사진이 한 장도 남지 않음'
      using errcode = 'data_exception';
  end if;

  -- user_id를 인자로 받지 않고 아이템에서 읽는다. 복합 외래키가 (item_id, user_id)
  -- 쌍을 요구하므로 둘은 애초에 따로 놀 수 없고, RLS가 남의 아이템을 걸러내므로
  -- 여기서 못 찾았다는 것은 없거나 내 것이 아니라는 뜻이다.
  select i.user_id into v_user_id from public.items i where i.id = p_item_id;
  if v_user_id is null then
    raise exception 'set_item_images: 아이템을 찾지 못함'
      using errcode = 'no_data_found';
  end if;

  -- id 없는 원소를 먼저 걸러낸다. 아래의 중복 검사가 count(distinct)라 null은 세지
  -- 않고, 그러면 id를 빠뜨린 요청이 "중복된 id가 있음"으로 보고된다.
  if exists (
    select 1 from jsonb_array_elements(p_images) as e
    where e.value->>'id' is null
  ) then
    raise exception 'set_item_images: id 없는 항목이 있음'
      using errcode = 'data_exception';
  end if;

  select count(distinct e.value->>'id') into v_distinct
  from jsonb_array_elements(p_images) as e;

  if v_distinct <> v_given then
    raise exception 'set_item_images: 중복된 이미지 id가 있음'
      using errcode = 'data_exception';
  end if;

  delete from public.item_images img
  where img.item_id = p_item_id
    and not exists (
      select 1 from jsonb_array_elements(p_images) as e
      where (e.value->>'id')::uuid = img.id
    );

  -- 삭제가 먼저인 이유는 이 함수가 존재하는 이유와 같다. 자리를 비우지 않고 넣으면
  -- 즉시 검사인 sort_order CHECK에 걸린다.
  insert into public.item_images
    (id, item_id, user_id, path, thumb_path, sort_order, width, height)
  select (e.value->>'id')::uuid,
         p_item_id,
         v_user_id,
         e.value->>'path',
         e.value->>'thumb_path',
         (e.position - 1)::smallint,
         (e.value->>'width')::integer,
         (e.value->>'height')::integer
  from jsonb_array_elements(p_images) with ordinality as e(value, position)
  where e.value ? 'path';

  select count(*) into v_kept
  from jsonb_array_elements(p_images) as e
  where not (e.value ? 'path');

  -- 남긴 사진을 최종 자리로 옮긴다. 방금 넣은 행과 자리가 겹칠 수 있지만, 겹침은
  -- 커밋까지만 살면 되고 유니크 제약이 deferred인 것이 정확히 그것을 위해서다.
  update public.item_images img
  set sort_order = (kept.position - 1)::smallint
  from (
    select (e.value->>'id')::uuid as id, e.position
    from jsonb_array_elements(p_images) with ordinality as e(value, position)
    where not (e.value ? 'path')
  ) as kept
  where img.id = kept.id
    and img.item_id = p_item_id;

  -- reorder_item_images와 같은 이유로 ROW_COUNT다. 다른 아이템의 id는 아무 행도
  -- 건드리지 못하는데, FOUND는 한 행만 갱신돼도 참이라 그 요청이 성공으로 보고된다.
  get diagnostics v_moved = row_count;

  if v_moved <> v_kept then
    raise exception
      'set_item_images: 유지하려는 % 개 중 % 개만 이 아이템의 사진임', v_kept, v_moved
      using errcode = 'data_exception';
  end if;

  return query
    select img.*
    from public.item_images img
    where img.item_id = p_item_id
    order by img.sort_order;
end;
$$;

comment on function public.set_item_images(uuid, jsonb) is
  '아이템의 사진 목록을 최종 순서대로 다시 쓴다. 목록에 없는 사진은 삭제되고, path가 있는 원소는 새로 삽입된다.';

-- 006과 같은 이유로 PUBLIC 기본 grant를 먼저 걷어낸다.
revoke all on function public.set_item_images(uuid, jsonb) from public, anon;
grant execute on function public.set_item_images(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 003의 두 함수를 지운다
-- ---------------------------------------------------------------------------
--
-- 순서 변경은 `set_item_images(item, [{"id":…}, …])`, 사진 한 장 삭제는 그 사진만 뺀
-- 목록이다. 남은 사진의 재번호는 위치가 곧 sort_order라 저절로 따라온다.
--
-- 지우는 이유는 중복이 아니라 **갈라짐**이다. 셋은 같은 규칙(0..4, 유니크, 대표는 최소
-- sort_order)을 각자 구현하고 있어서, 상한을 6장으로 올리는 날 세 곳을 같이 고쳐야 한다.
-- 그리고 호출자가 없는 함수는 그 사실을 알려주지 않는다 — 004는 `reorder_item_images`의
-- 가드가 가드 노릇을 못 한 채 두 번의 마이그레이션을 산 기록이다.
--
-- 되돌리려면 003과 005의 본문이 그대로 남아 있다. 앱은 이미 어느 쪽도 부르지 않으므로
-- 이 DROP은 배포된 데이터베이스에서도 아무 호출을 깨지 않는다.

drop function if exists public.reorder_item_images(uuid, uuid[]);
drop function if exists public.delete_item_image(uuid);
