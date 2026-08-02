# 배포 — Cloudflare Workers

`mapsy-frontend`를 Cloudflare Workers의 **정적 자산(Static Assets)** 으로 배포한다.

빌드 결과물은 `mapsy-frontend/dist`의 정적 파일뿐이고 서버 코드가 없다. 백엔드는 전부
Supabase가 맡으므로(PRD §8.3) Worker 스크립트 없이 자산만 올리는 **assets-only Worker**가
맞는 형태다. `wrangler.jsonc`에 `main`이 없고, 요청은 Worker를 거치지 않고 엣지에서
바로 파일로 응답한다 — 호출 과금도 발생하지 않는다.

> Cloudflare Pages가 아니라 Workers를 쓴다. 신규 프로젝트는 Workers Static Assets이
> 권장 경로이고, 나중에 서버 로직이 필요해지면 같은 Worker에 `main`을 추가하는 것으로
> 끝난다. Pages였다면 이전이 필요하다.

## 저장소에 이미 있는 것

| 파일 | 역할 |
|---|---|
| `mapsy-frontend/wrangler.jsonc` | Worker 이름·자산 디렉토리·SPA 폴백 (§2, §3) |
| `mapsy-frontend/public/_headers` | 캐시·보안 헤더 (§4) |
| `mapsy-frontend/package.json` | `wrangler` devDependency와 `deploy` 스크립트 |

**남은 일은 §5~§9다** — 환경변수, Cloudflare 계정 연결, Supabase 허용 목록. 이 셋은
저장소에 커밋할 수 없는 값이라 각자 설정해야 한다.

---

## 0. 준비물

| 항목 | 비고 |
|---|---|
| Cloudflare 계정 | 무료 플랜으로 충분하다 |
| Supabase 프로젝트 | URL과 publishable key가 필요하다 |
| Node ≥ 22.22.0 | `react-router@8.3.0`이 요구한다. 22.20이면 빌드는 되지만 경고가 뜬다 |
| pnpm 10.18.2 | `corepack enable`로 맞춘다 |

---

## 1. 명령

루트에서 실행한다.

| 명령 | 설명 |
|---|---|
| `pnpm cf:dev` | **Workers 런타임으로** 로컬 확인 (`wrangler dev`) |
| `pnpm cf:deploy` | 프로덕션 배포 |
| `pnpm cf:upload` | 프로덕션을 건드리지 않고 프리뷰 버전만 업로드 |

`pnpm preview`(Vite)와 `pnpm cf:dev`(wrangler)는 다르다. **Vite의 preview 서버는
SPA 폴백을 알아서 해주기 때문에, 폴백 설정이 없어도 잘 돌아가는 것처럼 보인다.**
배포 형태를 실제로 검증하려면 `cf:dev`를 써야 한다.

> **왜 `deploy`가 아니라 `cf:deploy`인가.** `pnpm deploy`는 pnpm의 **내장 명령**이다
> (워크스페이스 패키지를 디렉토리로 떠내는 기능). 같은 이름의 스크립트를 정의해도 내장
> 명령이 이기므로 `pnpm deploy`는 배포를 하지 않는다. `pnpm run deploy`로는 되지만,
> 이 저장소의 다른 명령들과 호출 방식이 달라지는 편이 더 위험하다.

wrangler는 전역이 아니라 `mapsy-frontend`의 devDependency다. 전역 설치는 사람마다 버전이
갈리고, Workers Builds도 `package.json`에 적힌 wrangler 버전을 그대로 쓴다.

---

## 2. `wrangler.jsonc`

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

`name`은 **Cloudflare 대시보드의 Worker 이름과 정확히 일치해야 한다.** Git 연동
빌드에서 이름이 어긋나면 빌드가 실패한다.

`assets.binding`은 넣지 않았다. 그건 Worker 코드에서 자산을 `env.ASSETS.fetch()`로
읽을 때 필요한 것이고, `main`이 없는 지금은 쓸 곳이 없다.

---

## 3. SPA 폴백 — 왜 필요한가

라우팅은 `BrowserRouter`가 클라이언트에서 처리한다. 앱 안에서 옷 카드를 누르면 URL만
`/items/123`으로 바뀌고 네트워크 요청은 일어나지 않는다. 문제는 **그 주소를 직접 열거나
새로고침할 때**다. 브라우저가 `/items/123`을 서버에 요청하는데 `dist`에는 그런 파일이 없다.

