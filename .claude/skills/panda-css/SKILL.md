---
name: panda-css
description: >-
  Panda CSS styling for mapsy — routes to the live upstream docs at panda-css.com/llms.txt
  and holds this repo's styling conventions. Use this whenever you touch anything visual in
  mapsy-frontend: writing or editing a component's styles, adding a css() call, building a
  recipe or cva variant, defining design tokens, editing panda.config.ts, picking a layout
  pattern (stack/flex/grid), handling dark mode or responsive breakpoints, or debugging why
  a style isn't showing up. Trigger it even when the request never says "Panda" or "CSS" —
  "make this look nicer", "add a button", "fix the spacing", "style the item card", "why is
  this not centered" all qualify. In this repo every style goes through Panda, and Panda is
  a build-time extractor: code written from memory with the wrong API shape compiles fine
  and silently emits no CSS, so guessing is expensive to debug.
---

# Panda CSS in mapsy

## Why this skill exists

Panda CSS is a **build-time static extractor**, not a runtime library. It parses your source
files, finds style calls it recognizes, and generates a stylesheet ahead of time.

That single fact drives everything else:

- If you write a style call in a shape Panda's parser doesn't recognize, **nothing breaks
  loudly**. TypeScript passes, the build succeeds, the component renders — with no styles.
  You then spend twenty minutes hunting a bug that was never a bug.
- Panda's API surface (conditions, patterns, recipes, token references) is large and moves
  between versions. Recalled-from-memory syntax is exactly the failure mode above.

So: **read the live doc before writing anything beyond a plain property.** The docs are
fetched, not vendored, so they can't drift out of date the way a copy-pasted snapshot would.

## When to fetch vs. just write it

Fetching costs a few seconds. Debugging silent extraction failure costs far more. But not
every edit needs a round trip.

**Just write it** when you're setting plain CSS properties through `css()` using tokens you
can see in `panda.config.ts` — `css({ display: 'flex', gap: '3', color: 'fg' })`.

**Fetch first** when you're doing any of these:

- creating or changing a recipe, slot recipe, or `cva`
- using a pattern (`hstack`, `vstack`, `grid`, `container`, `divider`, …)
- writing a condition you haven't already used in this repo (`_hover`, `_dark`, `_selected`,
  `&[data-state=open]`, arbitrary selectors)
- defining or referencing tokens, semantic tokens, or a color opacity modifier
- editing `panda.config.ts`, presets, or the styled-system output
- a style is not appearing and you don't immediately know why

## Doc routing table

All URLs are live. Fetch the narrowest section that covers your question.

| You're working on | Fetch | ~Size |
|---|---|---|
| What Panda is, why it's zero-runtime, comparison to other libs | `https://panda-css.com/llms.txt/overview` | 21 KB |
| Project setup, Vite/PostCSS wiring, `panda init`, codegen scripts | `https://panda-css.com/llms.txt/installation` | 96 KB |
| `css()`, patterns, recipes, `cva`, conditional styles, responsive, cascade layers, merging styles, style props, JSX style context | `https://panda-css.com/llms.txt/concepts` | 173 KB |
| Tokens, semantic tokens, text styles, layer styles, breakpoints, dark mode wiring | `https://panda-css.com/llms.txt/theming` | 45 KB |
| The full property/utility list — what shorthand maps to what CSS | `https://panda-css.com/llms.txt/utilities` | 49 KB |
| Custom utilities, custom patterns, presets, config extension | `https://panda-css.com/llms.txt/customization` | 35 KB |
| Framework/tooling integration walkthroughs, dynamic styling, minimal setup | `https://panda-css.com/llms.txt/guides` | 73 KB |
| Coming from Chakra / Stitches / Tailwind | `https://panda-css.com/llms.txt/migration` | 32 KB |
| CLI flags, config schema, TypeScript types, JSX prop reference | `https://panda-css.com/llms.txt/references` | 40 KB |

**Do not fetch `https://panda-css.com/llms-full.txt`** — it is 564 KB and contains everything
above concatenated. A targeted section always answers faster.

Index of these sections: `https://panda-css.com/llms.txt`

## Fetching effectively

