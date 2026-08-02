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

\echo '── 순서 변경 RPC ──'
-- The point of the function: two separate UPDATEs would each be their own
-- transaction and the first would trip the unique constraint on commit.
select public.reorder_item_images(
  'aaaa0000-0000-0000-0000-000000000001',
  array[
    'bbbb0000-0000-0000-0000-000000000002',
    'bbbb0000-0000-0000-0000-000000000000',
    'bbbb0000-0000-0000-0000-000000000001',
    'bbbb0000-0000-0000-0000-000000000003',
    'bbbb0000-0000-0000-0000-000000000004'
  ]::uuid[]);

select tests.eq(
  (select string_agg(path, ',' order by sort_order) from public.item_images),
  'p2,p0,p1,p3,p4', '전달한 순서대로 재배치됨');

-- The path assertion above is the real check. A count of distinct sort_orders
-- would be another tautology — the unique constraint guarantees 5 distinct
-- values for 5 rows of one item no matter what the reorder did.

select tests.fails(
  $f$select public.reorder_item_images(
       'aaaa0000-0000-0000-0000-000000000001',
       array['bbbb0000-0000-0000-0000-000000000000']::uuid[])$f$,
  '5 개 중 1 개만 전달됨', '일부만 전달하면 거부 — 구멍이 생김');

-- The count check alone let these through: FOUND is true as soon as one row
-- updates, so a subset was silently applied and reported as success.
select tests.fails(
  $f$select public.reorder_item_images(
       'aaaa0000-0000-0000-0000-000000000001',
       array['bbbb0000-0000-0000-0000-000000000000',
             'bbbb0000-0000-0000-0000-000000000000',
             'bbbb0000-0000-0000-0000-000000000001',
             'bbbb0000-0000-0000-0000-000000000003',
             'bbbb0000-0000-0000-0000-000000000004']::uuid[])$f$,
  '중복된 이미지 id', '중복 id는 개수가 맞아도 거부');

insert into public.items (id, user_id, title, category_id)
values ('aaaa0000-0000-0000-0000-000000000002', :'A', '다른 아이템', 'top.knit');
insert into public.item_images (id, item_id, user_id, path, thumb_path, sort_order)
values ('cccc0000-0000-0000-0000-000000000001',
        'aaaa0000-0000-0000-0000-000000000002', :'A', 'z0', 'z0t', 0);

select tests.fails(
  $f$select public.reorder_item_images(
       'aaaa0000-0000-0000-0000-000000000001',
       array['bbbb0000-0000-0000-0000-000000000000',
             'bbbb0000-0000-0000-0000-000000000001',
             'bbbb0000-0000-0000-0000-000000000002',
             'bbbb0000-0000-0000-0000-000000000003',
             'cccc0000-0000-0000-0000-000000000001']::uuid[])$f$,
  '이 아이템의 이미지임', '다른 아이템의 id가 섞이면 거부 — 중복과 다른 메시지');

-- Same tautology trap: a partially applied reorder still yields 0,1,2,3,4.
-- Only the path order shows that the rejected call rolled back.
select tests.eq(
  (select string_agg(path, ',' order by sort_order)
   from public.item_images where item_id = 'aaaa0000-0000-0000-0000-000000000001'),
  'p2,p0,p1,p3,p4', '거부된 재정렬은 아무것도 바꾸지 않음');

-- A photo-less item reordering to nothing is a legitimate no-op; the previous
-- version raised "대상 이미지를 찾지 못함" here.
insert into public.items (id, user_id, title, category_id)
values ('aaaa0000-0000-0000-0000-000000000003', :'A', '사진 없는 아이템', 'top.knit');
select public.reorder_item_images('aaaa0000-0000-0000-0000-000000000003', array[]::uuid[]);
\echo '  ok  빈 배열은 오류가 아님 (사진 0장 아이템)'

