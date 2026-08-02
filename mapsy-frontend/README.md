# mapsy-frontend

mapsy 내 옷장의 프론트엔드. Vite + React + TypeScript SPA이며 PWA로 설치된다.

전체 스펙은 [`../docs/PRD.md`](../docs/PRD.md), 배포 절차는
[`../docs/DEPLOY.md`](../docs/DEPLOY.md)를 참고.

## 시작하기

```bash
# 저장소 루트에서
pnpm install          # prepare 훅이 panda codegen까지 돌림

cp mapsy-frontend/.env.example mapsy-frontend/.env.local
# Supabase 대시보드(Project Settings → API Keys)에서 값을 채운다

pnpm dev
```

`.env.local` 없이도 앱은 뜬다. 인증 게이트가 이 경우를 **미리보기 모드**로 취급해
로그인을 요구하지 않고, 상단에 배너로 알려준다. Supabase 프로젝트를 만들기 전에도
UI를 그대로 만들 수 있다.

환경변수가 있으면 게이트가 정상 동작한다 — 미인증 방문자는 `/login`으로 보내지고,
로그인 후엔 원래 열려던 경로로 돌아온다.

## 스크립트

저장소 루트에서 실행하면 이 패키지로 전달된다.

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 타입 체크 후 프로덕션 빌드 |
| `pnpm preview` | 빌드 결과 미리보기 |
| `pnpm typecheck` | `tsc -b` |
| `pnpm codegen` | Panda CSS 재생성 |
| `pnpm lint` | oxlint |
| `pnpm test` | vitest (순수 로직) |
| `pnpm types:gen` | Supabase 스키마에서 DB 타입 재생성 |
| `pnpm cf:dev` | Cloudflare Workers 런타임(`wrangler dev`)으로 확인 |
| `pnpm cf:deploy` | Cloudflare Workers 배포 |

## 구조

