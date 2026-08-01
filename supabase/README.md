# supabase

mapsy의 데이터베이스 스키마와 스토리지 정책. **이 디렉토리가 스키마의 단일 진실 공급원**이고,
[`../docs/PRD.md`](../docs/PRD.md) §4는 설계 의도를 설명한다.

```
migrations/
├── 20260801000001_init_wardrobe.sql      items · item_images · 인덱스 · RLS
├── 20260801000002_wardrobe_storage.sql   wardrobe 버킷 · 스토리지 정책
└── 20260801000003_item_image_ordering.sql 사진 순서 변경/삭제 RPC
tests/
└── run.sh                                마이그레이션 적용 + 회귀 검사
```

---

## 프로젝트 세팅 체크리스트

마이그레이션으로 안 되는 일이 절반이다. 순서대로 밟으면 된다.

### 1. 프로젝트 생성

[supabase.com/dashboard](https://supabase.com/dashboard) → New project.

- **Region**: 한국에서 쓸 거면 `Northeast Asia (Seoul)` 또는 `(Tokyo)`. 사진 업로드
  왕복이 많아서 리전이 체감된다.
- **Database password**: 어딘가 저장해둘 것. 나중에 조회할 수 없다.
- 무료 플랜 기준 DB 500MB / 스토리지 1GB. PRD 추산으로 500벌이 약 175MB라 여유가 있다.

### 2. 환경변수

Project Settings → **API Keys**에서 두 값을 복사한다.

```bash
cp mapsy-frontend/.env.example mapsy-frontend/.env.local
# VITE_SUPABASE_URL              ← Project URL
# VITE_SUPABASE_PUBLISHABLE_KEY  ← Publishable key (sb_publishable_...)
```

**키 종류를 헷갈리지 말 것.**

| 키 | 접두사 | 용도 |
|---|---|---|
| Publishable | `sb_publishable_` | 브라우저에 넣는 것. 이걸 쓴다 |
| Secret | `sb_secret_` | 서버 전용. **RLS를 통째로 우회한다** |
| ~~anon~~ (레거시 JWT) | `eyJ...` | 아직 동작하지만 2026년 말 deprecated |
| ~~service_role~~ (레거시 JWT) | `eyJ...` | 위와 같음, 그리고 위험 |

Publishable key는 브라우저에 그대로 나가도 되는 값이다 — 로그아웃 상태면 Postgres의
`anon` 역할, 로그인하면 `authenticated` 역할을 부여하고, 실제 보호는 그 위의 RLS가 한다.
레거시 `anon` 키와 동작이 동일해서 정책이나 마이그레이션은 손댈 게 없다.

**`sb_secret_`로 시작하는 키는 절대 `.env.local`에 넣지 않는다.** `VITE_` 접두사가 붙은
값은 전부 클라이언트 번들에 컴파일되어 들어간다.

기존 프로젝트에 레거시 키가 이미 있다면 publishable/secret 키를 만들어도 **둘 다 동시에
동작**하므로 점진적으로 옮기면 된다.

### 3. 마이그레이션 적용

CLI가 필요하다 (`brew install supabase/tap/supabase` 또는 `npx supabase`).

```bash
supabase login
supabase link --project-ref <your-project-ref>   # URL의 서브도메인이 project-ref
supabase db push
```

모든 마이그레이션이 **재실행 가능**하다. 정책과 제약은 `drop ... if exists`, 테이블·인덱스는
`if not exists`, 버킷은 `on conflict do update`로 처리해서 중간에 실패해도 다시 돌리면 된다.
`pnpm test:db`가 마지막에 전체를 한 번 더 적용해 이 성질을 검사한다.

적용 후 Storage 탭에 `wardrobe` 버킷이 **Private**으로 보이면 성공이다.

### 4. Google 로그인

두 군데를 오가야 한다.

**Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com))
1. 프로젝트 생성 → APIs & Services → OAuth consent screen 설정 (External, 본인 이메일만
   테스트 사용자로 추가하면 심사 없이 쓸 수 있다)
