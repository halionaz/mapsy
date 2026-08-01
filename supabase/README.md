# supabase

mapsy의 데이터베이스 스키마와 스토리지 정책. **이 디렉토리가 스키마의 단일 진실 공급원**이고,
[`../docs/PRD.md`](../docs/PRD.md) §4는 설계 의도를 설명한다.

```
migrations/
├── 20260801000001_init_wardrobe.sql   items · item_images · 인덱스 · RLS
└── 20260801000002_wardrobe_storage.sql  wardrobe 버킷 · 스토리지 정책
```

## 적용

Supabase CLI가 필요하다 (`brew install supabase/tap/supabase` 또는 `npx supabase`).

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

두 마이그레이션 모두 **재실행 가능**하다. 정책은 `drop policy if exists`로, 테이블·인덱스는
`if not exists`로, 버킷은 `on conflict do nothing`으로 처리해서 중간에 실패해도 그냥 다시
돌리면 된다.

## 인증 설정 (마이그레이션으로 안 되는 것)

Google 로그인은 대시보드에서 켜야 한다 — Authentication → Providers → Google에 OAuth
클라이언트 ID/시크릿을 넣고, 승인된 리디렉션 URI에 Supabase가 알려주는 콜백 URL을 등록한다.
로컬 개발용으로는 Authentication → URL Configuration의 Redirect URLs에 `http://localhost:5173`도
추가해야 한다.

## 설계상 알아둘 것

**사진 순서 변경은 임시값을 거치면 안 된다.** `sort_order`는 `between 0 and 4` CHECK로 아이템당
최대 5장을 강제하는데, Postgres의 CHECK는 지연될 수 없어서 `99` 같은 임시 자리표시자를
경유하는 흔한 스왑 방식이 즉시 실패한다. 대신 `(item_id, sort_order)` UNIQUE를
`deferrable initially deferred`로 걸어놨으므로 **한 트랜잭션 안에서 값을 곧바로 맞바꾸면 된다.**

```sql
begin;
  update item_images set sort_order = 1 where id = <A>;  -- 잠시 1이 둘
  update item_images set sort_order = 0 where id = <B>;
commit;                                                   -- 여기서 UNIQUE 검사
```

**팔레트에 색을 추가하는 것은 스키마 변경이다.** `items_colors_valid` CHECK가 16색을 열거하고
있어서, 색 추가는 새 마이그레이션을 요구한다. 의도된 마찰이다 — 색상 필터가 성립하려면 값이
정규화돼 있어야 하고(PRD §5.3), 이 제약이 그 사실을 명시적으로 만든다.
프론트엔드의 `COLOR_IDS`와 짝을 맞춰야 한다.

반면 **카테고리는 그룹 접두사만 검증한다.** 소분류 추가는 흔한 제품 변경이라 마이그레이션을
요구하지 않되, 존재하지 않는 그룹의 `category_id`는 모든 필터에서 조용히 빠지는 쓰레기 값이라
막는다.

**`item_images`는 복합 외래키를 쓴다.** `(item_id, user_id) → items(id, user_id)`이므로 남의
아이템에 사진을 붙이는 것이 구조적으로 불가능하다. RLS 정책이 나중에 잘못 완화되더라도 유지된다.

## 검증 방법

로컬 Postgres 컨테이너에 Supabase 스텁(`auth.users`, `auth.uid()`, `storage.objects`,
`storage.foldername()`)을 세우고 마이그레이션을 적용해 제약과 RLS를 직접 시험할 수 있다.
`supabase start`가 있으면 그쪽이 더 충실하다.
