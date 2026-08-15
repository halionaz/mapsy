# mapsy

패션 서비스. 첫 기능은 **내 옷장** — 가진 옷을 사진으로 등록하고 카테고리·색상·사이즈·계절로
한눈에 모아본다.

전체 스펙은 [`docs/PRD.md`](docs/PRD.md), 배포는 [`docs/DEPLOY.md`](docs/DEPLOY.md).

## 구성

pnpm workspace 모노레포다.

```
mapsy/
├── mapsy-frontend/   Vite + React SPA (PWA)
├── supabase/         스키마 마이그레이션 · RLS · DB 회귀 테스트
├── scripts/          저장소 도구
├── .githooks/        git 훅 — pnpm install이 core.hooksPath로 연결한다
└── docs/PRD.md       제품 명세
```

`mapsy-native`, `mapsy-server`가 생기면 형제 디렉토리로 붙는다 — 워크스페이스 글롭이
`mapsy-*`라 파일을 고칠 필요 없이 잡힌다.

## 시작하기

**pnpm이 필요하다.** npm이나 yarn으로 설치하면 `preinstall` 훅이 막는다.

```bash
corepack enable      # package.json의 packageManager 버전을 그대로 사용
pnpm install         # postinstall이 아니라 prepare 훅이 panda codegen까지 돌림

cp mapsy-frontend/.env.example mapsy-frontend/.env.local
# Supabase 값을 채운다 — supabase/README.md의 세팅 체크리스트 참고

pnpm dev
```

`.env.local` 없이도 앱은 뜬다. 인증 게이트가 **미리보기 모드**로 취급해 로그인을 요구하지
않으므로, Supabase 프로젝트를 만들기 전에도 UI를 만들 수 있다.

## 명령

루트에서 실행한다.

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 타입 체크 후 프로덕션 빌드 |
| `pnpm typecheck` | 전체 패키지 `tsc -b` |
| `pnpm lint` | oxlint |
| `pnpm format` | oxfmt — 코드 포맷 (CI는 `format:check`로 막는다) |
| `pnpm test` | vitest — 순수 로직 단위 테스트 |
| `pnpm test:db` | Docker에 Postgres를 띄워 마이그레이션·RLS 검사 |
| `pnpm codegen` | Panda CSS 재생성 |
| `pnpm setup:worktree` | 워크트리에 gitignore된 로컬 파일 채우기 — 아래 참고 |
| `pnpm cf:dev` | Cloudflare Workers 런타임으로 빌드 결과 확인 |
| `pnpm cf:deploy` | Cloudflare Workers 배포 |

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml)이 PR과 main 푸시에서 위 명령을 그대로
돌린다. 잡은 둘이다 — `db`는 `pnpm test:db`(Docker만 필요해서 install을 건너뛴다), `web`은
설치 후 format·lint·typecheck·test·build.

`paths` 필터는 일부러 두지 않았다. `db` 잡이 지키는 것은 스키마와 프론트엔드 제약 맵 사이의
어긋남이라, "supabase/가 안 바뀌었으니 건너뛴다"는 곧 `errorMessage.ts`만 고친 PR에서 검사가
안 도는 것이다.

> **워크플로 파일만으로는 머지를 막지 못한다.** GitHub 저장소 설정에서 `db`·`web`을 required
> status check으로 등록해야 빨간 CI가 머지를 막는다. 안 하면 "돌리는 걸 기억하기"가 "빨간 걸
> 보면 안 머지하기를 기억하기"로 이름만 바뀐다.

## 워크트리

`git worktree add`는 **추적되는 파일만** 새 디렉토리에 푼다. gitignore된 것 —
`mapsy-frontend/.env.local`, `supabase/.env`, supabase CLI가 링크한 프로젝트를 기억하는
`supabase/.temp/` — 은 만들어진 워크트리에 남는다. 그래서 새 워크트리에서 `pnpm dev`를
띄우면 Supabase 설정이 통째로 비어 있다.

[`.githooks/post-checkout`](.githooks/post-checkout)이 이걸 자동으로 메운다.

```bash
git worktree add ../mapsy-feature -b feat/something
#   ✓ mapsy-frontend/.env.local
#   ✓ supabase/.env
#   ✓ supabase/.temp/project-ref
#   ...
```

원본은 **메인 워크트리**(`.git`이 있는 쪽)다. 이미 있는 파일은 건드리지 않으니 아무 때나 다시
돌려도 되고, 나중에 추가된 것만 채워진다. 덮어쓰려면 `pnpm setup:worktree --force`.

무엇을 복사할지는 나열하지 않고 **찾는다** — 저장소 안의 모든 `.env*` 중 git이 이미 추적하는
것(`.env.example`)을 뺀 나머지. `mapsy-server/.env`는 생기기만 하면 잡히고, 워크스페이스
글롭과 같은 이유로 파일을 고칠 일이 없다. env가 아닌 경로는
[`scripts/setup-worktree.sh`](scripts/setup-worktree.sh)의 `EXTRA_PATHS`에 적혀 있다.

의존성 설치는 훅에서 **하지 않는다.** `pnpm install`이 훅 안에서 돌면 `git worktree add`가
설명 없이 30초씩 멈춘다. node_modules가 없으면 그렇다고 알려주기만 하고, 직접 부른
`pnpm setup:worktree`는 없을 때만 설치한다.

> **훅은 `pnpm install`이 연결한다** — `git config core.hooksPath .githooks`를 `prepare`에서
> 돌린다. 클론 직후 아직 설치를 안 했다면 훅도 없다. 그리고 이 설정은 `.git/hooks/`를
> 대체하므로, 거기에 직접 넣은 훅이 있다면 `.githooks/`로 옮겨야 한다.

## 왜 pnpm만 허용하나

의존성 트리는 `pnpm-lock.yaml`이, 워크스페이스는 `pnpm-workspace.yaml`이 결정한다.
`npm install`은 둘 다 무시하고 node_modules를 평탄화하면서 별도의 `package-lock.json`을
쓴다. 결과는 다른 사람과 다르게 해석된 트리이고, 이 종류의 어긋남은 나중에 "내 컴퓨터에선
되는데"로 나타난다.

[`scripts/only-pnpm.mjs`](scripts/only-pnpm.mjs)가 `preinstall`에서 이를 막고, 같은 자리에서
`engines`에 적힌 Node·pnpm 최소 버전도 확인한다.

> **`.npmrc`의 `engine-strict`를 쓰지 않는 이유**: 그 설정은 *의존성*의 engines까지 강제해서,
> 실제보다 엄격한 범위를 선언한 패키지 하나가 설치 전체를 막는다. 우리 요구사항만 검사하는
> 편이 낫다.

**npm으로 설치를 시도하면 차단되더라도 `package-lock.json`이 남는다.** 일부러 gitignore하지
않았으니 `git status`에 보이면 지우면 된다.

## 알려진 것

- **react-router 8.3.0이 Node `>=22.22.0`을 요구한다.** pnpm은 기본 설정에서 이를 경고하지
  않는다. 브라우저 번들이라 런타임에는 문제가 없을 가능성이 높지만, 툴체인을 22.22 이상으로
  올리면 확실하다.