`WebFetch` runs your prompt against the page with a small model and returns its answer, not
the raw text. That makes the prompt you write the difference between a usable answer and a
vague paraphrase.

- **Ask a specific question and demand verbatim code.** "Summarize theming" gets you prose.
  "Give the exact `defineConfig` block for adding semantic tokens with a `_dark` condition,
  including the token reference syntax used in `css()`, as literal code blocks" gets you
  something you can paste.
- **Fetch once, extract everything you need.** If you're about to build three related things,
  ask for all three in one prompt rather than three round trips.
- **Responses are cached per URL for 15 minutes**, so re-asking a different question against
  the same section within a session is cheap.
- **If the answer looks hand-wavy or the code has gaps, fetch again with a narrower question.**
  A vague answer about API shape is worse than no answer, because it reads as authoritative.
- **The live doc wins over anything below.** If this file and the fetched doc disagree, the
  doc is right and this file needs updating — say so rather than quietly following the doc.
- **But the generated types beat both.** The docs' examples can lag the installed version.
  Observed on Panda 1.12: the pattern examples pass `align: 'center'` to `hstack`/`vstack`,
  which no longer type-checks — those patterns now expose only `justify` and `gap`, and both
  already default to `alignItems: center`, so any other alignment goes through a plain
  `alignItems` prop. When a fetched example fails to compile, read the real signature in
  `styled-system/patterns/<name>.d.ts` (and the `.mjs` beside it, which shows the defaults the
  pattern bakes in) rather than fighting the type error.

## mapsy conventions

These are decisions specific to this repo, not upstream Panda rules. They're here because the
docs can't tell you them.

### Setup

- Config lives at `mapsy-frontend/panda.config.ts`, output at `mapsy-frontend/styled-system/`.
- `styled-system/` is **generated and gitignored**. Never hand-edit it, never commit it. If it
  looks stale or imports fail, run `pnpm panda codegen` from `mapsy-frontend/`.
- `jsxFramework: 'react'` is on, so pattern JSX components and `styled` are available.
- Entry stylesheet declares the layer order: `@layer reset, base, tokens, recipes, utilities;`
- After any change to `panda.config.ts`, codegen must rerun before the new tokens or recipes
  resolve. This is the most common "my token doesn't exist" cause.

### Choosing the right tool

| Situation | Use |
|---|---|
| One-off styles on a single element | `css()` from `styled-system/css` |
| Layout — rows, columns, grids, spacing | a **pattern** (`hstack`, `vstack`, `grid`, `container`) rather than hand-rolled flex |
| A component with variants (Button, Chip, Card, Badge) | a **recipe** — `cva` for local, `defineRecipe` in config for shared |
| A multi-part component sharing variants (BottomSheet, ItemCard) | a **slot recipe** |
| Type sizes | `textStyle: 'title' \| 'body' \| 'label' \| …` — never a raw `fontSize`/`fontWeight` pair |
| The focus ring | `layerStyle: 'focusable'` (or `focusableInset` inside a scroller) |

The shared component layer lives in `src/shared/ui/`: `buttonStyle.ts` / `chipStyle.ts` /
`fieldStyle.ts` hold the recipes, `Button.tsx` / `Field.tsx` / `Sheet.tsx` /
`ConfirmDialog.tsx` / `Toaster.tsx` the components. Overlays are Ark UI primitives styled with
our tokens. Reach for one of these before writing a new `css()` for a button, input or chip.

Reach for patterns before writing `display: flex` by hand. The whole point is that layout
intent reads at a glance and stays consistent across screens — mapsy's item grid, filter chip
row, and form sections should not each invent their own flex incantation.

The exception is a **structural container whose job is to distribute height**, such as the app
shell or a screen's `<main>`. `vstack` centres its children and adds a gap; expressing "fill
the remaining height, stretch everything, no gap" through it means passing `alignItems` and
`gap` purely to cancel what the pattern means. There, a plain `css({ display: 'flex',
flexDirection: 'column' })` states the intent more honestly. Reserve that for containers, not
for content rows — if you find yourself hand-rolling flex to lay out siblings, it's a pattern.

### Styles must stay statically analyzable

