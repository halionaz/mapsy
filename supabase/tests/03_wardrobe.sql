-- Regression suite for the wardrobe schema: constraints, RLS, storage policies
-- and the ordering functions.
--
-- Run with `pnpm test:db` (see run.sh). Any failure aborts the script.

\set ON_ERROR_STOP on
\pset pager off
-- Assertions report through NOTICE (stderr); the result rows themselves carry no
-- information, so they are dropped. \echo still reaches stdout for the headings.
\o /dev/null
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

insert into auth.users (id, email) values
  (:'A', 'a@example.com'),
  (:'B', 'b@example.com');

\echo '── 제약 (사용자 A) ──'
set role authenticated;
set request.jwt.claim.sub = :'A';

insert into public.items (id, user_id, title, category_id, colors, seasons, price)
values ('aaaa0000-0000-0000-0000-000000000001', :'A', '마산 플리스 자켓', 'outer.fleece',
        array['navy','white'], array['fall','winter'], 220000);

select tests.eq(
  (select count(*)::text from public.items),
  '1', '유효한 아이템이 저장됨');

select tests.eq(
  (select status || ' ' || is_favorite::text from public.items),
  'owned false', '기본값이 owned / 즐겨찾기 해제');

select tests.fails(
  format('insert into public.items (user_id, title, category_id) values (%L, %L, %L)',
         :'B', '남의 옷', 'top.knit'),
  'row-level security', '다른 사용자 몫으로는 삽입 불가');

select tests.fails(
  format('insert into public.items (user_id, title, category_id) values (%L, %L, %L)',
         :'A', '   ', 'top.knit'),
  'items_title_not_blank', '공백뿐인 이름 거부');

select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, colors)
            values (%L, '아이보리 니트', 'top.knit', array['ivory'])$f$, :'A'),
  'items_colors_valid', '팔레트 밖 색상 거부');

select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, colors)
            values (%L, '패턴 셔츠', 'top.shirt', array['red','blue','green','yellow'])$f$, :'A'),
  'items_colors_limit', '색상 4개 거부');

select tests.fails(
  format('insert into public.items (user_id, title, category_id) values (%L, %L, %L)',
         :'A', '이상한 옷', 'hat.beanie'),
  'items_category_group_valid', '존재하지 않는 카테고리 그룹 거부');

select tests.fails(
  format('insert into public.items (user_id, title, category_id) values (%L, %L, %L)',
         :'A', '접두사만', 'top'),
  'items_category_group_valid', '소분류 없는 카테고리 거부');

select tests.fails(
  format('insert into public.items (user_id, title, category_id, price) values (%L, %L, %L, -1)',
         :'A', '공짜', 'top.knit'),
  'items_price_non_negative', '음수 가격 거부');

select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, seasons)
            values (%L, '장마철', 'top.knit', array['monsoon'])$f$, :'A'),
  'items_seasons_valid', '존재하지 않는 계절 거부');

\echo '── updated_at 트리거 ──'
update public.items set title = '마산 플리스' where id = 'aaaa0000-0000-0000-0000-000000000001';
select tests.eq(
  (select (updated_at > created_at)::text from public.items),
  'true', 'update 시 updated_at 갱신됨');

\echo '── 사진 ──'
insert into public.item_images (id, item_id, user_id, path, thumb_path, sort_order)
select ('bbbb0000-0000-0000-0000-00000000000' || g)::uuid,
       'aaaa0000-0000-0000-0000-000000000001', :'A',
       'p' || g, 't' || g, g
from generate_series(0, 4) g;

select tests.eq((select count(*)::text from public.item_images), '5', '사진 5장 저장됨');

select tests.fails(
  format($f$insert into public.item_images (item_id, user_id, path, thumb_path, sort_order)
            values ('aaaa0000-0000-0000-0000-000000000001', %L, 'p5', 't5', 5)$f$, :'A'),
  'item_images_sort_order_range', '6번째 사진(sort_order 5) 거부 — 아이템당 최대 5장');

select tests.fails_deferred(
  format($f$insert into public.item_images (item_id, user_id, path, thumb_path, sort_order)
            values ('aaaa0000-0000-0000-0000-000000000001', %L, 'dup', 'dup', 0)$f$, :'A'),
  'item_images_item_sort_key', '같은 아이템 내 sort_order 중복 거부');

