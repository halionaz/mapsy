/**
 * Closes a chain of cases so the compiler counts them.
 *
 * A `?:` chain ending in a bare `else` accepts a new member of the union in
 * silence — it simply falls through to whatever the last branch happened to be.
 * That is fine when the last branch is a genuine default and wrong when it is
 * one case among equals, which is the usual situation: the wardrobe's five
 * screen states each draw something different and each say something different,
 * and a sixth added later would quietly have drawn the grid and announced a
 * count for it.
 *
 * Ending the chain here makes the union exhaustive by type: `value` is narrowed
 * to `never` only if every case was named, so adding one stops the build.
 *
 * The throw is for the boundary the types do not cover — a value that arrived
 * from outside TypeScript, parsed from JSON or handed over by an API. Where the
 * union is computed locally, as the wardrobe's screen state is, it is plain dead
 * code and that is fine: the compile error is the whole product.
 *
 * What a throw actually costs is worth knowing before reaching for this at a
 * real boundary. React unmounts the tree when a render throws, so the visible
 * result is whatever catches it — `app/ErrorBoundary` in this app, which draws a
 * failure with a way out. Without that boundary it would be a white page, which
 * is worse than any wrong screen.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`)
}