Panda reads your source; it doesn't run it. Style objects must be literal enough for the
parser to see.

```tsx
// ✅ extractable
css({ color: 'fg.muted', fontSize: 'sm' })

// ✅ variants are the supported way to branch
const chip = cva({
  base: { rounded: 'full', px: '3', py: '1.5' },
  variants: { active: { true: { bg: 'accent', color: 'accent.fg' } } },
})
chip({ active: isActive })

// ❌ silently produces nothing — Panda can't see through the variable
const c = isActive ? 'accent' : 'fg.muted'
css({ color: c })

// ❌ never build class names by string concatenation
```

If you genuinely need a runtime value (a user-chosen color swatch, a computed width), pass it
as a **CSS custom property** through `style={{ '--swatch': hex }}` and reference `var(--swatch)`
in the Panda style. That keeps the generated CSS static while the value stays dynamic.

The same applies to values you were about to factor out. `const TILE = '84px'` and then
`css({ width: TILE })` asks the extractor to resolve a variable; write the literal twice and
say why in a comment instead.

### Two traps this repo has already paid for

**`_enabled` compiles to `:enabled`, which no `<a>` matches.** Several buttons in mapsy are
react-router `<Link>`s wearing `buttonStyle` (the FAB, 편집, 내 옷장으로). Guarding a hover or
press rule with `_enabled` removes it from every one of them, silently. Write
`'&:hover:not(:disabled)'` — true for an anchor, false for a disabled button. The guard is
needed at all because a `_hover` rule and a `_disabled` rule have equal specificity.

**`cx` joins class names; it does not merge styles.** Two atomic classes setting the same
property have the same specificity, so the winner is whichever Panda emitted later — a
coincidence, not a decision. `cx(buttonStyle({ size: 'sm' }), css({ px: '2' }))` is a bug
waiting for a stylesheet reorder. Either add a variant to the recipe, or merge the objects
first with `css(a.raw?.() ?? a, b)` / `css(styleObject, override)` so one rule is emitted.
`cx` is fine when the classes touch disjoint properties — that is the only safe case.

### Checking that CSS was actually emitted

Because a wrong shape produces no error, verify rather than assume:

```bash
cd mapsy-frontend && npx panda cssgen --outfile /tmp/check.css
grep -c 'colors-accent-hover' /tmp/check.css
```

Worth doing after adding a token group, a keyframe, an arbitrary selector
(`'&[data-state=open]'`, `'[data-open] &'`), or anything with a vendor prefix.

### Color and dark mode

- The PRD specifies dark mode **follows the system setting** with no manual toggle. Implement it
  with the `_dark` condition on semantic tokens, defined once in config — not with per-component
  conditionals scattered through the tree.
- Define semantic tokens for UI chrome (`bg`, `bg.subtle`, `fg`, `fg.muted`, `border`, `accent`)
  so a component never names a raw color. A component that says `color: 'gray.700'` is a
  component that will be wrong in dark mode.
- The **16-color clothing palette** from the PRD (블랙 · 화이트 · 그레이 · 베이지 · 브라운 ·
  네이비 · 블루 · 스카이 · 그린 · 카키 · 옐로우 · 오렌지 · 레드 · 핑크 · 퍼플 · 멀티/패턴) is
  **domain data, not theme chrome**. It renders as swatch dots on item cards and in the filter
  sheet, and those hexes must stay identical in light and dark — a beige garment is beige in
  both. Keep them in a separate, non-semantic token group (e.g. `colors.swatch.*`) so nobody
  accidentally gives them a `_dark` variant.

### Responsive

mapsy is mobile-first (360px and up; desktop is the same layout centered with a max width).
Write base styles for mobile and add breakpoints upward — `css({ p: '4', md: { p: '6' } })`.
Avoid desktop-first `max-width` queries; they invert the mental model for every later reader.

## Keeping this file honest

If you fetch the docs and find that something here is outdated — a renamed API, a changed
default, a pattern that no longer exists — fix this file in the same change. The routing table
and the conventions are the only parts that live here; everything factual about Panda itself
should be reachable through a fetch rather than restated, so that this file has very little
surface area on which to rot.