`not_found_handling: "single-page-application"`이 이 요청에 `dist/index.html`을 200으로
돌려준다. 그러면 앱이 부팅되고 라우터가 주소를 읽어 상세 화면을 그린다.

동작 순서:

1. 요청 경로와 일치하는 파일이 있으면 → 그 파일을 200으로
2. 없으면 → `/index.html`로 재작성해 200으로
3. `/index.html`조차 없으면 → 404

**서비스워커가 있는데도 필요하다.** 워크박스의 `navigateFallback`은 서비스워커가
설치된 *이후*의 탐색만 가로챈다. 링크를 처음 받아서 들어온 방문자, 시크릿 창,
서비스워커가 아직 활성화되지 않은 첫 로드에서는 서버 응답이 전부다.

---

## 4. `_headers` — 캐시와 보안 헤더

Cloudflare는 모든 정적 자산에 기본으로 이 헤더를 붙인다.

```
Cache-Control: public, max-age=0, must-revalidate
```

"캐시해도 되지만 쓰기 전에 항상 신선도를 확인하라"는 뜻이다. ETag도 같이 나가므로
변경이 없으면 304로 끝나 본문은 다시 받지 않는다. `index.html`·`sw.js`처럼 **내용이
바뀌어도 이름이 그대로인 파일에는 이 기본값이 정확히 맞다.**

반대로 Vite가 내놓는 `dist/assets/*`와 `dist/workbox-<hash>.js`는 이름에 콘텐츠 해시가
들어 있다. 내용이 바뀌면 파일명이 바뀌므로 재검증할 이유가 없다. Cloudflare는 파일명이
해시인지 자동으로 판별하지 않으니 명시해야 한다.

파일은 `mapsy-frontend/public/_headers`에 있다. `public/`인 이유는 Vite가 그 안의 파일을
그대로 `dist/`로 복사하기 때문이다 — Cloudflare는 업로드 최상단의 `_headers`를 읽는다.

주의할 점:

- **`/*`에 `Cache-Control`을 절대 넣지 마라.** `index.html`이나 `sw.js`가 오래 캐시되면
  `registerType: 'autoUpdate'`로 설정한 자동 업데이트가 그 기간만큼 멈춘다. 앱 셸은
  낡았는데 DB는 살아 있는 상태 — `vite.config.ts` 주석이 피하려던 바로 그 상황이다.
- `_headers` 자체는 자산으로 서빙되지 않는다. Cloudflare가 파싱해서 규칙으로만 쓰고,
  `/_headers` 요청은 §3의 폴백에 걸려 `index.html`을 받는다.
- `_headers`는 확장자가 없어 workbox의 `globPatterns`(확장자 기반)에 걸리지 않는다.
  실제로 빌드된 precache 목록에도 들어 있지 않다.
- 규칙은 최대 100개, 한 줄 2,000자. 여러 규칙이 매치되면 헤더가 합쳐진다.

`_redirects`도 같은 방식(`public/_redirects`)으로 지원한다. 지금은 필요 없다 —
알 수 없는 경로는 폴백이 받고, 앱의 `path="*"` 라우트가 `/`로 보낸다.

---

## 5. 환경변수 — 빌드 타임에만 존재한다

이 부분이 가장 헷갈리는 지점이다.

`VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`는 **`vite build` 시점에 번들
안으로 문자열 치환**된다. 배포된 결과물은 이미 값이 박힌 JS 파일이다. 따라서:

- ✅ 빌드 환경변수 — 로컬은 `.env.local`, CI는 Workers Builds의 build variables
- ❌ `wrangler.jsonc`의 `vars` — 그건 Worker 런타임용이고, `main`이 없는 이 프로젝트에는
  그걸 읽을 코드조차 없다
- ❌ `wrangler secret put` — 같은 이유로 무의미하다

publishable key가 번들에 들어가는 건 설계상 문제없다. 접근 통제는 모든 테이블과
스토리지 객체의 RLS가 하지, 키의 비밀성이 하는 게 아니다. **`sb_secret_...`은 절대
들어가면 안 된다** — RLS를 통째로 우회한다.

