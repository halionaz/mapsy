-- set_item_images(item, NULL)이 사진을 전부 지우고 성공으로 보고하던 것 (리뷰 지적)
--
-- 20260816000001의 가드 셋이 **전부** NULL을 통과시켰다. 셋 다 각자는 맞게 쓰였고,
-- 3값 논리 하나에 같이 무너진다 — `if <NULL>`은 거짓이므로 어떤 raise도 실행되지 않는다.
--
--   jsonb_typeof(NULL) <> 'array'   →  NULL <> 'array'  →  NULL  →  통과
--   v_given = 0                     →  jsonb_array_length(NULL)이 NULL  →  NULL  →  통과
--   v_distinct <> v_given           →  0 <> NULL        →  NULL  →  통과
--
-- 그리고 jsonb_array_elements는 STRICT라 NULL에 0행을 내므로, 삭제문의
-- `not exists (…)`가 그 아이템의 모든 사진에 대해 참이 된다. 삽입도 갱신도 0행이라
-- v_kept = v_moved = 0으로 마지막 검사까지 지나고, 빈 셋을 돌려주며 정상 종료한다.
--
-- 실물 PG 17에 마이그레이션을 그대로 올려 재현했다: 사진 5장 → 호출 → 0장, 예외 없음.
-- REST 경로도 닿는다. PostgREST는 RPC 인자를 json_to_recordset으로 뽑는데,
-- `{"p_images": null}`은 거기서 SQL NULL이 된다(같은 컨테이너에서 확인).
--
-- 앱은 지금 이 입력을 만들지 않는다 — toImagePayload는 언제나 배열을 돌려준다. 그것이
-- 이 결함을 사소하게 만들지 않는 이유는 이 가드가 존재하는 이유와 같다: 폼이 기억하는
-- 규칙은 폼을 고치면 사라지므로 데이터베이스가 들고 있기로 한 것이었고, 뚫렸을 때 남는
-- 상태가 정확히 막으려던 그 상태(사진 0장 = 그리드의 빈 카드)다.
--
-- 함수 전체를 다시 쓴다. 본문에서 달라진 것은 첫 줄의 `p_images is null or` 하나다.
--
-- 20260816000001을 직접 고치지 않는 이유는 **그 파일이 이미 linked 프로젝트에 push됐기
-- 때문**이다. main에는 아직 없다 — 이 브랜치에서 처음 생긴 파일이고, 그 점에서 003이
-- main에 있던 상태로 고쳐 쓴 004·005와는 상황이 다르다. 그럼에도 나누는 쪽인 것은 원격
-- supabase_migrations 테이블에 20260816000001 행이 이미 있어서다: 파일만 고치면 원격은
-- 낡은 본문을 든 채 다시 적용되지 않고, 그 어긋남은 아무 데서도 보이지 않는다.
--
-- 값은 함수 본문이 두 벌이 된 것이다. 이 브랜치가 방금 reorder_item_images를 지우며 적은
-- 이유(같은 규칙을 여러 곳이 각자 구현하면 갈라진다)가 여기에도 그대로 걸린다 — 이 함수의
-- 규칙을 고치는 사람은 두 파일 중 나중 것을 고쳐야 한다. 아직 push하지 않은 브랜치였다면
-- 001에 한 조각을 넣고 이 파일을 지우는 쪽이 맞다.

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
  -- NULL을 여기서 잡는다. 아래 두 가드는 NULL 앞에서 각자 조용히 참을 잃으므로,
  -- 인자가 배열이라는 사실을 세우는 것이 이 한 줄의 몫이다.
  if p_images is null or jsonb_typeof(p_images) <> 'array' then
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

  -- 다른 아이템의 id는 아무 행도 건드리지 못하는데, FOUND는 한 행만 갱신돼도 참이라
  -- 그 요청이 성공으로 보고된다. 그래서 ROW_COUNT다.
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

-- grant를 다시 적지 않는다. `create or replace`는 ACL을 보존한다 — 시그니처가 그대로일
-- 때의 이야기이고, 바뀌는 날은 함수가 새로 만들어지므로 그때 그 마이그레이션이 적으면 된다.
-- 있으나 마나 한 두 줄을 "언젠가 복사해 갈 사람"을 위해 남기면, 진짜로 필요한 자리에서도
-- 의례로 읽힌다.