[Feature-Sliced Design](https://feature-sliced.design)을 따른다.

```
src/
├── app/            앱 전역 — 라우트 테이블, 프로바이더, 레이아웃 셸 겸 인증 게이트
│   ├── providers/    QueryClient · BrowserRouter
│   └── layouts/      AppLayout
├── pages/          라우트 하나 = 슬라이스 하나
│   ├── wardrobe/ item-detail/ item-new/ item-edit/ login/ settings/
├── entities/       도메인 객체 — 그 객체를 읽고 쓰는 일 전부
│   └── item/
│       ├── api/      Supabase 호출 · DB 행 ↔ 도메인 변환(mapRow)
│       ├── model/    도메인 타입 · 쿼리/뮤테이션 훅 · 쿼리 키 · 업로드 대기열
│       └── ui/       ItemCard
├── features/       엔티티 하나로 안 떨어지는 사용자 동작
│   ├── auth/           세션 상태 · 구글 로그인
│   ├── item-form/      등록·편집 폼과 사진 선택
│   ├── item-photos/    원본 사진 서명(useItemPhotos) · 뷰어 · 팬/줌 기하
│   └── wardrobe-filter/  필터 모델 + applyFilters (순수)
└── shared/
    ├── api/        supabase 클라이언트 · storage · DB 생성 타입
    ├── config/     카테고리·색상·사이즈·핏·계절 프리셋 (PRD §5)
    ├── lib/        이미지 처리 · 초성 검색 · 포맷 · 유틸
    └── ui/         공용 컴포넌트
```

**엔티티가 자기 CRUD를 갖는다.** `useSetFavorite`도 `useDeleteItem`도
`entities/item`에 있다 — 사용자 동작이지만 옷 하나를 읽고 쓰는 것 이상이 아니고,
훅 하나짜리 슬라이스를 네 개 만드는 편이 더 나쁘다. `features/`로 올라가는 건
**여러 엔티티를 엮거나 엔티티에 속하지 않는** 동작이다: 로그인, 폼, 필터, 사진 뷰어.

**세그먼트가 곧 관심사다.** 슬라이스 안에서 `api/`는 바깥과 말하는 코드, `model/`은 상태와
도메인 규칙, `lib/`는 순수 로직, `ui/`는 그리는 코드다. 어디에 넣을지 애매하면 "이게 없으면
무엇이 안 되나"로 정한다.

**슬라이스 밖에서는 `index.ts`만 본다.** `@/entities/item`은 되고
`@/entities/item/model/queries`는 안 된다 — 그래야 내부 배치를 호출부를 건드리지 않고 바꿀 수
있고, 공개할 생각이 없던 것(`fetchWardrobe`, `mapRow`)이 새어나가지 않는다. `shared/`는
슬라이스가 없으므로 파일을 직접 가리킨다 (`@/shared/lib/format`).

**슬라이스는 `슬라이스/세그먼트/파일` 3단계로 평평하게 유지한다.** 파일이 커지면 폴더를 하나 더
파지 말고 같은 세그먼트 안에서 나눈다 — `ui/PhotoViewer/Zoom.tsx`가 아니라
`ui/PhotoViewerZoom.tsx`다. lint가 이걸 강제하고 있다: `../../`가 금지라 세그먼트 아래로 한
단계만 들어가도 형제 세그먼트에 닿을 방법이 없어진다(별칭 경로는 동일 층 규칙이 막고, 상대
경로는 이 규칙이 막는다). `no-restricted-imports`로는 "같은 슬라이스 안이면 허용"을 표현할 수
없어서 생기는 제약이고, FSD가 권하는 모양이기도 하다.

**의존 방향은 아래로만.** `app → pages → features → entities → shared`. 같은 층의 슬라이스끼리도
서로 import하지 않는다 — 화면에서 조합한다.

**이 세 규칙은 문서가 아니라 lint가 강제한다.** `.oxlintrc.json`의 `no-restricted-imports`가
딥 임포트·상향 의존·동일 층 임포트를 전부 잡는다. 오버라이드 글롭이 `src/shared/**`가 아니라
`**/shared/**`인 것이 중요하다 — 전자는 **아무 파일도 매칭하지 못해 규칙이 조용히 죽고**,
lint는 통과한다.

**lint가 보는 것은 import 방향뿐이다.** 그래서 lint 메시지에는 lint가 실제로 잡는 것만 적는다 —
강제되지 않는 약속을 강제 장치 안에 적어두면, 그 약속이 깨졌을 때 아무 신호도 안 난다.

### shared에 도메인이 있는 것

`shared/config/`에 카테고리·색상·사이즈·계절 프리셋이, `shared/lib/errorMessage.ts`에 제약
이름 → 한국어 문구가 있다. `entities/item/model/types.ts`는 `SubcategoryId`·`ColorId`를
거기서 가져온다. 즉 **"옷이 무엇인가"의 어휘가 최하층에 있다.** 원래 FSD대로면 엔티티에 있어야
한다.

의도된 절충이다. 이 프리셋들은 entities·features·pages 세 층이 고르게 쓰는 어휘이고,
`entities/item`으로 내리면 `ColorSwatch` 같은 공용 컴포넌트가 엔티티에 갇힌다. 그래서 선은
어휘가 아니라 **동작**에 긋는다 — `shared`는 도메인 값을 알아도 되지만 도메인 일을 하지는
않는다. 쿼리 키를 `shared`에서 걷어낸 것도 이 선 때문이 아니라, **키가 캐시 주소라 페처와 같은
자리에 있어야 하기 때문**이다.

## 데이터

**서버에서 오는 것은 전부 react-query를 통한다.** 컴포넌트에 `useEffect` + `useState`로 짠
페치가 있으면 그건 아직 옮기지 않은 것이다 — 경합 취소, 재시도, 캐시를 손으로 다시 만들게 된다.

**쿼리 키는 페처를 소유한 슬라이스가 갖는다** — 옷장은
[`entities/item/model/queryKeys.ts`](src/entities/item/model/queryKeys.ts), 서명 URL은
`signPaths` 바로 옆인 [`shared/api/storage.ts`](src/shared/api/storage.ts). 호출부에 직접 적지
않는 이유는, 옷장 항목 하나를 뮤테이션 다섯 개가 패치·취소·무효화하는데 그중 하나만 키가
어긋나도 `setQueryData`가 아무도 읽지 않는 항목에 조용히 쓰고 **에러를 내지 않기** 때문이다.
`wardrobeKeys`에서 `all`은 접두사(취소·무효화용), `list()`는 정확한 키
(`setQueryData`/`getQueryData`용)다 — 둘을 바꿔 쓰면 조용히 어긋난다.

전역 레지스트리를 두지 않는 이유는 **키가 캐시 주소라서**다. 주소는 그 자리를 채우는 코드 옆에
있어야 하고, 레지스트리는 둘을 import 하나만큼 떼어놓으면서 얻는 게 없다 — 막으려던 드리프트는
키 파일과 그 옆 뮤테이션들 사이의 것이고, 그 둘은 어느 쪽이든 이웃이다.

**캐시 기본값을 그냥 물려받지 않는다.** 서명 URL 쿼리는 `staleTime`을 URL 수명에 맞춰 따로
잡는다 — 목록용 30분을 그대로 쓰면 30분마다 재서명되고, `<img src>`가 전부 바뀌어 원본
사진을 다시 받는다. 브라우저는 토큰까지 포함한 URL 전체로 캐시하므로 같은 객체라도 새 URL은
새 요청이다. **그리드 썸네일에는 이 비용이 아직 남아 있다** — 아래 참고.

옷장은 한 번 받아 클라이언트에서 거른다(PRD §8.4). 캐시 항목이 하나뿐이라 뮤테이션은
**무효화 대신 그 항목을 직접 패치한다** — 즐겨찾기 별 하나 누를 때마다 전량 refetch가 돌면
커버 URL이 전부 다시 서명되고 그리드의 모든 썸네일이 다시 로드된다. 이유는
[`entities/item/model/queries.ts`](src/entities/item/model/queries.ts) 주석에 있다.

## 테스트 범위

**결정이 들어있는 로직은 순수 함수로 분리해 테스트한다** — 초성 검색, 필터·정렬, DB 행 매핑,
이미지 리사이즈/크롭 기하. 이 부분은 Supabase 없이 돌아가고 실제로 검증돼 있다.

**예외가 하나 있다: `useItemPhotos`.** 순수 함수로 안 떨어지는데(캐시·리렌더가 곧 동작이다)
`photoSlots`가 자기 주석에서 "이 규칙을 양방향으로 두 번 틀렸다"고 적고 있고, 틀렸던 그 URL을
만드는 쪽이 이 훅이다. 그래서 여기만 `@testing-library/react` + jsdom으로 테스트한다 — 파일
맨 위 `@vitest-environment jsdom` 주석으로 그 파일만 jsdom을 쓰고, 나머지는 node 그대로다.

**네트워크 경로(`entities/item/api`, `entities/item/model/queries.ts`)와 화면은 자동 테스트가
없다.** 다만 행/삽입 타입은 `src/shared/api/database.types.ts`(실제 스키마에서 생성)에서 오므로
컬럼 이름과 nullability는 컴파일 타임에 검증된다. 나머지는 손으로 밟아봐야 한다 —
등록 → 조회 → 편집 → 삭제.

스키마를 바꾸면 `pnpm types:gen`으로 타입을 다시 생성한다. `src/shared/api/database.types.ts`는
생성물이니 직접 고치지 않는다.

## 스타일링

Panda CSS를 쓴다. **`styled-system/`은 생성물이라 커밋하지 않고 직접 수정하지 않는다.**
`panda.config.ts`를 바꾸면 `pnpm codegen`을 다시 돌려야 토큰과 레시피가 반영된다.

규약과 문서 라우팅은 [`../.claude/skills/panda-css/`](../.claude/skills/panda-css/SKILL.md)에
정리되어 있다. Panda는 빌드타임 추출기라 잘못된 형태로 쓰면 **에러 없이 CSS만 조용히
누락되므로**, 레시피·패턴·조건·토큰을 건드릴 땐 기억에 의존하지 말고 스킬의 라우팅 테이블을
따라 최신 문서를 확인할 것.

## 아직 없는 것

- **필터 바텀시트.** 검색·카테고리 칩·정렬은 붙었지만 색상·사이즈·계절·브랜드·태그를 고르는
  시트가 없다. `applyFilters`는 이미 모든 축을 처리하므로 UI만 얹으면 된다.
- **편집 화면에서 사진 교체·순서 변경 불가 — UI만 없다.** DB 함수
  (`reorder_item_images`, `delete_item_image`)와 클라이언트 래퍼
  (`reorderItemImages`, `deleteItemImage` — `@/entities/item`에서 export)는 있고
  `pnpm test:db`가 검증한다. 화면에서 아직 호출하지 않을 뿐이라 그 두 export는 의도적으로
  미사용 상태다. 업로드·삭제·`sort_order`를 조정해야 해서 등록 흐름의 변형이 아니라 별도
  작업이다.
- **그리드 커버 썸네일이 30분마다 다시 내려온다.** `fetchWardrobe`가 실행될 때마다 커버를 전부
  새로 서명하는데, `useWardrobe`는 전역 기본값(staleTime 30분 + `refetchOnWindowFocus`)을
  쓴다. 상세 화면 원본에서 고친 것과 같은 낭비지만, 같은 방법으로는 못 고친다 — 이 쿼리의
  `staleTime`은 URL 수명뿐 아니라 **행 신선도**(다른 기기에서 추가된 옷)도 겸하고 있어서
  3.5시간으로 올릴 수 없다. 제대로 하려면 커버 서명을 별도 쿼리로 떼고 행 데이터는 30분에
  둬야 한다. 원본보다는 싸고(썸네일 400px) `SquarePhoto`가 `loading="lazy"`라 화면 밖은
  유예되므로 급하지 않다.
- 로그아웃 (설정 화면이 스텁)
- **PWA 아이콘이 SVG 하나뿐.** `manifest.icons`가 SVG라 Android 설치 배너 조건을 못 채울 수
  있고, iOS는 SVG `apple-touch-icon`을 무시하므로 아예 링크를 걸지 않았다. 192·512 PNG와
  maskable, 180 PNG(apple-touch-icon)가 필요하다.
- 포매터·CI 없음. 코드 스타일(세미콜론 없음, 싱글쿼트)이 균일하지만 강제하는 게 없다.
- 라우트 코드 스플리팅과 에러 바운더리 없음