select tests.fails(
  format($f$insert into public.item_images (item_id, user_id, path, thumb_path, sort_order)
            values ('aaaa0000-0000-0000-0000-000000000001', %L, 'x', 'x', 3)$f$, :'B'),
  'row-level security', '남의 user_id로 사진 첨부 불가');

\echo '── 사진 목록 재작성 (set_item_images) ──'
-- 편집 화면이 부르는 하나뿐인 사진 쓰기 경로. 삭제·추가·순서를 한 번에 받는다.
-- 시작 상태: p0..p4 (sort_order 0..4), 즉 꽉 찬 다섯 장.

-- 아래 "다른 아이템의 사진" 케이스용.
insert into public.items (id, user_id, title, category_id)
values ('aaaa0000-0000-0000-0000-000000000002', :'A', '옆 아이템', 'top.knit');
insert into public.item_images (id, item_id, user_id, path, thumb_path, sort_order)
values ('cccc0000-0000-0000-0000-000000000001',
        'aaaa0000-0000-0000-0000-000000000002', :'A', 'z0', 'z0t', 0);

-- 한 번의 저장에 세 가지가 다 들어온 모양: p1·p2·p4는 목록에 없어 지워지고, 새 사진이
-- 가운데로 들어가고, 남은 둘의 순서가 뒤집힌다. **다섯 장에서 시작하는 것이 핵심이다** —
-- 나눠 불렀다면 자리를 비우기 전에는 새 사진을 넣을 곳이 아예 없다.
select tests.eq(
  (select string_agg(path, ',' order by sort_order)
   from public.set_item_images('aaaa0000-0000-0000-0000-000000000001', $j$[
     {"id": "bbbb0000-0000-0000-0000-000000000003"},
     {"id": "dddd0000-0000-0000-0000-000000000001",
      "path": "p5", "thumb_path": "t5", "width": 1280, "height": 960},
     {"id": "bbbb0000-0000-0000-0000-000000000000"}
   ]$j$::jsonb)),
  'p3,p5,p0', '삭제·추가·순서 변경이 한 번에 반영되고, 반영된 목록이 돌아옴');

-- 돌려준 것과 남은 것이 같은지. 프론트엔드가 이 반환값을 그대로 캐시에 넣으므로,
-- 둘이 어긋나면 화면과 데이터베이스가 조용히 갈라진다.
select tests.eq(
  (select string_agg(path, ',' order by sort_order) || ' / ' || count(*)::text
   from public.item_images where item_id = 'aaaa0000-0000-0000-0000-000000000001'),
  'p3,p5,p0 / 3', '테이블에 남은 것도 같은 순서, 목록에 없던 세 장은 삭제됨');

-- 대표를 바꾸는 방법이 순서 변경이라는 규약(PRD §4)의 실물. 옛 대표 p0은 맨 뒤로 갔고,
-- 0번 자리는 비지 않았다 — 삭제 뒤 재번호를 따로 하지 않아도 위치가 곧 sort_order다.
select tests.eq(
  (select path from public.item_images
   where item_id = 'aaaa0000-0000-0000-0000-000000000001' and sort_order = 0),
  'p3', '목록의 첫 번째가 곧 대표');

select tests.eq(
  (select width || 'x' || height from public.item_images where path = 'p5'),
  '1280x960', '새 사진의 크기가 그대로 저장됨');

select tests.fails(
  $f$select * from public.set_item_images(
       'aaaa0000-0000-0000-0000-000000000001', '[]'::jsonb)$f$,
  '한 장도 남지 않음', '빈 목록 거부 — 사진 없는 아이템은 빈 카드가 됨');

-- NULL은 빈 배열과 같은 자리에서 막혀야 한다. 처음 판에서는 세 가드가 전부 3값 논리에
-- 무너져 통과했고, 삭제문의 not exists가 모든 행에 참이 되어 사진이 전부 지워졌다.
-- 예외가 아니라 빈 셋을 돌려주는 정상 종료였다.
select tests.fails(
  $f$select * from public.set_item_images(
       'aaaa0000-0000-0000-0000-000000000001', null::jsonb)$f$,
  '배열이 아님', 'NULL 목록 거부 — PostgREST가 JSON null을 SQL NULL로 넘김');