### 잊으면 조용히 망가진다

환경변수 없이 빌드해도 **빌드는 성공한다.** 그리고 배포된 앱은 `AppLayout`의 게이트가
`unconfigured` 상태로 판단해 **로그인을 요구하지 않고 전체 화면을 열어준다.** 상단에
"Supabase 미설정 — 미리보기 모드" 배너가 뜨는 게 유일한 신호다.

로컬 개발용으로 의도된 동작이지만(README의 "미리보기 모드"), 프로덕션 배포에서는 사고다.
§10의 체크리스트로 반드시 확인한다.

**번들 크기도 달라진다.** 환경변수가 없으면 Vite가 `import.meta.env.VITE_SUPABASE_URL`을
`undefined`로 치환하고, `getSupabase()`의 가드가 항상 throw하는 죽은 코드가 되면서
`@supabase/supabase-js`(Auth·Realtime·Storage) 전체가 트리셰이킹된다. 366 kB와 574 kB의
차이다. **환경변수 없이 빌드한 크기를 CI 빌드와 비교하면 안 된다** — 회귀처럼 보이지만
아무 관계가 없다.

CI에서만 막고 싶다면 `vite.config.ts`에 가드를 넣는다. `command === 'build'`만 보면
`.env.local` 없이 빌드를 확인하려는 로컬 작업까지 막히므로 CI 여부를 함께 본다.

```ts
export default defineConfig(({ command }) => {
  if (command === 'build' && process.env.CI && !process.env.VITE_SUPABASE_URL) {
    throw new Error('CI 빌드에 VITE_SUPABASE_URL이 없음 — 인증 없는 앱이 배포된다.')
  }
  // ...
})
```

---

## 6. 수동 배포

먼저 이 경로로 한 번 성공시켜 놓고 Git 연동으로 넘어가는 편이 좋다. 실패했을 때
원인이 빌드인지 CI 설정인지 갈라내기 쉽다.

```bash
# 1) Cloudflare 로그인 (브라우저가 열린다)
pnpm --filter mapsy-frontend exec wrangler login

# 2) .env.local이 채워져 있는지 확인한 뒤 빌드
pnpm build

# 3) 무엇이 올라가는지 먼저 확인
pnpm --filter mapsy-frontend exec wrangler deploy --dry-run

# 4) 실제 배포
pnpm cf:deploy
```

배포되면 `https://mapsy.<your-subdomain>.workers.dev`가 나온다.

CI가 아닌 스크립트에서 돌릴 때는 `wrangler login` 대신 환경변수를 쓴다.

```bash
export CLOUDFLARE_API_TOKEN=...    # Workers Scripts: Edit 권한
export CLOUDFLARE_ACCOUNT_ID=...
```

---

## 7. Workers Builds — Git 연동 자동 배포

대시보드에서 Worker → **Settings → Builds**로 저장소를 연결한다.

| 설정 | 값 |
|---|---|
| Root directory | `mapsy-frontend` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Deploy command | `pnpm exec wrangler deploy` |
| Non-production branch deploy command | `pnpm exec wrangler versions upload` |
| Production branch | `main` |

> **`npx wrangler deploy`(Cloudflare 기본값)를 쓰지 않는다.** `npx`는 로컬에 wrangler가
> 없으면 레지스트리에서 새로 받는다 — devDependency로 버전을 고정한 의미가 사라진다.
> `pnpm exec`는 워크스페이스에 설치된 것만 쓰고, 없으면 조용히 받아오는 대신 실패한다.

### ⚠️ `wrangler.jsonc`를 먼저 push해야 한다

**wrangler는 설정 파일을 못 찾으면 자동 설정 모드로 들어간다.** 프레임워크를 감지해
`@cloudflare/vite-plugin`을 설치하고, 자기 `wrangler.jsonc`를 만들고, `npm run build`로
**빌드를 한 번 더** 돌린 뒤 그걸로 배포한다. 비대화형 환경에서는 확인 없이 진행된다.

빌드는 "성공"하고 앱도 뜨지만 결과가 다르다:

- `public/_headers`가 없으니 **캐시·보안 헤더가 통째로 빠진다** — 해시 번들도
  `max-age=0, must-revalidate`로 나간다