2. Credentials → Create OAuth client ID → Web application
3. **Authorized redirect URIs**에 아래를 추가:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
4. Client ID와 Client Secret 복사

**Supabase 대시보드**
5. Authentication → Providers → Google → 활성화 후 위 두 값 입력
6. Authentication → URL Configuration
   - **Site URL**: 배포 주소 (아직 없으면 `http://localhost:5173`)
   - **Redirect URLs**: `http://localhost:5173` 추가. 배포 후 실제 도메인도 추가할 것.

이게 빠지면 로그인 버튼을 눌러도 구글에서 `redirect_uri_mismatch`로 되돌아온다.

### 5. 타입 생성

```bash
pnpm types:gen
```

`mapsy-frontend/src/types/database.ts`에 실제 스키마의 행·삽입 타입이 생성된다. 이 파일은
생성물이니 직접 고치지 않는다. `types/item.ts`는 그대로 남는다 — 그쪽은 앱이 쓰는 도메인
타입(camelCase, 좁혀진 유니온)이고, 둘 사이의 변환은 `features/items/mapRow.ts`가 맡는다.

스키마를 바꿀 때마다 다시 돌려야 컬럼 이름과 nullability가 컴파일 타임에 검증된다.

### 6. 확인

`pnpm dev`로 띄워서 로그인 → 옷 등록 → 그리드에 보이는지 → 상세 → 편집 → 삭제까지
한 번 밟아본다. **이 경로는 자동 테스트가 없다** (아래 참고).

---

## 검증

```bash
pnpm test:db
```

Docker에 Postgres를 띄우고 `auth`/`storage` 스텁을 세운 뒤 **실제 마이그레이션을 적용해**
제약·RLS·스토리지 정책·순서 변경 RPC·함수 노출 범위를 검사한다. 49개 단언이 있고 하나라도 어긋나면
0이 아닌 코드로 끝난다. 마지막에 마이그레이션을 한 번 더 적용해 멱등성도 확인한다.

`supabase start`가 있으면 그쪽이 더 충실하지만, 이 스크립트는 Docker만 있으면 돌아가서
마이그레이션을 건드릴 때마다 부담 없이 실행할 수 있다.

**커버하지 않는 것**: 실제 Auth 흐름, 실제 Storage 업로드, 프론트엔드 네트워크 경로.
이건 위 6단계에서 손으로 확인해야 한다.

---

## 설계상 알아둘 것

### 사진 순서 변경은 반드시 RPC로

`sort_order`는 `between 0 and 4` CHECK로 아이템당 최대 5장을 강제하고,
`(item_id, sort_order)` UNIQUE는 `deferrable initially deferred`다.

**클라이언트에서 `update`를 두 번 부르는 방식은 동작하지 않는다.** PostgREST는 요청 하나당
트랜잭션 하나라 첫 `update`가 단독으로 커밋되면서 UNIQUE를 위반한다. 지연 제약은 *자기*
트랜잭션이 커밋될 때 검사되기 때문이다. 그리고 `99` 같은 임시값을 경유하는 흔한 회피법은
CHECK가 지연될 수 없어서 막힌다.

그래서 두 함수를 둔다. 둘 다 `security invoker`라 RLS가 그대로 적용된다 —
남의 사진은 건드릴 수 없다.

```sql
select reorder_item_images(<item_id>, array[<cover_id>, <second>, ...]::uuid[]);
select delete_item_image(<image_id>);
```

`reorder_item_images`는 **해당 아이템의 모든 이미지 id를 순서대로** 받는다. 개수가 다르거나,
중복 id가 있거나, 다른 아이템의 id가 섞이면 거부하고 **세 경우가 서로 다른 메시지**를 낸다 —
갱신된 행 수를 요청 개수와 비교하기 때문이다. 사진이 없는 아이템에 빈 배열을 넘기는 것은
정상 no-op이다.