-- JSON null은 같은 문장의 다른 가지다. 위와 함께 두는 이유는 둘이 다른 값이라서다.
select tests.fails(
  $f$select * from public.set_item_images(
       'aaaa0000-0000-0000-0000-000000000001', 'null'::jsonb)$f$,
  '배열이 아님', 'JSON null도 거부');

select tests.eq(
  (select count(*)::text from public.item_images
   where item_id = 'aaaa0000-0000-0000-0000-000000000001'),
  '3', '거부된 세 호출 뒤에도 사진이 그대로임');

select tests.fails(
  $f$select * from public.set_item_images('aaaa0000-0000-0000-0000-000000000001', $j$[
       {"id": "bbbb0000-0000-0000-0000-000000000003"},
       {"id": "cccc0000-0000-0000-0000-000000000001"}
     ]$j$::jsonb)$f$,
  '이 아이템의 사진임', '다른 아이템의 사진을 유지 목록에 넣으면 거부');

-- 거부된 호출이 롤백되는지. 위 요청은 p5와 p0을 지우고 나서 마지막 검사에서 걸린다.
select tests.eq(
  (select string_agg(path, ',' order by sort_order)
   from public.item_images where item_id = 'aaaa0000-0000-0000-0000-000000000001'),
  'p3,p5,p0', '거부된 재작성은 아무것도 바꾸지 않음');

select tests.fails(
  $f$select * from public.set_item_images('aaaa0000-0000-0000-0000-000000000001', $j$[
       {"id": "bbbb0000-0000-0000-0000-000000000003"},
       {"id": "bbbb0000-0000-0000-0000-000000000003"}
     ]$j$::jsonb)$f$,
  '중복된 이미지 id', '중복 id 거부');

-- 중복 검사가 count(distinct)라 null을 세지 않는다. id를 빠뜨린 요청이 "중복"으로
-- 보고되면 호출자는 엉뚱한 곳을 고치게 된다.
select tests.fails(
  $f$select * from public.set_item_images('aaaa0000-0000-0000-0000-000000000001', $j$[
       {"path": "x", "thumb_path": "xt"}
     ]$j$::jsonb)$f$,
  'id 없는 항목', 'id 없는 원소는 중복과 다른 메시지로 거부');

-- 최대 5장을 강제하는 것은 여전히 CHECK 하나뿐이다. 이 경로에도 걸리는지 —
-- 함수가 개수를 따로 세지 않는 근거가 이것이다.
select tests.fails(
  $f$select * from public.set_item_images('aaaa0000-0000-0000-0000-000000000001', $j$[
       {"id": "bbbb0000-0000-0000-0000-000000000003"},
       {"id": "dddd0000-0000-0000-0000-000000000001"},
       {"id": "bbbb0000-0000-0000-0000-000000000000"},
       {"id": "dddd0000-0000-0000-0000-000000000002", "path": "p6", "thumb_path": "t6"},
       {"id": "dddd0000-0000-0000-0000-000000000003", "path": "p7", "thumb_path": "t7"},
       {"id": "dddd0000-0000-0000-0000-000000000004", "path": "p8", "thumb_path": "t8"}
     ]$j$::jsonb)$f$,
  'item_images_sort_order_range', '6장은 CHECK에서 막힘 — 개수 상한은 여전히 거기 하나');

select tests.fails(
  $f$select * from public.set_item_images('aaaa0000-0000-0000-0000-0000000000ff', $j$[
       {"id": "dddd0000-0000-0000-0000-00000000000a",
        "path": "y", "thumb_path": "yt"}
     ]$j$::jsonb)$f$,
  '아이템을 찾지 못함', '없는 아이템 거부');

