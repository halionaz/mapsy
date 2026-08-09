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
 * from outside TypeScript. It should be unreachable, and if it ever runs, a
 * thrown error is the honest outcome rather than a screen rendering nothing.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`)
}
