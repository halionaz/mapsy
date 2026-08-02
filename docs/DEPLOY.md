# 배포 — Cloudflare Workers

`mapsy-frontend`를 Workers의 **정적 자산(Static Assets)** 으로 배포한다. 빌드 결과물이 정적
파일뿐이고 백엔드는 전부 Supabase이므로, Worker 스크립트 없이 자산만 올리는 **assets-only
Worker**다 — `wrangler.jsonc`에 `main`이 없고 요청은 엣지에서 바로 응답되어 호출 과금이 없다.
나중에 서버 로직이 필요하면 `main`을 추가하면 된다.

설정은 저장소에 있다 (`mapsy-frontend/wrangler.jsonc`, `mapsy-frontend/public/_headers`).
남은 건 계정 연결과 환경변수 — §3~§5.

## 명령

루트에서 실행한다.

| 명령 | 설명 |
|---|---|
| `pnpm cf:dev` | Workers 런타임으로 로컬 확인 |
| `pnpm cf:deploy` | 프로덕션 배포 |
| `pnpm cf:upload` | 프리뷰 버전만 업로드 (프로덕션 미변경) |

`pnpm preview`(Vite)로는 배포 형태를 검증할 수 없다 — Vite preview 서버는 SPA 폴백을 알아서
해주기 때문에 폴백 설정이 없어도 돌아가는 것처럼 보인다.

> 스크립트 이름이 `cf:` 프리픽스인 이유: `pnpm deploy`는 pnpm 내장 명령이라 같은 이름의
> 스크립트를 가린다.

## 1. `wrangler.jsonc`

```jsonc
{
  "name": "mapsy",
  "compatibility_date": "2026-08-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  },
  "workers_dev": true,
  "preview_urls": true,
  "observability": { "enabled": true }
}
```

`name`은 **대시보드의 Worker 이름과 정확히 일치해야 한다** — 어긋나면 Git 연동 빌드가 실패한다.

`not_found_handling`이 없는 경로에 `index.html`을 200으로 준다. `BrowserRouter`가 URL만 바꾸는
구조라 `/items/123`을 직접 열거나 새로고침할 때 이게 없으면 404다. **서비스워커가 있어도
필요하다** — 워크박스의 `navigateFallback`은 서비스워커 설치 *이후*의 탐색만 가로챈다.

## 2. `_headers`

Cloudflare 기본값은 모든 자산에 `public, max-age=0, must-revalidate`다. 이름이 그대로인 채
내용이 바뀌는 파일(`index.html`, `sw.js`)에는 이게 맞고, 해시가 붙은 `/assets/*`·`/workbox-*`만
`immutable`로 올린다.

**`/*`에 `Cache-Control`을 넣지 마라.** `index.html`·`sw.js`가 같이 묶여 `registerType:
'autoUpdate'` 서비스워커가 그 기간만큼 멈춘다.

## 3. 환경변수 — 빌드 타임에만 존재한다

`VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`는 `vite build` 시점에 번들로 치환된다.

- ✅ 빌드 환경변수 — 로컬 `.env.local`, CI는 Workers Builds의 **build variables**
- ❌ `wrangler.jsonc`의 `vars`, `wrangler secret` — Worker 런타임용이라 무의미하다

publishable key가 번들에 들어가는 건 정상이다(RLS가 접근을 통제한다). **`sb_secret_...`은 절대
들어가면 안 된다.**

> ⚠️ **환경변수를 빠뜨려도 빌드는 성공한다.** 그리고 배포된 앱은 `AppLayout`이 `unconfigured`로
> 판단해 **로그인 없이 전체 화면을 열어준다.** 상단 "Supabase 미설정 — 미리보기 모드" 배너가
> 유일한 신호다. 배포 후 §6 체크리스트로 반드시 확인한다.

## 4. 배포

### 수동

```bash
pnpm --filter mapsy-frontend exec wrangler login
pnpm build                                              # .env.local 확인 후
pnpm --filter mapsy-frontend exec wrangler deploy --dry-run
pnpm cf:deploy
```

CI가 아닌 스크립트에서는 `CLOUDFLARE_API_TOKEN`(Workers Scripts: Edit) + `CLOUDFLARE_ACCOUNT_ID`.

### Workers Builds (Git 연동)

대시보드 → Worker → **Settings → Builds**.

| 설정 | 값 |
|---|---|
| Root directory | `mapsy-frontend` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Deploy command | `pnpm exec wrangler deploy` |
| Non-production branch | `pnpm exec wrangler versions upload` |

`npx` 대신 `pnpm exec`를 쓴다 — `npx`는 로컬에 없으면 레지스트리에서 새로 받아 devDependency로
고정한 의미가 사라진다. install을 build command에 직접 쓰는 이유는 `prepare` 훅이
`panda codegen`을 돌려 gitignore된 `styled-system/`을 만들기 때문이다.

**빌드 변수** (런타임 변수 아님):

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `PNPM_VERSION` | `10.18.2` (이미지 기본값은 10.11.x) |

Node는 이미지 기본값이 24라 그대로 두면 된다. 22로 고정하려면 **22.22.0 이상** —
`react-router@8.3.0`이 요구하고 pnpm은 경고하지 않는다.

> ⚠️ **`wrangler.jsonc`가 대상 브랜치에 올라가 있어야 한다.** 설정을 못 찾으면 wrangler가
> 자동 설정 모드로 들어가 `@cloudflare/vite-plugin`을 설치하고 자기 설정을 만든 뒤 빌드를 한 번
> 더 돌린다. 빌드는 "성공"하지만 `_headers`가 통째로 빠진다. 로그에 `Create wrangler.jsonc:`가
> 보이면 이 상태다.

