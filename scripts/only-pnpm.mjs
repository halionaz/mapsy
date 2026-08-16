/**
 * Install-time guard: pnpm only, and only on a toolchain this repo supports.
 *
 * The workspace is defined in pnpm-workspace.yaml and the dependency tree is
 * pinned by pnpm-lock.yaml. `npm install` ignores both: it flattens
 * node_modules, writes a competing package-lock.json, and produces a tree that
 * resolves differently from everyone else's — the kind of breakage that surfaces
 * later as "works on my machine".
 *
 * Version checking lives here rather than in `.npmrc`'s `engine-strict`, because
 * that setting also enforces every *dependency's* engines field. A transitive
 * package declaring a stricter Node range than it truly needs would then block
 * installs outright, which is a much worse failure than the warning pnpm prints
 * by default.
 *
 * Deliberately dependency-free: a guard that protects installs shouldn't itself
 * require a successful install first.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RED = '[31m'
const BOLD = '[1m'
const DIM = '[2m'
const RESET = '[0m'

function fail(message) {
  console.error(`\n${RED}${BOLD}${message}${RESET}\n`)
  process.exit(1)
}

// ── Which package manager? ─────────────────────────────────────────────────
// Format: "pnpm/10.18.2 npm/? node/v22.20.0 darwin arm64". An empty value means
// the script was run directly rather than through an install, so there is
// nothing to guard.
const userAgent = process.env.npm_config_user_agent ?? ''
const [manager, managerVersion] = userAgent.split(' ')[0].split('/')

if (manager && manager !== 'pnpm') {
  fail(
    `이 저장소는 pnpm으로만 설치할 수 있습니다.\n\n` +
      `  감지된 패키지 매니저: ${manager}\n\n` +
      `  pnpm이 없다면:\n` +
      `    corepack enable          ${DIM}# packageManager에 적힌 버전을 그대로 사용${RESET}${RED}${BOLD}\n` +
      `  또는:\n` +
      `    npm install -g pnpm\n\n` +
      `  그런 다음:\n` +
      `    pnpm install\n\n` +
      `  ${manager}로 이미 설치를 시도했다면 남은 파일을 지워야 합니다:\n` +
      `    rm -rf node_modules */node_modules package-lock.json yarn.lock\n` +
      `    pnpm install`,
  )
}

// ── Does the toolchain meet what package.json declares? ────────────────────
const here = dirname(fileURLToPath(import.meta.url))
const { engines = {} } = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))

/**
 * Lowest version a `>=x.y.z` range allows, as [major, minor, patch].
 *
 * Only handles the `>=` form, which is all this repo declares. Anything else
 * returns null, and check() turns that into a loud failure rather than a guess:
 * a guard that silently skips its own check is indistinguishable from one that
 * ran and passed.
 *
 * The trap is real. README documents jsdom's range
 * (`^22.22.2 || ^24.15.0 || >=26.0.0`) as the reason for the floor, and copying
 * that string into engines.node is the obvious next edit — which, before the
 * check below existed, disabled the Node check entirely and said nothing.
 */
function minimumOf(range) {
  const match = /^>=\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range?.trim() ?? '')
  if (!match) return null
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}

function parse(version) {
  const match = /v?(\d+)\.(\d+)\.(\d+)/.exec(version ?? '')
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

function isBelow(actual, minimum) {
  for (let i = 0; i < 3; i++) {
    if (actual[i] < minimum[i]) return true
    if (actual[i] > minimum[i]) return false
  }
  return false
}

// 읽지 못한 것은 전부 fail로 나간다. 못 읽었을 때 조용히 통과하면, 검사가 돈 것과
// 안 돈 것이 같은 출력(아무것도 없음)을 낸다.
function check(label, actualVersion, range, howToFix) {
  const field = `engines.${label.toLowerCase()}`

  if (range === undefined) {
    fail(
      `package.json에 ${field}가 없습니다.\n\n` +
        `  이 가드는 그 값으로 검사합니다 — 필드가 사라지면 검사도 같이 사라집니다.`,
    )
  }

  const minimum = minimumOf(range)
  if (!minimum) {
    fail(
      `${field}의 범위를 읽지 못했습니다: ${range}\n\n` +
        `  이 가드는 ">=x.y.z" 형태만 읽습니다.\n` +
        `  범위 형식을 바꿨다면 scripts/only-pnpm.mjs의 minimumOf도 같이 고쳐야 합니다.`,
    )
  }

  const actual = parse(actualVersion)
  if (!actual) {
    fail(`${label} 버전을 읽지 못했습니다: ${actualVersion}`)
  }

  if (isBelow(actual, minimum)) {
    fail(
      `${label} 버전이 낮습니다.\n\n` +
        `  필요: ${range}\n` +
        `  현재: ${actualVersion}\n\n` +
        `  ${howToFix}`,
    )
  }
}

check(
  'Node',
  process.versions.node,
  engines.node,
  'asdf/nvm 등으로 Node를 올린 뒤 다시 시도하세요.',
)

if (manager === 'pnpm') {
  check('pnpm', managerVersion, engines.pnpm, 'corepack enable 로 packageManager 버전을 맞추세요.')
}
