# mapsy-frontend

mapsy 내 옷장의 프론트엔드. Vite + React + TypeScript SPA이며 PWA로 설치된다.

전체 스펙은 [`../docs/PRD.md`](../docs/PRD.md)를 참고.

## 시작하기

```bash
# 저장소 루트에서
pnpm install          # postinstall이 panda codegen까지 돌림

cp mapsy-frontend/.env.example mapsy-frontend/.env.local
# Supabase 대시보드(Project Settings → API)에서 값을 채운다

pnpm dev
```

`.env.local` 없이도 앱은 뜬다. 로그인 화면이 환경변수가 없다고 알려줄 뿐이라,
Supabase 프로젝트를 만들기 전에도 UI를 볼 수 있다.

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

## 구조

```
src/
├── app/          라우터, 프로바이더, 레이아웃 셸
├── features/     auth · items · settings
├── shared/
│   ├── constants/  카테고리·색상·사이즈·핏·계절 프리셋 (PRD §5)
│   ├── lib/        supabase 클라이언트
│   └── ui/         공용 컴포넌트
└── types/        도메인 타입 (PRD §4 스키마 대응)
```

## 스타일링

Panda CSS를 쓴다. **`styled-system/`은 생성물이라 커밋하지 않고 직접 수정하지 않는다.**
`panda.config.ts`를 바꾸면 `pnpm codegen`을 다시 돌려야 토큰과 레시피가 반영된다.

규약과 문서 라우팅은 [`../.claude/skills/panda-css/`](../.claude/skills/panda-css/SKILL.md)에
정리되어 있다. Panda는 빌드타임 추출기라 잘못된 형태로 쓰면 **에러 없이 CSS만 조용히
누락되므로**, 레시피·패턴·조건·토큰을 건드릴 땐 기억에 의존하지 말고 스킬의 라우팅 테이블을
따라 최신 문서를 확인할 것.

## 아직 없는 것

- 아이템 CRUD와 사진 업로드 파이프라인 (등록/상세/편집 화면은 현재 스텁)
- 필터 바텀시트, 검색, 정렬
- Supabase 스키마와 RLS 마이그레이션
- PWA 아이콘이 SVG 하나뿐 — 설치 경험을 위해 192/512 PNG와 maskable 아이콘 필요
