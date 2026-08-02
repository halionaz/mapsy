#!/usr/bin/env bash
#
# Worktree bootstrap: copy the local files git does not carry.
#
# A new worktree is a fresh checkout of tracked files and nothing else. Anything
# gitignored — .env.local, supabase/.temp/project-ref — stays behind in the
# worktree it was created in, so `pnpm dev` in a new branch's worktree runs
# against a Supabase project it has never heard of. The fix is mechanical, which
# is exactly why it should not be done by hand every time.
#
# Source of truth is the *main* worktree (the one holding .git), not whichever
# worktree happens to be current. It is the only one guaranteed to exist.
#
# What gets copied is derived, not enumerated: every .env* under the repo, minus
# anything git already tracks. mapsy-server/.env is picked up by existing, the
# same way pnpm-workspace.yaml's `mapsy-*` glob picks up the package itself.
# Paths that are not env files (supabase/.temp) are listed explicitly below.
#
# Idempotent and non-destructive: an existing file at the destination is left
# alone unless --force is passed. Re-running after adding a new secret only
# fills in the gap.
#
# bash rather than node: this runs from a git hook, where PATH can be whatever a
# GUI app handed to git, and it has to work before `pnpm install` ever runs.

set -eu

BOLD=$'\033[1m'
DIM=$'\033[2m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# ── Non-env local state worth carrying over ────────────────────────────────
# Files or directories, relative to the repo root. Missing entries are skipped
# silently — most setups will not have all of them.
EXTRA_PATHS='
supabase/.temp
.claude/settings.local.json
'

# Generated directories. Pruned from the search because they are rebuilt by
# `pnpm install` (node_modules, styled-system) or by a dev/build run, and
# walking node_modules to find some dependency's own .env is slow and wrong.
PRUNE_NAMES='node_modules .git dist dist-ssr coverage .vite .wrangler styled-system .temp'

FORCE=0
FILES_ONLY=0

usage() {
  cat <<EOF
${BOLD}setup-worktree.sh${RESET} — 새 워크트리에 gitignore된 로컬 파일을 채운다

  ${DIM}pnpm setup:worktree${RESET}

옵션
  --force        이미 있는 파일도 덮어쓴다 (기본은 건너뜀)
  --files-only   파일 복사만 하고 pnpm install 여부는 확인하지 않는다
  -h, --help     이 도움말

메인 워크트리(.git이 있는 쪽)에서 복사해온다. 워크트리 생성 시
.githooks/post-checkout이 --files-only로 자동 실행한다.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --files-only) FILES_ONLY=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      printf '%s\n\n' "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

# ── Where are we, and where do we copy from? ───────────────────────────────
# `git worktree list` always reports the main worktree first, which survives the
# cases dirname(--git-common-dir) does not: a separate gitdir, or a .git file.
here=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "git 저장소가 아니다." >&2
  exit 1
}
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
[ -n "$main" ] || {
  echo "메인 워크트리를 찾지 못했다." >&2
  exit 1
}

# Normalize both sides before comparing — a symlinked path would otherwise read
# as a different worktree and we would try to copy a file onto itself.
here=$(cd "$here" && pwd -P)
main=$(cd "$main" && pwd -P)

if [ "$here" = "$main" ]; then
  [ "$FILES_ONLY" = 1 ] && exit 0
  echo "${DIM}메인 워크트리다 — 복사할 것이 없다.${RESET}"
  exit 0
fi

# ── Collect candidates ─────────────────────────────────────────────────────
prune_expr=''
for name in $PRUNE_NAMES; do
  prune_expr="$prune_expr -name $name -o"
done
prune_expr=${prune_expr% -o}

# shellcheck disable=SC2086 # prune_expr is a deliberately unquoted find expression
candidates=$(
  cd "$main" && find . \( $prune_expr \) -prune -o -type f \( -name '.env' -o -name '.env.*' \) -print |
    sed 's|^\./||'
)

for path in $EXTRA_PATHS; do
  [ -e "$main/$path" ] || continue
  if [ -d "$main/$path" ]; then
    candidates="$candidates
$(cd "$main" && find "$path" -type f | sed 's|^\./||')"
  else
    candidates="$candidates
$path"
  fi
done

# ── Copy ───────────────────────────────────────────────────────────────────
copied=0
skipped=0

while IFS= read -r rel; do
  [ -n "$rel" ] || continue

  # Tracked files arrive with the checkout. This is what keeps .env.example out
  # without naming it — and what keeps the list correct if it is ever renamed.
  if git -C "$main" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1; then
    continue
  fi

  if [ -e "$here/$rel" ] && [ "$FORCE" = 0 ]; then
    skipped=$((skipped + 1))
    continue
  fi

  mkdir -p "$here/$(dirname "$rel")"
  cp -p "$main/$rel" "$here/$rel"
  echo "  ${GREEN}✓${RESET} $rel"
  copied=$((copied + 1))
done <<EOF
$candidates
EOF

if [ "$copied" = 0 ] && [ "$skipped" = 0 ]; then
  echo "${YELLOW}!${RESET} 메인 워크트리에도 로컬 파일이 없다 ${DIM}— mapsy-frontend/.env.example를 참고해 .env.local을 만들어라${RESET}"
else
  summary="로컬 파일 ${copied}개 복사"
  [ "$skipped" -gt 0 ] && summary="$summary, ${skipped}개는 이미 있어 건너뜀 ${DIM}(--force로 덮어쓰기)${RESET}"
  echo "${BOLD}$summary${RESET}"
fi

# ── Dependencies ───────────────────────────────────────────────────────────
# Skipped under --files-only: the git hook runs inside `git worktree add`, and a
# 30초 install there turns a fast command into a mysterious hang.
[ "$FILES_ONLY" = 1 ] && {
  [ -d "$here/node_modules" ] || echo "${DIM}  node_modules 없음 — pnpm install 필요${RESET}"
  exit 0
}

if [ ! -d "$here/node_modules" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    echo "${BOLD}pnpm install${RESET} ${DIM}(prepare 훅이 panda codegen까지 돌린다)${RESET}"
    (cd "$here" && pnpm install)
  else
    echo "${YELLOW}!${RESET} node_modules가 없는데 pnpm을 찾을 수 없다 ${DIM}— corepack enable${RESET}"
  fi
fi