`delete_item_image`는 삭제 후 남은 사진을 0..n-1로 재번호해서, 대표(0번)를 지워도 다음
사진이 승격되고 카드가 비지 않는다.

### 팔레트에 색을 추가하는 것은 스키마 변경이다

`items_colors_valid` CHECK가 16색을 열거한다. 의도된 마찰이다 — 색상 필터가 성립하려면 값이
정규화돼 있어야 하고(PRD §5.3), 이 제약이 그 사실을 명시적으로 만든다. 프론트엔드의
`COLOR_IDS`와 짝을 맞춰야 한다.

반면 **카테고리는 그룹 접두사만 검증한다.** 소분류 추가는 흔한 제품 변경이라 마이그레이션을
요구하지 않되, 존재하지 않는 그룹의 `category_id`는 모든 필터에서 조용히 빠지는 쓰레기 값이라
막는다.

### CHECK 헬퍼는 private 스키마에 있다

`has_unique_elements` 같은 헬퍼를 `public`에 두면 PostgREST가 그대로 RPC 엔드포인트로
노출한다. 그렇다고 `revoke execute`를 하면 **CHECK 평가 자체가 permission denied로 깨진다**
— 제약식은 삽입하는 역할의 권한으로 평가되기 때문이다(PG 17에서 확인).

그래서 헬퍼는 `private` 스키마에 둔다. PostgREST가 introspect하지 않으므로 노출되지 않고,
`authenticated`에게 `usage`만 주면 제약은 정상 동작한다.

RPC 두 개(`reorder_item_images`, `delete_item_image`)는 노출돼야 하는 것이 맞지만
`authenticated` 전용이어야 한다. 여기에 함정이 두 겹 있다.

1. Postgres가 기본으로 **PUBLIC**에 EXECUTE를 준다.
2. Supabase가 프로젝트마다
   `alter default privileges in schema public grant all on functions to postgres, anon,
   authenticated, service_role`을 돌려놔서, `public`에 만든 함수는 **명시적 `anon=X`** 를
   달고 태어난다.

`revoke ... from public`은 1번만 지운다. 2번은 `from anon`을 함께 적어야 회수된다 —
실제 프로젝트의 `supabase db dump`로 확인했다. 테스트 하네스(`00_bootstrap.sql`)도 같은
`alter default privileges`를 실행하므로, 이 차이가 로컬에서 드러난다.

### item_images는 복합 외래키를 쓴다

`(item_id, user_id) → items(id, user_id)`이므로 남의 아이템에 사진을 붙이는 것이
구조적으로 불가능하다. RLS 정책이 나중에 잘못 완화되더라도 유지된다.

### 버킷에 크기·타입 제한이 걸려 있다

5MB / `image/webp`, `image/jpeg`. 클라이언트가 항상 장변 1280으로 재인코딩해서 올리므로
이 범위를 벗어나는 건 버그거나 악용이다. 무료 1GB 한도를 지키는 장치이기도 하다 — RLS는
자기 폴더에 올리는 것을 막지 않으니, 한도가 없으면 세션 하나로 버킷을 채울 수 있다.

---

## 아직 안 된 것

- **계정 삭제 시 스토리지 정리.** `auth.users` 삭제는 `items` → `item_images`까지
  캐스케이드되지만 `storage.objects`에는 외래키가 없어 사진이 남는다. `item_images`에
  `after delete` 트리거를 걸거나 Edge Function이 필요하다. 1인용인 동안은 급하지 않지만
  외부에 열기 전엔 해야 한다.
- **서버 사이드 필터링.** PRD §8.4 기준 1,000벌부터. GIN 인덱스는 이미 있어서 쿼리만
  바꾸면 된다.
- **스토리지 용량 알림 기준.**