- `workers_dev`·`preview_urls`가 설정에 없어 경고와 함께 기본 활성화된다
- `compatibility_flags: ["nodejs_compat"]`가 임의로 붙는다
- 빌드가 두 번 돌아 시간이 두 배로 든다

로그에서 `Detected Project Settings:` 와 `📄 Create wrangler.jsonc:` 가 보이면 이 상태다.
**저장소를 연결하기 전에 `wrangler.jsonc`와 `public/_headers`가 대상 브랜치에 올라가
있는지 확인한다.**

**Root directory가 `mapsy-frontend`인 이유**는 `wrangler.jsonc`가 거기 있고, Cloudflare가
root directory 안의 wrangler 설정에서 Worker 이름을 읽어 대시보드 이름과 대조하기
때문이다.

**install을 build command에 직접 쓴다.** 자동 설치에 기대지 않는 편이 확실하고,
`--frozen-lockfile`이 CI에서 락파일이 조용히 갱신되는 걸 막는다. `pnpm`은 상위로
올라가며 `pnpm-workspace.yaml`을 찾아 워크스페이스 전체를 설치하므로, 하위 디렉토리에서
실행해도 루트 락파일이 그대로 쓰인다. 설치 중 `prepare` 훅이 `panda codegen`을 돌려
`styled-system/`을 만든다 — gitignore된 디렉토리라 이 단계가 없으면 빌드가 깨진다.

### 빌드 변수

Settings → Builds → **Build variables and secrets**에 넣는다. 런타임 변수와는 다른 칸이다.

| 이름 | 값 | 이유 |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | 번들에 치환된다 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | 번들에 치환된다 |
| `PNPM_VERSION` | `10.18.2` | 빌드 이미지 기본값은 10.11.x다. `packageManager`와 맞춘다 |
| `NODE_VERSION` | (선택) `24` | 기본값이 이미 Node 24라 보통 생략해도 된다 |

Node를 22 계열로 고정하려면 **22.22.0 이상**이어야 한다. `react-router@8.3.0`의
요구사항이고, pnpm은 기본 설정에서 이걸 경고하지 않는다.

`.node-version` 파일로도 고정할 수 있지만, nvm/fnm/asdf가 로컬 개발 Node까지 바꾸므로
팀 합의 없이 넣지 않는 편이 낫다.

### 브랜치 프리뷰

`main`이 아닌 브랜치는 `wrangler versions upload`로 올라가 프로덕션을 건드리지 않고
`<version>-mapsy.<subdomain>.workers.dev` 형태의 프리뷰 URL을 받는다.

**이 URL은 공개된다.** 로그인 없이 접근 가능하고, 프로덕션과 같은 Supabase 프로젝트를
본다. 막으려면 Cloudflare Access로 해당 호스트에 정책을 걸거나, `wrangler.jsonc`에서
`preview_urls`를 `false`로 끈다.

---

## 8. 커스텀 도메인

도메인의 네임서버가 Cloudflare를 가리키고 있어야 한다. `wrangler.jsonc`에 추가한다.

```jsonc
{
  "routes": [
    { "pattern": "mapsy.example.com", "custom_domain": true }
  ]
}
```

DNS 레코드와 인증서는 Cloudflare가 자동으로 만든다. 붙인 뒤에는 `workers_dev`를
`false`로 닫아 `.workers.dev` 주소로도 같은 앱이 열리는 상태를 없애는 게 좋다 —
중복 오리진은 OAuth 허용 목록과 PWA 설치 대상이 갈리는 원인이 된다.

---

## 9. Supabase 쪽 설정

**배포 후 반드시 해야 한다.** 안 하면 로그인이 프로덕션에서만 실패한다.

`LoginPage`는 `redirectTo: window.location.origin`으로 OAuth를 시작한다. 즉 배포된
오리진이 Supabase의 허용 목록에 없으면 구글에서 돌아오는 길이 막힌다.

Supabase 대시보드 → **Authentication → URL Configuration**:

| 항목 | 값 |
|---|---|
| Site URL | `https://mapsy.example.com` (커스텀 도메인, 없으면 `.workers.dev` 주소) |
| Redirect URLs | `https://mapsy.example.com/**` |
| Redirect URLs (프리뷰) | `https://*-mapsy.<subdomain>.workers.dev/**` |