-- RETURNING이 소유자에게 행을 돌려주는지 — 아래 B 케이스의 반대쪽.
--
-- 프론트엔드가 여기에 기댄다. deleteItem은 `.select('id')`로 지운 행을 받아
-- 비어 있으면 실패로 처리하는데, PostgREST가 0행 매치를 에러로 보지 않아서
-- 그렇지 않으면 아무것도 안 지운 삭제가 성공으로 보고되기 때문이다. 정책이
-- `for all` 하나라 DELETE의 RETURNING도 같은 조건으로 SELECT되지만, 나중에
-- 커맨드별 정책으로 쪼개면서 select를 좁히면 **삭제는 되고 예외는 나는** 상태가
-- 된다 — 행은 사라졌는데 스토리지 정리를 건너뛰어 고아 객체가 남는다.
insert into public.items (id, user_id, title, category_id)
values ('aaaa0000-0000-0000-0000-000000000003', :'A', '사진 없는 아이템', 'top.knit');

with deleted as (
  delete from public.items where id in (
    'aaaa0000-0000-0000-0000-000000000002',
    'aaaa0000-0000-0000-0000-000000000003')
  returning 1)
select tests.eq((select count(*)::text from deleted), '2', '소유자의 삭제는 지운 행을 돌려줌');

\echo '── 격리 (사용자 B) ──'
reset role;
set role authenticated;
set request.jwt.claim.sub = :'B';

select tests.eq((select count(*)::text from public.items), '0', 'B는 A의 아이템을 못 봄');
select tests.eq((select count(*)::text from public.item_images), '0', 'B는 A의 사진을 못 봄');

with deleted as (delete from public.items returning 1)
select tests.eq((select count(*)::text from deleted), '0', 'B는 A의 아이템을 못 지움');

-- RPC도 RLS를 우회하지 못한다. set_item_images는 user_id를 인자로 받지 않고 아이템에서
-- 읽는데, RLS가 그 아이템 자체를 숨기므로 첫 줄에서 걸린다.
select tests.fails(
  $f$select * from public.set_item_images('aaaa0000-0000-0000-0000-000000000001', $j$[
       {"id": "bbbb0000-0000-0000-0000-000000000000"}
     ]$j$::jsonb)$f$,
  '아이템을 찾지 못함', 'B는 A의 사진 목록을 다시 쓸 수 없음');

\echo '── 스토리지 정책 ──'
insert into storage.objects (bucket_id, name)
values ('wardrobe', :'B' || '/item/photo.webp');
select tests.eq((select count(*)::text from storage.objects), '1', 'B는 자기 폴더에 업로드 가능');

select tests.fails(
  format($f$insert into storage.objects (bucket_id, name) values ('wardrobe', %L)$f$,
         :'A' || '/item/steal.webp'),
  'row-level security', 'B는 A의 폴더에 업로드 불가');

-- Blocked by the policy's `with check`, so this errors rather than quietly
-- updating nothing — which is the better outcome: a rename that silently no-ops
-- would look like a bug in the app.
select tests.fails(
  format($f$update storage.objects set name = %L where name like %L$f$,
         :'A' || '/item/moved.webp', :'B' || '%'),
  'row-level security', 'B는 자기 객체를 A 폴더로 옮기지 못함');

\echo '── 버킷 설정 ──'
reset role;
select tests.eq(
  (select public::text from storage.buckets where id = 'wardrobe'),
  'false', 'wardrobe 버킷은 비공개');

select tests.eq(
  (select file_size_limit::text from storage.buckets where id = 'wardrobe'),
  '5242880', '업로드 크기 상한 5MB');

select tests.eq(
  (select array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'wardrobe'),
  'image/webp,image/jpeg', '허용 MIME 타입이 클라이언트 인코딩과 일치');

\echo '── 배열·텍스트 제약 ──'
select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, seasons)
            values (%L, '중복 계절', 'top.knit', array['summer','summer'])$f$, :'A'),
  'items_seasons_distinct', '계절 중복 거부');

select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, colors)
            values (%L, '중복 색', 'top.knit', array['black','black'])$f$, :'A'),
  'items_colors_distinct', '색상 중복 거부');

select tests.fails(
  format($f$insert into public.items (user_id, title, category_id)
            values (%L, repeat('가', 101), 'top.knit')$f$, :'A'),
  'items_title_length', '101자 이름 거부');

