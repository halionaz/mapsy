/**
 * 워크스페이스 가드: `pnpm -r`이 부르는 스크립트를 패키지가 다 선언했는지 본다.
 *
 * `pnpm -r lint`는 lint 스크립트가 있는 패키지에서만 돈다. 없는 패키지는 exit 0으로
 * 건너뛰고, 아무도 선언하지 않았으면 한 줄 알리고 역시 exit 0이다. 워크스페이스 글롭이
 * `mapsy-*`라 패키지는 생기기만 하면 붙지만 검사는 같이 붙지 않는다 — 타입 오류·금지된
 * import·미포맷 코드를 넣은 프로브 패키지가 lint·typecheck·test·build를 전부 통과했다.
 *
 * format은 목록에 없다. 루트에서 레포 전체로 한 번 도는 명령이라 패키지 선언과 무관하고,
 * 그래서 프로브가 유일하게 못 지나간 검사이기도 하다.
 *
 * **무엇을 검사할지도 루트에서 파생한다.** 목록을 여기 손으로 적으면, 루트에 다섯 번째
 * `pnpm -r` 명령이 생기는 순간 그 명령만 조용히 건너뛴다 — 이 파일이 막으려는 것과 같은
 * 모양이다. 패키지 목록을 pnpm에게 묻는 것도 같은 이유다. 글롭은 pnpm-workspace.yaml에
 * 있고, 손으로 다시 파싱하면 가드가 자기가 지키는 도구와 다르게 읽기 시작한다.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// `pnpm -r <script>` / `pnpm --recursive run <script>` — 퍼뜨리는 이름을 뽑는다.
const FANOUT = /^pnpm\s+(?:-r|--recursive)\s+(?:run\s+)?([\w:-]+)$/
const RECURSIVE = /(?:^|\s)(?:-r|--recursive)(?:\s|$)/

const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function fail(message) {
  console.error(`\n${RED}${BOLD}${message}${RESET}\n`)
  process.exit(1)
}

const { scripts: rootScripts = {} } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const required = []
for (const [name, command] of Object.entries(rootScripts)) {
  if (!RECURSIVE.test(command)) continue

  const match = FANOUT.exec(command.trim())
  if (!match) {
    fail(
      `루트 스크립트 "${name}" — -r로 퍼뜨리는데 형태를 읽지 못했습니다: ${command}\n\n` +
        `  이 가드는 "pnpm -r <script>" 형태만 읽습니다.\n` +
        `  다른 형태를 쓸 거면 scripts/check-package-scripts.mjs의 FANOUT도 같이 고쳐야 합니다.`,
    )
  }
  required.push(match[1])
}

// 하나도 없다면 루트 스크립트를 잘못 읽은 것이다. 그대로 두면 "검사할 게 없어서 통과"가 된다.
if (required.length === 0) {
  fail(`루트에 "pnpm -r"로 퍼뜨리는 스크립트가 하나도 없습니다.\n\n  package.json을 확인하세요.`)
}

const listed = JSON.parse(
  execFileSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], { cwd: root, encoding: 'utf8' }),
)

// 루트는 -r의 대상이 아니다. 여기 있는 lint·test가 방금 읽은 그 애그리게이트다.
const packages = listed.filter((p) => p.path !== root)

// 하나도 없다면 글롭이 깨진 것이다. 위와 같은 이유로 통과시키지 않는다.
if (packages.length === 0) {
  fail(
    '워크스페이스 패키지를 하나도 찾지 못했습니다.\n\n  pnpm-workspace.yaml의 글롭을 확인하세요.',
  )
}

const gaps = []
for (const p of packages) {
  const { scripts = {} } = JSON.parse(readFileSync(join(p.path, 'package.json'), 'utf8'))
  const missing = required.filter((name) => !scripts[name])
  if (missing.length > 0) gaps.push(`  ${relative(root, p.path)}: ${missing.join(', ')}`)
}

if (gaps.length > 0) {
  fail(
    `워크스페이스 패키지에 없는 스크립트가 있습니다.\n\n` +
      `${gaps.join('\n')}\n\n` +
      `  pnpm -r은 스크립트가 없는 패키지를 조용히 건너뜁니다 — 검사가 안 도는 것과\n` +
      `  통과가 구분되지 않습니다. 해당 없는 패키지라면 이유를 명령으로 남기세요:\n` +
      `    "typecheck": "echo 'tsconfig 없음 — 타입 검사 대상이 아님'"`,
  )
}

console.log(`워크스페이스 패키지 ${packages.length}개 — ${required.join('·')} 모두 선언됨`)