와일드카드는 `*`가 구분자(`.`와 `/`)를 제외한 문자, `**`가 임의의 문자열이다. 프리뷰
URL을 쓸 계획이 없다면 세 번째 줄은 넣지 않는 게 안전하다.

**Google Cloud Console은 건드릴 필요 없다.** 구글에 등록된 redirect URI는 Supabase의
`https://<ref>.supabase.co/auth/v1/callback`이고, 배포 도메인과 무관하게 그대로다.

Storage는 별도 CORS 설정이 필요 없다. 사진은 서명 URL로 직접 받아온다.

---

## 10. 배포 후 확인

```bash
BASE=https://mapsy.example.com

# 딥링크가 200 + index.html 로 오는가 (SPA 폴백)
curl -sI "$BASE/items/does-not-exist" | head -n 4

# 해시 번들이 immutable 로 오는가
ASSET=$(curl -s "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1)
curl -sI "$BASE$ASSET" | grep -i cache-control

# 서비스워커는 재검증되는가 (max-age=0, must-revalidate 여야 한다)
curl -sI "$BASE/sw.js" | grep -i cache-control
```

같은 검사를 배포 전에 `pnpm cf:dev`(`http://127.0.0.1:8787`)로 돌릴 수 있다.
`pnpm preview`(Vite)로는 안 된다 — §1 참고.

브라우저에서:

- [ ] 상단에 **"Supabase 미설정 — 미리보기 모드" 배너가 없다** — 있으면 §5의 환경변수를 빠뜨린 것이다
- [ ] 로그아웃 상태로 `/`를 열면 `/login`으로 간다
- [ ] Google 로그인 왕복이 성공하고, 원래 열려던 경로로 돌아온다
- [ ] `/items/<실제 id>`를 주소창에 직접 입력해 새로고침 → 상세 화면이 뜬다
- [ ] 옷 등록 → 사진 업로드 → 목록에 반영
- [ ] 모바일에서 "홈 화면에 추가"가 뜬다 (PNG 아이콘이 없어 Android에서는 안 뜰 수 있다 — README의 아이콘 TODO 참고)
- [ ] 새 버전 배포 후 앱을 다시 열면 몇 초 내에 갱신된다

---

## 11. 롤백

```bash
pnpm --filter mapsy-frontend exec wrangler rollback
```

인자 없이 실행하면 최근 100개 버전 중에서 고르는 대화형 목록이 뜬다. 버전 ID를 직접
넘겨도 된다. 대시보드의 Deployments 탭에서도 같은 일을 할 수 있다.

정적 자산도 버전에 포함되므로, 롤백하면 그 시점의 번들이 그대로 되돌아온다.

**단, 되돌아오지 않는 것이 있다.** 이전 버전의 서비스워커를 설치한 사용자는 캐시된
셸을 갖고 있다. `registerType: 'autoUpdate'`라 다음 방문 때 롤백된 셸을 가져가지만,
그 사이 한 번은 이전 버전을 볼 수 있다. 그리고 DB 스키마 변경을 동반한 배포는 프론트만
롤백해서는 복구되지 않는다 — 마이그레이션을 먼저 되돌려야 한다.

---

## 알려진 것 / 남은 일

- **CI 없음.** Workers Builds가 `pnpm build`(= `tsc -b && vite build`)를 돌리므로 타입
  에러는 배포를 막지만, `pnpm lint`와 `pnpm test`는 아무도 돌리지 않는다. 빌드 커맨드에
  붙이거나 GitHub Actions를 따로 두는 게 좋다.
- **환경변수 빌드 가드 미적용.** §5의 스니펫은 문서로만 있다. 지금은 환경변수를 빠뜨린
  배포를 §10의 체크리스트가 사람 눈으로 잡는다.
- **PWA 아이콘이 SVG 하나뿐이다.** 설치 배너 조건을 못 채울 수 있다 (README 참고).
- **스테이징 환경 없음.** 브랜치 프리뷰는 프로덕션과 같은 Supabase 프로젝트를 본다.
  분리하려면 `wrangler.jsonc`에 `env.staging`을 두고 별도 Supabase 프로젝트의 값을 빌드
  변수로 넣어야 한다.