브랜치 프리뷰 URL은 **공개되고 프로덕션과 같은 Supabase 프로젝트를 본다.** 막으려면 Cloudflare
Access를 걸거나 `preview_urls: false`.

## 5. Supabase 설정

**배포 후 반드시.** 안 하면 로그인이 프로덕션에서만 실패한다. `LoginPage`가
`redirectTo: window.location.origin`으로 OAuth를 시작하므로 배포 오리진이 허용 목록에 있어야
한다.

Supabase → **Authentication → URL Configuration**:

| 항목 | 값 |
|---|---|
| Site URL | `https://mapsy.example.com` |
| Redirect URLs | `https://mapsy.example.com/**` |

Google Cloud Console은 건드릴 필요 없다 — 등록된 redirect URI는 Supabase 콜백이라 배포 도메인과
무관하다.

## 6. 배포 후 확인

```bash
BASE=https://mapsy.example.com
ASSET=$(curl -s "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1)

curl -sI "$BASE/items/does-not-exist" | head -n 3          # 200 + index.html
curl -sI "$BASE$ASSET" | grep -iE 'content-type|cache-control'  # javascript + immutable
curl -sI "$BASE/sw.js" | grep -i cache-control             # max-age=0, must-revalidate
```

`content-type`을 같이 보는 이유는 §7이다 — 경로를 오타내도 폴백이 200을 줘서 "성공"처럼 보인다.

브라우저에서:

- [ ] **"Supabase 미설정 — 미리보기 모드" 배너가 없다** (있으면 §3의 환경변수 누락)
- [ ] Google 로그인 왕복 성공, 원래 열려던 경로로 복귀
- [ ] `/items/<실제 id>` 직접 입력 후 새로고침 → 상세 화면
- [ ] 옷 등록 → 사진 업로드 → 목록 반영
- [ ] 새 버전 배포 후 다시 열면 갱신

## 7. 알아둘 것

**존재하지 않는 해시 자산이 HTML로 굳는다.** 폴백이 `/assets/index-typo.js`에도 `index.html`을
주는데 `Cache-Control`은 요청 경로로 매치되므로 그 HTML이 `immutable`로 1년 박힌다. 서비스워커가
그걸 물면 precache에 승격되거나(조용함) `importScripts`가 실패해 워커가 껍데기가 된다.

- **`/assets/*`·`/workbox-*` 경로를 브라우저 주소창에 손으로 치지 마라.** 진단은 `curl`로 한다
  (`curl`은 캐시를 남기지 않는다).
- 지어낸 오타는 어떤 빌드도 그 이름을 안 내놓으니 무해하다. 위험한 건 **옛 배포의 실제 해시**로,
  §8 롤백이 그 이름을 되살린다.
- 지금은 코드 스플리팅이 없어(청크 1개) 노출면이 좁다. **라우트 단위 `React.lazy`를 넣으면
  상시 위험이 된다** — 그때 `_headers`를 먼저 손봐야 한다.
- 설정만으로는 못 고친다. `not_found_handling`을 `"404-page"`/`"none"`으로 바꾸면 딥링크가 죽고,
  `_redirects`로 폴백을 재구성하려면 라우트를 열거해 동기화해야 하며 `path="*"`를 잃는다. 경로를
  갈라 판단하려면 `main`이 필요하다(자산 요청은 여전히 Worker를 안 거치므로, 비용은 딥링크
  내비게이션 수만큼이다).
- 복구는 unregister + Storage 삭제. `workbox-<hash>.js` 쪽은 `vite-plugin-pwa`를 올려 해시를
  바꾸거나 `workbox: { inlineWorkboxRuntime: true }`로 그 URL을 아예 없앨 수 있다.

**`_headers` 규칙이 안 먹는 것 같을 때.** `pnpm cf:dev` 기동 로그가 `✨ Parsed 3 valid header
rules.`와 깨진 규칙의 사유·줄번호를 찍는다. `wrangler deploy --dry-run`은 헤더에 대해 아무것도
찍지 않아 사전 검증에 못 쓴다. 규칙 발동 여부는 **접두사를 깨뜨린** 대조군으로 본다
(`workbox-` → `workbo-`) — 접두사를 남긴 채 해시만 바꾸면 규칙에 그대로 걸린다.

**로컬과 프로덕션의 차이 하나.** `_headers` 매칭은 일치하지만, `index.html`이 본문으로 나가는
응답에 프로덕션은 ETag를 안 붙이고 `wrangler dev`는 붙인다.

## 8. 롤백

```bash
pnpm --filter mapsy-frontend exec wrangler rollback
```

인자 없이 실행하면 최근 100개 버전 중에서 고른다. 정적 자산도 버전에 포함되므로 그 시점의
번들이 그대로 돌아온다. 단, 이전 서비스워커를 설치한 사용자는 다음 방문 때 갱신되므로 한 번은
옛 버전을 볼 수 있고, 스키마 변경을 동반한 배포는 마이그레이션을 먼저 되돌려야 한다.

## 커스텀 도메인

네임서버가 Cloudflare를 가리키면 `wrangler.jsonc`에 추가한다.

```jsonc
"routes": [{ "pattern": "mapsy.example.com", "custom_domain": true }]
```

붙인 뒤엔 `workers_dev: false`로 닫는 게 좋다 — 중복 오리진은 OAuth 허용 목록과 PWA 설치
대상이 갈리는 원인이다.

## 남은 일

- **CI 없음.** Workers Builds가 `tsc -b`를 돌려 타입 에러는 막지만 `pnpm lint`·`pnpm test`는
  아무도 돌리지 않는다.
- **스테이징 없음.** 브랜치 프리뷰가 프로덕션과 같은 Supabase 프로젝트를 본다.