select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, tags)
            values (%L, '태그많음', 'top.knit', array(select 't'||g from generate_series(1,21) g))$f$, :'A'),
  'items_tags_limit', '태그 21개 거부');

select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, tags)
            values (%L, '긴 태그', 'top.knit', array[repeat('가', 41)])$f$, :'A'),
  'items_tags_element_length', '41자 태그 원소 거부');

-- The form mirrors this number. Without a named constraint there was nothing to
-- assert, and the client cap drifted to 4.7x the int4 ceiling unnoticed.
select tests.fails(
  format($f$insert into public.items (user_id, title, category_id, price)
            values (%L, '너무 비싼 옷', 'top.knit', 1000000001)$f$, :'A'),
  'items_price_max', '10억원 초과 거부');

\echo '── 함수 노출 ──'
reset role;
select tests.eq(
  (select count(*)::text from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('has_unique_elements', 'max_element_length')),
  '0', 'CHECK 헬퍼는 public 스키마에 없음 — REST로 노출되지 않음');

select tests.eq(
  (select count(*)::text from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname in ('has_unique_elements', 'max_element_length')),
  '2', '헬퍼는 private 스키마에 있음');

-- What actually authorises the helpers is EXECUTE, the same rule as the public
-- RPCs. Schema USAGE is a second layer for direct SQL only: constraint
-- expressions resolve to an OID at definition time, so evaluation never consults
-- the namespace — revoking USAGE from `authenticated` leaves the CHECKs working.
select tests.eq(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and has_function_privilege('anon', p.oid, 'execute')),
  '', 'private 헬퍼도 anon이 실행할 수 없음');

select tests.eq(
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute'))::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'),
  'true', 'authenticated는 헬퍼를 실행할 수 있음 — CHECK 평가에 필요한 유일한 권한');

-- Defence in depth for direct SQL, kept but labelled for what it is.
select tests.eq(
  has_schema_privilege('anon', 'private', 'usage')::text,
  'false', 'anon은 private 스키마 이름을 해석할 수 없음');

-- 003과 005가 만든 두 함수는 set_item_images로 대체되고 지워졌다. 마이그레이션은 파일명
-- 순으로 적용되므로, 여기서 0이 나온다는 것은 그 순서가 실제로 지켜졌다는 뜻이기도 하다.
select tests.eq(
  (select count(*)::text from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('reorder_item_images', 'delete_item_image')),
  '0', '대체된 두 RPC는 스키마에 남아 있지 않음');

-- Scoped by condition, not by name. The previous version named the RPCs of the
-- day explicitly, so one added later would inherit Supabase's default `anon=X`
-- grant and no assertion would notice — the same "test cannot see the
-- regression" shape this suite has now been bitten by three times.
--
-- Deliberately strict: no function in `public` may be anon-executable, trigger
-- helpers included. If an anon-callable RPC is ever wanted, this line has to be
-- changed on purpose.
select tests.eq(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('anon', p.oid, 'execute')),
  '', 'public의 어떤 함수도 anon이 실행할 수 없음');

-- Counted as well as tested: `bool_and` over no rows is NULL, so a renamed or
-- dropped RPC would leave this asserting nothing at all rather than failing.
select tests.eq(
  (select count(*)::text || ' ' || bool_and(has_function_privilege(
     'authenticated', p.oid, 'execute'))::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('set_item_wears', 'set_item_images')),
  '2 true', 'RPC 둘 다 authenticated가 실행할 수 있음');

-- The assertion that actually matters: what an anonymous session gets back.
-- Narrowed to "for function" so losing schema USAGE cannot pass this by
-- accident.
reset role;
set role anon;
select tests.fails(
  $f$select public.set_item_wears(current_date, array[]::uuid[])$f$,
  'permission denied for function', 'anon은 착용 기록 RPC를 호출할 수 없음');
select tests.fails(
  $f$select * from public.set_item_images(
       'aaaa0000-0000-0000-0000-000000000001', '[]'::jsonb)$f$,
  'permission denied for function', 'anon은 사진 목록 재작성 RPC를 호출할 수 없음');
reset role;

set role authenticated;
set request.jwt.claim.sub = :'A';

