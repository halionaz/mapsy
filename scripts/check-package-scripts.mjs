/**
 * 워크스페이스 가드: `pnpm -r`이 부르는 스크립트를 패키지가 다 선언했는지 본다.
 *
 * `pnpm -r lint`는 lint 스크립트가 있는 패키지에서만 돈다. 없는 패키지는 exit 0으로
 * 건너뛰는데, 그 출력은 통과와 구분되지 않는다. 워크스페이스 글롭이 `mapsy-*`라
 * 패키지는 생기기만 하면 붙지만 검사는 같이 붙지 않는다 — 타입 오류·금지된 import·
 * 미포맷 코드를 넣은 프로브 패키지가 lint·typecheck·test·build를 전부 통과했다.
 *
 * format은 목록에 없다. 루트에서 레포 전체로 한 번 도는 명령이라 패키지 선언과
 * 무관하고, 그래서 프로브가 유일하게 못 지나간 검사이기도 하다.
 *
 * 패키지 목록은 pnpm에게 묻는다. 글롭은 pnpm-workspace.yaml에 있고, 그걸 손으로 다시
 * 파싱하면 가드가 자기가 지키는 도구와 다르게 읽기 시작한다.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const REQUIRED = ['lint', 'typecheck', 'test', 'build']

const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function fail(message) {
  console.error(`\n${RED}${BOLD}${message}${RESET}\n`)
  process.exit(1)
}

const listed = JSON.parse(
  execFileSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], { cwd: root, encoding: 'utf8' }),
)

// 루트는 -r의 대상이 아니다. 여기 있는 lint·test는 하위로 넘기는 통과 스크립트다.
const packages = listed.filter((p) => p.path !== root)

// 하나도 없다면 글롭이 깨진 것이다. 그대로 두면 "검사할 게 없어서 통과"가 된다.
if (packages.length === 0) {
  fail(
    '워크스페이스 패키지를 하나도 찾지 못했습니다.\n\n  pnpm-workspace.yaml의 글롭을 확인하세요.',
  )
}

const gaps = []
for (const p of packages) {
  const { scripts = {} } = JSON.parse(readFileSync(join(p.path, 'package.json'), 'utf8'))
  const missing = REQUIRED.filter((name) => !scripts[name])
  if (missing.length > 0) gaps.push(`  ${relative(root, p.path)}: ${missing.join(', ')}`)
}

if (gaps.length > 0) {
  fail(
    `워크스페이스 패키지에 없는 스크립트가 있습니다.\n\n` +
      `${gaps.join('\n')}\n\n` +
      `  pnpm -r은 스크립트가 없는 패키지를 조용히 건너뜁니다 — 검사가 안 도는 것과\n` +
      `  통과가 구분되지 않습니다. 빈 스크립트라도 선언하세요.`,
  )
}

console.log(`워크스페이스 패키지 ${packages.length}개 — ${REQUIRED.join('·')} 모두 선언됨`)
