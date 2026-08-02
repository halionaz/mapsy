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
| `pnpm test` | vitest — 순수 로직 단위 테스트 |
| `pnpm test:db` | Docker에 Postgres를 띄워 마이그레이션·RLS 검사 |
| `pnpm codegen` | Panda CSS 재생성 |
| `pnpm cf:dev` | Cloudflare Workers 런타임으로 빌드 결과 확인 |
| `pnpm cf:deploy` | Cloudflare Workers 배포 |

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