\echo '── 착용 기록 ──'
insert into public.items (id, user_id, title, category_id)
values ('aaaa0000-0000-0000-0000-000000000004', :'A', '기록용 니트', 'top.knit');

insert into public.item_wears (item_id, user_id, worn_on)
values ('aaaa0000-0000-0000-0000-000000000001', :'A', current_date);

select tests.eq((select count(*)::text from public.item_wears), '1', '착용 기록이 저장됨');

select tests.fails(
  format($f$insert into public.item_wears (item_id, user_id, worn_on)
            values ('aaaa0000-0000-0000-0000-000000000001', %L, current_date)$f$, :'A'),
  'item_wears_item_date_key', '같은 옷을 같은 날 두 번 기록해도 한 행');

-- 하루의 여유는 느슨함이 아니라 시차다. worn_on은 클라이언트의 달력 날짜이고
-- 비교는 UTC 서버에서 도는데, 한국 오전 아홉 시까지는 그 둘이 실제로 하루 다르다.
insert into public.item_wears (item_id, user_id, worn_on)
values ('aaaa0000-0000-0000-0000-000000000004', :'A', current_date + 1);
\echo '  ok  하루 앞선 날짜는 허용 — 클라이언트 로컬 날짜와 UTC 서버의 시차'
delete from public.item_wears where worn_on = current_date + 1;

select tests.fails(
  format($f$insert into public.item_wears (item_id, user_id, worn_on)
            values ('aaaa0000-0000-0000-0000-000000000004', %L, current_date + 2)$f$, :'A'),
  '착용 날짜가 미래예요', '이틀 앞선 날짜 거부');

-- 트리거가 UPDATE에도 걸리는지. INSERT만 막으면 나중에 날짜를 고치는 경로가
-- 생기는 순간 같은 구멍이 다시 열린다.
select tests.fails(
  $f$update public.item_wears set worn_on = current_date + 2
     where item_id = 'aaaa0000-0000-0000-0000-000000000001'$f$,
  '착용 날짜가 미래예요', '미래로 옮기는 수정도 거부');

\echo '── set_item_wears ──'
select public.set_item_wears(current_date, array[
  'aaaa0000-0000-0000-0000-000000000001',
  'aaaa0000-0000-0000-0000-000000000004']::uuid[]);

select tests.eq(
  (select count(*)::text from public.item_wears where worn_on = current_date),
  '2', '고른 두 벌이 오늘로 기록됨 — 이미 있던 한 벌은 중복되지 않음');

-- 제출은 그날의 집합을 다시 말하는 것이다. 빠진 옷은 지우고 새 옷만 넣는다.
select public.set_item_wears(current_date, array[
  'aaaa0000-0000-0000-0000-000000000004']::uuid[]);

select tests.eq(
  (select string_agg(item_id::text, ',') from public.item_wears where worn_on = current_date),
  'aaaa0000-0000-0000-0000-000000000004', '집합에서 빠진 옷은 지워짐');

-- 같은 집합 재제출과 배열 안 중복은 둘 다 호출자가 실수로 보낼 수 있는 모양이고,
-- 유니크 제약까지 가기 전에 접힌다.
select public.set_item_wears(current_date, array[
  'aaaa0000-0000-0000-0000-000000000004',
  'aaaa0000-0000-0000-0000-000000000004']::uuid[]);

select tests.eq(
  (select count(*)::text from public.item_wears where worn_on = current_date),
  '1', '중복 id를 보내도 한 행');

select tests.fails(
  $f$select public.set_item_wears(current_date,
       array['aaaa0000-0000-0000-0000-0000000000ff']::uuid[])$f$,
  'item_wears_item_fk', '존재하지 않는 옷 id는 외래키에서 막힘');

-- 아래 둘은 메시지가 아니라 SQLSTATE를 잰다. 프론트엔드가 이 값 하나로 분기하기
-- 때문이다 — 제출이 23503으로 돌아오면 옷장 캐시가 서버보다 뒤처졌다는 뜻이라
-- 컬렉션을 다시 불러온다(WardrobePage의 submitSelection). 단위 테스트는 자기가 쓴
-- 픽스처만 볼 수 있으므로, 그 값이 실물과 맞는지는 여기서만 확인된다.
select tests.fails_with_sqlstate(
  $f$select public.set_item_wears(current_date,
       array['aaaa0000-0000-0000-0000-0000000000ff']::uuid[])$f$,
  '23503', '없는 옷 id는 23503 — 프론트의 재조회 분기가 이 값에 선다');