-- RETURNING이 소유자에게 행을 돌려주는지 — 아래 B 케이스의 반대쪽.
--
-- 프론트엔드가 여기에 기댄다. deleteItem은 `.select('id')`로 지운 행을 받아
-- 비어 있으면 실패로 처리하는데, PostgREST가 0행 매치를 에러로 보지 않아서
-- 그렇지 않으면 아무것도 안 지운 삭제가 성공으로 보고되기 때문이다. 정책이
-- `for all` 하나라 DELETE의 RETURNING도 같은 조건으로 SELECT되지만, 나중에
-- 커맨드별 정책으로 쪼개면서 select를 좁히면 **삭제는 되고 예외는 나는** 상태가
-- 된다 — 행은 사라졌는데 스토리지 정리를 건너뛰어 고아 객체가 남는다.
with deleted as (
  delete from public.items where id in (
    'aaaa0000-0000-0000-0000-000000000002',
    'aaaa0000-0000-0000-0000-000000000003')
  returning 1)
select tests.eq((select count(*)::text from deleted), '2', '소유자의 삭제는 지운 행을 돌려줌');

\echo '── 사진 삭제 시 재번호 ──'
select public.delete_item_image('bbbb0000-0000-0000-0000-000000000002');

select tests.eq(
  (select count(*)::text from public.item_images), '4', '한 장 삭제됨');

select tests.eq(
  (select string_agg(sort_order::text, ',' order by sort_order) from public.item_images),
  '0,1,2,3', '삭제 후에도 sort_order가 연속 — 대표 사진 구멍 없음');

select tests.eq(
  (select path from public.item_images where sort_order = 0),
  'p0', '대표를 지우면 다음 사진이 0번으로 승격');

select tests.fails(
  $f$select public.delete_item_image('cccc0000-0000-0000-0000-000000000099')$f$,
  '이미지를 찾지 못함', '없는 이미지 삭제는 오류');

\echo '── 격리 (사용자 B) ──'
reset role;
set role authenticated;
set request.jwt.claim.sub = :'B';

select tests.eq((select count(*)::text from public.items), '0', 'B는 A의 아이템을 못 봄');
select tests.eq((select count(*)::text from public.item_images), '0', 'B는 A의 사진을 못 봄');

with deleted as (delete from public.items returning 1)
select tests.eq((select count(*)::text from deleted), '0', 'B는 A의 아이템을 못 지움');

select tests.fails(
  $f$select public.reorder_item_images(
       'aaaa0000-0000-0000-0000-000000000001',
       array['bbbb0000-0000-0000-0000-000000000000']::uuid[])$f$,
  '0 개 중 1 개만 전달됨', 'RPC도 RLS를 우회하지 못함 — B에게는 사진이 0장');

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

-- Scoped by condition, not by name. The previous version listed
-- ('reorder_item_images', 'delete_item_image') explicitly, so a third RPC added
-- later would inherit Supabase's default `anon=X` grant and no assertion would
-- notice — the same "test cannot see the regression" shape this suite has now
-- been bitten by three times.
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

select tests.eq(
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute'))::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('reorder_item_images', 'delete_item_image')),
  'true', 'RPC는 authenticated가 실행할 수 있음');

-- The assertion that actually matters: what an anonymous session gets back.
-- Narrowed to "for function" so losing schema USAGE cannot pass this by
-- accident.
reset role;
set role anon;
select tests.fails(
  $f$select public.reorder_item_images('aaaa0000-0000-0000-0000-000000000001', array[]::uuid[])$f$,
  'permission denied for function', 'anon은 순서 변경 RPC를 호출할 수 없음');
select tests.fails(
  $f$select public.delete_item_image('bbbb0000-0000-0000-0000-000000000000')$f$,
  'permission denied for function', 'anon은 사진 삭제 RPC를 호출할 수 없음');
reset role;

set role authenticated;
set request.jwt.claim.sub = :'A';

\echo '── 인덱스 ──'
select tests.eq(
  (select count(*)::text from pg_indexes
   where tablename = 'item_images' and indexdef like '%(item_id, sort_order)%'),
  '1', '(item_id, sort_order) 인덱스는 하나뿐 — UNIQUE 제약과 중복 없음');

\echo '── 캐스케이드 ──'
delete from public.items;
select tests.eq(
  (select count(*)::text from public.item_images), '0', '아이템 삭제 시 사진 행도 사라짐');

\echo ''
\echo '모든 검사 통과'