-- 그리고 겹치지 않아야 한다. 미래 날짜는 트리거가 raise exception … data_exception
-- 으로 막으므로 22000이고, 23503 분기가 이걸 "옷장이 낡았다"로 오해할 수 없다.
select tests.fails_with_sqlstate(
  format($f$insert into public.item_wears (item_id, user_id, worn_on)
            values ('aaaa0000-0000-0000-0000-000000000004', %L, current_date + 2)$f$, :'A'),
  '22000', '미래 날짜는 23503이 아님 — 두 분기가 겹치지 않음');

-- 하루치를 다시 쓰는 함수가 옆 날짜까지 지우면, 오늘을 기록하는 순간 어제가
-- 날아간다. 빈 배열은 그날만 비워야 한다.
insert into public.item_wears (item_id, user_id, worn_on)
values ('aaaa0000-0000-0000-0000-000000000001', :'A', current_date - 1);

select public.set_item_wears(current_date, array[]::uuid[]);

select tests.eq(
  (select count(*)::text from public.item_wears where worn_on = current_date),
  '0', '빈 배열은 그날 기록을 지움');

select tests.eq(
  (select count(*)::text from public.item_wears where worn_on = current_date - 1),
  '1', '오늘 제출은 어제 기록을 건드리지 않음');

\echo '── 착용 기록 격리 (사용자 B) ──'
reset role;
set role authenticated;
set request.jwt.claim.sub = :'B';

select tests.eq(
  (select count(*)::text from public.item_wears), '0', 'B는 A의 착용 기록을 못 봄');

-- RLS가 아니라 복합 외래키가 막는다. user_id는 B 자신이라 with check는 통과하고,
-- (item_id, user_id) 쌍이 items에 없다는 사실이 남는다 — 정책이 나중에 느슨해져도
-- 유지되는 쪽.
select tests.fails(
  format($f$insert into public.item_wears (item_id, user_id, worn_on)
            values ('aaaa0000-0000-0000-0000-000000000001', %L, current_date)$f$, :'B'),
  'item_wears_item_fk', 'B는 A의 옷에 착용 기록을 붙일 수 없음');

select tests.fails(
  $f$select public.set_item_wears(current_date,
       array['aaaa0000-0000-0000-0000-000000000001']::uuid[])$f$,
  'item_wears_item_fk', 'RPC도 남의 옷을 기록해주지 않음 — user_id는 세션에서 옴');

reset role;
set role authenticated;
set request.jwt.claim.sub = :'A';

\echo '── 인덱스 ──'
select tests.eq(
  (select count(*)::text from pg_indexes
   where tablename = 'item_images' and indexdef like '%(item_id, sort_order)%'),
  '1', '(item_id, sort_order) 인덱스는 하나뿐 — UNIQUE 제약과 중복 없음');

select tests.eq(
  (select count(*)::text from pg_indexes
   where tablename = 'item_wears' and indexdef like '%(item_id, worn_on)%'),
  '1', '(item_id, worn_on) 인덱스는 하나뿐 — UNIQUE 제약과 중복 없음');

\echo '── 캐스케이드 ──'
-- 지우기 전에 지울 것이 있는지부터. 0을 0과 비교하는 캐스케이드 검사는 캐스케이드가
-- 없어도 통과한다.
select tests.eq(
  (select (count(*) > 0)::text from public.item_images), 'true', '삭제 전 사진이 남아 있음');
select tests.eq(
  (select (count(*) > 0)::text from public.item_wears), 'true', '삭제 전 착용 기록이 남아 있음');

delete from public.items;
select tests.eq(
  (select count(*)::text from public.item_images), '0', '아이템 삭제 시 사진 행도 사라짐');
select tests.eq(
  (select count(*)::text from public.item_wears), '0', '아이템 삭제 시 착용 기록도 사라짐');

\echo ''
\echo '모든 검사 통과'
